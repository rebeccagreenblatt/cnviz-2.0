import { describe, expect, it } from "vitest";
import { fileKind, normalizeChromosome, parseBafFile, parseCnr, parseCns, parseSomaticMaf, parseVcf } from "./parsers";
import type { SkippedRows } from "./types";

const file = (name: string, text: string) => new File([text], name);
const gzFile = async (name: string, text: string) =>
  new File([await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).blob()], name);

const CNR_HEADER = "chromosome\tstart\tend\tgene\tlog2\tdepth\tweight\n";
const CNS_HEADER = "chromosome\tstart\tend\tgene\tlog2\tdepth\tprobes\tweight\n";
const VCF_HEADER = "##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tTUMOR\n";
const MAF_HEADER = "Hugo_Symbol\tChromosome\tStart_Position\tReference_Allele\tTumor_Seq_Allele2\tVariant_Classification\tCLIN_SIG\tt_alt_count\tt_ref_count\tt_depth\n";

describe("chromosome names", () => {
  it("accepts UCSC, GRCh37/b37 and numeric sex-chromosome styles", () => {
    expect(normalizeChromosome("chr7")).toBe("chr7");
    expect(normalizeChromosome("7")).toBe("chr7");
    expect(normalizeChromosome("X")).toBe("chrX");
    expect(normalizeChromosome("chrx")).toBe("chrX");
    expect(normalizeChromosome("23")).toBe("chrX");
    expect(normalizeChromosome("24")).toBe("chrY");
    expect(normalizeChromosome(" 12 ")).toBe("chr12");
  });

  it("loads a GRCh37-style .cnr the same as a chr-prefixed one", async () => {
    const b37 = await parseCnr(file("s.cnr", CNR_HEADER + "7\t100\t200\tEGFR\t1.5\t300\t0.9\nX\t100\t200\t-\t0.1\t300\t0.9\n"));
    expect(b37.map((p) => p.chromosome)).toEqual(["chr7", "chrX"]);
  });

  it("errors when no row is on chr1-22, X or Y", async () => {
    await expect(parseCns(file("bad.cns", CNS_HEADER + "scaffold_1\t1\t100\t-\t0.1\t30\t5\t1\n")))
      .rejects.toThrow(/no rows on chromosomes 1–22, X or Y.*scaffold_1/);
  });
});

describe(".cnr / .cns rows", () => {
  it("skips rows with unreadable numbers and counts them", async () => {
    const skipped: SkippedRows = {};
    const probes = await parseCnr(file("s.cnr", CNR_HEADER +
      "chr1\t100\t200\tA\t0.1\t300\t0.9\nchr1\t300\t400\tA\tnan\t300\t0.9\nchr1\t500\t600\tA\t\t300\t0.9\n"), skipped);
    expect(probes).toHaveLength(1);
    expect(skipped).toEqual({ "s.cnr": 2 });
  });

  it("errors on a header-only file and on a file with no usable rows", async () => {
    await expect(parseCns(file("empty.cns", CNS_HEADER))).rejects.toThrow(/no data rows/);
    await expect(parseCns(file("bad.cns", CNS_HEADER + "chr1\t1\t100\t-\tnan\t30\t5\t1\n"))).rejects.toThrow(/no usable rows/);
  });

  it("reads depth as missing (not 0) when the column is absent, and weight as 1", async () => {
    const [p] = await parseCnr(file("s.cnr", "chromosome\tstart\tend\tgene\tlog2\nchr1\t100\t200\tA\t0.1\n"));
    expect(p.depth).toBeNull();
    expect(p.weight).toBe(1);
  });

  it("keeps depth 0 (no coverage) as 0", async () => {
    const [p] = await parseCnr(file("s.cnr", CNR_HEADER + "chr1\t100\t200\tA\t-20\t0\t0.01\n"));
    expect(p.depth).toBe(0);
    expect(p.log2).toBe(-20);
  });
});

describe("VCF allele frequencies", () => {
  const vcf = VCF_HEADER +
    "chr1\t1000\t.\tA\tG\t.\tPASS\t.\tGT:AF:AD\t0/1:0.42:30,20\n" + // AF used
    "chr2\t1000\t.\tA\tG\t.\tPASS\t.\tGT:AF:AD\t0/1:.:30,20\n" +    // AF blank → read counts
    "chr3\t1000\t.\tA\tG\t.\tPASS\t.\tGT:AD\t0/1:10,30\n" +         // read counts only
    "chr4\t1000\t.\tA\tG\t.\tPASS\t.\tGT:AF:AD\t0/1:.:.\n" +        // nothing usable → dropped
    "chr5\t1000\t.\tA\tG\t.\tLowQual\t.\tGT:AF\t0/1:0.5\n";         // filtered → dropped

  it("uses AF, falls back to AD when AF is blank, drops variants with neither", async () => {
    const v = await parseVcf(file("s.vcf", vcf));
    expect(v.map((x) => [x.chromosome, +x.baf.toFixed(2)])).toEqual([["chr1", 0.42], ["chr2", 0.4], ["chr3", 0.75]]);
  });

  it("reads gzipped VCFs, with case-insensitive extensions", async () => {
    const v = await parseBafFile(await gzFile("S1.VCF.GZ", vcf));
    expect(v).toHaveLength(3);
  });
});

describe("file types", () => {
  it("ignores case and a trailing .gz", () => {
    expect(fileKind("S1.CNR")).toBe("cnr");
    expect(fileKind("s1.vcf.gz")).toBe("vcf");
    expect(fileKind("calls.MAF")).toBe("maf");
    expect(fileKind("notes.txt")).toBeNull();
  });
});

describe("somatic MAF", () => {
  const maf = MAF_HEADER +
    "KRAS\tchr12\t25245350\tC\tT\tMissense_Mutation\t\t20\t\t400\n" +      // no t_ref_count → t_depth
    "BRAF\tchr7\t140753336\tA\tT\tMissense_Mutation\t\t20\t380\t\n" +      // ref + alt
    "TP53\tchr17\t7674220\tC\tT\tMissense_Mutation\tpathogenic\t.\t.\t.\n" + // no counts
    "PTEN\tchr10\t87933147\tC\tT\tIntron\t\t10\t90\t\n" +                   // hidden by default
    "TERT\tchr5\t1295228\tG\tA\tIntron\tpathogenic\t20\t80\t\n" +           // pathogenic → shown
    "EGFR\tchr7\t55191822\tT\tG\tMissense_Mutation\tbenign\t50\t50\t\n";    // benign → hidden

  it("calculates VAF from t_depth when the ref count is missing, and never invents counts", async () => {
    const byGene = Object.fromEntries((await parseSomaticMaf(file("v.maf", maf))).map((v) => [v.gene, v]));
    expect(byGene.KRAS.vaf).toBeCloseTo(0.05);
    expect(byGene.KRAS.depth).toBe(400);
    expect(byGene.BRAF.vaf).toBeCloseTo(0.05);
    expect(byGene.BRAF.depth).toBe(400);
    expect(byGene.TP53.vaf).toBeNull();
    expect(byGene.TP53.depth).toBeNull();
  });

  it("keeps every variant, flagging intronic/silent/benign (unless pathogenic) as hidden by default", async () => {
    const variants = await parseSomaticMaf(file("v.maf", maf));
    expect(variants).toHaveLength(6);
    expect(variants.filter((v) => v.hiddenByDefault).map((v) => v.gene).sort()).toEqual(["EGFR", "PTEN"]);
  });
});
