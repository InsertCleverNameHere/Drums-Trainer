/**
 * @fileoverview Parses the latest commit message to determine version bump type.
 * Outputs to `.bump-type` file for consumption by bump-version.js.
 *
 * Supported keywords:
 * - MAJOR: Breaking changes (X.0.0)
 * - MINOR: New features (0.Y.0)
 * - PATCH: Bug fixes (0.0.Z) [default]
 * - RESET: Reset minor/patch to zero (X.0.0)
 * - RESETMINOR: Reset patch to zero (X.Y.0)
 * - NONE: Skip version bump
 * - NEW: X.Y.Z - Override version completely
 *
 * @module scripts/parse-commit
 */

const { execSync } = require("child_process");
const fs = require("fs");

try {
  // Get the latest commit message (full message, not just first line)
  const commitMsg = execSync("git log -1 --pretty=%B").toString().trim();
  const firstLine = commitMsg.split("\n")[0].trim();

  let bumpType = "patch"; // Default to patch for any commit without keywords
  let customVersion = null;

  // Check for keywords (case-insensitive, must be at start of message)
  if (/^MAJOR:/i.test(firstLine)) {
    bumpType = "major";
    console.log("🔴 Detected MAJOR version bump (breaking changes)");
  } else if (/^MINOR:/i.test(firstLine)) {
    bumpType = "minor";
    console.log("🟡 Detected MINOR version bump (new features)");
  } else if (/^PATCH:/i.test(firstLine)) {
    bumpType = "patch";
    console.log("🟢 Detected PATCH version bump (bug fixes)");
  } else if (/^RESET:/i.test(firstLine)) {
    bumpType = "reset";
    console.log("🔄 Detected RESET (X.0.0)");
  } else if (/^RESETMINOR:/i.test(firstLine)) {
    bumpType = "resetminor";
    console.log("🔄 Detected RESETMINOR (X.Y.0)");
  } else if (/^NONE:/i.test(firstLine)) {
    bumpType = "none";
    console.log("⏭️ Detected NONE (skip version bump)");
  } else if (/^NEW:\s*(\d+\.\d+\.\d+)/i.test(firstLine)) {
    const match = firstLine.match(/^NEW:\s*(\d+\.\d+\.\d+)/i);
    customVersion = match[1];
    bumpType = "custom";
    console.log(`🎯 Detected NEW version override: ${customVersion}`);
  } else {
    console.log("🟢 No keyword detected, defaulting to PATCH");
  }

  // Write to temp file for bump-version.js
  const output = JSON.stringify({ bumpType, customVersion }, null, 2);
  fs.writeFileSync(".bump-type", output);

  console.log(
    `✅ Bump type written to .bump-type: ${bumpType}${
      customVersion ? ` (${customVersion})` : ""
    }`
  );

  // Output for GitHub Actions (optional)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `bump_type=${bumpType}\n`);
    if (customVersion) {
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `custom_version=${customVersion}\n`
      );
    }
  }
} catch (error) {
  console.error("❌ Error parsing commit message:", error.message);

  // Default to patch on error (safety fallback)
  fs.writeFileSync(
    ".bump-type",
    JSON.stringify({ bumpType: "patch", customVersion: null }, null, 2)
  );
  console.log("⚠️ Defaulting to PATCH due to error");

  process.exit(0); // Don't fail the workflow
}
