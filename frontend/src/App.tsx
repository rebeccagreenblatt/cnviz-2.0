import { useCallback, useEffect, useMemo, useState } from "react";
import { DEMO_ONLY } from "./buildMode";
import FileUpload from "./components/FileUpload";
import GenomeView from "./components/GenomeView";
import AboutPage from "./components/AboutPage";
import ForLabsPage from "./components/ForLabsPage";
import GeneSearch from "./components/GeneSearch";
import { computeControlBand, computeGeneMeans, mergeGenes } from "./compute";
import { getGenes, getReference } from "./data/reference";
import { loadEmbeddedCase, readEmbeddedCase, type ReportInfo } from "./embeddedCase";
import type { Build, ControlBand, Gene, GeneMean, LoadedCase, Probe, Segment, SomaticVariant, VcfVariant } from "./types";
import "./App.css";

// Report files: read the embedded case once, before first render (null for the plain app)
const EMBEDDED = (() => {
  try { return { case: readEmbeddedCase(), error: null }; } catch (e) { return { case: null, error: String(e) }; }
})();

function App() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [build, setBuild] = useState<Build>("hg38");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [geneMeans, setGeneMeans] = useState<GeneMean[]>([]);
  const [genes, setGenes] = useState<Gene[]>([]);
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
  const [selectedGene, setSelectedGene] = useState<Gene | null>(null);
  const [variants, setVariants] = useState<VcfVariant[]>([]);
  const [somaticVariants, setSomaticVariants] = useState<SomaticVariant[]>([]);
  const [page, setPage] = useState<"app" | "about" | "labs">("app");
  const [controlBand, setControlBand] = useState<ControlBand[]>([]);
  const [controlCount, setControlCount] = useState(0);
  const [report, setReport] = useState<ReportInfo | null>(null); // set when this page is a CNViz report file
  const [reportError, setReportError] = useState<string | null>(EMBEDDED.error);

  const reference = useMemo(() => getReference(build), [build]);

  const handleFilesLoaded = useCallback(
    (data: LoadedCase) => {
      setCaseId(data.caseId);
      setBuild(data.build);

      const ucscGenes = getGenes(data.build);
      const means = computeGeneMeans(data.probes, ucscGenes);
      const merged = mergeGenes(ucscGenes, data.probes);

      setProbes(data.probes);
      setSegments(data.segments);
      setGeneMeans(means);
      setGenes(merged);
      setVariants(data.variants);
      setSomaticVariants(data.somaticVariants);
      setSelectedGene(null);
      if (data.controlSamples && data.controlSamples.length > 0) {
        setControlBand(computeControlBand(data.controlSamples));
        setControlCount(data.controlSamples.length);
      } else {
        setControlBand([]);
        setControlCount(0);
      }
      const parts: string[] = [];
      if (data.probes.length > 0)
        parts.push(count(data.probes.length, "probe"));
      if (data.segments.length > 0)
        parts.push(count(data.segments.length, "segment"));
      if (data.variants.length > 0)
        parts.push(count(data.variants.length, "SNP"));
      const nHidden = data.somaticVariants.filter((v) => v.hiddenByDefault).length;
      const nShown = data.somaticVariants.length - nHidden;
      if (data.somaticVariants.length > 0)
        parts.push(count(nShown, "variant") + (nHidden ? ` (${nHidden.toLocaleString()} hidden)` : ""));
      const nSkipped = Object.values(data.skipped ?? {}).reduce((a, b) => a + b, 0);
      setLoadingSummary(`Loaded ${parts.join(", ")}` +
        (nSkipped ? ` (${nSkipped.toLocaleString()} row${nSkipped === 1 ? "" : "s"} skipped: unreadable values)` : ""));
    },
    []
  );

  // Report files open straight to their embedded case
  useEffect(() => {
    if (!EMBEDDED.case) return;
    loadEmbeddedCase(EMBEDDED.case).then(
      ({ loaded, info }) => { setReport(info); handleFilesLoaded(loaded); },
      (e) => setReportError(e instanceof Error ? e.message : String(e)),
    );
  }, [handleFilesLoaded]);

  const handleControlFiles = useCallback((samples: Segment[][]) => {
    setControlBand(computeControlBand(samples));
    setControlCount(samples.length);
  }, []);

  const handleGeneSelect = useCallback((gene: Gene) => {
    setSelectedGene(gene);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedGene(null);
  }, []);

  const resetCase = () => {
    setCaseId(null);
    setSegments([]);
    setProbes([]);
    setGeneMeans([]);
    setGenes([]);
    setLoadingSummary(null);
    setSelectedGene(null);
    setVariants([]);
    setSomaticVariants([]);
    setControlBand([]);
    setControlCount(0);
  };

  return (
    <div className="app">
      <div className="header">
        <h1>CNViz</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {DEMO_ONLY && (
            <button className="btn btn-light" onClick={() => setPage("labs")}>
              For labs
            </button>
          )}
          <button className="btn btn-light" onClick={() => setPage("about")}>
            About
          </button>
        </div>
      </div>

      {report && (
        <div className="report-banner">
          Report: <strong>{report.name}</strong> · generated {report.generated} · CNViz {report.version}
        </div>
      )}
      {reportError && <p className="upload-error">Could not open this report: {reportError}</p>}

      {page === "about" ? (
        <AboutPage onBack={() => setPage("app")} />
      ) : page === "labs" ? (
        <ForLabsPage onBack={() => setPage("app")} />
      ) : !caseId ? (
        EMBEDDED.case || EMBEDDED.error ? (reportError ? null : <p className="case-summary">Opening report…</p>) : <FileUpload onFilesLoaded={handleFilesLoaded} />
      ) : (
        <div>
          <div className="case-bar">
            <span className="case-id">Case: {caseId}</span>
            <span className="build-badge">{build}</span>
            {loadingSummary && (
              <span className="case-summary">
                {loadingSummary}
              </span>
            )}
            <div className="case-actions">
              <GeneSearch genes={genes} selectedGene={selectedGene} onSelect={handleGeneSelect} />
              {!report && (
                <button className="btn" onClick={resetCase}>
                  {DEMO_ONLY ? "Back" : "Load New Case"}
                </button>
              )}
            </div>
          </div>

          {(segments.length > 0 || probes.length > 0) && (
            <GenomeView
              segments={segments}
              probes={probes}
              geneMeans={geneMeans}
              genes={genes}
              reference={reference}
              variants={variants}
              somaticVariants={somaticVariants}
              selectedGene={selectedGene}
              onGeneSelect={handleGeneSelect}
              onClearSelection={handleClearSelection}
              controlBand={controlBand}
              controlSampleCount={controlCount}
              onControlFiles={handleControlFiles}
              initialChromCount={report?.chromosomes}
              initialPurityPct={report?.purityPct}
              initialGenesText={report?.genesText}
              allowUploads={!DEMO_ONLY && !report}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** "1 probe", "9,103 probes" */
function count(n: number, noun: string): string {
  return `${n.toLocaleString()} ${noun}${n === 1 ? "" : "s"}`;
}

export default App;
