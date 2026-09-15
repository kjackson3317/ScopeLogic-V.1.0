import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import './drawing-pages.css';

type PageCounts = Record<number, number>;
type PageCalibrationMap = Record<number, { label: string } | undefined>;
type PageFilter = 'all' | 'marked' | 'measured' | 'scaled';

type Props = {
  pdfDoc: any;
  pageCount: number;
  activePage: number;
  onSelectPage: (page: number) => void;
  markCountByPage: PageCounts;
  measurementCountByPage: PageCounts;
  pageCalibrations: PageCalibrationMap;
};

type SearchState = {
  query: string;
  matches: Set<number> | null;
  scanning: boolean;
  scanned: number;
};

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

function LazyPageThumbnail({ pdfDoc, pageNumber }: { pdfDoc: any; pageNumber: number }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '180px 0px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;
    if (!visible || !pdfDoc || !canvasRef.current) return;

    const render = async () => {
      try {
        const pdfPage = await pdfDoc.getPage(pageNumber);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const cssWidth = 48;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({ scale: (cssWidth / baseViewport.width) * dpr });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${Math.max(30, Math.round(viewport.height / dpr))}px`;
        renderTask = pdfPage.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (cause: any) {
        if (!cancelled && cause?.name !== 'RenderingCancelledException') setFailed(true);
      }
    };

    void render();
    return () => {
      cancelled = true;
      try { renderTask?.cancel?.(); } catch { /* no-op */ }
    };
  }, [visible, pdfDoc, pageNumber]);

  return (
    <span ref={hostRef} className={failed ? 'page-thumb drawing-thumb failed' : 'page-thumb drawing-thumb'}>
      <canvas ref={canvasRef} />
      {!visible && <span className="thumb-placeholder">{pageNumber}</span>}
      {failed && <span className="thumb-placeholder">{pageNumber}</span>}
    </span>
  );
}

export default function DrawingPagesRail({
  pdfDoc,
  pageCount,
  activePage,
  onSelectPage,
  markCountByPage,
  measurementCountByPage,
  pageCalibrations,
}: Props) {
  const textCache = useRef(new Map<number, string>());
  const searchGeneration = useRef(0);
  const [pageLabels, setPageLabels] = useState<string[]>([]);
  const [filter, setFilter] = useState<PageFilter>('all');
  const [queryInput, setQueryInput] = useState('');
  const [search, setSearch] = useState<SearchState>({ query: '', matches: null, scanning: false, scanned: 0 });

  useEffect(() => {
    let cancelled = false;
    searchGeneration.current += 1;
    textCache.current.clear();
    setQueryInput('');
    setSearch({ query: '', matches: null, scanning: false, scanned: 0 });
    setFilter('all');
    setPageLabels([]);
    if (!pdfDoc) return;

    const loadLabels = async () => {
      try {
        const labels = await pdfDoc.getPageLabels?.();
        if (!cancelled && Array.isArray(labels)) setPageLabels(labels.map((label: unknown) => String(label ?? '')));
      } catch {
        if (!cancelled) setPageLabels([]);
      }
    };
    void loadLabels();
    return () => { cancelled = true; };
  }, [pdfDoc]);

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const query = normalize(queryInput);
    const generation = searchGeneration.current + 1;
    searchGeneration.current = generation;

    if (!query || !pdfDoc || !pageCount) {
      setSearch({ query: '', matches: null, scanning: false, scanned: 0 });
      return;
    }

    setSearch({ query, matches: new Set(), scanning: true, scanned: 0 });
    const matches = new Set<number>();
    let cursor = 1;
    let completed = 0;
    const workerCount = Math.min(4, pageCount);

    const scanPage = async (pageNumber: number) => {
      const label = pageLabels[pageNumber - 1] || '';
      if (normalize(label).includes(query) || String(pageNumber).includes(query)) {
        matches.add(pageNumber);
        return;
      }

      let text = textCache.current.get(pageNumber);
      if (text === undefined) {
        try {
          const pdfPage = await pdfDoc.getPage(pageNumber);
          const textContent = await pdfPage.getTextContent();
          text = normalize(textContent.items
            .map((item: any) => typeof item?.str === 'string' ? item.str : '')
            .filter(Boolean)
            .join(' '));
        } catch {
          text = '';
        }
        textCache.current.set(pageNumber, text);
      }
      if (text.includes(query)) matches.add(pageNumber);
    };

    const worker = async () => {
      while (true) {
        if (generation !== searchGeneration.current) return;
        const pageNumber = cursor;
        cursor += 1;
        if (pageNumber > pageCount) return;
        await scanPage(pageNumber);
        completed += 1;
        if (generation === searchGeneration.current) {
          setSearch({ query, matches: new Set(matches), scanning: completed < pageCount, scanned: completed });
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    if (generation === searchGeneration.current) {
      setSearch({ query, matches: new Set(matches), scanning: false, scanned: pageCount });
    }
  };

  const clearSearch = () => {
    searchGeneration.current += 1;
    setQueryInput('');
    setSearch({ query: '', matches: null, scanning: false, scanned: 0 });
  };

  const visiblePages = useMemo(() => {
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
    return pages.filter((pageNumber) => {
      if (search.matches && !search.matches.has(pageNumber)) return false;
      if (filter === 'marked' && !markCountByPage[pageNumber]) return false;
      if (filter === 'measured' && !measurementCountByPage[pageNumber]) return false;
      if (filter === 'scaled' && !pageCalibrations[pageNumber]) return false;
      return true;
    });
  }, [pageCount, search.matches, filter, markCountByPage, measurementCountByPage, pageCalibrations]);

  const resultStatus = search.scanning
    ? `Searching ${search.scanned}/${pageCount}`
    : search.matches
      ? `${visiblePages.length} match${visiblePages.length === 1 ? '' : 'es'}`
      : `${visiblePages.length} page${visiblePages.length === 1 ? '' : 's'}`;

  return (
    <section className="rail-section pages-section drawing-pages-section">
      <div className="rail-heading"><b>Pages</b><span>{resultStatus}</span></div>
      <form className="drawing-page-search" onSubmit={runSearch}>
        <input
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Search sheet text…"
          aria-label="Search drawing sheet text"
        />
        <button type="submit" disabled={!queryInput.trim() || search.scanning}>{search.scanning ? '…' : 'Find'}</button>
        <button type="button" className="clear" disabled={!queryInput && !search.matches} onClick={clearSearch} aria-label="Clear page search">×</button>
      </form>
      <div className="drawing-page-filter" role="group" aria-label="Page filter">
        {(['all', 'marked', 'measured', 'scaled'] as PageFilter[]).map((value) => (
          <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
            {value === 'all' ? 'All' : value === 'marked' ? 'Counted' : value === 'measured' ? 'Measured' : 'Scaled'}
          </button>
        ))}
      </div>
      <div className="page-list drawing-page-list">
        {!pageCount && <div className="empty-compact">Open a PDF drawing set.</div>}
        {pageCount > 0 && !visiblePages.length && !search.scanning && <div className="empty-compact">No sheets match the current search/filter.</div>}
        {visiblePages.map((pageNumber) => {
          const markCount = markCountByPage[pageNumber] || 0;
          const measurementCount = measurementCountByPage[pageNumber] || 0;
          const label = pageLabels[pageNumber - 1];
          return (
            <button key={pageNumber} className={pageNumber === activePage ? 'page-row active' : 'page-row'} onClick={() => onSelectPage(pageNumber)}>
              <LazyPageThumbnail pdfDoc={pdfDoc} pageNumber={pageNumber} />
              <span className="drawing-page-copy">
                <b>{label ? `Sheet ${label}` : `Page ${pageNumber}`}</b>
                <small>PDF {pageNumber} · {markCount} count · {measurementCount} meas.</small>
              </span>
              <span className={pageCalibrations[pageNumber] ? 'page-scale-dot scaled' : 'page-scale-dot'} title={pageCalibrations[pageNumber]?.label || 'Unscaled'} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
