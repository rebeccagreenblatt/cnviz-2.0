// Alternating colors for chromosome segments (colorblind-safe, Wong palette)
export const CHROM_COLORS = ["#0072B2", "#E69F00"];

// Level-of-detail thresholds (in base pairs of visible x-range)
export const GENE_MEAN_THRESHOLD = 200_000_000;
export const PROBE_THRESHOLD = 20_000_000;

// Minimum probes a gene needs before we render its name next to the dot.
export const GENE_LABEL_MIN_PROBES = 3;

// Cytoband stain → fill color (UCSC G-banding palette).
export const STAIN_COLORS: Record<string, string> = {
  gneg: "#ffffff",
  gpos25: "#c8c8c8",
  gpos50: "#969696",
  gpos75: "#646464",
  gpos100: "#000000",
  acen: "#c24646",
  gvar: "#b0b0b0",
  stalk: "#b0b0b0",
};

// Default y-axis data range and the margin used to define "out of range".
export const DEFAULT_Y_MIN = -4;
export const DEFAULT_Y_MAX = 4;
export const OOR_MARGIN = 1;
export const AMP_LOG2_THRESHOLD = 2;
export const OUT_OF_RANGE_COLOR = "#009E73";
export const REPORTABLE_COLOR = "#CC79A7";
export const HAS_VARIANTS_COLOR = "#56B4E9";

/** Clamp a value to [lower, upper]. */
export function clampToRange(v: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, v));
}
