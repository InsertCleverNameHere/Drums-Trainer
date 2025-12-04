/**
 * @fileoverview Version bump script - reads bump type from .bump-type file
 * and updates commits.json and service-worker.js accordingly.
 *
 * Replaces the old versioningMode.json system with commit-message-based versioning.
 *
 * @module scripts/bump-version
 */

const fs = require("fs");
const { execSync } = require("child_process");

const commitsPath = "./commits.json";
const swTemplatePath = "./service-worker-template.js";
const finalSwPath = "./service-worker.js";

try {
  // Read current version and hash
  const { latestHash: currentHash, version: currentVersion } = JSON.parse(
    fs.readFileSync(commitsPath, "utf8")
  );

  // Read bump type from parse-commit.js output
  let bumpType = "patch";
  let customVersion = null;

  if (fs.existsSync(".bump-type")) {
    const bumpData = JSON.parse(fs.readFileSync(".bump-type", "utf8"));
    bumpType = bumpData.bumpType;
    customVersion = bumpData.customVersion;
  } else {
    console.warn("⚠️ .bump-type not found, defaulting to patch");
  }

  // Get latest Git commit hash
  const latestHash = execSync("git rev-parse HEAD").toString().trim();

  // Exit early if mode is 'none' or hash unchanged
  if (bumpType === "none") {
    console.log("✅ No version bump (NONE keyword)");
    process.exit(0);
  }

  if (latestHash === currentHash) {
    console.log("✅ No version bump (hash unchanged)");
    process.exit(0);
  }

  let newVersion;

  // Handle custom version override
  if (bumpType === "custom" && customVersion) {
    newVersion = `v${customVersion}`;
    console.log(`🎯 Custom version override: ${newVersion}`);
  } else {
    // Parse and bump version (existing logic)
    const [x, y, z] = currentVersion.replace("v", "").split(".").map(Number);

    switch (bumpType) {
      case "major":
        newVersion = `v${x + 1}.0.0`;
        break;
      case "minor":
        newVersion = `v${x}.${y + 1}.0`;
        break;
      case "reset":
        newVersion = `v${x}.0.0`;
        break;
      case "resetminor":
        newVersion = `v${x}.${y}.0`;
        break;
      case "patch":
      default:
        newVersion = `v${x}.${y}.${z + 1}`;
        break;
    }

    console.log(
      `🔄 Version bumped from ${currentVersion} to ${newVersion} (${bumpType})`
    );
  }

  // Write updated version to commits.json
  fs.writeFileSync(
    commitsPath,
    JSON.stringify({ latestHash, version: newVersion }, null, 2)
  );

  // Update service worker
  try {
    const swTemplate = fs.readFileSync(swTemplatePath, "utf8");
    const finalSwContent = swTemplate.replace("__APP_VERSION__", newVersion);
    fs.writeFileSync(finalSwPath, finalSwContent);
    console.log(`✅ Updated service-worker.js with version ${newVersion}`);
  } catch (err) {
    console.error(`❌ Error updating service worker: ${err.message}`);
    process.exit(1);
  }

  // Output for GitHub Actions (optional)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${newVersion.replace("v", "")}\n`
    );
  }

  // Clean up temp file
  if (fs.existsSync(".bump-type")) {
    fs.unlinkSync(".bump-type");
  }
} catch (error) {
  console.error("❌ Error bumping version:", error.message);
  process.exit(1);
}
