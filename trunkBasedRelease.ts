const childProcess = require("child_process");
const util = require("util");
const semver = require('semver');
const { name: PACKAGE_NAME } = require("./package.json");

type BranchName = string;
type BuildName = string;
type BuildId = string;
type Environment = string;
type Commit = string;

const TEST_ENV = "test";
const STAGING_ENV = "staging";
const LIVE_ENV = "live";

const MAJOR_BUMP = "major";
const MINOR_BUMP = "minor";
const PATCH_BUMP = "patch";

type BumpType = typeof MAJOR_BUMP | typeof MINOR_BUMP | typeof PATCH_BUMP;

const execAsync = util.promisify(childProcess.exec);
const executeAsyncCommand = async (command: string): Promise<string> => (await execAsync(command)).stdout.toString().trim();

type CheckReleaseScenario = (options: {
    branchName: BranchName;
    environment?: Environment;
}) => boolean;

const checkAlphaScenario: CheckReleaseScenario = ({ branchName }) => /(fix|feature)\/.*$/.test(branchName);
const checkBetaScenario: CheckReleaseScenario = ({ branchName }) => /main$/.test(branchName);
const checkConsumerScenario: CheckReleaseScenario = ({ branchName, environment = TEST_ENV }) => /release\/.*$/.test(branchName) && environment === LIVE_ENV;

const createBumpVersionSegmentHook = (bumpType: BumpType) => (currentType: BumpType, currentVersion: number) => bumpType === currentType ? currentVersion + 1 : currentVersion;

const getGitLatestTag = async (regex: RegExp) => (
    (await executeAsyncCommand("git tag --list") ?? "")
        .split("\n")
        .reverse()
        .find(tag => regex.test(tag))
);

type getCommitsFromRangeOptions = {
    start: string;
    end: string;
};

const getCommitsFromRange = async (options?: getCommitsFromRangeOptions) => {
    const { start, end } = options ?? {};
    const range = (start && end && `${start}..${end}`) || "";
    return (await executeAsyncCommand(`git log --oneline --pretty=format:%s ${range}`) ?? "")
        .split("\n");
};

const parseBumpTypeFromCommits = (commits: Commit[]) => {
    type Accumulator = Record<string, boolean>;
    const reducer = (acc: Accumulator, commit: Commit) => ({
        ...acc,
        [(
            (/(fix|feat)!:/.test(commit) && MAJOR_BUMP) ||
            (/feat:/.test(commit) && MINOR_BUMP) ||
            (/fix:/.test(commit) && PATCH_BUMP)
        ) as string]: true
    });
    const { major, minor, patch } = commits.reduce(reducer, {} as Accumulator);

    return (
        (major && MAJOR_BUMP) ||
        (minor && MINOR_BUMP) ||
        PATCH_BUMP
    );
};

const getLatestConsumerRelease = async () => {
    const distTags = await executeAsyncCommand(`npm view ${PACKAGE_NAME} dist-tags --json`);
    return JSON.parse(distTags).latest;
};

type PublishPackageOptions = {
    nextVersion: string;
    nextTag: string;
    distTag: string;
    publishMessage: string;
};

const publishPackage = async ({ nextVersion, nextTag, distTag, publishMessage }: PublishPackageOptions) => {
    await executeAsyncCommand(`npm version ${nextVersion} --git-tag-version=false`);
    await executeAsyncCommand(`npm publish ./ --tag="${distTag}"`);
    await executeAsyncCommand(`git tag --annotate ${nextTag} --message="${publishMessage}"`);
    await executeAsyncCommand(`git push origin ${nextTag}`);
};

type CreateReleaseVersion = (options: {
    branchName: BranchName;
    buildName: BuildName;
    buildId: BuildId;
}) => Promise<PublishPackageOptions>;

const createAlphaVersion: CreateReleaseVersion = async (options) => {
    const { buildName, buildId } = options;
    const nextVersion = `0.0.0-alpha-${buildName}-${buildId}`;
    const nextTag = `v${nextVersion}`;
    const distTag = "alpha";
    const publishMessage = `publish @${distTag} release ${nextTag}`;

    return { nextVersion, nextTag, distTag, publishMessage };
};

const createBetaVersion: CreateReleaseVersion = async (options) => {
    const { buildId } = options;
    const nextVersion = `0.0.0-beta-${buildId}`;
    const nextTag = `v${nextVersion}`;
    const distTag = "beta";
    const publishMessage = `publish @${distTag} release ${nextTag}`;

    return { nextVersion, nextTag, distTag, publishMessage };
};

const createConsumerVersion: CreateReleaseVersion = async (options) => {
    const { branchName, buildName } = options;
    const prevReleaseTag = (await getGitLatestTag(new RegExp(`-latest-${buildName}`)));
    const mergeBaseSha = !prevReleaseTag && await executeAsyncCommand(`git merge-base main ${branchName}`);
    const commits = (
        (prevReleaseTag && await getCommitsFromRange({ start: prevReleaseTag, end: "HEAD"})) ||
        (mergeBaseSha && await getCommitsFromRange({ start: `${mergeBaseSha}^`, end: "HEAD"})) ||
        await getCommitsFromRange()  
    );
    const bumpType = await parseBumpTypeFromCommits(commits);
    const bumpVersionSegment = createBumpVersionSegmentHook(bumpType);
    const lastVersion = await getLatestConsumerRelease();
    const  {major, minor, patch } = semver.coerce(lastVersion);
    const nextVersion = (
        bumpVersionSegment(MAJOR_BUMP, major) + `.` +
        bumpVersionSegment(MINOR_BUMP, minor) + `.` +
        bumpVersionSegment(PATCH_BUMP, patch)
    );
    const nextTag = `v${nextVersion}-latest-${buildName}`
    const distTag = "latest";
    const publishMessage = `publish beta @${distTag} release ${nextTag}`;

    return { nextVersion, nextTag, distTag, publishMessage };
};

type ReleaseScenario = {
    checkScenario: CheckReleaseScenario;
    createVersion: CreateReleaseVersion;
    publishPackage: typeof publishPackage;
};

const RELEASE_SCENARIOS: ReleaseScenario[] = [
    { checkScenario: checkAlphaScenario, createVersion: createAlphaVersion, publishPackage },
    { checkScenario: checkBetaScenario, createVersion: createBetaVersion, publishPackage },
    { checkScenario: checkConsumerScenario, createVersion: createConsumerVersion, publishPackage },
];

type ReleaseProjectOptions = {
    branchName: BranchName;
    buildName: BuildName;
    buildId: BuildId;
    environment: Environment;
}
export const releaseProject = async (options: ReleaseProjectOptions) => {
    const { branchName, buildName, buildId, environment } = options;
    const releaseScenario = RELEASE_SCENARIOS.find(({ checkScenario }) => checkScenario({ branchName, environment }));
    if (releaseScenario) {
        const releaseVersion = await releaseScenario.createVersion({ branchName, buildName, buildId });
        await releaseScenario.publishPackage(releaseVersion);
    }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


// Example usage:
// --------------
// All of these references will come from your CI pipeline.
releaseProject({
    branchName: "release/four",
    buildName: "release-four",
    buildId: Math.floor(Math.random() * 100000) + "", // 5 digit string.
    environment: LIVE_ENV
});
