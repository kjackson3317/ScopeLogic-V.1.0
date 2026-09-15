import type { MouseEvent as ReactMouseEvent } from 'react';
import type { PageSize, Point } from './measurements';
import type { DrawingMarkup, DrawingSnippet } from './takeoff-model';

const toPoint = (point: Point, size: PageSize) => ({ x: point.x * size.width, y: point.y * size.height });
const toPoints = (points: Point[], size: PageSize) => points.map((point) => `${point.x * size.width},${point.y * size.height}`).join(' ');

function rectFromMarkup(markup: DrawingMarkup, size: PageSize) {
  const a = toPoint(markup.points[0], size);
  const b = toPoint(markup.points[1] || markup.points[0], size);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

type Props = {
  page: number;
  pageSize: PageSize;
  markups: DrawingMarkup[];
  snippets: DrawingSnippet[];
  selectedMarkupId?: string;
  selectedSnippetId?: string;
  onSelectMarkup?: (id: string) => void;
  onSelectSnippet?: (id: string) => void;
};

export default function AnnotationLayer({
  page,
  pageSize,
  markups,
  snippets,
  selectedMarkupId,
  selectedSnippetId,
  onSelectMarkup,
  onSelectSnippet,
}: Props) {
  const currentMarkups = markups.filter((item) => item.page === page);
  const currentSnippets = snippets.filter((item) => item.page === page);

  const stop = (event: ReactMouseEvent<SVGElement>) => event.stopPropagation();

  return (
    <g className="annotation-layer">
      <defs>
        <marker id="sl-annotation-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
        </marker>
      </defs>

      {currentMarkups.map((markup) => {
        const selected = markup.id === selectedMarkupId;
        const className = selected ? `drawing-annotation ${markup.kind} selected` : `drawing-annotation ${markup.kind}`;
        const select = (event: ReactMouseEvent<SVGElement>) => {
          stop(event);
          onSelectMarkup?.(markup.id);
        };
        const common = {
          className,
          stroke: markup.color,
          strokeWidth: markup.strokeWidth,
          opacity: markup.opacity,
          fill: 'none',
          onClick: select,
        };

        if (markup.kind === 'text') {
          const point = toPoint(markup.points[0], pageSize);
          return (
            <g key={markup.id} className={className} onClick={select}>
              <rect x={point.x - 3} y={point.y - 15} width={Math.max(72, (markup.text || 'Note').length * 6.5)} height="22" rx="4" fill="white" stroke={markup.color} strokeWidth="1" opacity="0.96" />
              <text x={point.x + 4} y={point.y} fill={markup.color} fontSize="12" fontWeight="600">{markup.text || 'Note'}</text>
            </g>
          );
        }

        if (markup.kind === 'freehand') {
          return <polyline key={markup.id} {...common} points={toPoints(markup.points, pageSize)} strokeLinecap="round" strokeLinejoin="round" />;
        }

        if (markup.kind === 'line' || markup.kind === 'arrow') {
          const a = toPoint(markup.points[0], pageSize);
          const b = toPoint(markup.points[1] || markup.points[0], pageSize);
          return <line key={markup.id} {...common} x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={markup.kind === 'arrow' ? 'url(#sl-annotation-arrow)' : undefined} />;
        }

        const rect = rectFromMarkup(markup, pageSize);
        if (markup.kind === 'highlight') {
          return <rect key={markup.id} {...common} {...rect} fill={markup.color} stroke="none" />;
        }

        return (
          <rect
            key={markup.id}
            {...common}
            {...rect}
            rx={markup.kind === 'cloud' ? 8 : 2}
            strokeDasharray={markup.kind === 'cloud' ? '2 5' : undefined}
          />
        );
      })}

      {currentSnippets.map((snippet) => {
        const selected = snippet.id === selectedSnippetId;
        const x = snippet.bounds.x * pageSize.width;
        const y = snippet.bounds.y * pageSize.height;
        const width = snippet.bounds.width * pageSize.width;
        const height = snippet.bounds.height * pageSize.height;
        return (
          <g
            key={snippet.id}
            className={selected ? 'drawing-snippet selected' : 'drawing-snippet'}
            onClick={(event) => {
              stop(event);
              onSelectSnippet?.(snippet.id);
            }}
          >
            <rect x={x} y={y} width={width} height={height} rx="2" />
            <g transform={`translate(${x + 5} ${y + 5})`}>
              <rect width="56" height="17" rx="3" />
              <text x="28" y="11.5" textAnchor="middle">SNIPPET</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
