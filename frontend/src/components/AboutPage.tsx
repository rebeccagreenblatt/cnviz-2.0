import { DEMO_ONLY } from "../buildMode";
import { readEmbeddedCase } from "../embeddedCase";

interface AboutPageProps {
  onBack: () => void;
}

// Which CNViz this is: the cnviz.com demo, the offline viewer, or a report file
function whichVersion(): string {
  if (DEMO_ONLY) return "the cnviz.com demo";
  try { if (readEmbeddedCase()) return "a CNViz report file"; } catch { /* not a report */ }
  return "the CNViz offline viewer";
}

export default function AboutPage({ onBack }: AboutPageProps) {
  return (
    <div className="about-page">
      <div className="about-content">
        <h2>About CNViz</h2>

        <section>
          <h3>What is CNViz?</h3>
          <p>
            CNViz is an interactive visualization tool for copy number data. It is designed for molecular pathologists
            and genomics professionals who need to quickly review CNVkit output, optionally alongside B-allele frequency
            data and/or variant data. This is an updated implementation of CNViz, which was originally published as an
            R/Shiny application (Ramesh et al., <em>Journal of Pathology Informatics</em>, 2022).
          </p>
          <p className="small">You are using {whichVersion()}, version {__CNVIZ_VERSION__}.</p>
        </section>

        <section>
          <h3>Privacy</h3>
          <p>
            CNViz runs entirely on your computer. Files are never uploaded or stored. Please use an institutionally
            managed computer without third-party browser extensions. CNViz is a visualization aid, not a validated
            clinical test. See SECURITY.md in the CNViz GitHub repository for details.
          </p>
        </section>

        <section>
          <h3>Supported File Formats</h3>
          <ul>
            <li><strong>.cnr:</strong> CNVkit bin-level log2 ratios</li>
            <li><strong>.cns:</strong> CNVkit segments</li>
            <li>
              <strong>.vcf, .baf or .maf:</strong> B-allele frequency data (optional). From a VCF, CNViz uses the AF
              field, or the read counts (AD) when AF is blank, from the first sample column. From a MAF, it uses the
              ref and alt read counts.
            </li>
            <li><strong>.maf:</strong> variant data (optional)</li>
          </ul>
          <p>
            You can load any combination: bins only, segments only, or both. Gzipped files (.gz) are accepted, and
            chromosomes can be named "chr7" or "7". Exact column requirements, for converting output from other
            callers: see the For labs page on cnviz.com.
          </p>
        </section>

        <section>
          <h3>Features</h3>
          <ul>
            <li>Genome-wide and chromosome-level zoom with interactive navigation</li>
            <li>Probe, gene-mean, and segment visualization</li>
            <li>B-allele frequency plot synced to the copy number view</li>
            <li>Real-time log2 recalculation based on ploidy and tumor purity</li>
            <li>Out-of-range highlighting for aberrant regions</li>
            <li>Gene search with click-to-zoom</li>
            <li>Highlight specific genes of interest by typing a gene list (or loading a CSV in the offline viewer)</li>
            <li>Variant table, for all variants and in gene view</li>
            <li>Run controls: .cns files from control samples, displayed as a 95% reference range</li>
            <li>Support for hg19 and hg38 reference builds</li>
          </ul>
        </section>

        <section>
          <h3>How It Works</h3>
          <p>
            When you load files, CNViz reads them, assigns probes to genes, calculates
            gene-level log2 ratios, and renders everything with Plotly.js.
          </p>

          <h4>Gene Means</h4>
          <p>
            Probes are assigned to a gene by their coordinates (UCSC NCBI RefSeq Curated gene positions), not by the
            gene label in the .cnr, so off-target (antitarget) bins inside a gene count toward it. A gene's value is
            the weighted mean of its probes' log2 ratios, using CNVkit's bin weights, as in CNVkit's own gene-level
            summary (genemetrics). Two optional settings leave probes out of gene means: probes with no coverage
            (depth 0), and antitarget bins. The probes themselves are still displayed.
          </p>

          <h4>Purity &amp; Ploidy Adjustment</h4>
          <p>To isolate somatic alterations from normal tissue contamination, CNViz utilizes
            the mathematical framework established by the ABSOLUTE model (Carter et al., 2012).
            Using your provided tumor purity and ploidy values, the app calculates the absolute tumor copy number (C) for a given segment:
            <code>C = (2^raw · (α·τ + 2·(1−α)) − 2·(1−α)) / α</code>,
            where <code>raw</code> is the log2 copy ratio, <code>α</code> is the tumor purity,
            and <code>τ</code> is the baseline tumor ploidy.
          </p>
          <p>
            <strong>Note on Ploidy (τ):</strong> This pipeline derives τ from the total, user-inputted karyotype chromosome count divided by 23.
            While practical, users should note that this
            unweighted count treats all chromosomes equally and does not account for
            variations in chromosome size.
          </p>
          <p>
            <strong>Note on CNVKit input:</strong> The purity/ploidy adjustment in CNViz assumes
            the input log2 ratios have not been rescaled for purity or ploidy by CNVKit.
            If you have already applied purity/ploidy correction
            via <code>cnvkit.py call</code>, leave these settings at their defaults in CNViz
            (ploidy = 2, purity = 100%) to avoid double correction.
          </p>

          <h4>B-Allele Frequency</h4>
          <p>
            B-allele frequency values are displayed as raw observed
            frequencies and are not adjusted for purity or ploidy.
          </p>

          <h4>Variant Data</h4>
          <p>
            Variants from the MAF file are listed in a table at the bottom of the page, and for the selected gene in
            gene view, with HGVSc, HGVSp, classification, significance, VAF and depth. Intronic, intergenic, flanking, UTR and silent variants, and benign variants, are hidden by default unless called pathogenic, but can be displayed. The variant table is intended as a supplementary view and should not replace your
            primary variant review workflow.
          </p>

          <h4>Amplification Callout</h4>
          <p>
            In the whole genome view, genes with a mean log2 ratio ≥ 2 after purity/ploidy adjustment (estimated copy number ≥ 8) and at least 4 probes are highlighted automatically, even if they are not on your "Highlight genes" list. This feature is intended to highlight focal amplifications that might otherwise be missed. Gene-level deletions are not highlighted by default at whole genome zoom, however, you can type any gene into the "Highlight genes" field to view it in the whole genome view.
          </p>

          <h4>Run Controls</h4>
          <p>
            .cns files from other samples in the same sequencing run, or from a panel of normal samples, are displayed
            as a band behind the sample's copy number data. This helps distinguish real copy number aberrations from
            recurrent probe or region bias. CNViz finds the minimal non-overlapping segments across all control files,
            then calculates the mean ± 1.96 SD of log2 ratios per segment: the range about 95% of normal samples fall
            in (a 95% reference range). The band adjusts for purity like the sample, but not for ploidy. Where only one
            control covers a region, only its mean line is shown. This feature can also be used to compare a tumor to its matched germline sample: with a single control, CNViz shows that sample’s log2 values as a line instead of a 95% reference range.
          </p>

          <h4>Reference Data</h4>
          <p>Chromosome sizes, cytobands and gene positions come from UCSC (hg19 and hg38).</p>
        </section>

        <section>
          <p>Questions or comments? Contact cnviz.help@gmail.com</p>
        </section>

        <button className="btn btn-primary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
