'use client';

import { useMemo, useState } from 'react';
import styles from './review-deliverables-preview.module.css';

export type PreviewMasterProject = {
  id: string;
  projectNumber: string;
  name: string;
  location: string;
  status: string;
  revision: string;
  systems: string[];
};

type Props = { masters: PreviewMasterProject[]; userEmail: string };
type Tab = 'matrix' | 'clarifications' | 'checklist' | 've' | 'bid-internal' | 'bid-external' | 'internal';

const rbbRows = [
  { id: 'RBB-001', system: 'Structured Cabling', topic: 'Copper Cabling Category', recommendation: 'Provide Category 6A horizontal cabling throughout unless otherwise modified by the contract documents.', refs: '27 10 00 §2.3.A; T2.01 Note 7; T5.02 Detail 3', status: 'Current' },
  { id: 'RBB-002', system: 'Structured Cabling', topic: 'MDF / IDF Buildout', recommendation: 'Provide racks, patching, cable management, grounding accessories, and related room buildout components shown or specified for a complete telecommunications room installation.', refs: '27 11 00; T5.01', status: 'Current' },
  { id: 'RBB-003', system: 'CCTV', topic: 'Camera Requirements', recommendation: 'Provide camera types and minimum performance requirements shown in the device schedule and details.', refs: '28 20 00; T6.01', status: 'Current' },
];

const clarifications = [
  { id: 'RFI-001', type: 'RFI', system: 'Structured Cabling', subject: 'Copper Cabling Category', question: 'Confirm whether Category 6 or Category 6A is required for standard horizontal cabling locations.', ref: '27 10 00 §2.3.A; T2.01 Note 7', status: 'Open', response: '' },
  { id: 'GC-001', type: 'GC Clarification', system: 'CCTV', subject: 'Exterior Camera Pole Power', question: 'Confirm which trade is responsible for branch power to exterior camera pole locations.', ref: 'E2.03; T6.02', status: 'Open', response: '' },
];

const checklist = [
  ['CL-001', 'General', 'Confirm all required permits and permit fees are included.'],
  ['CL-002', 'Submittals', 'Confirm all required product data, shop drawings, and submittals are included.'],
  ['CL-003', 'Closeout', 'Confirm all required as-built drawings and record documentation are included.'],
  ['CL-004', 'Training', 'Confirm all specified owner training is included.'],
  ['CL-005', 'Testing', 'Confirm all specified testing and certification are included.'],
];

const veItems = [
  { id: 'VE-001', system: 'Structured Cabling', title: 'Copper Cabling Category', opportunity: 'Evaluate Category 6 for standard workstation outlets while retaining Category 6A for WAPs and other high-bandwidth device locations.', impact: 'May reduce material and installation cost. Confirm owner standards, performance requirements, and future bandwidth expectations before acceptance. Reduced performance and future flexibility should be considered.', refs: '27 10 00 §2.3.A; T5.02 Detail 3', status: 'Identified' },
  { id: 'VE-002', system: 'CCTV', title: 'Exterior Camera Mounting', opportunity: 'Evaluate wall or building-mounted camera locations where dedicated poles are shown but equivalent coverage may be achievable from the structure.', impact: 'May remove pole, foundation, trenching, and associated electrical work. Verify coverage, mounting height, sight lines, owner preference, and architectural constraints before acceptance.', refs: 'T6.02; E2.03', status: 'Under Review' },
];

const bidItems = [
  { scope: 'Category 6A Cabling', rbb: 'RBB-001', a: 'Included', b: 'Qualified — Cat 6 except WAPs', c: 'Included' },
  { scope: 'Permanent-Link Testing', rbb: 'RBB-004', a: 'Excluded', b: 'Included', c: 'Unclear' },
  { scope: 'Owner Training', rbb: 'RBB-006', a: 'Included', b: 'Included', c: 'Excluded' },
  { scope: 'As-Built Drawings', rbb: 'Checklist', a: 'Included', b: 'Qualified', c: 'Included' },
];

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'blue' | 'internal' }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

export default function ReviewDeliverablesPreview({ masters, userEmail }: Props) {
  const [selectedMasterId, setSelectedMasterId] = useState(masters[0]?.id || '');
  const [tab, setTab] = useState<Tab>('matrix');
  const [search, setSearch] = useState('');
  const selectedMaster = masters.find((master) => master.id === selectedMasterId) || masters[0] || null;
  const filtered = useMemo(() => masters.filter((master) => !search.trim() || `${master.projectNumber} ${master.name} ${master.location}`.toLowerCase().includes(search.trim().toLowerCase())), [masters, search]);

  if (!selectedMaster) return <main className={styles.empty}><h1>Deliverables Preview</h1><p>No active Master Projects are available.</p></main>;

  const projectTitle = `${selectedMaster.projectNumber ? `${selectedMaster.projectNumber} · ` : ''}${selectedMaster.name}`;

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><img src="/brand/scopelogic-logo-mark.png" alt="" /><div><b>ScopeLogic</b><span>Deliverables Test</span></div></div>
      <div className={styles.libraryTitle}><span>MASTER PROJECT LIBRARY</span><b>Master Projects</b><small>Deliverable format preview</small></div>
      <input className={styles.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search master projects…" />
      <div className={styles.masterList}>{filtered.map((master) => <button key={master.id} className={master.id === selectedMaster.id ? styles.masterActive : ''} onClick={() => setSelectedMasterId(master.id)}><span>{master.projectNumber || 'MASTER'}</span><b>{master.name}</b><small>{master.status} · {master.revision}</small></button>)}</div>
      <div className={styles.sidebarFooter}><span>{userEmail}</span><a href="/review-workflow-preview">Review Workflow Test</a><a href="/master-projects">Master Projects</a></div>
    </aside>

    <main className={styles.main}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>DELIVERABLE DESIGN TEST</span><h1>{selectedMaster.name}</h1><p>{selectedMaster.location || 'No location entered'} · {selectedMaster.revision}</p></div>
        <div className={styles.headerBadges}><Badge tone="green">{selectedMaster.status}</Badge><Badge tone="blue">TEST ONLY — no production writes</Badge></div>
      </header>

      <nav className={styles.tabs}>
        <button className={tab === 'matrix' ? styles.active : ''} onClick={() => setTab('matrix')}>ScopeLogic Matrix</button>
        <button className={tab === 'clarifications' ? styles.active : ''} onClick={() => setTab('clarifications')}>Clarification Log</button>
        <button className={tab === 'checklist' ? styles.active : ''} onClick={() => setTab('checklist')}>Contractor Checklist</button>
        <button className={tab === 've' ? styles.active : ''} onClick={() => setTab('ve')}>VE Opportunity Log</button>
        <button className={tab === 'bid-internal' ? styles.active : ''} onClick={() => setTab('bid-internal')}>Bid Alignment — Internal</button>
        <button className={tab === 'bid-external' ? styles.active : ''} onClick={() => setTab('bid-external')}>Bid Alignment Report</button>
        <button className={tab === 'internal' ? styles.active : ''} onClick={() => setTab('internal')}>Internal Only</button>
      </nav>

      {tab === 'matrix' && <section className={styles.workspace}>
        <div className={styles.workspaceHead}><div><span>CLIENT DELIVERABLE</span><h2>ScopeLogic Matrix™</h2><p>The Matrix is made up of Recommended Base Bid entries. No separate RBB deliverable.</p></div><Badge tone="green">RBB = Matrix Entry</Badge></div>
        <div className={styles.pdfPage}>
          <div className={styles.pdfHeader}><img src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /><div><b>ScopeLogic Matrix™</b><span>{projectTitle}</span><span>{selectedMaster.revision}</span></div></div>
          <table className={styles.matrixTable}><thead><tr><th>RBB</th><th>System</th><th>Scope Item</th><th>Recommended Base Bid</th><th>References</th><th>Status</th></tr></thead><tbody>{rbbRows.map((row) => <tr key={row.id}><td><b>{row.id}</b></td><td>{row.system}</td><td><b>{row.topic}</b></td><td>{row.recommendation}</td><td>{row.refs}</td><td>{row.status}</td></tr>)}</tbody></table>
          <div className={styles.pdfNote}>No Basis field. No Related Clarification field. The deliverable states the recommended bid basis and supporting document references only.</div>
        </div>
      </section>}

      {tab === 'clarifications' && <section className={styles.workspace}>
        <div className={styles.workspaceHead}><div><span>CLIENT DELIVERABLE</span><h2>Clarification Log™</h2><p>Single log containing formal RFIs and GC Clarifications. Type controls filtering/export.</p></div><div className={styles.headerBadges}><Badge tone="blue">RFI</Badge><Badge tone="amber">GC Clarification</Badge></div></div>
        <div className={styles.pdfPage}>
          <div className={styles.pdfHeader}><img src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /><div><b>Clarification Log™</b><span>{projectTitle}</span><span>{selectedMaster.revision}</span></div></div>
          <table className={styles.logTable}><thead><tr><th>ID</th><th>Type</th><th>System</th><th>Subject</th><th>Clarification</th><th>Reference</th><th>Status</th><th>Response</th></tr></thead><tbody>{clarifications.map((row) => <tr key={row.id}><td><b>{row.id}</b></td><td>{row.type}</td><td>{row.system}</td><td>{row.subject}</td><td>{row.question}</td><td>{row.ref}</td><td>{row.status}</td><td>{row.response || '—'}</td></tr>)}</tbody></table>
        </div>
      </section>}

      {tab === 'checklist' && <section className={styles.workspace}>
        <div className={styles.workspaceHead}><div><span>CLIENT / BIDDER DELIVERABLE</span><h2>Contractor Scope Confirmation Checklist</h2><p>Standard confirmations plus project-specific contractor clarifications. The standard template remains default-on.</p></div></div>
        <div className={styles.pdfPage}>
          <div className={styles.pdfHeader}><img src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /><div><b>Contractor Scope Confirmation Checklist</b><span>{projectTitle}</span><span>{selectedMaster.revision}</span></div></div>
          <table className={styles.logTable}><thead><tr><th>ID</th><th>Category</th><th>Contractor Confirmation</th><th>Response</th><th>Contractor Notes</th></tr></thead><tbody>{checklist.map(([id, category, question]) => <tr key={id}><td><b>{id}</b></td><td>{category}</td><td>{question}</td><td>Yes / No / Qualified</td><td></td></tr>)}</tbody></table>
        </div>
      </section>}

      {tab === 've' && <section className={styles.workspace}>
        <div className={styles.workspaceHead}><div><span>CLIENT DELIVERABLE</span><h2>VE Opportunity Log</h2><p>Opportunity identification without ScopeLogic-owned budget pricing.</p></div><Badge tone="green">No required dollar savings</Badge></div>
        <div className={styles.pdfPage}>
          <div className={styles.pdfHeader}><img src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /><div><b>VE Opportunity Log</b><span>{projectTitle}</span><span>{selectedMaster.revision}</span></div></div>
          <div className={styles.summaryCards}><div><b>2</b><span>Identified</span></div><div><b>1</b><span>Under Review</span></div><div><b>0</b><span>Accepted</span></div><div><b>0</b><span>Rejected</span></div></div>
          <div className={styles.veList}>{veItems.map((item) => <article key={item.id}><div className={styles.veTitle}><div><span>{item.id} · {item.system}</span><h3>{item.title}</h3></div><Badge tone={item.status === 'Under Review' ? 'amber' : 'green'}>{item.status}</Badge></div><dl><div><dt>VE Opportunity</dt><dd>{item.opportunity}</dd></div><div><dt>Potential Impact / Considerations</dt><dd>{item.impact}</dd></div><div><dt>References</dt><dd>{item.refs}</dd></div><div><dt>Status</dt><dd>{item.status}</dd></div></dl></article>)}</div>
        </div>
      </section>}

      {tab === 'bid-internal' && <section className={styles.workspace}>
        <div className={styles.workspaceHead}><div><span>INTERNAL WORKSPACE</span><h2>Bid Alignment — Internal</h2><p>Dense working view. ScopeLogic identifies scope alignment and records pricing only when supported by a bidder, GC, vendor, or documented quote.</p></div><Badge tone="internal">Internal</Badge></div>
        <div className={styles.internalPanel}>
          <table className={styles.bidTable}><thead><tr><th>Scope Item</th><th>RBB / Source</th><th>Bidder A</th><th>Bidder B</th><th>Bidder C</th><th>Clarification / Pricing Status</th></tr></thead><tbody>{bidItems.map((row) => <tr key={row.scope}><td><b>{row.scope}</b></td><td>{row.rbb}</td><td>{row.a}</td><td>{row.b}</td><td>{row.c}</td><td>Unpriced unless documented response is received</td></tr>)}</tbody></table>
          <div className={styles.detailCard}><div><b>Bidder B — Category 6A Cabling</b><Badge tone="amber">Qualified</Badge></div><p><strong>Proposal statement:</strong> “Category 6 cabling included except WAP locations.”</p><p><strong>Proposal reference:</strong> Page 7, Clarification 12</p><p><strong>Bidder clarification:</strong> Confirm adder to provide Category 6A at all horizontal locations.</p><p><strong>Bidder-provided adder / credit:</strong> Not received — Unpriced</p><p><strong>Pricing source:</strong> —</p></div>
        </div>
      </section>}

      {tab === 'bid-external' && <section className={styles.workspace}>
        <div className={styles.workspaceHead}><div><span>CLIENT DELIVERABLE</span><h2>ScopeLogic Bid Alignment Report</h2><p>External comparison based on documented proposal scope and documented adders/credits only. No ScopeLogic-generated budget pricing.</p></div></div>
        <div className={styles.pdfPage}>
          <div className={styles.pdfHeader}><img src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /><div><b>Bid Alignment Report</b><span>{projectTitle}</span><span>{selectedMaster.revision}</span></div></div>
          <h3 className={styles.sectionTitle}>Bid Summary</h3>
          <table className={styles.logTable}><thead><tr><th>Bidder</th><th>Base Proposal</th><th>Documented Adders</th><th>Documented Credits</th><th>Known Unpriced Scope Differences</th></tr></thead><tbody><tr><td>Bidder A</td><td>$1,020,000</td><td>$22,000</td><td>—</td><td>2</td></tr><tr><td>Bidder B</td><td>$1,075,000</td><td>—</td><td>—</td><td>1</td></tr><tr><td>Bidder C</td><td>$1,110,000</td><td>$8,000</td><td>$5,000</td><td>3</td></tr></tbody></table>
          <h3 className={styles.sectionTitle}>Material Scope Differences</h3>
          <div className={styles.scopeDifference}><div><b>Permanent-Link Testing</b><span>RBB-004</span></div><div className={styles.bidderGrid}><p><strong>Bidder A</strong><span>Excluded</span><small>Bidder-provided adder: $22,000</small></p><p><strong>Bidder B</strong><span>Included</span><small>No adjustment required</small></p><p><strong>Bidder C</strong><span>Unclear</span><small>Unpriced — clarification outstanding</small></p></div></div>
          <div className={styles.scopeDifference}><div><b>Owner Training</b><span>RBB-006</span></div><div className={styles.bidderGrid}><p><strong>Bidder A</strong><span>Included</span><small>No adjustment required</small></p><p><strong>Bidder B</strong><span>Included</span><small>No adjustment required</small></p><p><strong>Bidder C</strong><span>Excluded</span><small>Unpriced — no documented adder received</small></p></div></div>
        </div>
      </section>}

      {tab === 'internal' && <section className={styles.workspace}>
        <div className={styles.workspaceHead}><div><span>NOT CLIENT DELIVERABLES</span><h2>Internal ScopeLogic Workflows</h2><p>These support the deliverables but do not leave ScopeLogic as standalone reports.</p></div><Badge tone="internal">Internal only</Badge></div>
        <div className={styles.internalGrid}><article><Badge tone="internal">Internal</Badge><h3>Review Notes</h3><p>Raw evidence capture from drawings, specifications, addenda, meetings, and field observations.</p><p><b>Feeds:</b> Evidence Groups → SLR</p></article><article><Badge tone="internal">Internal</Badge><h3>ScopeLogic Clarification</h3><p>Internal interpretation or unresolved analysis that must be settled before issuing a customer-facing recommendation.</p><p><b>May result in:</b> RBB, RFI, GC Clarification, Contractor Clarification, VE Opportunity, or no further action.</p></article><article><Badge tone="internal">Internal</Badge><h3>SLR</h3><p>Durable subject record tying evidence to the appropriate output lanes.</p><p><b>Outputs:</b> Matrix, Clarification Log, Contractor Checklist, VE Log.</p></article><article><Badge tone="internal">Internal</Badge><h3>Bid Alignment Workspace</h3><p>Proposal-level working analysis with inclusions, exclusions, qualifications, clarifications, documented adders/credits, and unpriced differences.</p><p><b>Output:</b> Bid Alignment Report.</p></article></div>
      </section>}
    </main>
  </div>;
}
