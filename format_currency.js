const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace id-ID locale string
  content = content.replace(/\.toLocaleString\('id-ID'/g, ".toLocaleString('en-US'");

  // Replace hardcoded $ with Rp
  content = content.replace(/\$([0-9,.]+)/g, 'Rp $1');

  // Specific text replacement
  content = content.replace('greater than $0', 'greater than Rp 0');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('./src');
