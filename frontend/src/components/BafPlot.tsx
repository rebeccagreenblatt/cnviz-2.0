import PlotlyChart from "./PlotlyChart";
import { CANONICAL_CHROMOSOMES } from "../types";
import { CHROM_COLORS } from "../constants";
import { escapeHtml, hoverLines } from "../plotlyText";

interface BafVariant {
  x: number;
  baf: number;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  depth: number;
}

interface BafPlotProps {
  variantsCum: BafVariant[];
  cumulativeOffsets: Record<string, number>;
  totalGenome: number;
  xRange: [number, number];
  revision: number;
  onXRangeChange: (range: [number, number]) => void;
  onPopup: (popup: { x: number; y: number; lines: string[] }) => void;
}

export default function BafPlot({
  variantsCum,
  cumulativeOffsets,
  totalGenome,
  xRange,
  revision,
  onXRangeChange,
  onPopup,
}: BafPlotProps) {
  if (variantsCum.length === 0) return null;

  const traces: Plotly.Data[] = [];

  CANONICAL_CHROMOSOMES.forEach((chrom, i) => {
    const offset = cumulativeOffsets[chrom];
    if (offset === undefined) return;
    const chromVars = variantsCum.filter((v) => v.chromosome === chrom);
    if (chromVars.length === 0) return;
    traces.push({
      x: chromVars.map((v) => v.x),
      y: chromVars.map((v) => v.baf),
      type: "scattergl",
      mode: "markers",
      name: chrom,
      marker: { color: CHROM_COLORS[i % 2], size: 3, opacity: 0.6 },
      hoverinfo: "text",
      hovertext: chromVars.map(
        (v) =>
          `${v.chromosome}:${v.position.toLocaleString()}<br>${escapeHtml(v.ref)}&gt;${escapeHtml(v.alt)}<br>BAF: ${v.baf.toFixed(3)}<br>depth: ${v.depth}`
      ),
      showlegend: false,
    });
  });

  traces.push({
    x: [0, totalGenome],
    y: [0.5, 0.5],
    type: "scattergl",
    mode: "lines",
    line: { color: "#999", width: 1, dash: "dash" },
    hoverinfo: "skip",
    showlegend: false,
  });

  const shapes: Partial<Plotly.Shape>[] = [];
  CANONICAL_CHROMOSOMES.forEach((chrom) => {
    const offset = cumulativeOffsets[chrom];
    if (offset === undefined || offset <= 0) return;
    shapes.push({
      type: "line",
      x0: offset, x1: offset,
      y0: 0, y1: 1,
      line: { color: "#ddd", width: 1 },
    });
  });

  return (
    <PlotlyChart
      data={traces}
      layout={{
        title: { text: "B-Allele Frequency", font: { size: 14 } },
        dragmode: "pan",
        uirevision: `baf-${revision}`,
        xaxis: {
          title: { text: "" },
          showticklabels: false,
          range: xRange,
          minallowed: 0,
          maxallowed: totalGenome,
          showgrid: false,
        },
        yaxis: {
          title: { text: "BAF" },
          range: [-0.05, 1.05],
          fixedrange: true,
          zeroline: false,
          tickvals: [0, 0.25, 0.5, 0.75, 1.0],
        },
        shapes,
        height: 250,
        margin: { t: 35, b: 30, l: 60, r: 20 },
        hovermode: "closest",
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fff",
      }}
      config={{
        responsive: true,
        displayModeBar: false,
        scrollZoom: true,
        doubleClick: "reset",
      }}
      style={{ width: "100%" }}
      onRelayout={(e) => {
        const ev = e as unknown as Record<string, unknown>; // axis ranges arrive under dotted keys
        if (ev["xaxis.autorange"]) {
          onXRangeChange([0, totalGenome]);
          return;
        }
        const x0 = ev["xaxis.range[0]"];
        const x1 = ev["xaxis.range[1]"];
        if (typeof x0 === "number" && typeof x1 === "number") {
          onXRangeChange([x0, x1]);
          return;
        }
        const range = ev["xaxis.range"];
        if (Array.isArray(range) && range.length === 2) {
          onXRangeChange([Number(range[0]), Number(range[1])]);
        }
      }}
      onClick={(data) => {
        if (!data.points.length) return;
        const pt = data.points[0];
        const extra = pt as unknown as { hovertext?: string; text?: string }; // not declared in Plotly's types
        const raw = extra.hovertext || extra.text || "";
        if (!raw) return;
        const lines = hoverLines(raw);
        const evt: MouseEvent | undefined = data.event;
        const px = evt?.clientX ?? 400;
        const py = evt?.clientY ?? 300;
        onPopup({ x: px, y: py, lines });
      }}
    />
  );
}
