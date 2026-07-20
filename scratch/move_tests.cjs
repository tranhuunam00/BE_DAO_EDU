const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const testUnitDir = path.join(rootDir, 'test', 'unit');

function getSpecFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getSpecFiles(filePath, fileList);
    } else if (file.endsWith('.spec.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const specFiles = getSpecFiles(srcDir);
console.log(`Found ${specFiles.length} spec files to move.`);

specFiles.forEach((oldSpecPath) => {
  const relPath = path.relative(srcDir, oldSpecPath);
  const newSpecPath = path.join(testUnitDir, relPath);
  const newSpecDir = path.dirname(newSpecPath);
  const oldSpecDir = path.dirname(oldSpecPath);

  fs.mkdirSync(newSpecDir, { recursive: true });

  const content = fs.readFileSync(oldSpecPath, 'utf8');

  // Replace relative imports
  const updatedContent = content.replace(
    /(from\s+['"]|import\s*\(\s*['"])([\.\/][^'"]+)(['"])/g,
    (match, prefix, importPath, suffix) => {
      if (!importPath.startsWith('.')) return match;

      const absImportPath = path.resolve(oldSpecDir, importPath);
      let newRel = path.relative(newSpecDir, absImportPath).replace(/\\/g, '/');
      if (!newRel.startsWith('.')) {
        newRel = './' + newRel;
      }
      return `${prefix}${newRel}${suffix}`;
    }
  );

  fs.writeFileSync(newSpecPath, updatedContent, 'utf8');
  fs.unlinkSync(oldSpecPath);
});

console.log(`Successfully moved ${specFiles.length} files to test/unit/!`);
