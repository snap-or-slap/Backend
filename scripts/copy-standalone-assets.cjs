const fs = require('fs');
const path = require('path');

const root = process.cwd();

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) {
    console.log(`[copy-standalone-assets] Skip missing: ${source}`);
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
  console.log(`[copy-standalone-assets] Copied: ${source} -> ${target}`);
}

const standaloneNextDir = path.join(root, '.next', 'standalone', '.next');

fs.mkdirSync(standaloneNextDir, { recursive: true });

copyIfExists(
  path.join(root, '.next', 'static'),
  path.join(standaloneNextDir, 'static'),
);

copyIfExists(
  path.join(root, 'public'),
  path.join(root, '.next', 'standalone', 'public'),
);
