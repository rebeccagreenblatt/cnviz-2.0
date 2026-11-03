import { useEffect, useMemo, useRef, useState } from "react";
import type { Gene } from "../types";

interface GeneSearchProps {
  genes: Gene[];
  selectedGene?: Gene | null;
  onSelect: (gene: Gene) => void;
}

export default function GeneSearch({ genes, selectedGene, onSelect }: GeneSearchProps) {
  const [query, setQuery] = useState(selectedGene ? selectedGene.gene : "");
  const [prevSelected, setPrevSelected] = useState(selectedGene);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show the selected gene's name whenever the selection changes
  if (selectedGene !== prevSelected) {
    setPrevSelected(selectedGene);
    setQuery(selectedGene ? selectedGene.gene : "");
  }

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.toUpperCase();
    const prefixCovered: Gene[] = [];
    const prefixUncovered: Gene[] = [];
    const containsCovered: Gene[] = [];
    const containsUncovered: Gene[] = [];
    for (const g of genes) {
      const name = g.gene.toUpperCase();
      const covered = g.probe_count > 0;
      if (name.startsWith(q)) {
        (covered ? prefixCovered : prefixUncovered).push(g);
      } else if (name.includes(q)) {
        (covered ? containsCovered : containsUncovered).push(g);
      }
      if (prefixCovered.length + prefixUncovered.length >= 40) break;
    }
    // Covered genes first, then uncovered; prefix before contains within each group
    return [
      ...prefixCovered,
      ...containsCovered,
      ...prefixUncovered,
      ...containsUncovered,
    ].slice(0, 20);
  }, [query, genes]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleSelect = (gene: Gene) => {
    setQuery(gene.gene);
    setOpen(false);
    onSelect(gene);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(matches[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="gene-search">
      <input
        className="gene-search-input"
        type="text"
        autoComplete="off"
        value={query}
        placeholder="Search gene (e.g. BRCA1, TP53)..."
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && matches.length > 0 && (
        <ul className="gene-search-dropdown">
          {matches.map((g, i) => {
            const covered = g.probe_count > 0;
            return (
              <li
                key={g.gene}
                className={`gene-search-item${i === activeIndex ? " active" : ""}`}
                onMouseDown={() => handleSelect(g)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{ opacity: covered ? 1 : 0.6 }}
              >
                <span className="name">{g.gene}</span>
                <span className="meta">
                  {g.chromosome} &middot;{" "}
                  {covered ? (
                    <span className="probe-count">{g.probe_count} probes</span>
                  ) : (
                    <em>no probes</em>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
