import { markupLabel, updateMarkup, updateSnippet } from './annotations';
import type { DrawingMarkup, DrawingSnippet } from './takeoff-model';

export type AnnotationPanelProps = {
  markups: DrawingMarkup[];
  snippets: DrawingSnippet[];
  selectedMarkupId: string;
  selectedSnippetId: string;
  onSelectMarkup: (id: string) => void;
  onSelectSnippet: (id: string) => void;
  onChangeMarkups: (items: DrawingMarkup[]) => void;
  onChangeSnippets: (items: DrawingSnippet[]) => void;
  onGoToPage: (page: number) => void;
  onDeleteSelected: () => void;
};

export default function AnnotationPanel({
  markups,
  snippets,
  selectedMarkupId,
  selectedSnippetId,
  onSelectMarkup,
  onSelectSnippet,
  onChangeMarkups,
  onChangeSnippets,
  onGoToPage,
  onDeleteSelected,
}: AnnotationPanelProps) {
  const selectedMarkup = markups.find((item) => item.id === selectedMarkupId) || null;
  const selectedSnippet = snippets.find((item) => item.id === selectedSnippetId) || null;

  const patchMarkup = (patch: Partial<DrawingMarkup>) => {
    if (!selectedMarkup) return;
    onChangeMarkups(markups.map((item) => item.id === selectedMarkup.id ? updateMarkup(item, patch) : item));
  };

  const patchSnippet = (patch: Partial<DrawingSnippet>) => {
    if (!selectedSnippet) return;
    onChangeSnippets(snippets.map((item) => item.id === selectedSnippet.id ? updateSnippet(item, patch) : item));
  };

  return (
    <div className="right-content annotation-panel">
      <div className="panel-title">
        <b>Annotations</b>
        <span>{markups.length} markups · {snippets.length} snippets</span>
      </div>

      <div className="subsection-title"><b>Markups</b><span>{markups.length}</span></div>
      {!markups.length && <div className="empty-compact">Drawing markups will appear here. They do not affect takeoff quantities.</div>}
      <div className="annotation-list">
        {markups.map((markup) => (
          <button
            key={markup.id}
            className={markup.id === selectedMarkupId ? 'annotation-row selected' : 'annotation-row'}
            onClick={() => {
              onSelectMarkup(markup.id);
              onSelectSnippet('');
              onGoToPage(markup.page);
            }}
          >
            <span><b>{markup.text?.trim() || markupLabel(markup.kind)}</b><small>{markupLabel(markup.kind)}{markup.referenceId ? ` · ${markup.referenceId}` : ''}</small></span>
            <em>P{markup.page}</em>
          </button>
        ))}
      </div>

      <div className="subsection-title"><b>Snippets</b><span>{snippets.length}</span></div>
      {!snippets.length && <div className="empty-compact">Captured drawing regions will appear here with their page and source reference.</div>}
      <div className="annotation-list">
        {snippets.map((snippet) => (
          <button
            key={snippet.id}
            className={snippet.id === selectedSnippetId ? 'annotation-row selected' : 'annotation-row'}
            onClick={() => {
              onSelectSnippet(snippet.id);
              onSelectMarkup('');
              onGoToPage(snippet.page);
            }}
          >
            <span><b>{snippet.title || `Snippet · Page ${snippet.page}`}</b><small>{snippet.note || snippet.referenceId || 'Drawing snippet'}</small></span>
            <em>P{snippet.page}</em>
          </button>
        ))}
      </div>

      {(selectedMarkup || selectedSnippet) && (
        <div className="annotation-inspector">
          {selectedMarkup && (
            <>
              {selectedMarkup.kind === 'text' && (
                <label><span>Text</span><input value={selectedMarkup.text || ''} onChange={(event) => patchMarkup({ text: event.target.value })} /></label>
              )}
              <label><span>Reference / Issue ID</span><input value={selectedMarkup.referenceId || ''} onChange={(event) => patchMarkup({ referenceId: event.target.value })} placeholder="Optional" /></label>
              <label><span>Reference Note</span><textarea value={selectedMarkup.referenceNote || ''} onChange={(event) => patchMarkup({ referenceNote: event.target.value })} placeholder="Optional note" /></label>
            </>
          )}

          {selectedSnippet && (
            <>
              <label><span>Title</span><input value={selectedSnippet.title} onChange={(event) => patchSnippet({ title: event.target.value })} /></label>
              <label><span>Note</span><textarea value={selectedSnippet.note} onChange={(event) => patchSnippet({ note: event.target.value })} /></label>
              <label><span>Reference / Issue ID</span><input value={selectedSnippet.referenceId || ''} onChange={(event) => patchSnippet({ referenceId: event.target.value })} placeholder="Optional" /></label>
              <label><span>Reference Note</span><textarea value={selectedSnippet.referenceNote || ''} onChange={(event) => patchSnippet({ referenceNote: event.target.value })} placeholder="Optional note" /></label>
            </>
          )}

          <button className="button danger wide" onClick={onDeleteSelected}>Delete Selected Annotation</button>
        </div>
      )}
    </div>
  );
}
