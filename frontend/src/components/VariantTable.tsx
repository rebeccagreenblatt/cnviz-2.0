import { useMemo, useState } from "react";
import type { Gene, SomaticVariant } from "../types";
import { useCopyLocus } from "../useCopyLocus";

/**
 * Somatic variant table, used twice: all variants (with a Gene column; collapsible) and the selected gene's
 * variants in gene view. Columns sort on click; the filter row narrows by gene, classification or significance.
 * Variants flagged hiddenByDefault (intronic / UTR / silent / benign, not pathogenic) appear only when
 * "Show N hidden variants" is ticked; the setting is shared by both tables.
 */
interface VariantTableProps {
  title: string;
  variants: SomaticVariant[];
  showHidden: boolean;
  onShowHidden: (show: boolean) => void;
  collapsible?: boolean;
  /** Adds the Gene column (with filter); clicking a gene opens its gene view */
  geneColumn?: { genesByName: Map<string, Gene>; onGeneSelect?: (gene: Gene) => void };
}

type SortKey = "gene" | "position" | "classification" | "significance" | "vaf" | "depth";

const cellStyle = { padding: "0.3rem 0.5rem" };
const sortableStyle = { ...cellStyle, cursor: "pointer", userSelect: "none" as const };
const filterInputStyle = { width: "100%", fontSize: "0.75rem", padding: "0.2rem 0.3rem", border: "1px solid #ddd", borderRadius: "3px", fontFamily: "monospace" };
const hintStyle = { fontWeight: 400, color: "#999", fontSize: "0.75rem" };

export default function VariantTable({ title, variants, showHidden, onShowHidden, collapsible = false, geneColumn }: VariantTableProps) {
  const [open, setOpen] = useState(true);
  const { message: copyMsg, copyLocus } = useCopyLocus();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [filters, setFilters] = useState({ gene: "", classification: "", significance: "" });

  const hiddenCount = variants.filter((v) => v.hiddenByDefault).length;
  const shown = useMemo(() => showHidden ? variants : variants.filter((v) => !v.hiddenByDefault), [variants, showHidden]);

  const rows = useMemo(() => {
    const has = (value: string, filter: string) => !filter || value.toLowerCase().includes(filter.toLowerCase());
    const filtered = shown.filter((v) =>
      has(v.gene, filters.gene) && has(v.classification || "", filters.classification) && has(v.significance || "", filters.significance));
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "gene": return sortDir * a.gene.localeCompare(b.gene);
        case "position": return sortDir * (a.chromosome.localeCompare(b.chromosome, undefined, { numeric: true }) || a.position - b.position);
        case "classification": return sortDir * (a.classification || "").localeCompare(b.classification || "");
        case "significance": return sortDir * (a.significance || "").localeCompare(b.significance || "");
        case "vaf": return compareNullable(a.vaf, b.vaf, sortDir);
        case "depth": return compareNullable(a.depth, b.depth, sortDir);
      }
    });
  }, [shown, filters, sortKey, sortDir]);

  if (variants.length === 0) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 1 ? -1 : 1);
    else { setSortKey(key); setSortDir(1); }
  };
  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 1 ? " ▲" : " ▼") : "";
  const sortable = (key: SortKey, label: React.ReactNode) =>
    <th style={sortableStyle} onClick={() => handleSort(key)}>{label}{arrow(key)}</th>;
  const filterCell = (key: keyof typeof filters) => (
    <td style={cellStyle}>
      <input autoComplete="off" style={filterInputStyle} placeholder="filter..." value={filters[key]}
        onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} />
    </td>
  );
  const hasFilters = filters.gene || filters.classification || filters.significance;
  const isOpen = !collapsible || open;

  return (
    <div style={{ margin: "0.5rem 0", padding: "0.75rem", background: "#fafafa", borderRadius: "6px", border: "1px solid #e0e0e0" }}>
      <h3
        style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", ...(collapsible ? { cursor: "pointer", userSelect: "none" } : {}) }}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        {collapsible && (open ? "▾ " : "▸ ")}{title} ({hasFilters ? `${rows.length} / ${shown.length}` : shown.length})
      </h3>
      {isOpen && hiddenCount > 0 && (
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "#555", margin: "0 0 0.5rem", cursor: "pointer" }}>
          <input type="checkbox" checked={showHidden} onChange={(e) => onShowHidden(e.target.checked)} />
          Show {hiddenCount} hidden variant{hiddenCount === 1 ? "" : "s"} (intronic, intergenic, flanking, UTR, silent or benign)
        </label>
      )}
      {copyMsg && (
        <p style={{ color: copyMsg.ok ? "#2e7d32" : "#c00", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>
          {copyMsg.text}
        </p>
      )}
      {isOpen && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", fontFamily: "monospace" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                {geneColumn && sortable("gene", "Gene")}
                {sortable("position", <>Position <span style={hintStyle}>(click to copy locus for IGV)</span></>)}
                <th style={cellStyle}>Ref/Alt</th>
                <th style={cellStyle}>HGVSc</th>
                <th style={cellStyle}>HGVSp</th>
                {sortable("classification", "Classification")}
                {sortable("significance", "Significance")}
                {sortable("vaf", "VAF")}
                {sortable("depth", "Depth")}
              </tr>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                {geneColumn && filterCell("gene")}
                <td style={cellStyle} />
                <td style={cellStyle} />
                <td style={cellStyle} />
                <td style={cellStyle} />
                {filterCell("classification")}
                {filterCell("significance")}
                <td style={cellStyle} />
                <td style={cellStyle} />
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => {
                const gene = geneColumn && (geneColumn.genesByName.get(v.gene) || geneColumn.genesByName.get(v.gene.toUpperCase()));
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    {geneColumn && (
                      <td
                        style={{ ...cellStyle, color: gene ? "#0072B2" : undefined, fontWeight: 500, cursor: gene ? "pointer" : "default" }}
                        onClick={() => { if (gene) geneColumn.onGeneSelect?.(gene); }}
                      >{v.gene}</td>
                    )}
                    <td style={{ ...cellStyle, color: "#0072B2", cursor: "pointer" }} onClick={() => copyLocus(`${v.chromosome}:${v.position}`)}>
                      {v.chromosome}:{v.position.toLocaleString()}
                    </td>
                    <td style={{ ...cellStyle, maxWidth: "8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${v.ref}>${v.alt}`}>{v.ref}{'>'}{v.alt}</td>
                    <td style={cellStyle}>{v.hgvsc || "—"}</td>
                    <td style={cellStyle}>{v.hgvsp || "—"}</td>
                    <td style={cellStyle}>{v.classification || "—"}</td>
                    <td style={cellStyle}>{v.significance || "—"}</td>
                    {/* VAF and depth are null when the MAF has no usable read counts */}
                    <td style={cellStyle}>{v.vaf == null ? "—" : `${(v.vaf * 100).toFixed(1)}%`}</td>
                    <td style={cellStyle}>{v.depth == null ? "—" : v.depth}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Numeric sort with missing values always last, whichever direction. */
function compareNullable(a: number | null, b: number | null, dir: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir * (a - b);
}
