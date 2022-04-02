const customPlugin = require("./customPlugin");

module.exports = {
  branches: [
    { name: "main", channel: "next" },
    { name: "release/*", channel: "latest" },
    { name: "feature/*", prerelease: true },
    { name: "fix/*", prerelease: true },
  ],
  plugins: [
    // "@semantic-release/commit-analyzer",
    customPlugin
    // "@semantic-release/release-notes-generator",
    // "@semantic-release/npm",
    // "@semantic-release/git",
  ],
};
