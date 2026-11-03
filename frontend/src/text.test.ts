import { describe, expect, it } from "vitest";
import { escapeHtml, hoverLines } from "./plotlyText";
import { loadEmbeddedCase } from "./embeddedCase";

describe("hover text from input files", () => {
  it("escapes markup so it shows as literal text, and the popup restores it", () => {
    const gene = '<b style="color:red">FAKE</b> & co';
    const hover = `${escapeHtml(gene)}<br>chr1:100`;
    expect(hover).not.toContain("<b ");
    expect(hoverLines(hover)).toEqual([gene, "chr1:100"]);
  });
});

describe("report files (embedded case)", () => {
  it("loads embedded files through the normal parsers, with the pipeline's purity, ploidy and genes", async () => {
    const cns = "chromosome\tstart\tend\tgene\tlog2\tdepth\tprobes\tweight\n7\t0\t1000\t-\t1.2\t300\t5\t4\n";
    const { loaded, info } = await loadEmbeddedCase({
      format: "cnviz-case/1", name: "S1", build: "hg38", generated: "2026-11-02", cnviz_version: "2.0.0",
      purity_pct: 60, chromosomes: 69, files: { cns: { name: "S1.cns", text: cns }, genes: { name: "g.csv", text: "Gene\nEGFR\n" } },
    });
    expect(loaded.segments[0].chromosome).toBe("chr7");
    expect(info).toMatchObject({ name: "S1", purityPct: 60, chromosomes: 69, genesText: "Gene\nEGFR\n" });
  });
});
