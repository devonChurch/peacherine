// https://www.npmjs.com/package/semver
// semver.coerce('42.6.7.9.3-alpha') // '42.6.7'


const childProcess = require("child_process");
const util = require("util");
const semver = require('semver')

const execAsync = util.promisify(childProcess.exec);

const executeAsyncCommand = async (command) => (await execAsync(command)).stdout.toString().trim();

const getCurrentBranchName = async () => executeAsyncCommand("git branch --show-current");

const getGitTags = async (regex) => {
    const tags = await executeAsyncCommand("git tag --list");
    return (tags ?? "")
        .split("\n")
        .find(tag => regex.test(tag))
        // .sort((next, prev) => semver.gt(next, prev) ? 1 : -1)
        // .slice(-1)[0];
    // return (tags ?? "").split("\n").reverse().find(tag => regex.test(tag));
};

const alphaRelease = {
    getName: () => "alphaRelease",
    checkScenario: ({ branchName }) => /(fix|feature)\/.*$/.test(branchName),
    createSemVer: ({ buildName, buildId, gitTags }) => {
        // `0.0.0-alpha-${buildName}-${buildId}`
    }
};

const betaRelease = {
    getName: () => "betaRelease",
    checkScenario: ({ branchName }) => /main$/.test(branchName),
    // getLastVersion: async () => {
    getLastTag: async () => {
        return (await getGitTags(/-beta-/)).slice(-1)[0];
        // git tag v1.3.0-beta-1a2b3c
        // return semver.coerce(lastTag ?? "1.0.0");
    },
    getCommitsToCompare: ({ start, end }) => {
        await getGitTags(`git log --oneline --pretty=format:%h${DELIMITER}%cI ${start}..${end}`);
    },
    createSemVer: ({ buildName, buildId, gitTags }) => {
        const lastTag = await this.getLastTag();
        console.log("lastTag", lastTag);

        const commits = getCommitsToCompare({ start: lastTag, end: branch})


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
    // getLastVersion: async () => {
    getLastTag: async ({ buildName }) => {
        const regex = new RegExp(buildName)
        return await getGitTags(regex);
        // (new RegExp("foo-bar")).test("v1.2.3-foo-bar-1a2b3c")
        // const lastTag = await getGitTags(/^v\d*\.\d*\.\d*$/);
        // return semver.coerce(lastTag);
        // const lastTag = await getGitTags(/xxxxxx/);
        // return semver.coerce(lastTag);
    },
    
    createSemVer: ({ buildName, buildId, gitTags }) => {
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



// const getGitTags = async (regex) => (await executeAsyncCommand("git tag --list"))
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
    const gitTags = "xxxxx"; // git tags >> .trim().split("\n").filter(xxx => xxx.trim());
    const branchName = await getCurrentBranchName();
    const buildName = "xxxx-xxxx";
    const buildId = "1a2b3c4d5e6f";
    const environment = "test";

    console.log("branchName", branchName);

    // What type of release is this?
    const releaseScenario = RELEASE_SCENARIOS.find(({ checkScenario }) => checkScenario({ branchName, environment }));
    const releaseVersion = releaseScenario.createSemVer({ branchName, buildName, buildId, gitTags });
    console.log("releaseScenario", releaseScenario.getName());
    
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