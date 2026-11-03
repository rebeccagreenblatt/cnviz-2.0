import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseCns } from "../parsers";
import PlotlyChart from "./PlotlyChart";
import { escapeHtml, hoverLines } from "../plotlyText";
import { adjustLog2, estimateCN } from "../purity";
import { geneLog2 } from "../compute";
import BafPlot from "./BafPlot";
import LegendPanel from "./LegendPanel";
import Popup from "./Popup";
import VariantTable from "./VariantTable";
import type { ControlBand, Gene, GeneMean, Probe, ReferenceData, Segment, SomaticVariant, VcfVariant } from "../types";
import { CANONICAL_CHROMOSOMES } from "../types";
import {
  CHROM_COLORS,
  GENE_MEAN_THRESHOLD,
  PROBE_THRESHOLD,
  GENE_LABEL_MIN_PROBES,
  STAIN_COLORS,
  DEFAULT_Y_MIN,
  DEFAULT_Y_MAX,
  OOR_MARGIN,
  OUT_OF_RANGE_COLOR,
  REPORTABLE_COLOR,
  HAS_VARIANTS_COLOR,
  AMP_LOG2_THRESHOLD,
  clampToRange,
} from "../constants";

interface GenomeViewProps {
  segments: Segment[];
  probes: Probe[];
  geneMeans: GeneMean[];
  genes: Gene[];
  variants: VcfVariant[];
  somaticVariants: SomaticVariant[];
  reference: ReferenceData;
  selectedGene?: Gene | null;
  onGeneSelect?: (gene: Gene) => void;
  onClearSelection?: () => void;
  controlBand?: ControlBand[];
  onControlFiles?: (samples: Segment[][]) => void;
  initialChromCount?: number; // report files: ploidy × 23 from the pipeline (default 46)
  initialPurityPct?: number; // report files: tumor purity % from the pipeline (default 100)
  controlSampleCount?: number; // number of control files loaded (for the "N samples loaded" label)
  initialGenesText?: string; // report files: gene list (CSV/text) from the pipeline, editable by typing
  allowUploads?: boolean; // gene-list CSV and run-control uploads: off on cnviz.com and in report files
}

// Plot layer (trace) names. The click handler identifies what was clicked by these names, so they are
// defined once here rather than typed out in several places.
const LAYER = {
  controlMean: "control-mean",
  outOfRangeSegments: "out-of-range segments",
  highlightedGenes: "gene-means",
  genes: "gene-means-other",
  amplifiedGenes: "gene-means-amp",
  probes: "probes",
  cytobands: "cytobands",
} as const;
// Layers whose points are genes (or probes with a gene), so a click can offer "Open gene view"
const GENE_LAYERS = new Set<string>([LAYER.highlightedGenes, LAYER.genes, LAYER.amplifiedGenes, LAYER.probes]);

export default function GenomeView({
  segments,
  probes,
  geneMeans,
  genes,
  variants,
  somaticVariants,
  reference,
  selectedGene,
  onGeneSelect,
  onClearSelection,
  controlBand,
  onControlFiles,
  initialChromCount = 46,
  initialPurityPct = 100,
  controlSampleCount = 0,
  initialGenesText = "",
  allowUploads = true,
}: GenomeViewProps) {
  const { cumulative_offsets, chromosome_sizes } = reference;

  const [popup, setPopup] = useState<{ x: number; y: number; lines: string[]; gene?: string } | null>(null);
  const [reportableGenes, setReportableGenes] = useState<Set<string>>(() => new Set(parseGeneList(initialGenesText)));
  const [showProbes, setShowProbes] = useState(true);
  const [reportableText, setReportableText] = useState(() => parseGeneList(initialGenesText).join(", "));
  const reportableCsvRef = useRef<HTMLInputElement>(null);

  const [controlFiles, setControlFiles] = useState<File[]>([]);
  const [controlLoading, setControlLoading] = useState(false);
  const controlInputRef = useRef<HTMLInputElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [showControlBand, setShowControlBand] = useState(true);

  const handleControlUpload = useCallback(async (files: File[]) => {
    if (!onControlFiles || files.length === 0) return;
    setControlLoading(true);
    try {
      const samples = await Promise.all(files.map((f) => parseCns(f)));
      onControlFiles(samples);
    } finally {
      setControlLoading(false);
    }
  }, [onControlFiles]);

  const addControlFiles = useCallback(async (newFiles: File[]) => {
    const combined = [...controlFiles, ...newFiles];
    setControlFiles(combined);
    await handleControlUpload(combined);
  }, [controlFiles, handleControlUpload]);

  const clearControls = useCallback(() => {
    setControlFiles([]);
    onControlFiles?.([]);
    if (controlInputRef.current) controlInputRef.current.value = "";
  }, [onControlFiles]);

  const [showHiddenVariants, setShowHiddenVariants] = useState(false);
  const genesWithVariants = useMemo(() => {
    const s = new Set<string>();
    for (const v of somaticVariants) if (showHiddenVariants || !v.hiddenByDefault) s.add(v.gene.toUpperCase());
    return s;
  }, [somaticVariants, showHiddenVariants]);

  const applyReportableGenes = (text: string, normalize?: boolean) => {
    const names = parseGeneList(text);
    setReportableGenes(new Set(names));
    setReportableText(normalize ? names.join(", ") : text);
  };

  useEffect(() => {
    if (!popup) return;
    const handler = () => setPopup(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [popup]);

  const genesByName = useMemo(() => {
    const m = new Map<string, Gene>();
    for (const g of genes) m.set(g.gene, g);
    return m;
  }, [genes]);

  const totalGenome = useMemo(
    () => CANONICAL_CHROMOSOMES.reduce((sum, c) => sum + (chromosome_sizes[c] || 0), 0),
    [chromosome_sizes]
  );

  const [xRange, setXRange] = useState<[number, number]>([0, totalGenome]);
  const visibleSpan = xRange[1] - xRange[0];
  const [revision, setRevision] = useState(0);

  // Y-axis range and out-of-range thresholds
  const [yMin, setYMin] = useState(DEFAULT_Y_MIN);
  const [yMax, setYMax] = useState(DEFAULT_Y_MAX);
  const oorUpper = yMax - OOR_MARGIN;
  const oorLower = yMin + OOR_MARGIN;
  const isOOR = (v: number) => v > oorUpper || v < oorLower;

  // Ideogram strip positioning — scales with y-range so it stays visible
  const ySpan = yMax - yMin;
  const ideoHeight = Math.max(0.2, ySpan * 0.04);
  const ideogramYTop = yMin - ySpan * 0.01;
  const ideogramYBottom = ideogramYTop - ideoHeight;
  const yAxisBottom = ideogramYBottom - ySpan * 0.01;

  // Ploidy and purity
  const [chromCount, setChromCount] = useState(initialChromCount);
  const [purityPct, setPurityPct] = useState(initialPurityPct);
  const ploidy = chromCount / 23;
  const purity = purityPct / 100;
  const isAdjusted = ploidy !== 2 || purity !== 1;
  const ploidyBaseline = Math.log2(ploidy / 2);
  const adj = (raw: number) => adjustLog2(raw, ploidy, purity);

  // Navigation helpers
  const isZoomed = xRange[0] > 0 || xRange[1] < totalGenome;
  const resetZoom = () => {
    setXRange([0, totalGenome]);
    setRevision((r) => r + 1);
    onClearSelection?.();
  };

  const zoomToChromosome = (chrom: string) => {
    const offset = cumulative_offsets[chrom];
    const size = chromosome_sizes[chrom];
    if (offset === undefined || size === undefined) return;
    setXRange([offset, offset + size]);
    setRevision((r) => r + 1);
  };

  const getBand = useMemo(() => {
    const bands = reference.cytobands;
    return (chrom: string, pos: number): string => {
      for (const b of bands) {
        if (b.chromosome === chrom && pos >= b.start && pos < b.end) {
          return chrom.replace(/^chr/i, "") + b.name;
        }
      }
      return "";
    };
  }, [reference.cytobands]);

  const centromeres = useMemo(() => {
    const m = new Map<string, number>();
    for (const band of reference.cytobands) {
      if (band.stain !== "acen") continue;
      const prev = m.get(band.chromosome);
      const mid = (band.start + band.end) / 2;
      m.set(band.chromosome, prev === undefined ? mid : (prev + mid) / 2);
    }
    return m;
  }, [reference.cytobands]);

  const zoomToArm = (chrom: string, arm: "p" | "q") => {
    const offset = cumulative_offsets[chrom];
    const size = chromosome_sizes[chrom];
    const cen = centromeres.get(chrom);
    if (offset === undefined || size === undefined || cen === undefined) return;
    if (arm === "p") {
      setXRange([offset, offset + cen]);
    } else {
      setXRange([offset + cen, offset + size]);
    }
    setRevision((r) => r + 1);
  };

  const activeChromosome = useMemo(() => {
    for (const c of CANONICAL_CHROMOSOMES) {
      const offset = cumulative_offsets[c];
      const size = chromosome_sizes[c];
      if (offset === undefined || size === undefined) continue;
      if (xRange[0] >= offset - 1 && xRange[1] <= offset + size + 1) return c;
    }
    return null;
  }, [xRange, cumulative_offsets, chromosome_sizes]);

  // Zoom to selected gene
  useEffect(() => {
    if (!selectedGene) return;
    const offset = cumulative_offsets[selectedGene.chromosome];
    if (offset === undefined) return;
    const length = Math.max(selectedGene.end - selectedGene.start, 1000);
    const padding = Math.max(length * 0.5, 5000);
    const start = offset + Math.max(0, selectedGene.start - padding);
    const end = offset + selectedGene.end + padding;
    setXRange([start, end]);
    setRevision((r) => r + 1);
  }, [selectedGene, cumulative_offsets]);

  // Pre-compute cumulative positions
  const probesCum = useMemo(() => {
    return probes
      .map((p) => {
        const offset = cumulative_offsets[p.chromosome];
        if (offset === undefined) return null;
        return {
          x: offset + (p.start + p.end) / 2,
          log2: p.log2, chromosome: p.chromosome,
          start: p.start, end: p.end, gene: p.gene, depth: p.depth,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [probes, cumulative_offsets]);

  // Optional exclusions from gene means (see geneLog2 in compute.ts); probes themselves are always plotted
  const [excludeNoCoverage, setExcludeNoCoverage] = useState(false);
  const [excludeAntitarget, setExcludeAntitarget] = useState(false);
  const hasProbeDepth = useMemo(() => probes.some((p) => p.depth != null), [probes]);
  const hasAntitarget = useMemo(() => probes.some((p) => p.gene.toLowerCase() === "antitarget"), [probes]);
  const geneMeansCum = useMemo(() => {
    const exclude = { noCoverage: excludeNoCoverage, antitarget: excludeAntitarget };
    return geneMeans
      .map((g) => {
        const offset = cumulative_offsets[g.chromosome];
        if (offset === undefined) return null;
        const value = geneLog2(g.bins, exclude);
        const excluded = [
          value.excludedNoCoverage ? `${value.excludedNoCoverage} with no coverage` : "",
          value.excludedAntitarget ? `${value.excludedAntitarget} antitarget` : "",
        ].filter(Boolean).join(", ");
        return {
          x: offset + (g.start + g.end) / 2,
          xStart: offset + g.start, xEnd: offset + g.end,
          mean_log2: value.log2,
          gene: g.gene, chromosome: g.chromosome,
          start: g.start, end: g.end, probe_count: g.probe_count,
          probeNote: value.allExcluded ? " (all would be excluded; none excluded)" : excluded ? ` (${excluded} excluded)` : "",
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [geneMeans, cumulative_offsets, excludeNoCoverage, excludeAntitarget]);

  const variantsCum = useMemo(() => {
    return variants
      .map((v) => {
        const offset = cumulative_offsets[v.chromosome];
        if (offset === undefined) return null;
        return {
          x: offset + v.position, baf: v.baf, chromosome: v.chromosome,
          position: v.position, ref: v.ref, alt: v.alt, depth: v.depth,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [variants, cumulative_offsets]);

  // ── Build CNV plot traces ──────────────────────────────────────────

  const traces: Plotly.Data[] = [];

  // Control band (95% reference range) — rendered first so it's behind everything.
  // Adjusted for purity (like the case) but never for ploidy: the controls are normal diploid samples.
  const adjBand = (raw: number) => adjustLog2(raw, 2, purity);
  const controlBandCum = useMemo(() => {
    if (!controlBand || controlBand.length === 0) return [];
    return controlBand
      .map((b) => {
        const offset = cumulative_offsets[b.chromosome];
        if (offset === undefined) return null;
        return { ...b, xStart: offset + b.start, xEnd: offset + b.end };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [controlBand, cumulative_offsets]);

  const controlShapes: Partial<Plotly.Shape>[] = [];
  if (controlBandCum.length > 0 && showControlBand) {
    for (const b of controlBandCum) {
      controlShapes.push({
        type: "rect",
        x0: b.xStart, x1: b.xEnd,
        y0: adjBand(b.range_lower), y1: adjBand(b.range_upper),
        fillcolor: "rgba(180, 180, 180, 0.25)",
        line: { width: 0 },
        layer: "below",
      });
    }

    const meanX: number[] = [];
    const meanY: number[] = [];
    for (const b of controlBandCum) {
      meanX.push(b.xStart, b.xEnd, NaN);
      meanY.push(adjBand(b.mean_log2), adjBand(b.mean_log2), NaN);
    }
    traces.push({
      x: meanX, y: meanY, type: "scattergl", mode: "lines",
      line: { color: "rgba(120, 120, 120, 0.5)", width: 1, dash: "dot" },
      name: LAYER.controlMean,
      hoverinfo: "text",
      hovertext: controlBandCum.flatMap((b) => [
        `<b>Run controls</b><br>mean log2: ${adjBand(b.mean_log2).toFixed(3)}${purity !== 1 ? ` (raw: ${b.mean_log2.toFixed(3)})` : ""}` +
          `<br>95% reference range: [${adjBand(b.range_lower).toFixed(3)}, ${adjBand(b.range_upper).toFixed(3)}]<br>controls in this region: ${b.n_samples}`,
        "",
        "",
      ]),
      showlegend: false,
    });
  }

  // Segment traces
  const oorSegX: number[] = [];
  const oorSegY: number[] = [];

  CANONICAL_CHROMOSOMES.forEach((chrom, i) => {
    const offset = cumulative_offsets[chrom];
    if (offset === undefined) return;
    const chromSegments = segments.filter((s) => s.chromosome === chrom);
    if (chromSegments.length === 0) return;

    const x: number[] = [];
    const y: number[] = [];

    chromSegments.forEach((seg) => {
      const xStart = offset + seg.start;
      const xEnd = offset + seg.end;
      const midpoint = offset + (seg.start + seg.end) / 2;
      const adjVal = adj(seg.log2);

      if (isOOR(adjVal)) {
        const clampedY = clampToRange(adjVal, oorLower, oorUpper);
        oorSegX.push(xStart, midpoint, xEnd, NaN);
        oorSegY.push(clampedY, clampedY, clampedY, NaN);
      } else {
        x.push(xStart, midpoint, xEnd, NaN);
        y.push(adjVal, adjVal, adjVal, NaN);
      }
    });

    if (x.length > 0) {
      traces.push({
        x, y, type: "scattergl", mode: "lines",
        line: { color: CHROM_COLORS[i % 2], width: 3 },
        name: chrom, hoverinfo: "skip", showlegend: false,
      });
    }
  });

  if (oorSegX.length > 0) {
    traces.push({
      x: oorSegX, y: oorSegY, type: "scattergl", mode: "lines",
      line: { color: OUT_OF_RANGE_COLOR, width: 3 },
      name: LAYER.outOfRangeSegments, hoverinfo: "skip", showlegend: false,
    });
  }

  // Gene-mean helpers shared by reportable and non-reportable traces
  const hasSegments = segments.length > 0;
  const hasReportable = reportableGenes.size > 0;

  const geneHoverText = (g: typeof geneMeansCum[0], starred: boolean) => {
    const band = getBand(g.chromosome, g.start);
    return `<b>${g.gene}</b>${starred ? " ★" : ""}${isOOR(adj(g.mean_log2)) ? " <b>(OUT OF RANGE)</b>" : ""}${band ? "<br>" + band : ""}<br>${g.chromosome}:${g.start.toLocaleString()}-${g.end.toLocaleString()}<br>mean log2: ${adj(g.mean_log2).toFixed(3)}${isAdjusted ? ` (raw: ${g.mean_log2.toFixed(3)})` : ""}<br>est. CN: ${estimateCN(g.mean_log2, ploidy, purity)}<br>probes: ${g.probe_count}${g.probeNote}`;
  };

  // Hide the label of the gene with fewer probes when two are too close
  const getCollisionHidden = (genes: typeof geneMeansCum): Set<number> => {
    const minGap = visibleSpan * 0.02;
    const hidden = new Set<number>();
    const sorted = genes.map((g, i) => ({ g, i })).sort((a, b) => a.g.x - b.g.x);
    for (let k = 1; k < sorted.length; k++) {
      if (sorted[k].g.x - sorted[k - 1].g.x < minGap) {
        if (sorted[k].g.probe_count >= sorted[k - 1].g.probe_count) {
          hidden.add(sorted[k - 1].i);
        } else {
          hidden.add(sorted[k].i);
        }
      }
    }
    return hidden;
  };

  // Reportable gene trace — always visible
  if (hasReportable) {
    const reportVisible = geneMeansCum.filter(
      (g) => g.x >= xRange[0] && g.x <= xRange[1] && reportableGenes.has(g.gene.toUpperCase())
    );
    if (reportVisible.length > 0) {
      const reportHidden = getCollisionHidden(reportVisible);
      traces.push({
        x: reportVisible.map((g) => g.x),
        y: reportVisible.map((g) => clampToRange(adj(g.mean_log2), oorLower, oorUpper)),
        type: "scattergl",
        mode: "markers+text" as Plotly.PlotData["mode"],
        name: LAYER.highlightedGenes,
        marker: {
          color: reportVisible.map((g) => isOOR(adj(g.mean_log2)) ? OUT_OF_RANGE_COLOR : REPORTABLE_COLOR),
          line: {
            color: reportVisible.map((g) => genesWithVariants.has(g.gene.toUpperCase()) ? HAS_VARIANTS_COLOR : REPORTABLE_COLOR),
            width: reportVisible.map((g) => genesWithVariants.has(g.gene.toUpperCase()) ? 4 : 0),
          },
          size: reportVisible.map((g) => Math.min(28, 7 + 1.4 * Math.pow(g.probe_count, 0.7))),
          opacity: 0.9,
          symbol: "diamond",
        },
        text: reportVisible.map((g, i) => reportHidden.has(i) ? "" : g.gene),
        textposition: "top center",
        textfont: { size: 9, color: REPORTABLE_COLOR },
        hoverinfo: "text",
        hovertext: reportVisible.map((g) => geneHoverText(g, true)),
        customdata: reportVisible.map((g) => g.gene),
        showlegend: false,
      });
    }
  }

  // Non-reportable gene-means — zoom-gated
  if (!hasSegments || visibleSpan <= GENE_MEAN_THRESHOLD) {
    const visible = geneMeansCum.filter(
      (g) => g.x >= xRange[0] && g.x <= xRange[1] && !(hasReportable && reportableGenes.has(g.gene.toUpperCase()))
    );
    if (visible.length > 0) {
      const visibleHidden = getCollisionHidden(visible);
      traces.push({
        x: visible.map((g) => g.x),
        y: visible.map((g) => clampToRange(adj(g.mean_log2), oorLower, oorUpper)),
        type: "scattergl",
        mode: "markers+text" as Plotly.PlotData["mode"],
        name: LAYER.genes,
        marker: {
          color: visible.map((g) => isOOR(adj(g.mean_log2)) ? OUT_OF_RANGE_COLOR : "#333"),
          line: {
            color: visible.map((g) => genesWithVariants.has(g.gene.toUpperCase()) ? HAS_VARIANTS_COLOR : "rgba(0,0,0,0)"),
            width: visible.map((g) => genesWithVariants.has(g.gene.toUpperCase()) ? 3 : 0),
          },
          size: visible.map((g) => Math.min(22, 5 + 1.1 * Math.pow(g.probe_count, 0.7))),
          opacity: 0.8,
        },
        text: visible.map((g, i) => visibleHidden.has(i) ? "" : (g.probe_count >= GENE_LABEL_MIN_PROBES ? g.gene : "")),
        textposition: "top center",
        textfont: { size: 9, color: "#333" },
        hoverinfo: "text",
        hovertext: visible.map((g) => geneHoverText(g, false)),
        customdata: visible.map((g) => g.gene),
        showlegend: false,
      });
    }
  }

  // High-level amplifications — always visible regardless of zoom
  if (hasSegments && visibleSpan > GENE_MEAN_THRESHOLD) {
    const amps = geneMeansCum.filter(
      (g) => g.x >= xRange[0] && g.x <= xRange[1]
        && !(hasReportable && reportableGenes.has(g.gene.toUpperCase()))
        && adj(g.mean_log2) >= AMP_LOG2_THRESHOLD
        && g.probe_count >= 4
    );
    if (amps.length > 0) {
      // Group nearby amps to avoid label collisions — label the gene
      // with the most probes and show "+ N more" for the rest
      const minLabelGap = visibleSpan * 0.03;
      const sorted = [...amps].sort((a, b) => a.x - b.x);
      const clusterLeaders = new Set<typeof sorted[0]>();
      const clusterCounts = new Map<typeof sorted[0], number>();
      let clusterStart = sorted[0];
      let clusterBest = sorted[0];
      let clusterSize = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].x - clusterStart.x < minLabelGap) {
          clusterSize++;
          if (sorted[i].probe_count > clusterBest.probe_count) clusterBest = sorted[i];
        } else {
          clusterLeaders.add(clusterBest);
          clusterCounts.set(clusterBest, clusterSize);
          clusterStart = sorted[i];
          clusterBest = sorted[i];
          clusterSize = 1;
        }
      }
      clusterLeaders.add(clusterBest);
      clusterCounts.set(clusterBest, clusterSize);

      traces.push({
        x: amps.map((g) => g.x),
        y: amps.map((g) => clampToRange(adj(g.mean_log2), oorLower, oorUpper)),
        type: "scattergl",
        mode: "markers+text" as Plotly.PlotData["mode"],
        name: LAYER.amplifiedGenes,
        marker: {
          color: amps.map((g) => isOOR(adj(g.mean_log2)) ? OUT_OF_RANGE_COLOR : "#333"),
          line: {
            color: amps.map((g) => genesWithVariants.has(g.gene.toUpperCase()) ? HAS_VARIANTS_COLOR : "rgba(0,0,0,0)"),
            width: amps.map((g) => genesWithVariants.has(g.gene.toUpperCase()) ? 3 : 0),
          },
          size: amps.map((g) => Math.min(22, 5 + 1.1 * Math.pow(g.probe_count, 0.7))),
          opacity: 0.9,
          symbol: "diamond",
        },
        text: amps.map((g) => {
          if (!clusterLeaders.has(g)) return "";
          const count = clusterCounts.get(g) ?? 1;
          return count > 1 ? `${g.gene} +${count - 1} more` : g.gene;
        }),
        textposition: "top center",
        textfont: { size: 9, color: "#333", weight: 700 },
        hoverinfo: "text",
        hovertext: amps.map((g) => geneHoverText(g, false)),
        customdata: amps.map((g) => g.gene),
        showlegend: false,
      });
    }
  }

  // Probe trace — zoom-gated
  const visibleProbes =
    !showProbes ? [] :
    !hasSegments || visibleSpan <= PROBE_THRESHOLD
      ? probesCum.filter((p) => p.x >= xRange[0] && p.x <= xRange[1])
      : [];

  if (visibleProbes.length > 0) {
    traces.push({
      x: visibleProbes.map((p) => p.x),
      y: visibleProbes.map((p) => clampToRange(adj(p.log2), oorLower, oorUpper)),
      type: "scattergl",
      mode: "markers",
      name: LAYER.probes,
      marker: {
        color: visibleProbes.map((p) => isOOR(adj(p.log2)) ? OUT_OF_RANGE_COLOR : "#0072B2"),
        size: 3, opacity: 0.6,
      },
      hoverinfo: "text",
      hovertext: visibleProbes.map(
        (p) => {
          const band = getBand(p.chromosome, p.start);
          return `${p.gene ? escapeHtml(p.gene) : "—"}${isOOR(adj(p.log2)) ? " <b>(OUT OF RANGE)</b>" : ""}${band ? "<br>" + band : ""}<br>${p.chromosome}:${p.start.toLocaleString()}-${p.end.toLocaleString()}<br>log2: ${adj(p.log2).toFixed(3)}${isAdjusted ? ` (raw: ${p.log2.toFixed(3)})` : ""}<br>est. CN: ${estimateCN(p.log2, ploidy, purity)}<br>depth: ${p.depth != null ? p.depth.toFixed(1) : "—"}`;
        }
      ),
      customdata: visibleProbes.map((p) => p.gene || ""),
      showlegend: false,
    });
  }

  // ── Shapes ─────────────────────────────────────────────────────────

  const shapes: Partial<Plotly.Shape>[] = [];

  // Chromosome boundaries
  CANONICAL_CHROMOSOMES.forEach((chrom) => {
    const offset = cumulative_offsets[chrom];
    if (offset === undefined || offset <= 0) return;
    shapes.push({
      type: "line", x0: offset, x1: offset,
      y0: ideogramYTop, y1: yMax,
      line: { color: "#ddd", width: 1 },
    });
  });

  // Zero line
  shapes.push({
    type: "line", x0: 0, x1: totalGenome, y0: 0, y1: 0,
    line: { color: "#999", width: 1, dash: "dash" },
  });

  // Ploidy baseline
  if (Math.abs(ploidyBaseline) > 0.01) {
    shapes.push({
      type: "line", x0: 0, x1: totalGenome, y0: ploidyBaseline, y1: ploidyBaseline,
      line: { color: "#CC79A7", width: 1.5, dash: "dot" },
    });
  }

  // Cytoband ideogram
  const visibleCytobands: Array<{
    name: string; chromosome: string; stain: string;
    start: number; end: number; xStart: number; xEnd: number;
  }> = [];
  for (const band of reference.cytobands) {
    const offset = cumulative_offsets[band.chromosome];
    if (offset === undefined) continue;
    const xStart = offset + band.start;
    const xEnd = offset + band.end;
    if (xEnd < xRange[0] || xStart > xRange[1]) continue;
    visibleCytobands.push({
      name: band.name, chromosome: band.chromosome, stain: band.stain,
      start: band.start, end: band.end, xStart, xEnd,
    });
    shapes.push({
      type: "rect", x0: xStart, x1: xEnd,
      y0: ideogramYBottom, y1: ideogramYTop,
      fillcolor: STAIN_COLORS[band.stain] || "#d0d0d0",
      line: { color: "#333", width: 0.3 },
      layer: "below",
    });
  }

  // Cytoband hover trace
  if (visibleCytobands.length > 0) {
    traces.push({
      type: "bar", name: LAYER.cytobands,
      x: visibleCytobands.map((b) => (b.xStart + b.xEnd) / 2),
      y: visibleCytobands.map(() => ideogramYTop - ideogramYBottom),
      base: ideogramYBottom,
      width: visibleCytobands.map((b) => b.xEnd - b.xStart),
      marker: { color: "rgba(0,0,0,0)", line: { color: "rgba(0,0,0,0)", width: 0 } },
      hoverinfo: "text",
      hovertext: visibleCytobands.map(
        (b) => `<b>${b.chromosome.replace("chr", "")}${b.name}</b><br>${b.chromosome}:${b.start.toLocaleString()}-${b.end.toLocaleString()}<br><i>click to zoom</i>`
      ),
      customdata: visibleCytobands.map((b) => [b.xStart, b.xEnd]),
      showlegend: false,
    } as Plotly.Data);
  }

  // Selected gene highlight
  if (selectedGene) {
    const offset = cumulative_offsets[selectedGene.chromosome];
    if (offset !== undefined) {
      shapes.push({
        type: "rect",
        x0: offset + selectedGene.start, x1: offset + selectedGene.end,
        y0: ideogramYTop, y1: yMax,
        fillcolor: "rgba(255, 200, 50, 0.2)",
        line: { width: 0 }, layer: "below",
      });
    }
  }

  // ── Annotations ────────────────────────────────────────────────────

  const annotations: Partial<Plotly.Annotations>[] = [];

  // Chromosome labels
  CANONICAL_CHROMOSOMES.forEach((chrom) => {
    const offset = cumulative_offsets[chrom];
    const size = chromosome_sizes[chrom];
    if (offset === undefined || size === undefined) return;
    const active = activeChromosome === chrom;
    annotations.push({
      x: offset + size / 2, y: 1.02, yref: "paper",
      text: chrom.replace("chr", ""), showarrow: false,
      font: { size: active ? 13 : 11, color: active ? "#004E7C" : "#0072B2" },
      captureevents: true,
    });
  });

  // p/q arm labels
  if (activeChromosome) {
    const offset = cumulative_offsets[activeChromosome];
    const size = chromosome_sizes[activeChromosome];
    const cen = centromeres.get(activeChromosome);
    if (offset !== undefined && size !== undefined && cen !== undefined) {
      annotations.push({
        x: offset + cen / 2, y: 1.02, yref: "paper",
        text: "p", showarrow: false,
        font: { size: 11, color: "#0072B2" }, captureevents: true,
      });
      annotations.push({
        x: offset + cen + (size - cen) / 2, y: 1.02, yref: "paper",
        text: "q", showarrow: false,
        font: { size: 11, color: "#0072B2" }, captureevents: true,
      });
    }
  }

  // Cytoband labels (when zoomed in)
  if (visibleSpan <= 100_000_000) {
    const minBandWidth = visibleSpan / 30;
    for (const b of visibleCytobands) {
      if (b.xEnd - b.xStart < minBandWidth) continue;
      annotations.push({
        x: (b.xStart + b.xEnd) / 2,
        y: (ideogramYBottom + ideogramYTop) / 2,
        text: b.chromosome.replace(/^chr/i, "") + b.name,
        showarrow: false,
        font: { size: 8, color: b.stain === "gpos100" || b.stain === "gpos75" ? "#fff" : "#333" },
      });
    }
  }

  // Selected gene label
  if (selectedGene && visibleSpan <= GENE_MEAN_THRESHOLD) {
    const offset = cumulative_offsets[selectedGene.chromosome];
    if (offset !== undefined) {
      annotations.push({
        x: offset + (selectedGene.start + selectedGene.end) / 2,
        y: 1.05, yref: "paper",
        text: `<b>${selectedGene.gene}</b>`, showarrow: false,
        font: { size: 12, color: "#b8860b" },
      });
    }
  }

  // LOD indicator
  const lodLabel =
    visibleSpan > GENE_MEAN_THRESHOLD ? "segments"
    : visibleSpan > PROBE_THRESHOLD ? "segments + gene means"
    : "segments + gene means + probes";

  const chromByLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of CANONICAL_CHROMOSOMES) m.set(c.replace("chr", ""), c);
    return m;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <>
      {/* Controls bar */}
      <div className="controls-bar">
        {isZoomed && (
          <button className="btn" onClick={resetZoom}>Whole genome view</button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          <label className="control-group" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
            <input type="checkbox" checked={showProbes} onChange={(e) => setShowProbes(e.target.checked)} />
            Probes
          </label>
          <div className="control-group">
            <span className="control-label">Y-axis</span>
            <input className="control-input" type="number" value={oorLower}
              onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v < oorUpper - 1) setYMin(v - OOR_MARGIN); }} />
            <span>to</span>
            <input className="control-input" type="number" value={oorUpper}
              onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v > oorLower + 1) setYMax(v + OOR_MARGIN); }} />
          </div>
          <div className="control-group">
            <span className="control-label">Chromosomes</span>
            <input className="control-input" type="number" value={chromCount} min={1}
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v) && v >= 1) setChromCount(v); }} />
            {ploidy !== 2 && (
              <span className="control-hint" style={{ color: "#CC79A7" }}>ploidy {ploidy.toFixed(1)}</span>
            )}
          </div>
          <div className="control-group">
            <span className="control-label">Purity</span>
            <input className="control-input" type="number" value={purityPct} min={1} max={100}
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v) && v >= 1 && v <= 100) setPurityPct(v); }} />
            <span>%</span>
          </div>
          {hasProbeDepth && (
            <ExclusionToggle label="Exclude probes with no coverage" checked={excludeNoCoverage} onChange={setExcludeNoCoverage}
              help="Exclude probes with no coverage from gene mean calculations. The probes themselves will still be displayed on the plot if 'probes' is toggled on." />
          )}
          {hasAntitarget && (
            <ExclusionToggle label="Exclude antitarget bins" checked={excludeAntitarget} onChange={setExcludeAntitarget}
              help="Exclude antitarget bins from gene mean calculations. The probes themselves will still be displayed on the plot if 'probes' is toggled on." />
          )}
        </div>
      </div>

      {/* Highlight genes bar */}
      <div style={{
        padding: "0.4rem 0.75rem", background: "#f8f8f8", borderBottom: "1px solid #e0e0e0",
        display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap",
      }}>
        <label style={{ fontSize: "0.8rem", flexShrink: 0 }}>Highlight genes</label>
        <input
          type="text" value={reportableText}
          onChange={(e) => applyReportableGenes(e.target.value)}
          style={{ flex: 1, minWidth: "180px", fontSize: "0.8rem", fontFamily: "monospace", padding: "0.25rem 0.4rem", borderRadius: "4px", border: "1px solid #ccc" }}
          placeholder="EGFR, ERBB2, MET, BRAF, ..."
        />
        {allowUploads && <label style={{ fontSize: "0.75rem", color: "#777", flexShrink: 0, cursor: "pointer" }}>
          or CSV
          <input ref={reportableCsvRef} type="file" accept=".csv,.txt" style={{ display: "none" }}
            onChange={async (e) => { const file = e.target.files?.[0]; if (file) applyReportableGenes(await file.text(), true); }} />
        </label>}
        {hasReportable && (
          <button className="btn" style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
            onClick={() => { setReportableGenes(new Set()); setReportableText(""); if (reportableCsvRef.current) reportableCsvRef.current.value = ""; }}>
            Clear
          </button>
        )}
      </div>

      {/* Run controls upload */}
      <div style={{
        padding: "0.4rem 0.75rem", background: "#f8f8f8", borderBottom: "1px solid #e0e0e0",
        display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap",
      }}>
        <label
          style={{ fontSize: "0.8rem", flexShrink: 0, cursor: "pointer", userSelect: "none" }}
          onClick={() => setShowControls(!showControls)}
        >
          {showControls ? "▾" : "▸"} Run controls
          {controlBand && controlBand.length > 0 && (
            <span style={{ color: "#0072B2", marginLeft: "0.4rem" }}>
              ({controlSampleCount} sample{controlSampleCount !== 1 ? "s" : ""} loaded)
            </span>
          )}
        </label>
        {controlBand && controlBand.length > 0 && (
          <label style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
            <input type="checkbox" checked={showControlBand} onChange={(e) => setShowControlBand(e.target.checked)} />
            Show band
          </label>
        )}
        {allowUploads && showControls && controlFiles.length === 0 && !(controlBand && controlBand.length > 0) && (
          <>
            <input
              ref={controlInputRef}
              type="file"
              multiple
              accept=".cns"
              style={{ fontSize: "0.8rem" }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) await addControlFiles(files);
              }}
            />
            {controlLoading && <span style={{ fontSize: "0.8rem", color: "#999" }}>Computing...</span>}
          </>
        )}
        {allowUploads && showControls && controlFiles.length > 0 && (
          <>
            <button
              className="btn"
              style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
              onClick={() => controlInputRef.current?.click()}
            >
              Add more
            </button>
            <input
              ref={controlInputRef}
              type="file"
              multiple
              accept=".cns"
              style={{ display: "none" }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) await addControlFiles(files);
              }}
            />
            <button
              className="btn"
              style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", color: "#999" }}
              onClick={clearControls}
            >
              Clear
            </button>
            {controlLoading && <span style={{ fontSize: "0.8rem", color: "#999" }}>Computing...</span>}
          </>
        )}
      </div>

      <LegendPanel hasVariants={genesWithVariants.size > 0} />

      {/* CNV Plot */}
      <PlotlyChart
        data={traces}
        layout={{
          title: {
            text: `${selectedGene ? selectedGene.gene : activeChromosome ? activeChromosome.replace("chr", "Chr ") : isZoomed ? "Genome View" : "Whole Genome View"} <span style="font-size:11px;color:#888">(${lodLabel})</span>`,
            font: { size: 16 },
          },
          dragmode: "pan",
          uirevision: `genome-${revision}`,
          xaxis: {
            title: { text: "" }, showticklabels: false,
            range: xRange, minallowed: 0, maxallowed: totalGenome, showgrid: false,
          },
          yaxis: {
            title: { text: "log2 ratio" },
            range: [yAxisBottom, yMax], fixedrange: true, zeroline: false,
            tickvals: Array.from({ length: Math.floor(oorUpper - oorLower) + 1 }, (_, i) => oorLower + i),
          },
          shapes: [...controlShapes, ...shapes], annotations,
          height: 400,
          margin: { t: 50, b: 30, l: 60, r: 20 },
          hovermode: "closest",
          plot_bgcolor: "#fafafa",
          paper_bgcolor: "#fff",
        }}
        config={{
          responsive: true, displayModeBar: true, scrollZoom: true,
          modeBarButtonsToRemove: ["select2d", "lasso2d"],
          doubleClick: "reset",
        }}
        style={{ width: "100%" }}
        onClick={(data) => {
          if (!data.points.length) return;
          const point = data.points[0];
          const trace = traces[point.curveNumber];
          const extra = point as unknown as PointExtras;
          if (!trace) return;
          if (trace.name === LAYER.cytobands) {
            const cd = extra.customdata as [number, number] | undefined;
            if (cd) {
              const padding = (cd[1] - cd[0]) * 2;
              setXRange([cd[0] - padding, cd[1] + padding]);
              setRevision((r) => r + 1);
            }
            return;
          }
          const raw = extra.hovertext || extra.text || "";
          if (!raw) return;
          const lines = hoverLines(raw);
          const traceName = trace.name as string | undefined;
          const cd = extra.customdata as string | undefined;
          const geneName = GENE_LAYERS.has(traceName ?? "") && cd && genesByName.has(cd)
            ? cd : undefined;
          const evt: MouseEvent | undefined = data.event;
          setPopup({ x: evt?.clientX ?? 400, y: evt?.clientY ?? 300, lines, gene: geneName });
        }}
        onClickAnnotation={(e) => {
          const text = e?.annotation?.text as string | undefined;
          if (!text) return;
          if ((text === "p" || text === "q") && activeChromosome) {
            zoomToArm(activeChromosome, text);
            return;
          }
          const chrom = chromByLabel.get(text);
          if (chrom) zoomToChromosome(chrom);
        }}
        onRelayout={(e) => {
          const ev = e as unknown as Record<string, unknown>; // axis ranges arrive under dotted keys
          if (ev["xaxis.autorange"]) { setXRange([0, totalGenome]); onClearSelection?.(); return; }
          const x0 = ev["xaxis.range[0]"];
          const x1 = ev["xaxis.range[1]"];
          if (typeof x0 === "number" && typeof x1 === "number") {
            setXRange([x0, x1]);
            if (x0 <= 1 && x1 >= totalGenome - 1) onClearSelection?.();
            return;
          }
          const range = ev["xaxis.range"];
          if (Array.isArray(range) && range.length === 2) {
            const r0 = Number(range[0]), r1 = Number(range[1]);
            setXRange([r0, r1]);
            if (r0 <= 1 && r1 >= totalGenome - 1) onClearSelection?.();
          }
        }}
      />

      {popup && (
        <Popup
          popup={popup}
          selectedGene={selectedGene}
          genesByName={genesByName}
          onGeneSelect={onGeneSelect}
          onClose={() => setPopup(null)}
        />
      )}

      {selectedGene && somaticVariants.length > 0 && (
        <VariantTable
          title={`${selectedGene.gene} variants`}
          variants={somaticVariants.filter((v) => v.gene.toUpperCase() === selectedGene.gene.toUpperCase())}
          showHidden={showHiddenVariants}
          onShowHidden={setShowHiddenVariants}
        />
      )}

      <BafPlot
        variantsCum={variantsCum}
        cumulativeOffsets={cumulative_offsets}
        totalGenome={totalGenome}
        xRange={xRange}
        revision={revision}
        onXRangeChange={setXRange}
        onPopup={setPopup}
      />

      <VariantTable
        title="Variants"
        variants={somaticVariants}
        showHidden={showHiddenVariants}
        onShowHidden={setShowHiddenVariants}
        collapsible
        geneColumn={{ genesByName, onGeneSelect }}
      />
    </>
  );
}

/** Gene names from typed text or a CSV/text file: comma, tab or line separated; header words skipped. */
function parseGeneList(text: string): string[] {
  return text
    .split(/[,\n\r\t]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && !/^(GENE|GENES|HUGO_SYMBOL|SYMBOL|NAME)$/.test(s));
}

/** Fields Plotly sets on clicked points that its types don't declare */
interface PointExtras { customdata?: unknown; hovertext?: string; text?: string }

/** Checkbox for the gene-mean exclusions, with an ⓘ that shows its explanation on hover. */
function ExclusionToggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="control-group" style={{ cursor: "pointer" }} title={help}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="control-label">{label}</span>
      <span className="info-icon" aria-label={help} role="img">ⓘ</span>
    </label>
  );
}
