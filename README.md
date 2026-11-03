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

Download both from the [latest release](https://github.com/rebeccagreenblatt/cnviz-2.0/releases). Setup
instructions, input formats and an example command are on the **For labs** page of [cnviz.com](https://cnviz.com).

To be notified of new releases, click **Watch → Custom → Releases** at the top of this page.

## Making a report file

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

   `python3 cnviz_report.py --help` lists every option; the For labs page on cnviz.com describes the input formats.
3. Open the report file (`S1_cnviz.html`) by double-clicking it. 

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
