/**
 * Client-side parsers for CNVKit .cnr and .cns files.
 *
 * Both formats are tab-delimited with a header row. We normalize column
 * names to lowercase and require at least {chromosome, start, end, log2}.
 */

import type { Probe, Segment, SkippedRows, SomaticVariant, VcfVariant } from "./types";
import { CANONICAL_CHROMOSOMES } from "./types";

/**
 * Read a File's text content. Gzipped files (e.g. .vcf.gz) are decompressed with the browser's built-in
 * DecompressionStream, so nothing extra is loaded.
 */
async function readText(file: File): Promise<string> {
  if (!/\.gz$/i.test(file.name)) return file.text();
  const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export type FileKind = "cnr" | "cns" | "vcf" | "baf" | "maf";

/** File type from its name, ignoring case and a trailing .gz ("S1.VCF.GZ" → "vcf"). */
export function fileKind(name: string): FileKind | null {
  const ext = name.toLowerCase().replace(/\.gz$/, "").split(".").pop();
  return ext === "cnr" || ext === "cns" || ext === "vcf" || ext === "baf" || ext === "maf" ? ext : null;
}

/**
 * Split a TSV string into a header + row-objects.
 * Returns objects keyed by lowercase column name.
 */
/**
 * Chromosome names as CNViz uses them ("chr1"…"chr22", "chrX", "chrY"). Accepts UCSC style ("chr7"),
 * Ensembl/GRCh37 b37 style ("7", "X") and numeric sex chromosomes ("23" = X, "24" = Y).
 * Anything else (e.g. "chrM", "GL000220.1") is returned with a "chr" prefix and ignored later.
 */
export function normalizeChromosome(name: string): string {
  const bare = (name ?? "").trim().replace(/^chr/i, "");
  const upper = bare.toUpperCase();
  if (upper === "23") return "chrX";
  if (upper === "24") return "chrY";
  if (upper === "X" || upper === "Y") return `chr${upper}`;
  return `chr${bare}`;
}

const KNOWN_CHROMOSOMES = new Set<string>(CANONICAL_CHROMOSOMES);

/** A file with rows but none on chr1–22/X/Y would otherwise load as an empty plot with no explanation. */
function requireKnownChromosomes<T extends { chromosome: string }>(items: T[], fileName: string): T[] {
  if (items.length > 0 && !items.some((x) => KNOWN_CHROMOSOMES.has(x.chromosome))) {
    const example = items[0].chromosome.replace(/^chr/, "");
    throw new Error(`${fileName}: no rows on chromosomes 1–22, X or Y (first chromosome name in the file: "${example}")`);
  }
  return items;
}

/**
 * Keep rows whose start, end and log2 are real numbers. A single "nan" or blank log2 would otherwise make its
 * whole gene mean NaN and the gene vanish from the plot. Counts drops in `skipped`; errors if nothing is usable.
 */
function usableRows<T extends { start: number; end: number; log2: number }>(items: T[], fileName: string, skipped?: SkippedRows): T[] {
  const usable = items.filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end) && Number.isFinite(x.log2));
  if (usable.length === 0) {
    throw new Error(items.length === 0
      ? `${fileName}: the file has no data rows`
      : `${fileName}: no usable rows (every row has an unreadable start, end or log2 value)`);
  }
  if (skipped && usable.length < items.length) skipped[fileName] = items.length - usable.length;
  return usable;
}

function parseTsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const parts = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = parts[i] ?? "";
    });
    return row;
  });
}

function requireColumns(
  rows: Record<string, string>[],
  required: string[],
  fileName: string
): void {
  if (rows.length === 0) return;
  const have = new Set(Object.keys(rows[0]));
  const missing = required.filter((c) => !have.has(c));
  if (missing.length > 0) {
    throw new Error(
      `${fileName} is missing required columns: ${missing.join(", ")}`
    );
  }
}

/**
 * Parse a .cnr file (probe-level copy number ratios).
 *
 * Columns: chromosome  start  end  gene  log2  depth  weight
 */
export async function parseCnr(file: File, skipped?: SkippedRows): Promise<Probe[]> {
  const text = await readText(file);
  const rows = parseTsv(text);
  requireColumns(rows, ["chromosome", "start", "end", "log2"], file.name);

  return requireKnownChromosomes(usableRows(rows.map((r) => ({
    chromosome: normalizeChromosome(r.chromosome),
    start: parseInt(r.start, 10),
    end: parseInt(r.end, 10),
    gene: r.gene ?? "",
    log2: parseFloat(r.log2),
    depth: optionalNumber(r.depth),
    weight: optionalNumber(r.weight) ?? 1,
  })), file.name, skipped), file.name);
}

/** A number from an optional column; null when the column is missing, blank or not a number. */
function optionalNumber(value: string | undefined): number | null {
  const n = Number.parseFloat(value ?? "");
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a .cns file (segment-level copy number).
 *
 * Columns: chromosome  start  end  gene  log2  depth  probes  weight
 */
export async function parseCns(file: File, skipped?: SkippedRows): Promise<Segment[]> {
  const text = await readText(file);
  const rows = parseTsv(text);
  requireColumns(rows, ["chromosome", "start", "end", "log2"], file.name);

  return requireKnownChromosomes(usableRows(rows.map((r) => ({
    chromosome: normalizeChromosome(r.chromosome),
    start: parseInt(r.start, 10),
    end: parseInt(r.end, 10),
    gene: r.gene ?? "",
    log2: parseFloat(r.log2),
    depth: parseFloat(r.depth || "0"),
    probes: parseInt(r.probes || "0", 10),
    weight: optionalNumber(r.weight) ?? 1,
  })), file.name, skipped), file.name);
}

/**
 * Parse a VCF file and extract B-allele frequency for each variant.
 *
 * BAF is read from:
 *   1. The AF field in the FORMAT/sample columns, OR
 *   2. Computed from the AD field (altReads / totalReads).
 *
 * Only PASS (or ".") filter variants are kept.
 */
/**
 * Parse a DRAGEN .baf file (tab-delimited: chromosome, start, end, baf).
 * "start" is the true position; "end" is start+1.
 */
/**
 * Parse a MAF file and compute BAF as t_alt_count / (t_alt_count + t_ref_count).
 */
export async function parseMaf(file: File): Promise<VcfVariant[]> {
  const text = await readText(file);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((line) => {
    const parts = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = parts[i] ?? "";
    });
    return row;
  });

  requireColumns(rows, ["chromosome", "start_position", "t_alt_count", "t_ref_count"], file.name);

  const variants: VcfVariant[] = [];
  for (const r of rows) {
    let altCount = parseInt(r.t_alt_count, 10);
    let refCount = parseInt(r.t_ref_count, 10);

    if ((Number.isNaN(altCount) || Number.isNaN(refCount) || altCount + refCount === 0) && r.dp4) {
      const parts = r.dp4.split(",").map(Number);
      if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
        refCount = parts[0] + parts[1];
        altCount = parts[2] + parts[3];
      }
    }

    const total = altCount + refCount;
    if (total === 0 || Number.isNaN(altCount) || Number.isNaN(refCount)) continue;

    variants.push({
      chromosome: normalizeChromosome(r.chromosome),
      position: parseInt(r.start_position, 10),
      ref: r.reference_allele ?? "",
      alt: r.tumor_seq_allele2 ?? "",
      baf: altCount / total,
      depth: total,
    });
  }

  if (variants.length === 0 && rows.length > 0) {
    throw new Error(
      `${file.name}: found ${rows.length} rows but no usable BAF data. ` +
      `Ensure t_alt_count and t_ref_count columns contain numeric values.`
    );
  }

  return requireKnownChromosomes(variants, file.name);
}

export async function parseBaf(file: File): Promise<VcfVariant[]> {
  const text = await readText(file);
  const rows = parseTsv(text);
  requireColumns(rows, ["chromosome", "start", "end", "baf"], file.name);

  const variants: VcfVariant[] = [];
  for (const r of rows) {
    const baf = parseFloat(r.baf);
    if (Number.isNaN(baf)) continue;
    variants.push({
      chromosome: normalizeChromosome(r.chromosome),
      position: parseInt(r.start, 10),
      ref: "",
      alt: "",
      baf,
      depth: 0,
    });
  }
  return requireKnownChromosomes(variants, file.name);
}

export async function parseVcf(file: File): Promise<VcfVariant[]> {
  const text = await readText(file);
  const lines = text.split(/\r?\n/);
  const variants: VcfVariant[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 10) continue;

    const [chrom, posStr, , ref, alt, , filter, , format, sample] = cols;

    // Only keep PASS or unfiltered variants
    if (filter !== "PASS" && filter !== ".") continue;

    const formatFields = format.split(":");
    const sampleFields = sample.split(":");

    const fieldMap: Record<string, string> = {};
    formatFields.forEach((f, i) => {
      fieldMap[f] = sampleFields[i] ?? "";
    });

    let baf: number | null = null;
    let dp = 0;

    // Try AF first; a blank or "." AF falls through to the read counts (AD) below
    const af = parseFloat(fieldMap.AF ?? "");
    if (Number.isFinite(af)) {
      baf = af;
    }

    // Try AD (ref,alt)
    if (fieldMap.AD) {
      const adParts = fieldMap.AD.split(",").map(Number);
      if (adParts.length >= 2) {
        const total = adParts.reduce((a, b) => a + b, 0);
        if (total > 0 && baf === null) {
          baf = adParts[1] / total;
        }
        dp = total;
      }
    }

    // DP field as fallback for depth
    if (fieldMap.DP) {
      dp = parseInt(fieldMap.DP, 10);
    }

    if (baf === null || Number.isNaN(baf)) continue;

    variants.push({
      chromosome: normalizeChromosome(chrom),
      position: parseInt(posStr, 10),
      ref,
      alt,
      baf,
      depth: dp,
    });
  }

  return requireKnownChromosomes(variants, file.name);
}

export async function parseSomaticMaf(file: File): Promise<SomaticVariant[]> {
  const text = await readText(file);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((line) => {
    const parts = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = parts[i] ?? "";
    });
    return row;
  });

  const variants: SomaticVariant[] = [];
  for (const r of rows) {
    const gene = r.hugo_symbol || r.gene || "";
    if (!gene) continue;

    const chrom = r.chromosome || r.chrom || "";
    const pos = parseInt(r.start_position || r.start || "0", 10);
    // VAF = alt reads / depth. Depth is t_depth when present, otherwise ref + alt.
    // A missing or non-numeric count is unknown, never 0, so VAF/depth show as "—" rather than a wrong number.
    const altCount = readCount(r.t_alt_count);
    const refCount = readCount(r.t_ref_count);
    const depth = readCount(r.t_depth) ?? (altCount != null && refCount != null ? altCount + refCount : null);

    const classification = r.variant_classification || r.variant_type || "";
    const significance = r.clin_sig || r.clinical_significance || r.pathogenicity || r.significance || r.acmg_classification || r.clinvar_significance || r.clinsig || "";
    const sigLower = significance.toLowerCase();
    const isPathogenic = /pathogenic/.test(sigLower);

    // Intronic, intergenic, flanking, UTR, silent and benign variants are kept but hidden by default
    // (unless called pathogenic); the variant tables have a "show" toggle for them.
    const clsLower = classification.toLowerCase();
    const hiddenByDefault = !isPathogenic && (
      ["intron", "igr", "5'flank", "3'flank", "5'utr", "3'utr", "silent"].includes(clsLower) ||
      (!!sigLower && /benign/.test(sigLower) && !/vous|uncertain/.test(sigLower)));

    variants.push({
      gene,
      chromosome: normalizeChromosome(chrom),
      position: pos,
      ref: r.reference_allele || r.ref || "",
      alt: r.tumor_seq_allele2 || r.alt || "",
      hgvsc: r.hgvsc || r["hgvs.c"] || "",
      hgvsp: r.hgvsp_short || r.hgvsp || r["hgvs.p"] || "",
      classification,
      significance,
      vaf: altCount != null && depth ? altCount / depth : null,
      depth,
      hiddenByDefault,
    });
  }

  return requireKnownChromosomes(variants, file.name);
}

/** A read count from a MAF column; null when blank, "." or not a number. */
function readCount(value: string | undefined): number | null {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Allele-frequency file by extension: .baf, .maf (ref/alt counts) or .vcf */
export function parseBafFile(file: File): Promise<VcfVariant[]> {
  const kind = fileKind(file.name);
  if (kind === "baf") return parseBaf(file);
  if (kind === "maf") return parseMaf(file);
  return parseVcf(file);
}
