import { access, readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const sourceRoots = ['app', 'lib'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const sourceFiles = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) await collect(fullPath);
    else if (allowedExtensions.has(extname(entry.name))) sourceFiles.push(fullPath);
  }
}

for (const sourceRoot of sourceRoots) await collect(join(root, sourceRoot));

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

const layout = await readFile(join(root, 'app', 'layout.tsx'), 'utf8');
if (!layout.includes("title: 'ScopeLogic v1.0'")) violations.push('app/layout.tsx: production title must be ScopeLogic v1.0');

const rootPage = await readFile(join(root, 'app', 'page.tsx'), 'utf8');
if (!rootPage.includes("export const dynamic = 'force-dynamic'")) violations.push('app/page.tsx: protected root page must be force-dynamic');
if (!rootPage.includes('isSupabaseConfigured()')) violations.push('app/page.tsx: safe Supabase configuration guard is missing');

const workspace = await readFile(join(root, 'app', 'workspace.tsx'), 'utf8');
for (const requiredText of [
  'pdfBytesToArrayBuffer',
  'loadWorkspaceFromCloud',
  'saveWorkspaceToCloud',
  'Affected Systems',
  'Recommended Bid Basis by System',
  'Contractor Checklist Scope Item by System',
  'Document Reference',
  'Retry Cloud Upload',
  'renameProjectFile',
  'System Status',
  'Export Current Project Backup',
  'Release History',
  'sidebar-backdrop',
  'Quote Template Builder',
  'Travel Time Calculator',
  'Take Off Quantity Sheet',
  'Group / Reorder',
  'Define Groups / Headers',
  'Average Cable Length',
  'Cable by Avg Length',
  'Full Thresholds Only / Round Down',
  'Generate Quote PDF',
  'showOnBom',
  'takeoffSettingsByProject',
  'No Take Off rules are preloaded',
  'IF this → THEN that',
  'Update Quote from Take Off',
  'quantitySources',
  'Scope of Work',
  'Import Spreadsheet',
  'Download Blank Template',
  'Download Current Database',
  'Drawing Take Off',
  'ScopeLogic-Parts-Import-Template.xlsx',
  'Update Existing Pricing Only',
]) {
  if (!workspace.includes(requiredText)) violations.push(`app/workspace.tsx: missing ${requiredText}`);
}
if (workspace.includes('DEFAULT_TAKEOFF_FORMULAS')) violations.push('app/workspace.tsx: Take Off rules must not be preloaded in RC5.4');
if (!workspace.includes("filter((formula) => !String(formula.id || '').startsWith('default-'))")) violations.push('app/workspace.tsx: legacy RC5.3.2 default Take Off rules are not filtered');
if (!workspace.includes("quote.status!=='Approved'")) violations.push('app/workspace.tsx: customer quote PDF must be restricted to Approved quotes');
if (!workspace.includes('duplicatePartNumbers') || !workspace.includes('saveParts')) violations.push('app/workspace.tsx: duplicate Part Number enforcement is missing');
if (!workspace.includes('downloadCurrentDatabase') || !workspace.includes('ScopeLogic-Parts-Database.xlsx')) violations.push('app/workspace.tsx: full parts database export is missing');
if (!workspace.includes('combinedScopeOfWorkHtml') || !workspace.includes('single-scope')) violations.push('app/workspace.tsx: unified Scope of Work editor is missing');
if (!workspace.includes("groupId:''") || !workspace.includes("showOnBom:true")) violations.push('app/workspace.tsx: new quote items must default to UNGROUPED and customer-BOM visible');

for (const removedText of ['Email Settings', 'Email All PDFs', 'Bid Leveling Summary', 'AI Draft Assistant', 'SCOPELOGIC_AI_ENABLED', 'OPENAI_API_KEY', 'migrateDocumentFiles', '<AutoGrowTextArea label=\"Contractor Checklist Scope Item\"']) {
  if (workspace.includes(removedText)) violations.push(`app/workspace.tsx: obsolete RC4 feature remains: ${removedText}`);
}


if (!workspace.includes("const sowDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.sow).map")) {
  violations.push('app/workspace.tsx: Recommended SOW must keep one row per SLR');
}
if (!workspace.includes('checklistItems: Record<string, string>')) {
  violations.push('app/workspace.tsx: system-specific checklist data model is missing');
}

const drawingTakeoff = await readFile(join(root, 'app', 'drawing-takeoff.tsx'), 'utf8');
for (const requiredText of ['PDF Drawing Take Off', 'Sync Counts to Take Off', "import('pdfjs-dist')", 'Calibrate', 'Snippet / SLR', 'Linked Take Off Rule', "source: 'drawing'"]) {
  if (!drawingTakeoff.includes(requiredText)) violations.push(`app/drawing-takeoff.tsx: missing ${requiredText}`);
}
if (drawingTakeoff.includes('starterTools') || drawingTakeoff.includes("localStorage.setItem('sl-tools'")) violations.push('app/drawing-takeoff.tsx: standalone prototype defaults/localStorage must not remain in RC5.4');

const zipSupport = await readFile(join(root, 'lib', 'zip.ts'), 'utf8');
for (const requiredText of ['createZip', 'readZip', '0x04034b50']) {
  if (!zipSupport.includes(requiredText)) violations.push(`lib/zip.ts: missing ${requiredText}`);
}

const cloudWorkspace = await readFile(join(root, 'lib', 'cloud-workspace.ts'), 'utf8');
for (const requiredText of ["storage.from('project-files')", 'createSignedUrl', 'inspectCloudSchema', 'renameProjectFile', "health.version !== '1.0-RC5.2'", 'checklist_scope_items_by_system', 'create_scopelogic_official_release', 'listOfficialReleases']) {
  if (!cloudWorkspace.includes(requiredText)) violations.push(`lib/cloud-workspace.ts: missing ${requiredText}`);
}

const pdfGenerator = await readFile(join(root, 'app', 'pdf-generator.ts'), 'utf8');
for (const requiredText of ['recommendationSummary', 'checklistItemFor', 'drawChecklistSection', "columnIndex === 2", 'SYSTEM_ORDER', "headers: ['RFI No.', 'Systems', 'Question']", "headers: ['SLR', 'Systems', 'Scope Item', 'Scope Concern', 'Recommended Bid Basis by System', 'Document Reference']"]) {
  if (!pdfGenerator.includes(requiredText)) violations.push(`app/pdf-generator.ts: missing RC4 PDF behavior: ${requiredText}`);
}

for (const requiredText of ['buildQuotePdfBytes', "export type QuotePdfMode = 'full-bom' | 'summary-only'", "addNarrativeSection('Scope of Work'", 'Bill of Materials', "['Material Total',input.totals.material]", "['Labor Total',input.totals.labor]", "['Tax',input.totals.tax]", "'TOTAL PRICE'"]) {
  if (!pdfGenerator.includes(requiredText)) violations.push(`app/pdf-generator.ts: missing RC5.3.5 customer quote behavior: ${requiredText}`);
}

if (!pdfGenerator.includes("if (kind === 'sow') return issues.filter((issue) => issue.sow).map")) {
  violations.push('app/pdf-generator.ts: Recommended SOW PDF must keep one row per SLR');
}
if (/title: 'Recommended SOW Matrix'[\s\S]{0,260}headers:\s*\['SLR', 'System'/.test(pdfGenerator)) {
  violations.push('app/pdf-generator.ts: Recommended SOW must use a combined Systems column');
}

if (/title: 'Formal RFI'[\s\S]{0,220}headers:\s*\[[^\]]*Answer/.test(pdfGenerator)) {
  violations.push('app/pdf-generator.ts: Formal RFI PDF must not export an Answer field');
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (packageJson.version !== '1.0.0-rc.5.4') violations.push('package.json: version must be 1.0.0-rc.5.4');
if (packageJson.dependencies?.resend || packageJson.devDependencies?.resend) violations.push('package.json: Resend dependency must be removed');
if (packageJson.dependencies?.exceljs !== '4.4.0') violations.push('package.json: ExcelJS 4.4.0 is required for browser XLSX import/export.');
if (packageJson.dependencies?.['pdfjs-dist'] !== '4.10.38') violations.push('package.json: PDF.js 4.10.38 is required for Drawing Take Off.');
if (packageJson.scripts?.postinstall !== 'node scripts/copy-pdf-worker.mjs') violations.push('package.json: PDF.js worker postinstall copy is missing.');

try {
  await access(join(root, 'app', 'api', 'email'));
  violations.push('app/api/email: obsolete email API route still exists');
} catch {
  // Expected in v1.0.
}

try {
  await access(join(root, 'app', 'api', 'ai'));
  violations.push('app/api/ai: deferred AI API route must not be included in RC5.3.5');
} catch {
  // Expected while AI is deferred.
}

const envExample = await readFile(join(root, '.env.example'), 'utf8');
if (/RESEND|SCOPELOGIC_DEFAULT_FROM_EMAIL|SCOPELOGIC_ALLOWED_FROM_EMAILS|SCOPELOGIC_DEFAULT_REPLY_TO|OPENAI_API_KEY|SCOPELOGIC_AI_ENABLED|OPENAI_MODEL/.test(envExample)) {
  violations.push('.env.example: retired email or deferred AI variables remain');
}

for (const [fileName, requiredTexts] of [
  ['20260729000100_scopelogic_rc3_cloud_cutover.sql', ['cloud_cutover_completed_at']],
  ['20260805000100_scopelogic_rc31_schema_repair.sql', ['customer_id', 'scopelogic_schema_health', "notify pgrst, 'reload schema'", 'project-files']],
  ['20260806000100_scopelogic_rc4_product_simplification.sql', ['systems jsonb', 'recommended_bid_basis_by_system', 'agreement_number', "'version', 'RC4'", "notify pgrst, 'reload schema'"]],
  ['20260806000200_scopelogic_rc41_matrix_checklist_refinement.sql', ['checklist_scope_items_by_system', "'version', 'RC4.1'", "notify pgrst, 'reload schema'"]],
  ['20260806000300_scopelogic_v1_production_closeout.sql', ['release_number', 'lifecycle_status', 'snapshot_data', 'content_sha256', 'protect_release_package_immutability', 'create_scopelogic_official_release', "'version', '1.0'", "notify pgrst, 'reload schema'"]],
  ['20260806000400_scopelogic_rc5_mobile_ai.sql', ['ai_assistance', "'version', '1.0-RC5'"]],
  ['20260807000100_scopelogic_rc52_estimating.sql', ['estimating_data', "'version', '1.0-RC5.2'"]],
]) {
  try {
    const migration = await readFile(join(root, 'supabase', 'migrations', fileName), 'utf8');
    for (const requiredText of requiredTexts) if (!migration.includes(requiredText)) violations.push(`${fileName}: missing ${requiredText}`);
  } catch {
    violations.push(`${fileName}: migration file is missing`);
  }
}

if (violations.length) {
  console.error('\nScopeLogic source verification failed:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('\nReplace the repository with the complete current release and run verification again.\n');
  process.exit(1);
}

console.log(`ScopeLogic source verification passed (${sourceFiles.length} source files checked).`);
