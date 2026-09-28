import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { TakeoffSymbol } from './symbol-registry';
import type { Mark, Tool } from './takeoff-model';
import { legacyShapeToSymbolId } from './tool-normalization';
import './markups-list-dock.css';

type Props = {
  marks: Mark[];
  tools: Tool[];
  pageLabels: Record<number, string>;
  activePage: number;
  selectedMarkId?: string;
  onSelectTool: (toolId: string) => void;
  onSelectCountGroup: (toolId: string, page?: number) => void;
};

type PageGroup = {
  page: number;
  label: string;
  marks: Mark[];
};

type ToolGroup = {
  tool: Tool;
  marks: Mark[];
  pages: PageGroup[];
};

function symbolId(tool: Tool) {
  return tool.symbolId || legacyShapeToSymbolId(tool.shape);
}

export default function MarkupsListDock({
  marks,
  tools,
  pageLabels,
  activePage,
  selectedMarkId,
  onSelectTool,
  onSelectCountGroup,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(270);
  const [query, setQuery] = useState('');
  const [sheetScope, setSheetScope] = useState<'all' | 'current'>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const groups = useMemo<ToolGroup[]>(() => {
    const toolById = new Map(tools.map((tool) => [tool.id, tool]));
    const grouped = new Map<string, Mark[]>();
    for (const mark of marks) {
      if (!toolById.has(mark.toolId)) continue;
      if (sheetScope === 'current' && mark.page !== activePage) continue;
      const list = grouped.get(mark.toolId) || [];
      list.push(mark);
      grouped.set(mark.toolId, list);
    }

    const normalizedQuery = query.trim().toLocaleLowerCase();
    return [...grouped.entries()]
      .map(([toolId, groupMarks]) => {
        const tool = toolById.get(toolId)!;
        const pageMap = new Map<number, Mark[]>();
        for (const mark of groupMarks) {
          const list = pageMap.get(mark.page) || [];
          list.push(mark);
          pageMap.set(mark.page, list);
        }
        const pages = [...pageMap.entries()]
          .map(([page, pageMarks]) => ({ page, label: pageLabels[page] || `Page ${page}`, marks: pageMarks }))
          .sort((a, b) => a.page - b.page);
        return { tool, marks: groupMarks, pages };
      })
      .filter((group) => {
        if (!normalizedQuery) return true;
        if (group.tool.name.toLocaleLowerCase().includes(normalizedQuery)) return true;
        if ((group.tool.system || '').toLocaleLowerCase().includes(normalizedQuery)) return true;
        return group.pages.some((page) => page.label.toLocaleLowerCase().includes(normalizedQuery)
          || page.marks.some((mark) => (mark.comments || '').toLocaleLowerCase().includes(normalizedQuery)));
      })
      .sort((a, b) => a.tool.name.localeCompare(b.tool.name));
  }, [marks, tools, pageLabels, activePage, query, sheetScope]);

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startY: event.clientY, startHeight: height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - event.clientY;
    const max = Math.max(220, Math.round(window.innerHeight * 0.7));
    setHeight(Math.max(145, Math.min(max, dragRef.current.startHeight + delta)));
  };

  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
  };

  const toggleExpanded = (toolId: string) => {
    setExpanded((current) => ({ ...current, [toolId]: !(current[toolId] ?? true) }));
  };

  if (collapsed) {
    return (
      <section className="markups-list-dock collapsed">
        <button type="button" className="markups-list-expand" onClick={() => setCollapsed(false)}>⌃</button>
        <b>Markups List</b>
        <span>{marks.length} raw count mark{marks.length === 1 ? '' : 's'}</span>
      </section>
    );
  }

  return (
    <section className="markups-list-dock" style={{ height }}>
      <div
        className="markups-list-resize-handle"
        onPointerDown={beginResize}
        onPointerMove={resize}
        onPointerUp={endResize}
        onDoubleClick={() => setCollapsed(true)}
        title="Drag to resize. Double-click to collapse."
      />

      <header className="markups-list-toolbar">
        <div className="markups-list-title"><b>Markups List</b><span>⌄</span></div>
        <label className="markups-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label>
        <label className="markups-filter"><span>Filter List</span><select value={sheetScope} onChange={(event) => setSheetScope(event.target.value as 'all' | 'current')}><option value="all">All Sheets</option><option value="current">Current Sheet</option></select></label>
        <span className="markups-list-total">Total Count <b>{groups.reduce((sum, group) => sum + group.marks.length, 0)}</b></span>
        <button type="button" className="markups-list-collapse" onClick={() => setCollapsed(true)} title="Collapse Markups List">⌄</button>
      </header>

      <div className="markups-table-wrap">
        <div className="markups-grid markups-grid-head">
          <span>Subject</span><span>Count</span><span>Color</span><span>System</span><span>Comments</span><span>Page Label</span><span>Custom Count</span>
        </div>

        {!groups.length && <div className="markups-empty">Placed count symbols will appear here and group by subject and sheet.</div>}

        {groups.map((group) => {
          const isOpen = expanded[group.tool.id] ?? true;
          const selectedInGroup = group.marks.some((mark) => mark.id === selectedMarkId);
          return (
            <div className="markups-tool-group" key={group.tool.id}>
              <div className={selectedInGroup ? 'markups-grid markups-group-row selected' : 'markups-grid markups-group-row'}>
                <button type="button" className="markups-subject group" onClick={() => toggleExpanded(group.tool.id)}>
                  <span className={isOpen ? 'markups-chevron open' : 'markups-chevron'}>›</span>
                  <TakeoffSymbol symbolId={symbolId(group.tool)} color={group.tool.color} size={16} />
                  <b>{group.tool.name} ({group.pages.length})</b>
                </button>
                <button type="button" className="markups-count total" onClick={() => { onSelectTool(group.tool.id); onSelectCountGroup(group.tool.id); }}>{group.marks.length}</button>
                <span className="markups-color-cell"><i style={{ background: group.tool.color }} /></span>
                <span>{group.tool.system || '—'}</span>
                <span>{group.marks.filter((mark) => Boolean(mark.comments?.trim())).length || ''}</span>
                <span>—</span>
                <span>1 / mark</span>
              </div>

              {isOpen && group.pages.map((pageGroup) => {
                const selectedOnPage = pageGroup.marks.some((mark) => mark.id === selectedMarkId);
                const comment = pageGroup.marks.find((mark) => mark.comments?.trim())?.comments || '';
                return (
                  <button
                    type="button"
                    key={`${group.tool.id}:${pageGroup.page}`}
                    className={selectedOnPage ? 'markups-grid markups-child-row selected' : 'markups-grid markups-child-row'}
                    onClick={() => onSelectCountGroup(group.tool.id, pageGroup.page)}
                  >
                    <span className="markups-subject child"><TakeoffSymbol symbolId={symbolId(group.tool)} color={group.tool.color} size={14} /><span>{group.tool.name}</span></span>
                    <b className="markups-count">{pageGroup.marks.length}</b>
                    <span className="markups-color-cell"><i style={{ background: group.tool.color }} /></span>
                    <span>{group.tool.system || '—'}</span>
                    <span className="markups-comments">{comment}</span>
                    <span>{pageGroup.label}</span>
                    <span>1</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
