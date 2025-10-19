// bumpVersion.js
const fs = require("fs");
const { execSync } = require("child_process");

const filePath = "./commits.json";

// Step 1: Read current commits.json
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const currentHash = data.latestHash;
const currentVersion = data.version;

// Step 2: Get latest Git commit hash
const latestHash = execSync("git rev-parse HEAD").toString().trim();

// Step 3: Compare hashes
if (latestHash === currentHash) {
  console.log("✅ No change in commit hash. Version remains:", currentVersion);
  process.exit(0);
}

// Step 4: Bump patch version (vX.Y.Z → vX.Y.(Z+1))
const versionParts = currentVersion.replace("v", "").split(".");
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = `v${versionParts.join(".")}`;

// Step 5: Write updated data back to commits.json
const updated = {
  latestHash,
  version: newVersion,
};

fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
console.log(`🔄 Commit hash changed. Version bumped to ${newVersion}`);
