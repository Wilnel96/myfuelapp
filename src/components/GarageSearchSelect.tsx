import { useMemo, useRef, useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface GarageOption {
  id: string;
  name: string;
  city: string | null;
}

interface GarageSearchSelectProps {
  garages: GarageOption[];
  value: string;
  onChange: (garageId: string) => void;
  inputClassName: string;
}

const MAX_RESULTS = 50;

export default function GarageSearchSelect({ garages, value, onChange, inputClassName }: GarageSearchSelectProps) {
  const selected = garages.find(g => g.id === value) || null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const labelFor = (g: GarageOption) => (g.city ? `${g.name} - ${g.city}` : g.name);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = terms.length === 0
      ? garages
      : garages.filter(g => {
          const haystack = `${g.name} ${g.city ?? ''}`.toLowerCase();
          return terms.every(t => haystack.includes(t));
        });
    return matches;
  }, [garages, query]);

  const visible = results.slice(0, MAX_RESULTS);

  const pick = (garage: GarageOption) => {
    onChange(garage.id);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      {selected && !open ? (
        <div className={`${inputClassName} flex items-center justify-between gap-2 cursor-pointer`} onClick={() => setOpen(true)}>
          <span className="truncate text-gray-900">{labelFor(selected)}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
            aria-label="Clear garage"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && visible.length > 0) {
                e.preventDefault();
                pick(visible[0]);
              }
            }}
            placeholder="Search by garage name or city"
            className={`${inputClassName} pl-10`}
            autoComplete="off"
          />
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No garages match "{query.trim()}"</p>
          ) : (
            <ul role="listbox">
              {visible.map(g => (
                <li key={g.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={g.id === value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(g)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 ${g.id === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-800'}`}
                  >
                    {labelFor(g)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.length > MAX_RESULTS && (
            <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
              Showing first {MAX_RESULTS} of {results.length}. Keep typing to narrow the list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
