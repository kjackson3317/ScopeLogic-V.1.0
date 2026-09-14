'use client';

import { useEffect, useState } from 'react';
import {
  SLR_SYSTEM_ORDER,
  blankChecklistChild,
  blankRbbChild,
  blankRbbSection,
  blankRfiChild,
  syncLegacyFields,
  type SlrChildFields,
  type SlrIssueLike,
} from './slr-model';

type EditableIssue = SlrIssueLike & SlrChildFields;

type Props = {
  issue: EditableIssue;
  onChange: (issue: EditableIssue) => void;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const clean = (value: unknown) => String(value ?? '').trim();
const firstUid = <T extends { uid: string }>(items: T[]) => new Set(items.slice(0, 1).map((item) => item.uid));

export default function SlrChildEditor({ issue, onChange }: Props) {
  const [openRfis, setOpenRfis] = useState<Set<string>>(() => firstUid(issue.rfis));
  const [openRbbs, setOpenRbbs] = useState<Set<string>>(() => firstUid(issue.recommendBaseBids));
  const [openChecklist, setOpenChecklist] = useState<Set<string>>(() => firstUid(issue.checklistQuestions));

  useEffect(() => {
    setOpenRfis(firstUid(issue.rfis));
    setOpenRbbs(firstUid(issue.recommendBaseBids));
    setOpenChecklist(firstUid(issue.checklistQuestions));
  }, [issue.uid]);

  const commit = (change: (next: EditableIssue) => void) => {
    const next = clone(issue);
    change(next);
    onChange(syncLegacyFields(next));
  };

  const toggleOpen = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, uid: string) => setter((current) => {
    const next = new Set(current);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    return next;
  });

  const saveSlr = () => {
    document.querySelector<HTMLButtonElement>('.matrix-editor-full .submit-bar .primary')?.click();
  };

  const rfiSystems = Array.from(new Set([...(issue.systems || []), ...SLR_SYSTEM_ORDER]));

  const addRfi = () => {
    const child = blankRfiChild();
    child.systems = [...(issue.systems || [])];
    child.reference = clean(issue.reference);
    commit((next) => next.rfis.push(child));
    setOpenRfis(new Set([child.uid]));
  };

  const addRbb = () => {
    const child = blankRbbChild();
    commit((next) => next.recommendBaseBids.push(child));
    setOpenRbbs(new Set([child.uid]));
  };

  const addChecklist = () => {
    const child = blankChecklistChild(issue.systems?.[0] || '');
    commit((next) => next.checklistQuestions.push(child));
    setOpenChecklist(new Set([child.uid]));
  };

  return <div className="slr-child-editor">
    <section className="recommendation-sections">
      <div className="recommendation-heading">
        <div><b>Formal RFI Questions</b><span>One scope concern may produce one or more related RFIs. Keep related questions together when that is clearer.</span></div>
        <div className="slr-section-actions">
          <button className="secondary" type="button" onClick={() => setOpenRfis(new Set(issue.rfis.map((item) => item.uid)))} disabled={!issue.rfis.length}>Expand All</button>
          <button className="secondary" type="button" onClick={() => setOpenRfis(new Set())} disabled={!issue.rfis.length}>Collapse All</button>
          <button className="primary slr-section-save" type="button" onClick={saveSlr} title="Uses the same save action as Submit Entry">Save SLR</button>
          <button className="secondary" type="button" onClick={addRfi}>+ Add RFI</button>
        </div>
      </div>
      {issue.rfis.length === 0 && <div className="empty-panel compact"><b>No RFI required.</b><p>Add an RFI only when the scope concern needs a formal question.</p></div>}
      {issue.rfis.map((rfi, index) => {
        const expanded = openRfis.has(rfi.uid);
        return <div className={`slr-child-card${expanded ? ' expanded' : ' collapsed'}`} key={rfi.uid}>
          <div className="slr-child-card-head">
            <button className="slr-child-summary-button" type="button" onClick={() => toggleOpen(setOpenRfis, rfi.uid)} aria-expanded={expanded}>
              <span className="slr-child-number">{rfi.number || 'RFI — Auto on Save'}</span>
              <small>{rfi.title || rfi.question || 'Untitled RFI'} · {rfi.locked ? 'Permanent customer-visible number' : 'Draft number may resequence'}</small>
            </button>
            <div className="slr-child-actions">
              <select value={rfi.status} onChange={(event) => commit((next) => { next.rfis[index].status = event.target.value as typeof rfi.status; })}>
                {(rfi.locked ? ['Issued', 'Answered', 'Closed'] : ['Draft', 'Issued', 'Answered', 'Closed']).map((status) => <option key={status}>{status}</option>)}
              </select>
              <button className="secondary slr-collapse-toggle" type="button" onClick={() => toggleOpen(setOpenRfis, rfi.uid)}>{expanded ? 'Collapse' : 'Expand'}</button>
              {!rfi.locked && <button className="secondary" type="button" onClick={() => commit((next) => { next.rfis.splice(index, 1); })}>Remove</button>}
            </div>
          </div>
          {expanded && <div className="slr-child-card-body">
            {rfi.locked && <div className="slr-lock-note">This RFI number has appeared in an Official Release and will not be renumbered or reused.</div>}
            <div className="slr-child-grid">
              <label className="field"><span>RFI Title / Subject</span><input readOnly={rfi.locked} value={rfi.title} onChange={(event) => commit((next) => { next.rfis[index].title = event.target.value; })} /></label>
              <label className="field"><span>Document Reference</span><input readOnly={rfi.locked} value={rfi.reference} onChange={(event) => commit((next) => { next.rfis[index].reference = event.target.value; })} /></label>
            </div>
            <label className="field"><span>Question</span><textarea rows={3} readOnly={rfi.locked} value={rfi.question} onChange={(event) => commit((next) => { next.rfis[index].question = event.target.value; })} /></label>
            <div className="slr-child-system-list"><span>Systems</span>{rfiSystems.map((system) => <label key={system}><input type="checkbox" checked={rfi.systems.includes(system)} disabled={rfi.locked} onChange={(event) => commit((next) => { const target = next.rfis[index]; target.systems = event.target.checked ? Array.from(new Set([...target.systems, system])) : target.systems.filter((item) => item !== system); })} /> {system}</label>)}</div>
            <label className="field"><span>Internal A/E / Owner Response</span><textarea rows={3} value={rfi.response} onChange={(event) => commit((next) => { next.rfis[index].response = event.target.value; if (event.target.value.trim() && next.rfis[index].status === 'Issued') next.rfis[index].status = 'Answered'; })} /></label>
            <div className="slr-child-grid">
              <label className="field"><span>Response Date</span><input type="date" value={rfi.responseDate} onChange={(event) => commit((next) => { next.rfis[index].responseDate = event.target.value; })} /></label>
              <label className="field"><span>Response Source</span><input value={rfi.responseSource} onChange={(event) => commit((next) => { next.rfis[index].responseSource = event.target.value; })} /></label>
            </div>
            <label><input type="checkbox" checked={rfi.includeInFormalRfi} disabled={rfi.locked} onChange={(event) => commit((next) => { next.rfis[index].includeInFormalRfi = event.target.checked; })} /> Include in Formal RFI deliverable</label>
          </div>}
        </div>;
      })}
    </section>

    <section className="recommendation-sections">
      <div className="recommendation-heading">
        <div><b>Recommend Base Bid</b><span>System selection belongs to each RBB. Every selected system gets its own recommendation section and automatic identifier.</span></div>
        <div className="slr-section-actions">
          <button className="secondary" type="button" onClick={() => setOpenRbbs(new Set(issue.recommendBaseBids.map((item) => item.uid)))} disabled={!issue.recommendBaseBids.length}>Expand All</button>
          <button className="secondary" type="button" onClick={() => setOpenRbbs(new Set())} disabled={!issue.recommendBaseBids.length}>Collapse All</button>
          <button className="primary slr-section-save" type="button" onClick={saveSlr} title="Uses the same save action as Submit Entry">Save SLR</button>
          <button className="secondary" type="button" onClick={addRbb}>+ Add Recommend Base Bid</button>
        </div>
      </div>
      {issue.recommendBaseBids.length === 0 && <div className="empty-panel compact"><b>No Recommend Base Bid entered.</b><p>Add one when the GC needs a carry basis while the concern is unresolved or being clarified.</p></div>}
      {issue.recommendBaseBids.map((rbb, rbbIndex) => {
        const lockedGroup = Object.values(rbb.sections).some((section) => section.locked || section.contentReleased);
        const expanded = openRbbs.has(rbb.uid);
        return <div className={`slr-child-card${expanded ? ' expanded' : ' collapsed'}`} key={rbb.uid}>
          <div className="slr-child-card-head">
            <button className="slr-child-summary-button" type="button" onClick={() => toggleOpen(setOpenRbbs, rbb.uid)} aria-expanded={expanded}>
              <span className="slr-child-number">{rbb.baseNumber || 'RBB — Auto on Save'}</span>
              <small>{rbb.title || 'Untitled RBB'} · {rbb.selectedSystems.length ? rbb.selectedSystems.join(', ') : 'No systems selected'} · {lockedGroup ? 'Customer-visible' : 'Draft'}</small>
            </button>
            <div className="slr-child-actions">
              <button className="secondary slr-collapse-toggle" type="button" onClick={() => toggleOpen(setOpenRbbs, rbb.uid)}>{expanded ? 'Collapse' : 'Expand'}</button>
              {!lockedGroup && <button className="secondary" type="button" onClick={() => commit((next) => { next.recommendBaseBids.splice(rbbIndex, 1); })}>Remove RBB</button>}
            </div>
          </div>
          {expanded && <div className="slr-child-card-body">
            {lockedGroup && <div className="slr-lock-note">Released recommendation text is read-only. If an RFI changes one released system section, mark only that section Superseded and add a new RBB for the replacement scope.</div>}
            <label className="field"><span>RBB Title / Subject</span><input value={rbb.title} onChange={(event) => commit((next) => { next.recommendBaseBids[rbbIndex].title = event.target.value; })} /></label>
            <div className="slr-child-system-list"><span>RBB Systems</span>{SLR_SYSTEM_ORDER.map((system) => {
              const checked = rbb.selectedSystems.includes(system);
              return <label key={system}><input type="checkbox" checked={checked} disabled={lockedGroup} onChange={(event) => commit((next) => {
                const target = next.recommendBaseBids[rbbIndex];
                if (event.target.checked) {
                  if (!target.selectedSystems.includes(system)) target.selectedSystems.push(system);
                  target.sections[system] ||= blankRbbSection(system);
                } else {
                  target.selectedSystems = target.selectedSystems.filter((item) => item !== system);
                  delete target.sections[system];
                }
              })} /> {system}</label>;
            })}</div>
            {rbb.selectedSystems.map((system) => {
              const section = rbb.sections[system] || blankRbbSection(system);
              return <div className="rbb-system-section" key={section.uid || system}>
                <div className="slr-child-card-head">
                  <div><span className="slr-child-number">{section.displayNumber || `${system} — Auto on Save`}</span><small>{system}</small></div>
                  {(section.locked || section.contentReleased) ? <div className="slr-child-actions">
                    {section.status !== 'Superseded' && <button className="secondary" type="button" onClick={() => commit((next) => { next.recommendBaseBids[rbbIndex].sections[system].status = 'Confirmed'; })}>Confirm</button>}
                    {section.status !== 'Superseded' && <button className="secondary" type="button" onClick={() => {
                      const replacement = blankRbbChild(system);
                      replacement.forceSuffix = Boolean(section.suffix);
                      replacement.sections[system].suffix = section.suffix;
                      replacement.sections[system].supersedesNumber = section.displayNumber;
                      commit((next) => {
                        next.recommendBaseBids[rbbIndex].sections[system].status = 'Superseded';
                        next.recommendBaseBids.push(replacement);
                      });
                      setOpenRbbs(new Set([replacement.uid]));
                    }}>Supersede & Create Replacement</button>}
                    {section.status === 'Superseded' && <span className="status-badge">Superseded</span>}
                  </div> : <select value={section.status} onChange={(event) => commit((next) => { next.recommendBaseBids[rbbIndex].sections[system].status = event.target.value as typeof section.status; })}>
                    {['Draft', 'Current', 'Confirmed', 'Superseded'].map((status) => <option key={status}>{status}</option>)}
                  </select>}
                </div>
                <label className="field"><span>Recommend Base Bid — {system}</span><textarea rows={4} readOnly={section.locked || section.contentReleased} value={section.recommendation} onChange={(event) => commit((next) => { next.recommendBaseBids[rbbIndex].sections[system].recommendation = event.target.value; })} /></label>
                <div className="field"><span>Based on RFI</span>{issue.rfis.length ? <div className="slr-child-system-list rfi-link-list">{issue.rfis.map((rfi) => { const checked = section.basedOnRfiUids.includes(rfi.uid); return <label key={rfi.uid}><input type="checkbox" checked={checked} onChange={(event) => commit((next) => { const target = next.recommendBaseBids[rbbIndex].sections[system]; target.basedOnRfiUids = event.target.checked ? Array.from(new Set([...target.basedOnRfiUids, rfi.uid])) : target.basedOnRfiUids.filter((uid) => uid !== rfi.uid); })} /> {rfi.number || 'Draft RFI'} — {rfi.title || rfi.question || 'Untitled'}</label>; })}</div> : <small>No RFI is currently available on this SLR.</small>}<small>Internal traceability only. These links remain editable after an Official Release; released customer-visible recommendation text does not change.</small></div>
                {section.supersedesNumber && <div className="slr-lock-note">Supersedes {section.supersedesNumber}</div>}
              </div>;
            })}
          </div>}
        </div>;
      })}
    </section>

    <section className="recommendation-sections checklist-scope-sections">
      <div className="recommendation-heading">
        <div><b>Contractor Checklist Questions</b><span>Checklist questions stay internal to the checklist workflow and do not appear in the Clarification Log.</span></div>
        <div className="slr-section-actions">
          <button className="secondary" type="button" onClick={() => setOpenChecklist(new Set(issue.checklistQuestions.map((item) => item.uid)))} disabled={!issue.checklistQuestions.length}>Expand All</button>
          <button className="secondary" type="button" onClick={() => setOpenChecklist(new Set())} disabled={!issue.checklistQuestions.length}>Collapse All</button>
          <button className="primary slr-section-save" type="button" onClick={saveSlr} title="Uses the same save action as Submit Entry">Save SLR</button>
          <button className="secondary" type="button" onClick={addChecklist}>+ Add Checklist Question</button>
        </div>
      </div>
      {issue.checklistQuestions.length === 0 && <div className="empty-panel compact"><b>No checklist questions entered.</b></div>}
      {issue.checklistQuestions.map((item, index) => {
        const expanded = openChecklist.has(item.uid);
        return <div className={`slr-child-card${expanded ? ' expanded' : ' collapsed'}`} key={item.uid}>
          <div className="slr-child-card-head">
            <button className="slr-child-summary-button" type="button" onClick={() => toggleOpen(setOpenChecklist, item.uid)} aria-expanded={expanded}>
              <span className="slr-child-number">{item.number || 'CL — Auto on Save'}</span>
              <small>{item.question || 'Untitled checklist question'} · {item.system || 'No system'} · {item.locked ? 'Permanent if customer-visible' : 'Draft number may resequence'}</small>
            </button>
            <div className="slr-child-actions">
              <select value={item.status} onChange={(event) => commit((next) => { next.checklistQuestions[index].status = event.target.value as typeof item.status; })}>{['Open', 'Reviewed', 'Complete'].map((status) => <option key={status}>{status}</option>)}</select>
              <button className="secondary slr-collapse-toggle" type="button" onClick={() => toggleOpen(setOpenChecklist, item.uid)}>{expanded ? 'Collapse' : 'Expand'}</button>
              {!item.locked && <button className="secondary" type="button" onClick={() => commit((next) => { next.checklistQuestions.splice(index, 1); })}>Remove</button>}
            </div>
          </div>
          {expanded && <div className="slr-child-card-body">
            <div className="slr-child-grid">
              <label className="field"><span>System</span><select value={item.system} disabled={item.locked} onChange={(event) => commit((next) => { next.checklistQuestions[index].system = event.target.value; })}><option value="">Select system...</option>{rfiSystems.map((system) => <option key={system}>{system}</option>)}</select></label>
              <label className="field"><span>Response</span><select value={item.response} onChange={(event) => commit((next) => { next.checklistQuestions[index].response = event.target.value; })}><option>Included</option><option>Excluded</option><option>Included with Exception</option><option>Not Stated</option><option>Clarification Required</option><option>N/A</option></select></label>
            </div>
            <label className="field"><span>Checklist Question / Requirement</span><textarea rows={3} readOnly={item.locked} value={item.question} onChange={(event) => commit((next) => { next.checklistQuestions[index].question = event.target.value; })} /></label>
            <label className="field"><span>Exception / Explanation</span><textarea rows={2} value={item.responseReason} onChange={(event) => commit((next) => { next.checklistQuestions[index].responseReason = event.target.value; })} /></label>
            <label className="field"><span>Verifies RBB</span><select multiple value={item.verifiesRbbNumbers} onChange={(event) => commit((next) => { next.checklistQuestions[index].verifiesRbbNumbers = Array.from(event.target.selectedOptions).map((option) => option.value); })}>{issue.recommendBaseBids.flatMap((rbb) => rbb.selectedSystems.map((system) => rbb.sections[system]).filter(Boolean)).filter((section) => section.displayNumber).map((section) => <option key={section.uid} value={section.displayNumber}>{section.displayNumber} — {section.system}</option>)}</select></label>
          </div>}
        </div>;
      })}
    </section>
  </div>;
}
