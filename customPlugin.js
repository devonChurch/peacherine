
/**
 * Called by semantic-release during the verification step
 * @param {*} pluginConfig The semantic-release plugin config
 * @param {*} context The context provided by semantic-release
 */
async function verifyConditions(pluginConfig, context) {
    console.log("\n\n\n");
    console.log("custom plugin | verifyConditions");
    console.log("\n", pluginConfig, "\n");
    console.log("\n", context, "\n");
    console.log("\n\n\n");
}

async function analyzeCommits(...args) {
    console.log("\n\n\n");
    console.log("custom plugin | analyzeCommits");
    console.log("\n", args, "\n");
    console.log("\n\n\n");
}

module.exports = { analyzeCommits };