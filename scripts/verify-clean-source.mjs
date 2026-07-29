import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const sourceRoots = ['app', 'lib'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const sourceFiles = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(fullPath);
    } else if (allowedExtensions.has(extname(entry.name))) {
      sourceFiles.push(fullPath);
    }
  }
}

for (const sourceRoot of sourceRoots) {
  await collect(join(root, sourceRoot));
}

const violations = [];
for (const filePath of sourceFiles) {
  const content = await readFile(filePath, 'utf8');
  const displayPath = relative(root, filePath).replaceAll('\\', '/');

  if (/new\s+Blob\s*\(\s*\[\s*(?:bytes|pdfBytes)\s*\]/m.test(content)) {
    violations.push(`${displayPath}: passes a pdf-lib Uint8Array directly into Blob`);
  }

  if (displayPath === 'app/pdf-generator.ts' && /new\s+Blob\s*\(/m.test(content)) {
    violations.push(`${displayPath}: contains browser Blob generation; this file must only build PDF bytes`);
  }
}


const rootPagePath = join(root, 'app', 'page.tsx');
const rootPage = await readFile(rootPagePath, 'utf8');
if (!rootPage.includes("export const dynamic = 'force-dynamic'")) {
  violations.push('app/page.tsx: protected root page must be force-dynamic to prevent build-time Supabase prerendering');
}
if (!rootPage.includes('isSupabaseConfigured()')) {
  violations.push('app/page.tsx: safe Supabase configuration guard is missing');
}

const workspacePath = join(root, 'app', 'workspace.tsx');
const workspace = await readFile(workspacePath, 'utf8');
if (!workspace.includes('pdfBytesToArrayBuffer')) {
  violations.push('app/workspace.tsx: the ArrayBuffer PDF compatibility helper is missing');
}

if (violations.length) {
  console.error('\nScopeLogic clean-source verification failed:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('\nDelete the existing repository contents and replace them with the complete current release.\n');
  process.exit(1);
}

console.log(`ScopeLogic source verification passed (${sourceFiles.length} source files checked).`);
