// "For labs" page (cnviz.com only): a short overview. Setup instructions live in the GitHub README.

const REPO = "https://github.com/rebeccagreenblatt/cnviz-2.0";

const ExternalLink = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

export default function ForLabsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="about-page">
      <div className="about-content">
        <h2>Using CNViz in your lab</h2>
        <p>To view your own cases, run CNViz at your institution, in one of two ways:</p>
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
        <p>See the <ExternalLink href={REPO}>GitHub repository</ExternalLink> for the files and setup instructions.</p>

        <section>
          <h3>Security</h3>
          <p>
            CNViz runs on your computer and doesn't upload or store data. Please use institutionally managed computers
            without third-party browser extensions. CNViz is a visualization aid, not a validated clinical test.
            Details: <ExternalLink href={`${REPO}/blob/main/SECURITY.md`}>SECURITY.md</ExternalLink>.
          </p>
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
