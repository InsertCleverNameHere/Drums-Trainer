const fs = require("fs");
const { execSync } = require("child_process");

const commitsPath = "./commits.json";
const modePath = "./versioningMode.json";

// Step 1: Read current version and hash
const { latestHash: currentHash, version: currentVersion } = JSON.parse(
  fs.readFileSync(commitsPath, "utf8")
);

// Step 2: Read mode
let mode = "patch"; // default fallback
try {
  mode = JSON.parse(fs.readFileSync(modePath, "utf8")).mode || "patch";
} catch (err) {
  console.warn("⚠️ Could not read versioningMode.json. Defaulting to 'patch'.");
}

// Step 3: Always reset mode to 'patch'
fs.writeFileSync(modePath, JSON.stringify({ mode: "patch" }, null, 2));
console.log("🔁 Reset versioning mode to 'patch'");

// Step 4: Get latest Git commit hash
const latestHash = execSync("git rev-parse HEAD").toString().trim();

// Step 5: Exit early if mode is 'none' or hash hasn't changed
if (latestHash === currentHash || mode === "none") {
  console.log("✅ No version bump. Mode:", mode);
  process.exit(0);
}

// Step 6: Parse and bump version
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
  case "resetmajor":
    newVersion = `v${x}.${y}.0`;
    break;
  case "patch":
  default:
    newVersion = `v${x}.${y}.${z + 1}`;
    break;
}

// Step 7: Write updated version
fs.writeFileSync(
  commitsPath,
  JSON.stringify({ latestHash, version: newVersion }, null, 2)
);
console.log(`🔄 Version bumped to ${newVersion} using mode '${mode}'`);

// Step 8: Read the service worker template
const swTemplatePath = "./service-worker-template.js";
const finalSwPath = "./service-worker.js"; // This is the file your app will actually use

try {
  const swTemplate = fs.readFileSync(swTemplatePath, "utf8");

  // Step 9: Inject the new version into the template
  const finalSwContent = swTemplate.replace("__APP_VERSION__", newVersion);

  // Step 10: Write the final service-worker.js file
  fs.writeFileSync(finalSwPath, finalSwContent);
  console.log(
    `✅ Successfully generated ${finalSwPath} with version ${newVersion}`
  );
} catch (err) {
  console.error(`❌ Error generating service worker: ${err.message}`);
  process.exit(1); // Exit with an error code so the workflow fails
}
