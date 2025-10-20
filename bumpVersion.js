const fs = require("fs");
const { execSync } = require("child_process");

const commitsPath = "./commits.json";
const modePath = "./versioningMode.json");

// Step 1: Read current version and hash
const { latestHash: currentHash, version: currentVersion } = JSON.parse(
  fs.readFileSync(commitsPath, "utf8")
);
let mode = "patch"; // default fallback

try {
  mode = JSON.parse(fs.readFileSync(modePath, "utf8")).mode || "patch";
} catch (err) {
  console.warn("⚠️ Could not read versioningMode.json. Defaulting to 'patch'.");
}

// Step 2: Get latest Git commit hash
const latestHash = execSync("git rev-parse HEAD").toString().trim();

// ✅ Step 3: Always reset mode to 'patch'
fs.writeFileSync(modePath, JSON.stringify({ mode: "patch" }, null, 2));
console.log("🔁 Reset versioning mode to 'patch'");

// Step 4: Exit early if mode is 'none' or hash hasn't changed
if (latestHash === currentHash || mode === "none") {
  console.log("✅ No version bump. Mode:", mode);
  process.exit(0);
}

// Step 5: Parse and bump version
const [x, y, z] = currentVersion.replace("v", "").split(".").map(Number);
let newVersion;

switch (mode) {
  case "major":
    newVersion = `v${x + 1}.0.0`;
    break;
  case "minor":
    newVersion = `v${x}.${y + 1}.0`;
    break;
  case "reset":
    newVersion = `v${x}.0.0`;
    break;
  case "patch":
  default:
    newVersion = `v${x}.${y}.${z + 1}`;
    break;
}

// Step 6: Write updated version
fs.writeFileSync(
  commitsPath,
  JSON.stringify({ latestHash, version: newVersion }, null, 2)
);
console.log(`🔄 Version bumped to ${newVersion} using mode '${mode}'`);
