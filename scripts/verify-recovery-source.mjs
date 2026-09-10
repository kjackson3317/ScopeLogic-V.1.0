import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const sourceFiles = [];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const legacyDialogDebt = new Set([
  'app/drawing-takeoff.tsx',
  'app/master-projects/[id]/master-workspace-client-v3.tsx',
  'app/master-projects/master-projects-client.tsx',
  'app/workspace.tsx',
]);

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) await collect(fullPath);
    else if (allowedExtensions.has(extname(entry.name))) sourceFiles.push(fullPath);
  }
}

for (const sourceRoot of ['app', 'lib']) await collect(join(root, sourceRoot));

const violations = [];
for (const filePath of sourceFiles) {
  const content = await readFile(filePath, 'utf8');
  const displayPath = relative(root, filePath).replaceAll('\\', '/');
  if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/m.test(content) && !legacyDialogDebt.has(displayPath)) {
    violations.push(`${displayPath}: browser-native dialogs are prohibited; use an in-app ScopeLogic modal or message instead`);
  }
  if (/new\s+Blob\s*\(\s*\[\s*(?:bytes|pdfBytes)\s*\]/m.test(content)) {
    violations.push(`${displayPath}: passes a pdf-lib Uint8Array directly into Blob`);
  }
}

const wrapper = await readFile(join(root, 'lib', 'cloud-workspace.ts'), 'utf8');
for (const requiredText of ['saveWithSlrProtection', 'removedUids.size > 1', 'guardedSaveQueue', 'loadWorkspaceFromCloud', 'saveWorkspaceToCloud']) {
  if (!wrapper.includes(requiredText)) violations.push(`lib/cloud-workspace.ts: missing recovery data-protection guard ${requiredText}`);
}

const implementation = await readFile(join(root, 'lib', 'cloud-workspace-legacy.ts'), 'utf8');
for (const requiredText of [
  "storage.from('project-files')",
  'inspectCloudSchema',
  'workspace_backups',
  'Automatic workspace checkpoint',
  'Cloud revision conflict',
  'knownCloudRevision',
  'checklist_scope_items_by_system',
  'create_scopelogic_official_release',
]) {
  if (!implementation.includes(requiredText)) violations.push(`lib/cloud-workspace-legacy.ts: missing required cloud behavior ${requiredText}`);
}

if (violations.length) {
  console.error('ScopeLogic recovery source verification failed:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log('ScopeLogic recovery source verification passed.');
if (legacyDialogDebt.size) console.log('Known native-dialog debt remains isolated to the existing legacy allowlist; new occurrences fail verification.');
