export interface Segment {
  chromosome: string;
  start: number;
  end: number;
  gene: string;
  log2: number;
  depth: number;
  probes: number;
  weight: number;
}

export interface Probe {
  chromosome: string;
  start: number;
  end: number;
  gene: string;
  log2: number;
  depth: number | null; // mean read depth; null when the .cnr has no depth column
  weight: number;
}

export interface Cytoband {
  chromosome: string;
  start: number;
  end: number;
  name: string;
  stain: string;
}

export interface ReferenceData {
  chromosome_sizes: Record<string, number>;
  cumulative_offsets: Record<string, number>;
  cytobands: Cytoband[];
}

export interface Gene {
  gene: string;
  chromosome: string;
  start: number;       // UCSC gene coordinates (see data/reference.ts)
  end: number;
  probe_count: number; // probes in this case that overlap the gene
}

/** A CNVkit bin (probe) overlapping a gene, as used for the gene's mean log2 */
export interface GeneBin {
  log2: number;
  weight: number; // CNVkit's bin weight (1 when the .cnr has none)
  noCoverage: boolean; // depth 0
  antitarget: boolean; // CNVkit labels off-target bins "Antitarget"
}

export interface GeneMean {
  gene: string;
  chromosome: string;
  start: number;
  end: number;
  probe_count: number;
  bins: GeneBin[];
}

export interface VcfVariant {
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  baf: number;       // B-allele frequency (alt reads / total reads)
  depth: number;
}

export interface SomaticVariant {
  gene: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  hgvsc: string;
  hgvsp: string;
  classification: string;
  significance: string;
  vaf: number | null; // null when the MAF has no usable read counts
  depth: number | null;
  hiddenByDefault: boolean; // intronic / intergenic / flanking / UTR / silent / benign (not pathogenic)
}

/** Run-control band for one region: mean ± 1.96 SD of the controls' segment log2 = a 95% reference range. */
export interface ControlBand {
  chromosome: string;
  start: number;
  end: number;
  mean_log2: number;
  sd: number;
  range_upper: number;
  range_lower: number;
  n_samples: number; // controls covering this region (can be fewer than the files loaded)
}

export const CANONICAL_CHROMOSOMES = [
  "chr1", "chr2", "chr3", "chr4", "chr5", "chr6", "chr7", "chr8", "chr9",
  "chr10", "chr11", "chr12", "chr13", "chr14", "chr15", "chr16", "chr17",
  "chr18", "chr19", "chr20", "chr21", "chr22", "chrX", "chrY",
];

export type Build = "hg38" | "hg19";

/** Rows dropped per file because a required number couldn't be read (shown next to "Loaded …"). */
export type SkippedRows = Record<string, number>;

/** Everything for one case, from uploaded files, the demo, or a report's embedded files. */
export interface LoadedCase {
  caseId: string;
  build: Build;
  probes: Probe[];
  segments: Segment[];
  variants: VcfVariant[]; // allele frequencies for the BAF plot
  somaticVariants: SomaticVariant[];
  controlSamples?: Segment[][]; // run controls (.cns), one array per file
  skipped?: SkippedRows;
}
