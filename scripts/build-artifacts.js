/**
 * @fileoverview Builds user and dev artifacts for deployment.
 *
 * - User artifact: Debloated production build (no tests, docs, dev tools)
 * - Dev artifact: Full codebase with all development resources
 *
 * Both artifacts are zipped for GitHub Releases.
 *
 * @module scripts/build-artifacts
 */

const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");

// Files to include in user artifact (production)
const userFiles = [
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
  "commits.json",
  "favicon.ico",
  "js",
  "css",
  "libs",
  "assets",
  "LICENSE",
  "THIRD_PARTY_LICENSES.md",
];

// Files/folders to exclude from dev artifact
const devExcludes = [
  "node_modules",
  ".git",
  "dist",
  ".vscode/chrome-debug-profile",
  ".vscode/edge-debug-profile",
  ".vscode/firefox-debug-profile",
  ".bump-type", // Temp file from parse-commit.js
];

async function buildArtifacts() {
  console.log("🏗️ Building artifacts...");

  try {
    // Clean dist folder
    await fs.remove("dist");
    await fs.ensureDir("dist/user");
    await fs.ensureDir("dist/dev");

    // ===========================
    // Copy USER artifact (debloated)
    // ===========================
    console.log("📦 Copying user artifact...");
    for (const file of userFiles) {
      const src = path.join(process.cwd(), file);
      const dest = path.join("dist/user", file);

      if (await fs.pathExists(src)) {
        await fs.copy(src, dest);
        console.log(`  ✓ ${file}`);
      } else {
        console.warn(`  ⚠️ ${file} not found, skipping`);
      }
    }

    // ===========================
    // Copy DEV artifact (full codebase)
    // ===========================
    console.log("📦 Copying dev artifact...");
    const allFiles = await fs.readdir(".");
    for (const file of allFiles) {
      if (devExcludes.includes(file)) {
        console.log(`  ⏭️ Skipping ${file}`);
        continue;
      }

      const src = path.join(process.cwd(), file);
      const dest = path.join("dist/dev", file);
      await fs.copy(src, dest);
      console.log(`  ✓ ${file}`);
    }

    // ===========================
    // Create ZIP archives
    // ===========================
    console.log("📦 Creating ZIP archives...");

    // User artifact ZIP
    await createZip("dist/user", "dist/user.zip");
    console.log("  ✅ dist/user.zip created");

    // Dev artifact ZIP
    await createZip("dist/dev", "dist/dev.zip");
    console.log("  ✅ dist/dev.zip created");

    console.log("✅ Artifacts built successfully!");
    console.log("   - dist/user/ (debloated)");
    console.log("   - dist/dev/ (full)");
    console.log("   - dist/user.zip");
    console.log("   - dist/dev.zip");
  } catch (error) {
    console.error("❌ Error building artifacts:", error.message);
    process.exit(1);
  }
}

/**
 * Creates a ZIP archive from a directory.
 *
 * @param {string} sourceDir - Source directory to zip
 * @param {string} outputPath - Output ZIP file path
 * @returns {Promise<void>}
 */
function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Run if called directly
if (require.main === module) {
  buildArtifacts();
}

module.exports = { buildArtifacts };
