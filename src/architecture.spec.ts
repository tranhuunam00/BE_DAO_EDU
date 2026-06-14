import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

describe('Application architecture boundaries', () => {
  it('keeps the domain independent from frameworks and outer layers', () => {
    const files = listTypeScriptFiles(join(__dirname, 'domain'));

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/from ['"]@nestjs/);
      expect(source).not.toMatch(/from ['"]typeorm['"]/);
      expect(source).not.toMatch(/\/application\//);
      expect(source).not.toMatch(/\/infrastructure\//);
      expect(source).not.toMatch(/\/presentation\//);
    }
  });

  it('keeps the composition root free of feature implementation details', () => {
    const source = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');

    expect(source).not.toMatch(/TypeOrmModule|JwtModule|ConfigModule/);
    expect(source).not.toMatch(/OrmEntity|Repository|UseCase/);
    expect(source).not.toMatch(/presentation\/controllers/);
  });

  it('keeps application use cases independent from storage adapters', () => {
    const files = listTypeScriptFiles(join(__dirname, 'application/use-cases'));

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/infrastructure\/storage/);
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
