/**
 * Data computations (all run in the browser):
 *
 * - computeGeneMeans / geneLog2: each gene's probes (bins), and their weighted mean log2
 * - computeControlBand: the run-control band (95% reference range) from control .cns files
 * - mergeGenes: UCSC gene coordinates with this case's probe counts (for gene search)
 */

import type { ControlBand, Gene, GeneBin, GeneMean, Probe, Segment } from "./types";
import { CANONICAL_CHROMOSOMES } from "./types";

type UcscGene = { gene: string; chromosome: string; start: number; end: number };

function buildGeneIndex(ucscGenes: UcscGene[]): Map<string, UcscGene[]> {
  const index = new Map<string, UcscGene[]>();
  for (const g of ucscGenes) {
    let list = index.get(g.chromosome);
    if (!list) { list = []; index.set(g.chromosome, list); }
    list.push(g);
  }
  for (const list of index.values()) list.sort((a, b) => a.start - b.start);
  return index;
}

function findOverlappingGenes(index: Map<string, UcscGene[]>, chrom: string, start: number, end: number): UcscGene[] {
  const genes = index.get(chrom);
  if (!genes) return [];
  const results: UcscGene[] = [];
  for (const g of genes) {
    if (g.start >= end) break;
    if (g.end > start) results.push(g);
  }
  return results;
}

/**
 * Assign probes (CNVkit bins) to genes by coordinate overlap with UCSC gene boundaries — not the .cnr gene
 * column — so antitarget/off-target bins inside a gene count toward it, as in CNVkit's genemetrics.
 * The gene value itself is computed by geneLog2(), depending on the exclusion settings.
 */
export function computeGeneMeans(probes: Probe[], ucscGenes: UcscGene[]): GeneMean[] {
  const index = buildGeneIndex(ucscGenes);
  const agg = new Map<string, GeneBin[]>();

  for (const probe of probes) {
    const bin: GeneBin = {
      log2: probe.log2,
      weight: probe.weight,
      noCoverage: probe.depth === 0,
      antitarget: probe.gene.toLowerCase() === "antitarget", // CNVkit's label for off-target bins
    };
    for (const g of findOverlappingGenes(index, probe.chromosome, probe.start, probe.end)) {
      const bins = agg.get(g.gene);
      if (bins) bins.push(bin);
      else agg.set(g.gene, [bin]);
    }
  }

  const geneMap = new Map<string, UcscGene>();
  for (const g of ucscGenes) geneMap.set(g.gene, g);

  return Array.from(agg.entries()).map(([gene, bins]) => {
    const ref = geneMap.get(gene)!;
    return { gene, chromosome: ref.chromosome, start: ref.start, end: ref.end, probe_count: bins.length, bins };
  });
}

export interface GeneLog2 {
  log2: number;
  excludedNoCoverage: number;
  excludedAntitarget: number;
  allExcluded: boolean; // every bin would be excluded, so the unfiltered value is used instead
}

/**
 * A gene's log2: the weighted mean of its bins' log2 (weights from CNVkit's .cnr), as in CNVkit's genemetrics
 * ("weighted mean of log2 ratios of all the gene's bins, including any off-target intronic bins").
 * Optionally leaves out bins with no coverage (depth 0) and/or antitarget bins. If that would leave nothing
 * (e.g. a homozygous deletion where no bin has coverage), the gene keeps its unfiltered value.
 */
export function geneLog2(bins: GeneBin[], exclude: { noCoverage: boolean; antitarget: boolean }): GeneLog2 {
  const isExcluded = (b: GeneBin) => (exclude.noCoverage && b.noCoverage) || (exclude.antitarget && b.antitarget);
  const kept = bins.filter((b) => !isExcluded(b));
  const allExcluded = kept.length === 0;
  return {
    log2: weightedMean(allExcluded ? bins : kept),
    excludedNoCoverage: allExcluded || !exclude.noCoverage ? 0 : bins.filter((b) => b.noCoverage).length,
    excludedAntitarget: allExcluded || !exclude.antitarget ? 0 : bins.filter((b) => b.antitarget && !(exclude.noCoverage && b.noCoverage)).length,
    allExcluded: allExcluded && bins.some(isExcluded),
  };
}

/** Weighted mean of log2; falls back to the plain mean if the weights sum to 0. */
function weightedMean(bins: GeneBin[]): number {
  const totalWeight = bins.reduce((a, b) => a + b.weight, 0);
  if (totalWeight > 0) return bins.reduce((a, b) => a + b.weight * b.log2, 0) / totalWeight;
  return bins.reduce((a, b) => a + b.log2, 0) / bins.length;
}

/**
 * Compute the run-control band (95% reference range) from control .cns files using the disjoin algorithm.
 *
 * 1. Collect all unique breakpoints per chromosome across all control samples
 * 2. Sort and create minimal non-overlapping segments (disjoin)
 * 3. For each disjoin segment, find the overlapping segment from each sample
 * 4. Compute mean ± 1.96 SD of log2 ratios: the range ~95% of normal samples fall in. (It is not a confidence
 *    interval for the mean.) A region covered by only one control has SD 0, so only its mean line shows.
 */
export function computeControlBand(controlSamples: Segment[][]): ControlBand[] {
  const bands: ControlBand[] = [];

  for (const chrom of CANONICAL_CHROMOSOMES) {
    const breakpoints = new Set<number>();
    const chromSamples: Segment[][] = [];

    for (const sample of controlSamples) {
      const chromSegs = sample.filter((s) => s.chromosome === chrom);
      chromSamples.push(chromSegs);
      for (const seg of chromSegs) {
        breakpoints.add(seg.start);
        breakpoints.add(seg.end);
      }
    }

    if (breakpoints.size < 2) continue;

    const sorted = Array.from(breakpoints).sort((a, b) => a - b);

    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i];
      const end = sorted[i + 1];
      if (end <= start) continue;
      const mid = (start + end) / 2;

      const values: number[] = [];
      for (const chromSegs of chromSamples) {
        for (const seg of chromSegs) {
          if (seg.start <= mid && seg.end >= mid) {
            values.push(seg.log2);
            break;
          }
        }
      }

      if (values.length === 0) continue;

      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const sd = n >= 2 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;

      bands.push({
        chromosome: chrom,
        start,
        end,
        mean_log2: mean,
        sd,
        range_upper: mean + 1.96 * sd,
        range_lower: mean - 1.96 * sd,
        n_samples: n,
      });
    }
  }

  return bands;
}

/**
 * Merge UCSC canonical gene coordinates with per-case probe counts.
 *
 * Probe counts are determined by coordinate overlap with the gene
 * boundaries, not the .cnr gene column — this includes antitarget probes.
 */
export function mergeGenes(
  ucscGenes: UcscGene[],
  probes: Probe[]
): Gene[] {
  const index = buildGeneIndex(ucscGenes);
  const counts = new Map<string, number>();

  for (const probe of probes) {
    const hits = findOverlappingGenes(index, probe.chromosome, probe.start, probe.end);
    for (const g of hits) {
      counts.set(g.gene, (counts.get(g.gene) ?? 0) + 1);
    }
  }

  return ucscGenes.map((g) => ({
    ...g,
    probe_count: counts.get(g.gene) ?? 0,
  }));
}
