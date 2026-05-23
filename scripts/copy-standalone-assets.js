const fs = require('fs');
const path = require('path');

const root = process.cwd();
const standaloneNextDir = path.join(root, '.next', 'standalone', '.next');
const standalonePublicDir = path.join(root, '.next', 'standalone', 'public');

fs.mkdirSync(standaloneNextDir, { recursive: true });

fs.cpSync(
  path.join(root, '.next', 'static'),
  path.join(standaloneNextDir, 'static'),
  { recursive: true },
);

if (fs.existsSync(path.join(root, 'public'))) {
  fs.cpSync(path.join(root, 'public'), standalonePublicDir, {
    recursive: true,
  });
}
