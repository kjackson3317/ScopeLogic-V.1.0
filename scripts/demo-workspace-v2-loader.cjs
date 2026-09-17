// Employer presentation V2 adapter. Runs after the existing isolation/branding adapter.
// This keeps production source unchanged while restructuring the presentation workspace.
const baseLoader = require('./demo-branding-loader.cjs');

module.exports = function(source) {
  source = baseLoader.call(this, source);
  const path = this.resourcePath.replaceAll('\\', '/');
  if (!path.endsWith('/app/workspace.tsx')) return source;

  const replaceOnce = (before, after, label) => {
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`Employer demo V2 adapter needs review: ${label} matched ${count} times.`);
    source = source.replace(before, after);
  };

  replaceOnce(
    "import SlrChildEditor from './slr-child-editor';\n",
    "import SlrChildEditor from './slr-child-editor';\nimport DemoProjectReviewPanel from './demo-project-review-panel';\nimport DemoDeliverablesHub from './demo-deliverables-hub';\n",
    'demo component imports',
  );

  replaceOnce(
    "const navDeliverables: [View, string][] = [\n  ['sow', 'Recommended SOW Matrix'],\n  ['clarifications', 'Clarification Log'],\n  ['rfi', 'Formal RFI'],\n  ['checklist', 'Contractor Response Checklist'],\n];",
    "const navDeliverables: [View, string][] = [\n  ['sow', 'Deliverables'],\n];",
    'deliverables navigation',
  );

  source = source.replace(/\n\s*\{isEmployerDemo && <div className=\"nav-group\"><span>REVIEW WORKFLOW<\/span><a href=\"\/demo\/review\">Review Notes \/ Deliverables \/ Bid Alignment<\/a><button onClick=\{\(\) => confirmAction\('Reset Demo', 'Replace this browser’s demo edits with the fictional starting project\?', resetDemo, 'Reset Demo'\)\}>Reset Demo<\/button><\/div>\}/, '');
  source = source.replaceAll('["drawing-takeoff", "Drawing Take Off"], ', '');

  const oldNotes = "function InternalNotes({ value, save }: { value: string; save: (value: string) => void }) {\n  const [draft, setDraft] = useState(value);\n  useEffect(() => setDraft(value), [value]);\n  return <><PageHead eyebrow=\"Internal Workspace\" title=\"Internal Notes\" description=\"Private project notes are stored with this project and are not included in client deliverables.\" action={<button className=\"primary\" onClick={() => save(draft)}>Save Notes</button>} /><div className=\"notes-page\"><RichTextEditor value={draft} onChange={setDraft} placeholder=\"Jot down project thoughts, follow-up items, coordination notes, and internal reminders...\" /></div></>;\n}";
  const newNotes = "function InternalNotes({ value, save, go }: { value: string; save: (value: string) => void; go?: (view: View) => void }) {\n  const [draft, setDraft] = useState(value);\n  useEffect(() => setDraft(value), [value]);\n  if (!isEmployerDemo) return <><PageHead eyebrow=\"Internal Workspace\" title=\"Internal Notes\" description=\"Private project notes are stored with this project and are not included in client deliverables.\" action={<button className=\"primary\" onClick={() => save(draft)}>Save Notes</button>} /><div className=\"notes-page\"><RichTextEditor value={draft} onChange={setDraft} placeholder=\"Jot down project thoughts, follow-up items, coordination notes, and internal reminders...\" /></div></>;\n  return <><PageHead eyebrow=\"Internal Workspace\" title=\"Internal Notes + Project Review\" description=\"Keep free-form notes on the left while structured review observations stay visible on the right.\" action={<button className=\"primary\" onClick={() => save(draft)}>Save Notes</button>} /><div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:16,minHeight:'calc(100vh - 190px)',alignItems:'stretch'}}><div className=\"notes-page\" style={{margin:0,minHeight:0}}><RichTextEditor value={draft} onChange={setDraft} placeholder=\"Jot down project thoughts, follow-up items, coordination notes, and internal reminders...\" /></div><DemoProjectReviewPanel onOpenSlr={() => go?.('internal')} /></div></>;\n}";
  replaceOnce(oldNotes, newNotes, 'Internal Notes split workspace');

  const oldInvocation = "{view === 'notes' && <InternalNotes value={internalNotes} save={(value) => { setNotesByProject((current) => ({ ...current, [projectId]: value })); message('Saved', 'Internal notes were saved.'); }} />}";
  const newInvocation = "{view === 'notes' && <InternalNotes value={internalNotes} save={(value) => { setNotesByProject((current) => ({ ...current, [projectId]: value })); message('Saved', 'Internal notes were saved.'); }} go={setView} />}";
  replaceOnce(oldInvocation, newInvocation, 'Internal Notes navigation callback');

  const sowPattern = /\{view === 'sow' && <Deliverable title=\"Recommended SOW Matrix\"[^\n]*\/>\}/;
  if (!sowPattern.test(source)) throw new Error('Employer demo V2 adapter needs review: primary deliverable render was not found.');
  source = source.replace(sowPattern, "{view === 'sow' && <DemoDeliverablesHub onOpenSlr={() => setView('internal')} onOpenReleases={() => setView('releases')} />}");

  const drawingPattern = /\n\s*\{view === 'drawing-takeoff' && <DrawingTakeoffPage[^\n]*\/>\}/;
  if (!drawingPattern.test(source)) throw new Error('Employer demo V2 adapter needs review: browser Drawing Takeoff render was not found.');
  source = source.replace(drawingPattern, '');

  source = source.replace(
    "{ category: 'Estimating Tools', title: 'Drawing Take Off', steps: ['Select the drawing and page, then calibrate scale.', 'Drag the drawing to pan and use the mouse wheel to zoom.', 'Place count marks, measurements, and annotations.', 'Link quantities to Take Off rules and sync the results.'], notes: ['Calibration is page-specific.', 'The expanded drawing window is designed for plan navigation.'] },",
    "{ category: 'Estimating Tools', title: 'Desktop Drawing Takeoff', steps: ['Launch the installed Technology Preconstruction Takeoff desktop companion.', 'Open the PDF drawing set and calibrate each measured sheet.', 'Use Select, Pan, Count and measurement tools in the fixed plan viewport.', 'Review the draggable Takeoff Totals dock, Rule Links and Sync Review before applying quantities downstream.'], notes: ['Drawing takeoff is desktop-only in this presentation build.', 'The browser workspace retains Take Off Rules, estimating and deliverables.'] },",
  );

  return source;
};
