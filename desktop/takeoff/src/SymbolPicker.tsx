import { useMemo, useState } from 'react';
import {
  searchTakeoffSymbols,
  TakeoffSymbol,
  type SymbolCategory,
  type TakeoffSymbolDefinition,
} from './symbol-registry';

export type SymbolPickerProps = {
  value: string;
  color: string;
  onChange: (symbolId: string) => void;
};

const CATEGORY_ORDER: SymbolCategory[] = [
  'Generic',
  'Structured Cabling',
  'Video Surveillance',
  'Access Control',
  'Intrusion',
  'Intercom',
  'AV / PA',
  'Fire Alarm',
];

function groupByCategory(symbols: TakeoffSymbolDefinition[]) {
  const grouped = new Map<SymbolCategory, TakeoffSymbolDefinition[]>();
  for (const category of CATEGORY_ORDER) grouped.set(category, []);
  for (const symbol of symbols) grouped.get(symbol.category)?.push(symbol);
  return grouped;
}

export default function SymbolPicker({ value, color, onChange }: SymbolPickerProps) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchTakeoffSymbols(query), [query]);
  const grouped = useMemo(() => groupByCategory(matches), [matches]);

  return (
    <div className="symbol-picker">
      <input
        className="symbol-picker-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search symbols..."
        aria-label="Search Takeoff symbols"
      />

      <div className="symbol-picker-scroll">
        {CATEGORY_ORDER.map((category) => {
          const symbols = grouped.get(category) || [];
          if (!symbols.length) return null;
          return (
            <section className="symbol-picker-group" key={category}>
              <header>{category}</header>
              <div className="symbol-picker-grid">
                {symbols.map((symbol) => (
                  <button
                    type="button"
                    key={symbol.id}
                    className={symbol.id === value ? 'symbol-picker-item selected' : 'symbol-picker-item'}
                    onClick={() => onChange(symbol.id)}
                    title={symbol.name}
                  >
                    <TakeoffSymbol symbolId={symbol.id} color={color} size={22} />
                    <span>{symbol.name}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {!matches.length && (
          <div className="symbol-picker-empty">No symbols match "{query}".</div>
        )}
      </div>
    </div>
  );
}
