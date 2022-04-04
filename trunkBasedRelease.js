const childProcess = require("child_process");
const util = require("util");
const semver = require('semver');
const { name: PACKAGE_NAME } = require("./package.json");

const execAsync = util.promisify(childProcess.exec);
const executeAsyncCommand = async (command) => (await execAsync(command)).stdout.toString().trim();

const getGitLatestTag = async (regex) => (
    (await executeAsyncCommand("git tag --list") ?? "")
        .split("\n")
        .reverse()
        .find(tag => regex.test(tag))
);

const getCommitsToCompare = async ({ start, end }) => {
    const range = (start && end && `${start}..${end}`) || "";
    return executeAsyncCommand(`git log --oneline --pretty=format:%s ${range}`);
};

const parseBumpTypeFromCommits = (commits) => {
    const accumulator = { major: false, minor: false, patch: false }
    const reducer = (acc, commit) => ({
        ...acc,
        [(
            (/(fix|feat)!:/.test(commit) && "major") ||
            (/feat:/.test(commit) && "minor") ||
            (/fix:/.test(commit) && "patch")
        )]: true
    });
    const { major, minor, patch } = commits.split("\n").reduce(reducer, accumulator);

    return (
        (major && "major") ||
        (minor && "minor") ||
        "patch"
    );
};

const getLatestConsumerRelease = async () => {
    const distTags = await executeAsyncCommand(`npm view ${PACKAGE_NAME} dist-tags --json`);
    return JSON.parse(distTags).latest;
};

const publishPackage = async ({ nextVersion, nextTag, distTag, publishMessage }) => {
    await executeAsyncCommand(`npm version ${nextVersion} --git-tag-version=false`);
    await executeAsyncCommand(`npm publish ./ --tag="${distTag}"`);
    await executeAsyncCommand(`git tag --annotate ${nextTag} --message="${publishMessage}"`);
    await executeAsyncCommand(`git push origin ${nextTag}`);
};

const alphaRelease = {
    checkScenario: ({ branchName }) => /(fix|feature)\/.*$/.test(branchName),
    createSemVer: async ({ buildName, buildId }) => {
        const nextVersion = `0.0.0-alpha-${buildName}-${buildId}`;
        const nextTag = `v${nextVersion}`;
        const distTag = "alpha";
        const publishMessage = `publish @${distTag} release ${nextTag}`;

        await publishPackage({ nextVersion, nextTag, distTag, publishMessage });
    }
};

const betaRelease = {
    checkScenario: ({ branchName }) => /main$/.test(branchName),
    createSemVer: async ({ buildId }) => {
        const nextVersion = `0.0.0-beta-${buildId}`;
        const nextTag = `v${nextVersion}`;
        const distTag = "beta";
        const publishMessage = `publish @${distTag} release ${nextTag}`;

        await publishPackage({ nextVersion, nextTag, distTag, publishMessage });
    }
};

const consumerRelease = {
    checkScenario: ({ branchName, environment }) => /release\/.*$/.test(branchName) && environment === "live",
    createSemVer: async ({ branchName, buildName }) => {
        const prevReleaseTag = (await getGitLatestTag(new RegExp(`-latest-${buildName}`)));
        const mergeBaseSha = !prevReleaseTag && await executeAsyncCommand(`git merge-base main ${branchName}`);
        const commits = (
            (prevReleaseTag && await getCommitsToCompare({ start: prevReleaseTag, end: "HEAD"})) ||
            (mergeBaseSha && await getCommitsToCompare({ start: `${mergeBaseSha}^`, end: "HEAD"})) ||
            await getCommitsToCompare()
        );
        const bumpType = await parseBumpTypeFromCommits(commits);
        const lastVersion = await getLatestConsumerRelease();
        const  {major, minor, patch } = semver.coerce(lastVersion);
        const bumpVersionSegment = (type, current) => bumpType === type ? current + 1 : current;
        const nextVersion = (
            bumpVersionSegment("major", major) +
            `.` +
            bumpVersionSegment("minor", minor) +
            `.` +
            bumpVersionSegment("patch", patch)
        );
        const nextTag = `v${nextVersion}-latest-${buildName}`
        const distTag = "latest";
        const publishMessage = `publish beta @${distTag} release ${nextTag}`;

        await publishPackage({ nextVersion, nextTag, distTag, publishMessage });
    }
};

const RELEASE_SCENARIOS = [
    alphaRelease,
    betaRelease,
    consumerRelease,
];

module.exports = releaseProject = async ({ branchName, buildName, buildId, environment }) => {
    const releaseScenario = RELEASE_SCENARIOS.find(({ checkScenario }) => checkScenario({ branchName, environment }));
    await releaseScenario.createSemVer({ branchName, buildName, buildId });
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


// Example usage:
// --------------
// All of these references will come from your CI pipeline.
releaseProject({
    branchName: "release/four",
    buildName: "release-four",
    buildId: Math.floor(Math.random() * 100000) + "", // 5 digit string.
    environment: "live"
});
