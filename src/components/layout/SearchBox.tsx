import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useQuery } from "@/hooks/useQuery";
import { normalizeText } from "@/lib/utils";
import { listMaterials } from "@/services/stockService";
import { listRequests } from "@/services/requestsService";

interface SearchBoxProps {
  inputId: string;
}

export function SearchBox({ inputId }: SearchBoxProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const { data } = useQuery(async () => {
    const [requests, materials] = await Promise.all([listRequests(), listMaterials()]);
    return { requests, materials };
  });

  const results = useMemo(() => {
    const q = normalizeText(query);
    if (q.length < 2 || !data) return { requests: [], materials: [] };
    return {
      requests: data.requests
        .filter((r) => normalizeText(`${r.code} ${r.description} ${r.responsible}`).includes(q))
        .slice(0, 5),
      materials: data.materials.filter((m) => normalizeText(`${m.code} ${m.name}`).includes(q)).slice(0, 4),
    };
  }, [query, data]);

  const hasResults = results.requests.length + results.materials.length > 0;
  const showPanel = open && query.trim().length >= 2;

  useClickOutside(formRef, () => setOpen(false), open);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    close();
    navigate(`/solicitacoes?q=${encodeURIComponent(term)}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <form role="search" ref={formRef} onSubmit={submit} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        Pesquisar solicitações e materiais
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        id={inputId}
        type="search"
        role="combobox"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Pesquisar código, descrição ou material…"
        autoComplete="off"
        aria-expanded={showPanel && hasResults}
        aria-controls={`${inputId}-results`}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
      />

      {showPanel && (
        <div
          id={`${inputId}-results`}
          className="animate-fade-up absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {!hasResults ? (
            <p className="p-4 text-sm text-slate-500">Nenhum resultado para “{query.trim()}”.</p>
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto p-2">
              {results.requests.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Solicitações</p>
                  <ul>
                    {results.requests.map((r) => (
                      <li key={r.id}>
                        <Link
                          to={`/solicitacoes/${r.id}`}
                          onClick={close}
                          className="block rounded-md px-3 py-2 hover:bg-slate-100"
                        >
                          <span className="block text-sm font-medium text-navy-800">{r.code}</span>
                          <span className="block truncate text-xs text-slate-500">{r.description}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {results.materials.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Materiais</p>
                  <ul>
                    {results.materials.map((m) => (
                      <li key={m.id}>
                        <Link
                          to={`/estoque/${m.id}`}
                          onClick={close}
                          className="block rounded-md px-3 py-2 hover:bg-slate-100"
                        >
                          <span className="block text-sm font-medium text-navy-800">{m.code}</span>
                          <span className="block truncate text-xs text-slate-500">{m.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <button
            type="submit"
            className="w-full border-t border-slate-200 px-4 py-3 text-left text-sm font-medium text-navy-700 hover:bg-slate-50"
          >
            Ver solicitações para “{query.trim()}”
          </button>
        </div>
      )}
    </form>
  );
}
