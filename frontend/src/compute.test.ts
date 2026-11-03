import { describe, expect, it } from "vitest";
import { computeControlBand, computeGeneMeans, geneLog2 } from "./compute";
import { absoluteCN, adjustLog2, estimateCN } from "./purity";
import type { GeneBin, Probe, Segment } from "./types";

const bin = (log2: number, weight = 1, extra: Partial<GeneBin> = {}): GeneBin =>
  ({ log2, weight, noCoverage: false, antitarget: false, ...extra });
const none = { noCoverage: false, antitarget: false };

describe("gene log2 (weighted mean, as in CNVkit genemetrics)", () => {
  it("weights each bin by its CNVkit weight", () => {
    // (1·0 + 3·1) / (1 + 3) = 0.75
    expect(geneLog2([bin(0, 1), bin(1, 3)], none).log2).toBeCloseTo(0.75);
  });

  it("falls back to a plain mean when all weights are 0", () => {
    expect(geneLog2([bin(0, 0), bin(1, 0)], none).log2).toBeCloseTo(0.5);
  });

  it("optionally excludes no-coverage and antitarget bins, and reports how many", () => {
    const bins = [bin(0), bin(0), bin(-20, 1, { noCoverage: true }), bin(-1, 1, { antitarget: true })];
    expect(geneLog2(bins, none).log2).toBeCloseTo(-5.25);
    const both = geneLog2(bins, { noCoverage: true, antitarget: true });
    expect(both.log2).toBeCloseTo(0);
    expect([both.excludedNoCoverage, both.excludedAntitarget]).toEqual([1, 1]);
  });

  it("keeps the unfiltered value when every bin would be excluded (e.g. a homozygous deletion)", () => {
    const deleted = [bin(-6, 1, { noCoverage: true }), bin(-7, 1, { noCoverage: true })];
    const value = geneLog2(deleted, { noCoverage: true, antitarget: false });
    expect(value.log2).toBeCloseTo(-6.5);
    expect(value.allExcluded).toBe(true);
  });
});

describe("assigning probes to genes", () => {
  const genes = [{ gene: "GENE1", chromosome: "chr1", start: 1000, end: 2000 }];
  const probe = (start: number, gene: string, depth: number | null = 100): Probe =>
    ({ chromosome: "chr1", start, end: start + 100, gene, log2: 0.5, depth, weight: 1 });

  it("uses UCSC coordinates, so antitarget bins inside the gene count toward it", () => {
    const [g] = computeGeneMeans([probe(1100, "GENE1"), probe(1500, "Antitarget"), probe(5000, "GENE1")], genes);
    expect(g.probe_count).toBe(2);
    expect(g.bins.map((b) => b.antitarget)).toEqual([false, true]);
  });

  it("marks depth-0 probes as no coverage, but not probes with unknown depth", () => {
    const [g] = computeGeneMeans([probe(1100, "GENE1", 0), probe(1300, "GENE1", null)], genes);
    expect(g.bins.map((b) => b.noCoverage)).toEqual([true, false]);
  });
});

describe("run-control band (95% reference range)", () => {
  const seg = (log2: number): Segment => ({ chromosome: "chr1", start: 0, end: 1000, gene: "", log2, depth: 0, probes: 1, weight: 1 });

  it("is mean ± 1.96 SD of the controls covering each region", () => {
    const [b] = computeControlBand([[seg(0)], [seg(0.2)], [seg(-0.2)]]);
    expect(b.mean_log2).toBeCloseTo(0);
    expect(b.sd).toBeCloseTo(0.2);
    expect(b.range_upper).toBeCloseTo(0.392);
    expect(b.range_lower).toBeCloseTo(-0.392);
    expect(b.n_samples).toBe(3);
  });

  it("has zero width where only one control covers the region", () => {
    const [b] = computeControlBand([[seg(0.1)]]);
    expect(b.range_upper).toBe(b.range_lower);
    expect(b.n_samples).toBe(1);
  });
});

describe("purity / ploidy (ABSOLUTE model)", () => {
  it("at 100% purity, C = 2^log2 × ploidy", () => {
    expect(absoluteCN(0, 2, 1)).toBeCloseTo(2);
    expect(absoluteCN(1, 2, 1)).toBeCloseTo(4);
    expect(absoluteCN(0, 4, 1)).toBeCloseTo(4); // tetraploid baseline
  });

  it("corrects for normal contamination", () => {
    // 50% purity, diploid: a raw log2 of log2(1.5) is a tumor with 4 copies
    expect(absoluteCN(Math.log2(1.5), 2, 0.5)).toBeCloseTo(4);
    // a homozygous deletion at 50% purity only reaches raw log2 = -1
    expect(absoluteCN(-1, 2, 0.5)).toBeCloseTo(0);
  });

  it("shows impossible negative copy numbers as 0", () => {
    expect(estimateCN(-2, 2, 0.5)).toBe("0.0");
    expect(adjustLog2(-2, 2, 0.5)).toBeCloseTo(Math.log2(0.001 / 2));
  });

  it("puts a diploid region at adjusted log2 0", () => {
    expect(adjustLog2(0, 2, 0.6)).toBeCloseTo(0);
  });
});
