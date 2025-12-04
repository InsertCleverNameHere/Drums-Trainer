/**
 * @fileoverview Generates CHANGELOG.md from git commit history.
 *
 * Groups commits by type (breaking changes, features, fixes) and prepends
 * to existing CHANGELOG.md. Includes link to GitHub Pages deployment.
 *
 * @module scripts/generate-changelog
 */

const { execSync } = require("child_process");
const fs = require("fs");

try {
  const version = JSON.parse(fs.readFileSync("commits.json", "utf8")).version;
  const date = new Date().toISOString().split("T")[0];

  console.log(`📝 Generating changelog for ${version}...`);

  // Get commits since last tag (or all if no tags exist)
  let commits;
  try {
    const lastTag = execSync("git describe --tags --abbrev=0 2>/dev/null")
      .toString()
      .trim();

    commits = execSync(`git log ${lastTag}..HEAD --oneline`)
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);

    console.log(`  Found ${commits.length} commits since ${lastTag}`);
  } catch {
    // No previous tags, get all commits
    commits = execSync("git log --oneline")
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);

    console.log(`  Found ${commits.length} commits (no previous tags)`);
  }

  // Group commits by type
  const breaking = commits.filter((c) => /MAJOR:|BREAKING:/i.test(c));
  const features = commits.filter((c) => /MINOR:|feat:/i.test(c));
  const fixes = commits.filter((c) => /PATCH:|fix:/i.test(c));
  const chores = commits.filter((c) => /chore:|NONE:/i.test(c));

  // Build changelog entry
  let changelog = `# Changelog\n\n`;
  changelog += `## [${version}] - ${date}\n\n`;

  if (breaking.length) {
    changelog += "### 💥 Breaking Changes\n\n";
    breaking.forEach((c) => {
      const msg = c.substring(c.indexOf(" ") + 1); // Remove commit hash
      changelog += `- ${msg}\n`;
    });
    changelog += "\n";
  }

  if (features.length) {
    changelog += "### ✨ Features\n\n";
    features.forEach((c) => {
      const msg = c.substring(c.indexOf(" ") + 1);
      changelog += `- ${msg}\n`;
    });
    changelog += "\n";
  }

  if (fixes.length) {
    changelog += "### 🐛 Fixes\n\n";
    fixes.forEach((c) => {
      const msg = c.substring(c.indexOf(" ") + 1);
      changelog += `- ${msg}\n`;
    });
    changelog += "\n";
  }

  if (chores.length) {
    changelog += "### 🧹 Chores\n\n";
    chores.forEach((c) => {
      const msg = c.substring(c.indexOf(" ") + 1);
      changelog += `- ${msg}\n`;
    });
    changelog += "\n";
  }

  // Add deployment link
  changelog += `**[View Live App](https://insertclevernamehere.github.io/Drums-Trainer/)**\n\n`;
  changelog += `---\n\n`;

  // Prepend to existing CHANGELOG.md (or create new)
  let existingChangelog = "";
  if (fs.existsSync("CHANGELOG.md")) {
    existingChangelog = fs.readFileSync("CHANGELOG.md", "utf8");

    // Remove duplicate "# Changelog" header
    existingChangelog = existingChangelog.replace(/^# Changelog\n\n/, "");
  }

  fs.writeFileSync("CHANGELOG.md", changelog + existingChangelog);
  console.log(`✅ Generated CHANGELOG.md for ${version}`);
} catch (error) {
  console.error("❌ Error generating changelog:", error.message);

  // Create minimal changelog on error (don't fail workflow)
  const version = JSON.parse(fs.readFileSync("commits.json", "utf8")).version;
  const date = new Date().toISOString().split("T")[0];

  const fallbackChangelog = `# Changelog\n\n## [${version}] - ${date}\n\n- Release ${version}\n\n`;

  if (fs.existsSync("CHANGELOG.md")) {
    const existing = fs
      .readFileSync("CHANGELOG.md", "utf8")
      .replace(/^# Changelog\n\n/, "");
    fs.writeFileSync("CHANGELOG.md", fallbackChangelog + existing);
  } else {
    fs.writeFileSync("CHANGELOG.md", fallbackChangelog);
  }

  console.log("⚠️ Created minimal changelog due to error");
  process.exit(0); // Don't fail the workflow
}
