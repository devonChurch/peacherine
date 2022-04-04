// https://www.npmjs.com/package/semver
// semver.coerce('42.6.7.9.3-alpha') // '42.6.7'


const childProcess = require("child_process");
const util = require("util");
const semver = require('semver');
const { name: PACKAGE_NAME } = require("./package.json");

const execAsync = util.promisify(childProcess.exec);

const executeAsyncCommand = async (command) => (await execAsync(command)).stdout.toString().trim();

const getCurrentBranchName = async () => executeAsyncCommand("git branch --show-current");

const getGitLatestTag = async (regex) => {
    const tags = await executeAsyncCommand("git tag --list");
    return (tags ?? "")
        .split("\n")
        .reverse()
        .find(tag => regex.test(tag))
        // .sort((next, prev) => semver.gt(next, prev) ? 1 : -1)
        // .slice(-1)[0];
    // return (tags ?? "").split("\n").reverse().find(tag => regex.test(tag));
};

const getCommitsToCompare = async ({ start, end }) => {
    const range = (start && end && `${start}..${end}`) ?? "";
    return executeAsyncCommand(`git log --oneline --pretty=format:%s ${range}`);
};

const parseBumpTypeFromCommits = (commits) => {
    const accumulator = { major: false, minor: false, patch: false }
    const reducer = (acc, commit) => {
        // const key = (
        //     (/(fix|feat)!:/.test(commit) && "major") ||
        //     (/feat:/.test(commit) && "minor") ||
        //     (/fix:/.test(commit) && "patch")
        // );

        // console.log("!!! ", key, commit, acc);
        // accumulator?.[key] = true;
        return {
            ...acc,
            [(
                (/(fix|feat)!:/.test(commit) && "major") ||
                (/feat:/.test(commit) && "minor") ||
                (/fix:/.test(commit) && "patch")
            )]: true
        };
        // fix: = patch
        // feat: = minor
        // fix!: or feat!: = major
    };
    const { major, minor, patch } = commits.split("\n").reduce(reducer, accumulator);

    // console.log(">>> ", { major, minor, patch });

    return (
        (major && "major") ||
        (minor && "minor") ||
        "patch"
        // (patch && "patch") ||
        // undefined
    )

};

const getLatestConsumerRelease = async () => {

    const distTags = await executeAsyncCommand(`npm view ${PACKAGE_NAME} dist-tags --json`);
    return JSON.parse(distTags).latest;

};

const publishPackage = async ({ nextVersion, nextTag, distTag, publishMessage }) => {

    console.log("publishPackage", { nextVersion, nextTag, distTag, publishMessage });

    await executeAsyncCommand(`npm version ${nextVersion} --git-tag-version=false`);
        
    await executeAsyncCommand(`npm publish ./ ${distTag ? `--tag="${distTag}"` : ""}`);
    
    await executeAsyncCommand(`git tag --annotate ${nextTag} --message="${publishMessage}"`);
    
    await executeAsyncCommand(`git push origin ${nextTag}`);
};

const alphaRelease = {
    getName: () => "alphaRelease",
    checkScenario: ({ branchName }) => /(fix|feature)\/.*$/.test(branchName),
    // createGitTag: ({ nextVersion, buildName, buildId }) => `${nextVersion}-beta-${buildId}`,
    createSemVer: async ({ buildName, buildId }) => {
        // `0.0.0-alpha-${buildName}-${buildId}`

        const nextVersion = `0.0.0-alpha-${buildName}-${buildId}`;
        const nextTag = `v${nextVersion}`;
        const publishMessage = `publish alpha release ${nextTag}`;

        await publishPackage({ nextVersion: nextTag, nextTag, publishMessage });

        // const nextVersion = `0.0.0`;
        // // const nextTag = `0.0.0-alpha-${buildName}-${buildId}`;

        // return nextVersion;

    }
};

const betaRelease = {
    getName: () => "betaRelease",
    checkScenario: ({ branchName }) => /main$/.test(branchName),
    // createGitTag: ({ nextVersion, buildId }) => `${nextVersion}-beta-${buildId}`,
    createSemVer: async ({ buildId }) => {
        
        const nextVersion = `0.0.0-beta-${buildId}`;
        const nextTag = `v${nextVersion}`;
        const distTag = "next";
        const publishMessage = `publish beta @${distTag} release ${nextTag}`;

        await publishPackage({ nextVersion: nextTag, nextTag, distTag, publishMessage });

        
        // return nextVersion;

        // Get last "next" tag
        // find commit between last tag and HEAD
        // Parse them
        // find Major, Minor, Patch
        // Make Bump

        // `0.0.0-beta-${buildId}`
    }
};

// const releaseCandidate = {
//     checkScenario: ({ branchName, environment }) => {
//         // /release\/*/,
//         // Test | Staging <---- do we actually need one for staging
//     },
//     createSemVer: ({ buildName, buildId, gitTags }) => {
//         // Get last "rc" tag matching this build name
//             // ^ for Hotfix scenario
//             // Otherwise Get last "next" tag
//         // find commit between last tag and HEAD
//         // Parse them
//         // find Major, Minor, Patch
//         // Make Bump

//         // `1.0.1-rc-${buildName}-${buildId}-${major|minor|patch}`
//     }
// };

const consumerRelease = {
    getName: () => "consumerRelease",
    checkScenario: ({ branchName, environment }) => /release\/.*$/.test(branchName),
    // createGitTag: ({ nextVersion, buildName }) => `${nextVersion}-latest-${buildName}`,
    createSemVer: async ({ branchName, buildName }) => {

        const prevReleaseTag = (await getGitLatestTag(new RegExp(`-latest-${buildName}`)));
        console.log("prevReleaseTag", prevReleaseTag);

        // If its not there then we need to get the branch commit from main
        const mergeBaseSha = !prevReleaseTag && await executeAsyncCommand(`git merge-base main ${branchName}`);
        console.log("mergeBaseSha", mergeBaseSha);

        // const commits = await getCommitsToCompare({ start: prevReleaseTag ?? `${mergeBaseSha}^`, end: "HEAD"});
        const commits = (
            (prevReleaseTag && await getCommitsToCompare({ start: prevReleaseTag, end: "HEAD"})) ||
            (mergeBaseSha && await getCommitsToCompare({ start: `${mergeBaseSha}^`, end: "HEAD"})) ||
            await getCommitsToCompare()
        );
        console.log("commits", commits);
        
        const bumpType = await parseBumpTypeFromCommits(commits);
        console.log("bumpType", bumpType);
        
        const lastVersion = await getLatestConsumerRelease();
        console.log("lastVersion", lastVersion);

        const  {major, minor, patch } = semver.coerce(lastVersion);
        const bumpVersionSegment = (type, current) => bumpType === type ? current + 1 : current;
        // return `${bumpVersionSegment("major", major)}.${bumpVersionSegment("minor", minor)}.${bumpVersionSegment("patch", patch)}`;
        const nextVersion = (
            bumpVersionSegment("major", major) +
            `.` +
            bumpVersionSegment("minor", minor) +
            `.` +
            bumpVersionSegment("patch", patch)
            // bumpVersionSegment("patch", patch) +
            // `-latest` +
            // `-${buildName}`
        );
        console.log("nextVersion", nextVersion);


        const nextTag = `v${nextVersion}-latest-${buildName}`
        console.log("nextTag", nextTag);

        const distTag = "latest";
        const publishMessage = `publish beta @${distTag} release ${nextTag}`;

        await publishPackage({ nextVersion, nextTag, distTag, publishMessage });


        // await executeAsyncCommand(`npm version --git-tag-version=false`);


        // ADD DIST_TAG!!!!!!




        // Meta data:
            // last branch/build
            // commit sha
        // Two scenarios
            // 


        // git tag






        // Get last "rc" tag matching this build name
        // Strip to consumer SemVer
        // `1.0.1`
    }
};


const RELEASE_SCENARIOS = [
    alphaRelease,
    betaRelease,
    // releaseCandidate, // <--- Maybe don't have this?
    consumerRelease,
];



// const getGitLatestTag = async (regex) => (await executeAsyncCommand("git tag --list"))
//     .then(tags => tags.reverse().find(tag => regex.test(tag)));


// parsing commits
    // We only use title to parse
    // git log --oneline xxxxxx <----- only titles between sha's
    // ignore "revert" or "[skip ci]"
    // look for:
        // fix: = patch
        // feat: = minor
        // fix!: or feat!: = major
    // We know the latest version through `npm view [PROJECT] dist-tags --json`
        // We can bump based on that version


const releaseProject = async () => {
    // READ THIS!!!
    // No need to tags
    // we know the last "rc", "latest" release versions from NPM
    
    // "next" and "beta" dont need versions

    // when creating the "rc".... 
        // `git merge-base main release/xxxx` to get the forked commit
        // `git log --oneline xxxxxxxxx SHA release/xxxxxx` get commits
        // parse commits


    // If its a hot fix then its a patch release by default!
        // If an "rc" with the same build name already exists




    // Setup:
    // git fetch --all --tags <---- Does Azure pull down ALL tags?
    // What happens when there are NO tags!
    // git tag
    // Can regex tags
        // https://git-scm.com/docs/git-tag
    // const gitTags = "xxxxx"; // git tags >> .trim().split("\n").filter(xxx => xxx.trim());
    const branchName = await getCurrentBranchName();
    const buildName = branchName.replace(/(\/|_|\.)/g, "-");
    const buildId = `${Math.random()}`;
    const environment = "test";

    console.log("branchName", branchName);

    // What type of release is this?
    const releaseScenario = RELEASE_SCENARIOS.find(({ checkScenario }) => checkScenario({ branchName, environment }));
    console.log("releaseScenario", releaseScenario.getName());
    
    await releaseScenario.createSemVer({ branchName, buildName, buildId });
    
    // const nextVersion = await releaseScenario.createSemVer({ branchName, buildName, buildId });
    // console.log("nextVersion", nextVersion);
    
    // const nextTag = releaseScenario.createGitTag({ nextVersion, buildName, buildId });
    // console.log("nextTag", nextTag);


    // await executeAsyncCommand(`npm version --git-tag-version=false`);

    // .
    // .
    // .
    // .
    
    // const lastTag = await releaseScenario.getLastTag({ buildName });
    // console.log("lastTag", lastTag);

    // Create next release version

    // Publish release
    // npm publish --tag <tag>
    // npm publish --tag next
    // npm publish --tag latest

    // Push tags
    // Use annotated tags!
    // Do we have permissions to push back to Github from Azure?

}

// Export this...
releaseProject();