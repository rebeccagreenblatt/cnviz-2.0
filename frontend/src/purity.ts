/**
 * Purity/ploidy adjustment (ABSOLUTE model, Carter et al. 2012).
 *
 * A sample is a mix of tumor cells (fraction α = purity) with copy number C, and normal cells with 2 copies.
 * CNVkit's log2 ratio compares the sample to a diploid reference, scaled by the tumor's average ploidy τ
 * (in CNViz, τ = Chromosomes setting / 23):
 *
 *     2^log2 = (α·C + 2·(1 − α)) / (α·τ + 2·(1 − α))
 *
 * Solving for the tumor copy number:
 *
 *     C = (2^log2 · (α·τ + 2·(1 − α)) − 2·(1 − α)) / α
 *
 * At 100% purity this is simply C = 2^log2 · τ. A value below what even C = 0 can produce (normal cells keep
 * the ratio up) gives a negative C, which is shown as 0.
 */
export function absoluteCN(rawLog2: number, ploidy: number, purity: number): number {
  const normal = 2 * (1 - purity);
  return (Math.pow(2, rawLog2) * (purity * ploidy + normal) - normal) / purity;
}

/** Estimated tumor copy number for display, e.g. "3.1" (negative values shown as 0). */
export function estimateCN(rawLog2: number, ploidy: number, purity: number): string {
  return Math.max(0, absoluteCN(rawLog2, ploidy, purity)).toFixed(1);
}

/**
 * Adjusted log2 for plotting: log2(C / 2), so a diploid region sits at 0. C is floored at 0.001 because
 * log2(0) is −infinity; those points end up far below the axis and are flagged out of range.
 */
export function adjustLog2(rawLog2: number, ploidy: number, purity: number): number {
  return Math.log2(Math.max(0.001, absoluteCN(rawLog2, ploidy, purity)) / 2);
}
