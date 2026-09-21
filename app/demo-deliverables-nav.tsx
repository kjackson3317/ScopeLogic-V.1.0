'use client';

import { useState } from 'react';

const ITEMS = [
  ['master-register', 'Master Coordination Register'],
  ['matrix', 'Scope Matrix / RBB'],
  ['clarifications', 'GC Clarifications'],
  ['rfi', 'Formal RFI'],
  ['ve', 'VE Opportunities'],
  ['checklist', 'Contractor Scope Confirmation'],
  ['bid-internal', 'Bid Alignment'],
  ['bid-report', 'Reports / Official Releases'],
] as const;

export default function DemoDeliverablesNav() {
  const [open, setOpen] = useState(true);

  return (
    <div className={`nav-group nav-folder ${open ? 'open' : ''}`} data-demo-deliverables-nav="true">
      <button
        type="button"
        className="nav-folder-head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="nav-folder-icon">{open ? '▾' : '▸'}</span>
        <b>DELIVERABLES</b>
        <small>{ITEMS.length}</small>
      </button>
      {open && (
        <div className="nav-folder-items">
          {ITEMS.map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className="sl-deliverable-nav-link"
              data-deliverable-preview={tab}
            >
              <span className="nav-tree-line">├</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
