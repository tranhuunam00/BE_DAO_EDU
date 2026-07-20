const fs = require('fs');
const path = require('path');

const testUnitDir = path.resolve(__dirname, '../test/unit');

function findArchSpecs(dir, list = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findArchSpecs(filePath, list);
    } else if (file.endsWith('-architecture.spec.ts') || file === 'architecture.spec.ts') {
      list.push(filePath);
    }
  }
  return list;
}

const archSpecs = findArchSpecs(testUnitDir);
console.log('Arch specs found:', archSpecs);

archSpecs.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('srcDir')) {
    content = content.replace(
      /describe\(/,
      `const srcDir = __dirname.replace(/([\\\\\\/])test([\\\\\\/])unit/, '$1src');\n\ndescribe(`
    );
  }

  content = content.replace(/join\(__dirname,/g, 'join(srcDir,');
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Successfully updated architecture spec files!');
