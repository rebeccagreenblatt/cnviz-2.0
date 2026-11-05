// "For labs" page (cnviz.com only): how a lab runs CNViz itself, as report files or the offline viewer.

const RELEASES = "https://github.com/rebeccagreenblatt/cnviz-2.0/releases";
const REPO = "https://github.com/rebeccagreenblatt/cnviz-2.0";
const BUILDING = `${REPO}/blob/main/BUILDING.md`;

const ExternalLink = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

const EXAMPLE = `python3 cnviz_report.py \\
  --template      /lab/tools/cnviz/cnviz-2.0.0.html \\
  --expect-sha256 <the 64-character checksum shown on the release page> \\
  --build         hg38 \\
  --cnr           /data/run_2026-11-02/S1/S1.cnr \\
  --cns           /data/run_2026-11-02/S1/S1.cns \\
  --baf           /data/run_2026-11-02/S1/S1_baf.maf \\
  --variants      /data/run_2026-11-02/S1/S1_somatic.maf \\
  --controls      /data/run_2026-11-02/controls/ctrl1.cns \\
                  /data/run_2026-11-02/controls/ctrl2.cns \\
                  /data/run_2026-11-02/controls/ctrl3.cns \\
  --genes         /lab/tools/cnviz/cnv_reportable_genes.csv \\
  --purity        60 \\
  --ploidy        3 \\
  --name          S1 \\
  -o              /data/run_2026-11-02/S1/S1_cnviz.html`;

export default function ForLabsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="about-page">
      <div className="about-content">
        <h2>Using CNViz in your lab</h2>
        <p>
          cnviz.com shows a demo case only, and nothing can be uploaded here. To view your own cases, run CNViz inside
          your institution, in one of two ways:
        </p>
        <table>
          <thead>
            <tr><th></th><th>Report file (recommended)</th><th>Offline viewer</th></tr>
          </thead>
          <tbody>
            <tr><th>What it is</th><td>Your pipeline writes one HTML file per case, with the case data already loaded</td><td>One HTML file; users load a case's files by hand</td></tr>
            <tr><th>Who sets it up</th><td>Bioinformatics team, as one pipeline step</td><td>Bioinformatics or IT team, once</td></tr>
            <tr><th>What users do</th><td>Open the case's report file</td><td>Open the viewer, choose the case's files</td></tr>
          </tbody>
        </table>
        <p>
          Both are the same app, and both work fully offline: no installation, no server, no network connections. Your
          team reviews and controls the exact version you run, and nothing changes unless you install a new version.
        </p>

        <section>
          <h3>What you need</h3>
          <p>
            CNViz reads CNVkit's <code>.cnr</code> (bins) and <code>.cns</code> (segments) format. Using a different CNV
            caller? Convert its output to these tab-separated columns, and CNViz will display it the same way.
          </p>
          <table>
            <thead>
              <tr><th>File</th><th>Required columns</th><th>Optional columns used</th></tr>
            </thead>
            <tbody>
              <tr><td><code>.cnr</code></td><td>chromosome, start, end, log2</td><td>gene (CNVkit's labels, incl. "Antitarget"), depth, weight</td></tr>
              <tr><td><code>.cns</code></td><td>chromosome, start, end, log2</td><td></td></tr>
              <tr><td>BAF <code>.vcf</code></td><td>Standard VCF with AF or AD in the sample column (first sample column used; PASS or unfiltered only)</td><td></td></tr>
              <tr><td>BAF <code>.maf</code></td><td>Chromosome, Start_Position, t_alt_count, t_ref_count</td><td></td></tr>
              <tr><td>BAF <code>.baf</code></td><td>chromosome, start, end, baf (DRAGEN style)</td><td></td></tr>
              <tr><td>Variants <code>.maf</code></td><td>Hugo_Symbol, Chromosome, Start_Position</td><td>Reference_Allele, Tumor_Seq_Allele2, HGVSc, HGVSp_Short, Variant_Classification, a significance column (e.g. CLIN_SIG), t_alt_count, t_ref_count, t_depth</td></tr>
            </tbody>
          </table>
          <ul>
            <li><strong>File shape:</strong> tab-separated text with one header row of column names. Extra columns are ignored.</li>
            <li><strong>log2:</strong> the log2 ratio of the sample's coverage to a diploid reference (0 = two copies), as CNVkit reports it.</li>
            <li><strong>Coordinates:</strong> CNVkit's convention (BED-style: 0-based start, end not included), matching the build you choose (hg19 or hg38).</li>
            <li><strong>Chromosomes</strong> can be named <code>chr7</code> or <code>7</code>.</li>
          </ul>
          <p>Gene positions come from CNViz's bundled UCSC reference, not from your files.</p>
        </section>

        <section>
          <h3>Report file</h3>
          <p>
            <strong>Requirements:</strong> Python 3.8 or later (standard library only). From
            the <ExternalLink href={RELEASES}>latest release</ExternalLink>, download <code>cnviz-2.0.0.html</code> (the
            template), its <code>.sha256</code> file, and <code>cnviz_report.py</code>.
          </p>
          <p><strong>One report per case</strong>, for example:</p>
          <pre>{EXAMPLE}</pre>
          <p>It prints: <code>wrote /data/run_2026-11-02/S1/S1_cnviz.html (10.4 MB) · case S1 · CNViz 2.0.0</code></p>
          <table>
            <thead>
              <tr><th>Option</th><th>What it is</th><th>Required?</th></tr>
            </thead>
            <tbody>
              <tr><td><code>--template</code></td><td>The CNViz file from the release</td><td>Yes</td></tr>
              <tr><td><code>--expect-sha256</code></td><td>Its checksum from the release page; the script refuses a template that doesn't match</td><td>Strongly recommended</td></tr>
              <tr><td><code>--build</code></td><td><code>hg19</code> or <code>hg38</code></td><td>Yes</td></tr>
              <tr><td><code>--cnr</code></td><td>CNVkit bins (probe-level log2 ratios)</td><td>One of these two</td></tr>
              <tr><td><code>--cns</code></td><td>CNVkit segments</td><td>One of these two</td></tr>
              <tr><td><code>--baf</code></td><td>Allele frequencies for the BAF plot: one <code>.vcf</code>, <code>.baf</code> or <code>.maf</code> with read counts</td><td>No</td></tr>
              <tr><td><code>--variants</code></td><td>Somatic variants (<code>.maf</code>) for the variant table; can be a different MAF than the BAF one, or the same</td><td>No</td></tr>
              <tr><td><code>--controls</code></td><td>Run-control segment files (<code>.cns</code>), any number, for the 95% reference range</td><td>No</td></tr>
              <tr><td><code>--genes</code></td><td>The genes your lab reports CNVs for (often a subset of the panel), highlighted in the report; readers can still type more (<code>.csv</code> or <code>.txt</code>)</td><td>No</td></tr>
              <tr><td><code>--purity</code></td><td>Tumor purity in %; default 100</td><td>No</td></tr>
              <tr><td><code>--ploidy</code></td><td>Tumor ploidy; default 2 (shown as 69 chromosomes for ploidy 3)</td><td>No</td></tr>
              <tr><td><code>--name</code></td><td>Case name shown in the report; default is the <code>.cnr</code>/<code>.cns</code> file name</td><td>No</td></tr>
              <tr><td><code>-o</code></td><td>Where to write the report</td><td>Yes</td></tr>
            </tbody>
          </table>
          <p>
            Any input can be gzipped (<code>.gz</code>). In a pipeline, the template and checksum usually live in the
            pipeline's configuration and the case paths come from the pipeline.
          </p>
          <p>
            <strong>Storage:</strong> a report contains the case's data. Store it wherever your lab keeps case results.
          </p>
        </section>

        <section>
          <h3>Offline viewer</h3>
          <ol>
            <li>Download <code>cnviz-2.0.0.html</code> and its <code>.sha256</code> from
              the <ExternalLink href={RELEASES}>latest release</ExternalLink>, and verify them (below).</li>
            <li>Put the file somewhere users can open it:
              <ul>
                <li>a <strong>shared network drive</strong>, read-only for users so only your team can replace it; or</li>
                <li>an <strong>internal web server</strong>, if your browsers block opening HTML files from network drives.</li>
              </ul>
            </li>
            <li>Users open it in Chrome, Edge or Firefox and load a case's <code>.cnr</code> / <code>.cns</code> (plus
              optional BAF, variants and controls).</li>
          </ol>
        </section>

        <section>
          <h3>Verifying a release</h3>
          <ul>
            <li><strong>Checksum:</strong> <code>shasum -a 256 cnviz-2.0.0.html</code> must match the release page.</li>
            <li><strong>Built by GitHub from the public source:</strong> <code>gh attestation verify cnviz-2.0.0.html --repo rebeccagreenblatt/cnviz-2.0</code> confirms
              GitHub's automated build produced this exact file from the published code. A file uploaded by hand would fail.</li>
            <li><strong>Or build it from source yourself:</strong> see <ExternalLink href={BUILDING}>BUILDING.md</ExternalLink> on
              GitHub. The result is identical to the release, with the same checksum.</li>
          </ul>
        </section>

        <section>
          <h3>Updating</h3>
          <p>
            New versions are published as GitHub releases. Nothing updates on its own: your team reviews a new version,
            verifies it, and replaces the file or template when ready.
          </p>
          <p>
            To be notified of new releases, click <strong>Watch → Custom → Releases</strong> on
            the <ExternalLink href={REPO}>GitHub repository</ExternalLink>.
          </p>
        </section>

        <section>
          <h3>Security, and what CNViz is not</h3>
          <ul>
            <li><strong>Protects:</strong> CNViz never uploads or stores data, and makes no network connections. Its
              security policy allows only the released code to run.</li>
            <li><strong>Doesn't protect against:</strong> a modified copy of CNViz itself (hence verifying releases), or
              browser extensions on the user's computer, which can read any page. The full security summary is in
              the <ExternalLink href={REPO}>repository</ExternalLink>.</li>
            <li><strong>Not a validated test:</strong> CNViz is a visualization aid. Whether and how to use it clinically,
              and what validation is needed, is your lab's decision.</li>
          </ul>
        </section>

        <section>
          <p>Questions? Contact cnviz.help@gmail.com</p>
          <p>CNViz is open source (MIT license) · Rebecca G. Ramesh</p>
        </section>

        <button className="btn btn-primary" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
