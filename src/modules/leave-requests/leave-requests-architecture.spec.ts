import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

describe('Leave requests architecture boundaries', () => {
  it('keeps domain and application independent from frameworks and adapters', () => {
    const files = [
      ...listTypeScriptFiles(join(__dirname, 'domain')),
      ...listTypeScriptFiles(join(__dirname, 'application')),
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/from ['"]@nestjs/);
      expect(source).not.toMatch(/from ['"]typeorm['"]/);
      expect(source).not.toMatch(/\/infrastructure\//);
      expect(source).not.toMatch(/\/presentation\//);
    }
  });
});

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listTypeScriptFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}
