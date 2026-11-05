import { parseCnr, parseCns, parseMaf, parseSomaticMaf } from "./parsers";
import type { LoadedCase } from "./types";
import demoCnr from "../public/demo/demo_gbm.cnr?raw";
import demoCns from "../public/demo/demo_gbm.cns?raw";
import demoBaf from "../public/demo/demo_gbm_baf.maf?raw";
import demoVariants from "../public/demo/demo_gbm_variants.maf?raw";
import demoControl1 from "../public/demo/demo_control_1.cns?raw";
import demoControl2 from "../public/demo/demo_control_2.cns?raw";
import demoControl3 from "../public/demo/demo_control_3.cns?raw";
import demoControl4 from "../public/demo/demo_control_4.cns?raw";
import demoControl5 from "../public/demo/demo_control_5.cns?raw";

/** The synthetic demo case (see scripts/generate_demo_data.py), parsed like uploaded files. */
export async function loadDemoCase(): Promise<LoadedCase> {
  const toFile = (text: string, name: string) => new File([text], name);
  const demoControls = [demoControl1, demoControl2, demoControl3, demoControl4, demoControl5];
  const [probes, segments, variants, somaticVariants, ...controlSamples] = await Promise.all([
    parseCnr(toFile(demoCnr, "demo_gbm.cnr")),
    parseCns(toFile(demoCns, "demo_gbm.cns")),
    parseMaf(toFile(demoBaf, "demo_gbm_baf.maf")),
    parseSomaticMaf(toFile(demoVariants, "demo_gbm_variants.maf")),
    ...demoControls.map((c, i) => parseCns(toFile(c, `demo_control_${i + 1}.cns`))),
  ]);
  return { caseId: "Demo — GBM", build: "hg38", probes, segments, variants, somaticVariants, controlSamples };
}
