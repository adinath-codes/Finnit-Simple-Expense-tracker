const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const ASSET_BUDGET_BYTES = 6 * 1024 * 1024;

function directoryBytes(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const target = path.join(directory, entry.name);
    return total + (entry.isDirectory() ? directoryBytes(target) : fs.statSync(target).size);
  }, 0);
}

function formatMib(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

const assetMapPath = path.resolve(
  process.argv[2] ?? path.join(ROOT, "dist", "assetmap.json"),
);
const sourceBytes = directoryBytes(ASSETS_DIR);

console.log(`Source assets: ${formatMib(sourceBytes)}`);

if (!fs.existsSync(assetMapPath)) {
  console.error(
    `Asset map not found at ${assetMapPath}. Export with --dump-assetmap, then pass its path to this command.`,
  );
  process.exitCode = 1;
  return;
}

const assetMap = JSON.parse(fs.readFileSync(assetMapPath, "utf8"));
const projectAssets = new Set();
for (const asset of Object.values(assetMap)) {
  for (const file of asset.files ?? []) {
    const absolute = path.resolve(file);
    if (absolute.startsWith(`${ASSETS_DIR}${path.sep}`)) projectAssets.add(absolute);
  }
}

let shippedBytes = 0;
for (const file of projectAssets) shippedBytes += fs.statSync(file).size;

console.log(
  `Project-owned shipped assets: ${formatMib(shippedBytes)} across ${projectAssets.size} files`,
);
console.log(`Budget: ${formatMib(ASSET_BUDGET_BYTES)}`);

if (shippedBytes > ASSET_BUDGET_BYTES) {
  console.error(`Asset budget exceeded by ${formatMib(shippedBytes - ASSET_BUDGET_BYTES)}.`);
  process.exitCode = 1;
}
