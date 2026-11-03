import { parseBafFile, parseCnr, parseCns, parseSomaticMaf } from "./parsers";
import type { Build, LoadedCase, Probe, Segment, SkippedRows, SomaticVariant, VcfVariant } from "./types";

/**
 * CNViz report files: report/cnviz_report.py copies the offline build and embeds one case as a
 * <script type="application/json" id="cnviz-case"> data block (never executed, so the page's
 * hash-locked Content-Security-Policy still allows only the reviewed app code to run).
 * The embedded files go through the same parsers as uploaded files.
 */
interface EmbeddedFile { name: string; text: string }
interface EmbeddedCase {
  format: "cnviz-case/1";
  name: string;
  build: Build;
  generated: string; // date the report was written
  cnviz_version: string; // version of the template the report was built from
  purity_pct: number;
  chromosomes: number; // ploidy × 23, as the Chromosomes control uses
  files: { cnr?: EmbeddedFile; cns?: EmbeddedFile; baf?: EmbeddedFile; variants?: EmbeddedFile; controls?: EmbeddedFile[]; genes?: EmbeddedFile };
}

export interface ReportInfo { name: string; generated: string; version: string; purityPct: number; chromosomes: number; genesText: string }

/** The embedded case, if this page is a report; null for the plain app. */
export function readEmbeddedCase(): EmbeddedCase | null {
  const el = document.getElementById("cnviz-case");
  if (!el?.textContent) return null;
  const data = JSON.parse(el.textContent) as EmbeddedCase;
  if (data.format !== "cnviz-case/1") throw new Error(`Unsupported report format: ${String(data.format)}`);
  return data;
}

export async function loadEmbeddedCase(c: EmbeddedCase): Promise<{ loaded: LoadedCase; info: ReportInfo }> {
  const toFile = (f: EmbeddedFile) => new File([f.text], f.name);
  const { cnr, cns, baf, variants, controls = [] } = c.files;
  const skipped: SkippedRows = {};
  const [probes, segments, vcfVariants, somaticVariants, ...controlSamples] = await Promise.all([
    cnr ? parseCnr(toFile(cnr), skipped) : Promise.resolve([] as Probe[]),
    cns ? parseCns(toFile(cns), skipped) : Promise.resolve([] as Segment[]),
    baf ? parseBafFile(toFile(baf)) : Promise.resolve([] as VcfVariant[]),
    variants ? parseSomaticMaf(toFile(variants)) : Promise.resolve([] as SomaticVariant[]),
    ...controls.map((f) => parseCns(toFile(f))),
  ]);
  return {
    loaded: { caseId: c.name, build: c.build, probes, segments, variants: vcfVariants, somaticVariants, controlSamples, skipped },
    info: { name: c.name, generated: c.generated, version: c.cnviz_version, purityPct: c.purity_pct, chromosomes: c.chromosomes, genesText: c.files.genes?.text ?? "" },
  };
}
