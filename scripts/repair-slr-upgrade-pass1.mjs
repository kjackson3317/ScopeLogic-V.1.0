import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);

function replaceKnown(source, before, after, label) {
  if (source.includes(after)) {
    console.log(`${label}: already repaired`);
    return source;
  }
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one old block, found ${count}`);
  console.log(`${label}: repaired`);
  return source.replace(before, after);
}

// TypeScript cannot reliably narrow a variable assigned inside nested forEach callbacks.
// Use ordinary loops so target is narrowed to SlrRbbSection after the null guard.
{
  const file = 'app/slr-model.ts';
  let source = read(file);
  const before = `  let target: SlrRbbSection | null = null;\n  issue.recommendBaseBids.forEach((rbb) => rbb.selectedSystems.forEach((system) => {\n    const section = rbb.sections[system];\n    if (section?.displayNumber === displayNumber) target = section;\n  }));\n  if (!target) throw new Error(\`Could not find \${displayNumber}.\`);`;
  const after = `  let target: SlrRbbSection | null = null;\n  for (const rbb of issue.recommendBaseBids) {\n    for (const system of rbb.selectedSystems) {\n      const section = rbb.sections[system];\n      if (section?.displayNumber === displayNumber) {\n        target = section;\n        break;\n      }\n    }\n    if (target) break;\n  }\n  if (!target) throw new Error(\`Could not find \${displayNumber}.\`);`;
  source = replaceKnown(source, before, after, 'slr-model target narrowing');
  write(file, source);
}

// workspace.tsx legitimately contains more than one serialized issue snapshot.
// Restrict this replacement to the official-release block after lockedIssues is created.
{
  const file = 'scripts/apply-slr-parent-child-upgrade.mjs';
  let source = read(file);
  const before = `  source = replaceOnce(source,\n    \"        issues: JSON.parse(JSON.stringify(issues)),\",\n    \"        issues: JSON.parse(JSON.stringify(lockedIssues)),\",\n    'release snapshot locked issues');`;
  const after = `  {\n    const anchor = \"      const lockedIssues = lockIssuesForOfficialRelease(issues, kinds) as Issue[];\";\n    const needle = \"        issues: JSON.parse(JSON.stringify(issues)),\";\n    const replacement = \"        issues: JSON.parse(JSON.stringify(lockedIssues)),\";\n    const anchorIndex = source.indexOf(anchor);\n    if (anchorIndex < 0) throw new Error('release snapshot locked issues: official release anchor not found');\n    const matchIndex = source.indexOf(needle, anchorIndex);\n    if (matchIndex < 0) throw new Error('release snapshot locked issues: snapshot line not found after official release anchor');\n    source = source.slice(0, matchIndex) + replacement + source.slice(matchIndex + needle.length);\n  }`;
  source = replaceKnown(source, before, after, 'official-release snapshot targeting');
  write(file, source);
}

console.log('SLR upgrade pass-1 repair complete.');
