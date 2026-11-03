import { useRef, useState } from "react";
import { DEMO_ONLY } from "../buildMode";
import { fileKind, parseCnr, parseCns, parseBafFile, parseMaf, parseSomaticMaf } from "../parsers";
import type { Build, LoadedCase, Probe, Segment, SkippedRows, SomaticVariant, VcfVariant } from "../types";
import demoCnr from "../../public/demo/demo_gbm.cnr?raw";
import demoCns from "../../public/demo/demo_gbm.cns?raw";
import demoBaf from "../../public/demo/demo_gbm_baf.maf?raw";
import demoVariants from "../../public/demo/demo_gbm_variants.maf?raw";
import demoControl1 from "../../public/demo/demo_control_1.cns?raw";
import demoControl2 from "../../public/demo/demo_control_2.cns?raw";
import demoControl3 from "../../public/demo/demo_control_3.cns?raw";
import demoControl4 from "../../public/demo/demo_control_4.cns?raw";
import demoControl5 from "../../public/demo/demo_control_5.cns?raw";

interface FileUploadProps {
  onFilesLoaded: (data: LoadedCase) => void;
}



export default function FileUpload({ onFilesLoaded }: FileUploadProps) {
  const multiRef = useRef<HTMLInputElement>(null);
  const cnrOverrideRef = useRef<HTMLInputElement>(null);
  const cnsOverrideRef = useRef<HTMLInputElement>(null);
  const bafOverrideRef = useRef<HTMLInputElement>(null);
  const somaticOverrideRef = useRef<HTMLInputElement>(null);
  const [build, setBuild] = useState<Build>("hg38");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cnrFile, setCnrFile] = useState<File | null>(null);
  const [cnsFile, setCnsFile] = useState<File | null>(null);
  const [bafFile, setBafFile] = useState<File | null>(null);
  const [somaticFile, setSomaticFile] = useState<File | null>(null);
  const [mafConflict, setMafConflict] = useState<File[] | null>(null);
  const [variantConflict, setVariantConflict] = useState<File[] | null>(null);

  const hasFiles = cnrFile || cnsFile;

  const handleLoadDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const toFile = (text: string, name: string) => new File([text], name);
      const demoControls = [demoControl1, demoControl2, demoControl3, demoControl4, demoControl5];
      const [probes, segments, variants, somaticVariants, ...controlSamples] = await Promise.all([
        parseCnr(toFile(demoCnr, "demo_gbm.cnr")),
        parseCns(toFile(demoCns, "demo_gbm.cns")),
        parseMaf(toFile(demoBaf, "demo_gbm_baf.maf")),
        parseSomaticMaf(toFile(demoVariants, "demo_gbm_variants.maf")),
        ...demoControls.map((c, i) => parseCns(toFile(c, `demo_control_${i + 1}.cns`))),
      ]);
      onFilesLoaded({ caseId: "Demo — GBM", build: "hg38", probes, segments, variants, somaticVariants, controlSamples });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleMultiSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const cnr = files.find((f) => fileKind(f.name) === "cnr");
    const cns = files.find((f) => fileKind(f.name) === "cns");

    if (!cnr && !cns) {
      setError("No .cnr or .cns file found in selection.");
      return;
    }

    setError(null);
    if (cnr) setCnrFile(cnr);
    if (cns) setCnsFile(cns);

    const vcf = files.find((f) => fileKind(f.name) === "vcf");
    const bafOnly = files.find((f) => fileKind(f.name) === "baf");
    const mafs = files.filter((f) => fileKind(f.name) === "maf");

    if (vcf || bafOnly) {
      // Unambiguous BAF file — assign it, then handle remaining .maf files
      setBafFile((vcf || bafOnly)!);
      if (mafs.length === 1) {
        setSomaticFile(mafs[0]);
      } else if (mafs.length >= 2) {
        setVariantConflict(mafs);
      }
    } else if (mafs.length === 1) {
      setBafFile(mafs[0]);
    } else if (mafs.length >= 2) {
      // Multiple .maf files, no .vcf/.baf — ask which is BAF
      setMafConflict(mafs);
    }
  };

  const resolveMafConflict = (bafIdx: number) => {
    if (!mafConflict) return;
    setBafFile(mafConflict[bafIdx]);
    const remainingMafs = mafConflict.filter((f, i) => i !== bafIdx && fileKind(f.name) === "maf");
    if (remainingMafs.length === 1) {
      setSomaticFile(remainingMafs[0]);
    } else if (remainingMafs.length >= 2) {
      setVariantConflict(remainingMafs);
    }
    setMafConflict(null);
  };

  const resolveVariantConflict = (idx: number) => {
    if (!variantConflict) return;
    setSomaticFile(variantConflict[idx]);
    setVariantConflict(null);
  };

  const handleLoad = async () => {
    if (!cnrFile && !cnsFile) {
      setError("Please select at least a .cnr or .cns file.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const skipped: SkippedRows = {};
      const [probes, segments, variants, somaticVariants] = await Promise.all([
        cnrFile ? parseCnr(cnrFile, skipped) : Promise.resolve([] as Probe[]),
        cnsFile ? parseCns(cnsFile, skipped) : Promise.resolve([] as Segment[]),
        bafFile ? parseBafFile(bafFile) : Promise.resolve([] as VcfVariant[]),
        somaticFile ? parseSomaticMaf(somaticFile) : Promise.resolve([] as SomaticVariant[]),
      ]);

      const caseId = (cnrFile?.name.replace(/\.cnr$/i, "") ??
        cnsFile?.name.replace(/\.cns$/i, ""))!;
      onFilesLoaded({ caseId, build, probes, segments, variants, somaticVariants, skipped });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse files");
    } finally {
      setLoading(false);
    }
  };

  const fileRow = (
    label: string,
    file: File | null,
    accept: string,
    ref: React.RefObject<HTMLInputElement | null>,
    onSet: (f: File) => void,
    onClear: () => void,
  ) => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", minWidth: 0 }}>
      <span style={{ width: "7rem", fontSize: "0.8rem", color: "#555", flexShrink: 0 }}>{label}</span>
      {file ? (
        <>
          <span style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{file.name}</span>
          <button
            className="btn"
            style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", flexShrink: 0 }}
            onClick={() => ref.current?.click()}
          >
            change
          </button>
          <button
            className="btn"
            style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", color: "#999", flexShrink: 0 }}
            onClick={onClear}
          >
            remove
          </button>
        </>
      ) : (
        <>
          <span style={{ fontSize: "0.8rem", color: "#999" }}>none</span>
          <button
            className="btn"
            style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}
            onClick={() => ref.current?.click()}
          >
            add
          </button>
        </>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSet(f);
        }}
      />
    </div>
  );

  if (DEMO_ONLY) {
    return (
      <div className="upload-card">
        <h2>CNViz demo</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", margin: "0.5rem 0 1rem" }}>
          This site shows a demo case only. To view your own data, use the offline version or a CNViz report, run inside your institution.
        </p>
        <button className="btn btn-primary" onClick={handleLoadDemo} disabled={loading} style={{ cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Loading..." : "Try the demo case (GBM)"}
        </button>
        {error && <p className="upload-error">{error}</p>}
      </div>
    );
  }

  return (
    <>
    <div className="upload-card">
      <h2>Load Case</h2>
      <div className="upload-field">
        <label>Reference build</label>
        <select
          value={build}
          onChange={(e) => setBuild(e.target.value as Build)}
        >
          <option value="hg38">hg38 (GRCh38)</option>
          <option value="hg19">hg19 (GRCh37)</option>
        </select>
      </div>

      <div className="upload-field">
        <label>Select files</label>
        <p style={{ fontSize: "0.85rem", color: "#555", margin: "0.25rem 0" }}>Select a .cnr and .cns file. You can also select an allele frequency file (.vcf, .baf, or .maf) to display a BAF plot and a variant file (.maf) to display variants (both optional).</p>
        <p style={{ fontSize: "0.8rem", color: "#999", margin: "0.25rem 0" }}>Cmd/Ctrl+click to select multiple</p>
        <input
          ref={multiRef}
          type="file"
          multiple
          accept=".cnr,.cns,.vcf,.baf,.maf,.gz"
          onChange={handleMultiSelect}
        />
      </div>

      {mafConflict && (
        <div style={{ margin: "0.75rem 0", padding: "0.75rem", background: "#fff8e1", borderRadius: "6px", border: "1px solid #ffe082" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            Multiple allele frequency-eligible files detected — which has the allele counts?
          </div>
          {mafConflict.map((f, i) => (
            <button
              key={i}
              className="btn"
              style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", marginRight: "0.5rem", marginBottom: "0.25rem" }}
              onClick={() => resolveMafConflict(i)}
            >
              {f.name}
            </button>
          ))}
          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.25rem" }}>
            Any remaining .maf file will be used for somatic variants.
          </div>
        </div>
      )}

      {variantConflict && (
        <div style={{ margin: "0.75rem 0", padding: "0.75rem", background: "#fff8e1", borderRadius: "6px", border: "1px solid #ffe082" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            Multiple .maf files remaining — which is the somatic variants file?
          </div>
          {variantConflict.map((f, i) => (
            <button
              key={i}
              className="btn"
              style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", marginRight: "0.5rem", marginBottom: "0.25rem" }}
              onClick={() => resolveVariantConflict(i)}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {hasFiles && !mafConflict && !variantConflict && (
        <div style={{ margin: "0.75rem 0", padding: "0.5rem 0.75rem", background: "#f8f8f8", borderRadius: "6px" }}>
          {fileRow("Probes (.cnr)", cnrFile, ".cnr", cnrOverrideRef, setCnrFile, () => setCnrFile(null))}
          {fileRow("Segments (.cns)", cnsFile, ".cns", cnsOverrideRef, setCnsFile, () => setCnsFile(null))}
          {fileRow("Allele freq.", bafFile, ".vcf,.baf,.maf,.gz", bafOverrideRef, setBafFile, () => setBafFile(null))}
          {fileRow("Variants (.maf)", somaticFile, ".maf,.gz", somaticOverrideRef, setSomaticFile, () => setSomaticFile(null))}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleLoad}
        disabled={loading || !hasFiles || !!mafConflict || !!variantConflict}
        style={{ cursor: loading ? "wait" : "pointer" }}
      >
        {loading ? "Parsing..." : "Load Case"}
      </button>
      {error && <p className="upload-error">{error}</p>}
    </div>
    <p style={{ textAlign: "center", fontSize: "0.85rem", color: "#777", marginTop: "1rem" }}>
      No data handy?{" "}
      <span
        style={{ color: "#0072B2", cursor: "pointer", textDecoration: "underline" }}
        onClick={handleLoadDemo}
      >
        Try a demo case (GBM)
      </span>
    </p>
    </>
  );
}
