import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

describe('Payments architecture boundaries', () => {
  it('keeps domain and application independent from NestJS, TypeORM and infrastructure', () => {
    const roots = [join(__dirname, 'domain'), join(__dirname, 'application')];
    const files = roots.flatMap(listTypeScriptFiles);

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
