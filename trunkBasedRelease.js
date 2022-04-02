// https://www.npmjs.com/package/semver
// semver.coerce('42.6.7.9.3-alpha') // '42.6.7'



const betaRelease = {
    checkScenario: ({ branchName }) => {
        // /[fix|feature]\/*/
    },
    createSemVer: ({ buildName, buildId, gitTags }) => {
        // `0.0.0-beta-${buildName}-${buildId}`
    }
};

const nextRelease = {
    checkScenario: ({ branchName }) => {
        // /main/
    },
    createSemVer: ({ buildName, buildId, gitTags }) => {
        // Get last "next" tag
        // find commit between last tag and HEAD
        // Parse them
        // find Major, Minor, Patch
        // Make Bump

        // `0.0.0-next-${buildId}`
    }
};

const releaseCandidate = {
    checkScenario: ({ branchName, environment }) => {
        // /release\/*/,
        // Test | Staging <---- do we actually need one for staging
    },
    createSemVer: ({ buildName, buildId, gitTags }) => {
        // Get last "rc" tag matching this build name
            // ^ for Hotfix scenario
            // Otherwise Get last "next" tag
        // find commit between last tag and HEAD
        // Parse them
        // find Major, Minor, Patch
        // Make Bump

        // `1.0.1-rc-${buildName}-${buildId}-${major|minor|patch}`
    }
};

const consumerRelease = {
    checkScenario: ({ branchName, environment }) => {
        // /release\/*/,
        // Live
    },
    createSemVer: ({ buildName, buildId, gitTags }) => {
        // Get last "rc" tag matching this build name
        // Strip to consumer SemVer
        // `1.0.1`
    }
};


const RELEASE_SCENARIOS = [
    betaRelease,
    nextRelease,
    releaseCandidate, // <--- Maybe don't have this?
    consumerRelease,
];


const releaseProject = () => {
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
    const branchName = "xxxx/xxxx";
    const buildName = "xxxx-xxxx";
    const buildId = "1a2b3c4d5e6f";

    // What type of release is this?
    const releaseScenario = RELEASE_SCENARIOS.find(({ checkScenario }) => checkScenario({ branchName, environment }));
    const releaseVersion = releaseScenario.createSemVer({ buildName, buildId, gitTags });

    // Create next release version

    // Publish release
    // npm publish --tag <tag>
    // npm publish --tag next
    // npm publish --tag latest

    // Push tags
    // Use annotated tags!
    // Do we have permissions to push back to Github from Azure?

}