#!/usr/bin/env python3
"""Write a CNViz report: one self-contained HTML file that opens straight to a case.

The report is a copy of the released offline CNViz file (the "template") with the case's files embedded
as a non-executable JSON data block. The template's own code is not modified, so its Content-Security-Policy
still allows only that reviewed code to run, and the report makes no network connections.

Python 3.8+, standard library only.

Example:
    python3 cnviz_report.py --template cnviz-2.0.0.html --expect-sha256 <checksum from the release page> --build hg38 \\
        --cnr S1.cnr --cns S1.cns --baf S1.vcf --variants S1.maf \\
        --controls run_controls/*.cns --genes cnv_reportable_genes.csv --name S1 -o S1_cnviz.html

A report contains the case's data: store it wherever your lab keeps case results.
"""
import argparse
import datetime
import gzip
import hashlib
import json
import os
import re
import sys

FORMAT = "cnviz-case/1"


def fail(msg):
    sys.exit(f"cnviz_report: {msg}")


def read_text(path):
    """File contents as text; .gz files (e.g. .vcf.gz) are decompressed first."""
    opener = gzip.open if path.lower().endswith(".gz") else open
    with opener(path, "rb") as f:
        raw = f.read()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


def embedded_file(path):
    # Embedded as plain text, so a ".gz" suffix is dropped from the name (the app decides file type by name)
    name = os.path.basename(path)
    if name.lower().endswith(".gz"):
        name = name[:-3]
    return {"name": name, "text": read_text(path)}


def verify_template(path, expected_hex, checksum_path):
    """The template must match the expected SHA-256.

    Best: --expect-sha256 <hex>, copied from the GitHub release page (or the lab's validation record) into the
    pipeline config. A checksum file next to the template only detects corruption: anyone able to replace the
    template could replace that file too. The release's signed provenance (`gh attestation verify`) is the
    proof that a template was built by GitHub from the public source.
    """
    with open(path, "rb") as f:
        data = f.read()
    actual = hashlib.sha256(data).hexdigest()
    if expected_hex:
        expected = expected_hex.strip().lower()
    else:
        if not os.path.exists(checksum_path):
            fail(f"checksum file not found: {checksum_path}\n"
                 "  Pass --expect-sha256 <checksum from the release page> (recommended), or put the release's\n"
                 "  .sha256 file next to the template.")
        words = read_text(checksum_path).split()
        expected = words[0].strip().lower() if words else ""
        print("cnviz_report: checked the template against the checksum file next to it, which only detects\n"
              "  corruption. For tamper protection pass --expect-sha256 <checksum from the release page>.", file=sys.stderr)
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        fail("expected checksum is not a SHA-256 value (64 hexadecimal characters)")
    if actual != expected:
        fail(f"template does not match its checksum; refusing to use it.\n  expected {expected}\n  actual   {actual}")
    html = data.decode("utf-8")
    m = re.search(r"<title>CNViz (\S+) \(offline\)</title>", html)
    if not m:
        fail("template is not a CNViz offline build (title not found)")
    if 'id="cnviz-case"' in html:
        fail("template already contains a case; use the released offline file, not a report")
    return html, m.group(1), actual


def main():
    p = argparse.ArgumentParser(description="Write a CNViz report (HTML) for one case.")
    p.add_argument("--template", required=True, help="released offline CNViz file, e.g. cnviz-2.0.0.html")
    p.add_argument("--expect-sha256", metavar="HEX",
                   help="expected SHA-256 of the template, from the release page (recommended)")
    p.add_argument("--template-sha256", metavar="FILE",
                   help="checksum file for the template, used when --expect-sha256 is not given (default: <template>.sha256)")
    p.add_argument("--build", required=True, choices=["hg19", "hg38"], help="reference genome build")
    p.add_argument("--cnr", help="CNVkit probe-level log2 ratios (.cnr)")
    p.add_argument("--cns", help="CNVkit segments (.cns)")
    p.add_argument("--baf", help="allele frequency file (.vcf, .baf or .maf with ref/alt counts)")
    p.add_argument("--variants", help="somatic variants (.maf)")
    p.add_argument("--controls", nargs="+", default=[], help="run control segment files (.cns)")
    p.add_argument("--genes", help="genes to highlight, e.g. the genes your lab reports CNVs for (.csv or .txt; comma, tab or line separated)")
    p.add_argument("--name", help="case name shown in the report (default: the .cnr/.cns file name)")
    p.add_argument("--purity", type=float, default=100, help="tumor purity, percent (default 100)")
    p.add_argument("--ploidy", type=float, default=2, help="tumor ploidy (default 2)")
    p.add_argument("-o", "--output", required=True, help="report file to write (.html)")
    a = p.parse_args()

    if not a.cnr and not a.cns:
        fail("give at least --cnr or --cns")
    if not 1 <= a.purity <= 100:
        fail("--purity must be between 1 and 100 (percent)")
    if a.ploidy <= 0:
        fail("--ploidy must be greater than 0")
    if os.path.abspath(a.output) == os.path.abspath(a.template):
        fail("--output must not overwrite the template")

    html, version, template_sha = verify_template(a.template, a.expect_sha256, a.template_sha256 or a.template + ".sha256")

    # The app's ploidy control is a chromosome count (ploidy × 23); purity is a whole percent
    chromosomes = max(1, round(a.ploidy * 23))
    purity_pct = round(a.purity)
    if chromosomes != a.ploidy * 23:
        print(f"cnviz_report: ploidy {a.ploidy} shown as {chromosomes} chromosomes (ploidy {chromosomes / 23:.2f})", file=sys.stderr)

    name = a.name or os.path.basename(a.cnr or a.cns).rsplit(".", 1)[0]
    files = {}
    for key in ("cnr", "cns", "baf", "variants", "genes"):
        path = getattr(a, key)
        if path:
            files[key] = embedded_file(path)
    if a.controls:
        files["controls"] = [embedded_file(c) for c in a.controls]

    case = {
        "format": FORMAT,
        "name": name,
        "build": a.build,
        "generated": datetime.date.today().isoformat(),
        "cnviz_version": version,
        "template_sha256": template_sha,
        "purity_pct": purity_pct,
        "chromosomes": chromosomes,
        "files": files,
    }
    # Every <, > and & is written as a JSON \u escape, so no file content can end the data block early or put the
    # HTML parser into a special state (e.g. "<!--<script"). JSON.parse turns the escapes back into the characters.
    payload = (json.dumps(case, ensure_ascii=False, separators=(",", ":"))
               .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026"))
    block = f'<script type="application/json" id="cnviz-case">{payload}</script>\n'

    # The app's code is all in <head>, so the last </body> is the real one
    end = html.rfind("</body>")
    if end < 0:
        fail("template has no </body>")
    out = html[:end] + block + html[end:]
    # Generic tab title: browsers keep titles in history (and may sync them), so the case name is shown only
    # inside the page (banner and case bar), never in the title
    out = re.sub(r"<title>[^<]*</title>", lambda _: "<title>CNViz report</title>", out, count=1)

    with open(a.output, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"wrote {a.output} ({os.path.getsize(a.output) / 1e6:.1f} MB) · case {name} · CNViz {version}")


if __name__ == "__main__":
    main()
