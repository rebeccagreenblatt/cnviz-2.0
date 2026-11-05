# CNViz 2.0

Interactive copy number visualization for molecular pathology. CNViz displays CNVkit output (`.cnr` bins and
`.cns` segments), optionally with B-allele frequencies, somatic variants and run controls, with purity/ploidy
adjustment, gene search and gene-level views.

**Demo:** [cnviz.com](https://cnviz.com) (synthetic data demo case)

## Using CNViz in your lab

CNViz runs inside your institution and works fully offline: no installation, no server, no network connections.
There are two ways to use it, both built from the same single HTML file:

- **Report file (recommended):** your bioinformatics pipeline runs `report/cnviz_report.py` to generate one interactive HTML file per case. Pathologists open the report (with the case data preloaded).
- **Offline viewer:** an interactive html file hosted on a shared drive or internal web server; users load a case's files by hand.

Download the files from the [latest release](https://github.com/rebeccagreenblatt/cnviz-2.0/releases).
To be notified of new releases, click **Watch → Custom → Releases** at the top of this page.

## Making a report file

Requires Python 3.8 or later (nothing else to install).

1. Download `cnviz-2.0.0.html` and `cnviz_report.py` from the latest release, and verify the HTML file
   (see [Verifying a release](#verifying-a-release)).
2. Run the script once per case. A full example:

   ```bash
   python3 cnviz_report.py \
     --template      cnviz-2.0.0.html \
     --expect-sha256 <the 64-character checksum shown on the release page> \
     --build         hg38 \
     --cnr           S1.cnr \
     --cns           S1.cns \
     --baf           S1_baf.maf \
     --variants      S1_somatic.maf \
     --controls      ctrl1.cns ctrl2.cns ctrl3.cns \
     --genes         cnv_reportable_genes.csv \
     --purity        60 \
     --ploidy        2 \
     --name          S1 \
     -o              S1_cnviz.html
   ```

   - **Required:** `--template`, `--build` (hg19 or hg38), `-o`, and at least one of `--cnr` / `--cns`.
   - **Strongly recommended:** `--expect-sha256`. The script refuses a template that doesn't match it.
   - **Optional:** everything else. `--baf` takes one `.vcf`, `.baf` or `.maf`; `--controls` takes any number of
     `.cns` files; `--genes` is the genes your lab reports CNVs for (often a subset of the panel), highlighted in
     every report; `--purity` defaults to 100 and `--ploidy` to 2; `--name` defaults to the file name.
     Any input can be gzipped.

   `python3 cnviz_report.py --help` lists every option. Input formats are [below](#input-files). A report contains
   the case's data, so store it wherever your lab keeps case results.
3. Open the report file (`S1_cnviz.html`) by double-clicking it.

## Offline viewer

1. Download `cnviz-2.0.0.html` from the latest release and verify it
   (see [Verifying a release](#verifying-a-release)).
2. Put the file on a shared drive, read-only for users, or an internal web server (for example, if your browsers
   block opening HTML files from network drives).
3. Users open it in Chrome, Edge or Firefox and load a case's files.

## Input files

CNViz reads CNVkit's `.cnr` (bins) and `.cns` (segments) format. Using a different CNV caller? Convert its output to
these columns, and CNViz will display it the same way.

| File | Required columns | Optional columns used |
|---|---|---|
| `.cnr` | chromosome, start, end, log2 | gene (CNVkit's labels, including "Antitarget"), depth, weight |
| `.cns` | chromosome, start, end, log2 | |
| BAF `.vcf` | Standard VCF with AF or AD in the sample column (first sample column used; PASS or unfiltered only) | |
| BAF `.maf` | Chromosome, Start_Position, t_alt_count, t_ref_count | |
| BAF `.baf` | chromosome, start, end, baf (DRAGEN style) | |
| Variants `.maf` | Hugo_Symbol, Chromosome, Start_Position | Reference_Allele, Tumor_Seq_Allele2, HGVSc, HGVSp_Short, Variant_Classification, a significance column (e.g. CLIN_SIG), t_alt_count, t_ref_count, t_depth |

- **File shape:** tab-separated text with one header row of column names. Extra columns are ignored.
- **log2:** the log2 ratio of the sample's coverage to a diploid reference (0 = two copies), as CNVkit reports it.
- **Coordinates:** CNVkit's convention (BED-style: 0-based start, end not included), matching the build you choose
  (hg19 or hg38).
- **Chromosomes** can be named `chr7` or `7`.
- Gene positions come from CNViz's bundled UCSC reference, not from your files.

## Verifying a release

Before installing a release, check that it's genuine:

- **Checksum:** `shasum -a 256 cnviz-2.0.0.html` must match the checksum on the release page.
- **Built by GitHub from this source:** `gh attestation verify cnviz-2.0.0.html --repo rebeccagreenblatt/cnviz-2.0`
  confirms GitHub's automated build produced this exact file from the published code.

You can also build it from source yourself: see [BUILDING.md](BUILDING.md).

## Security

CNViz makes no network connections and stores no data. [SECURITY.md](SECURITY.md) explains what it protects against,
what it doesn't, and how to report a problem.

## Citing CNViz

CNViz was first published as an R/Shiny application (Bioconductor package):

> Ramesh, Rebecca G., Ashkan Bigdeli, Chase Rushton, and Jason N. Rosenbaum. "CNViz: An R/Shiny application for
> interactive copy number variant visualization in cancer." *Journal of Pathology Informatics* 13 (2022): 100089.
> https://doi.org/10.1016/j.jpi.2022.100089

## License and contact

MIT license · Rebecca G. Ramesh · Questions: cnviz.help@gmail.com

CNViz is a visualization aid, not a validated clinical test. 
