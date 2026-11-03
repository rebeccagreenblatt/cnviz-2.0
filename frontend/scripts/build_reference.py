#!/usr/bin/env python3
"""Regenerate CNViz's reference genome data (src/data/hg19.json and hg38.json) from UCSC.

For each build this downloads three UCSC tables from https://hgdownload.soe.ucsc.edu/goldenPath/<build>/database/:
  - chromInfo           chromosome sizes
  - cytoBandIdeo        cytobands (for the ideogram and band names in hovers)
  - ncbiRefSeqCurated   NCBI RefSeq Curated transcripts, used for gene coordinates

Only chr1-22, chrX and chrY are kept. Each gene's coordinates span all of its RefSeq Curated transcripts
(the smallest start to the largest end) on the chromosome where it has the most transcripts; ties go to the
first chromosome in chr1...chrY order. Coordinates are UCSC's: 0-based start, end exclusive.

The output is compact JSON, genes sorted by name, chromosome sizes in chromInfo order. Re-running against
unchanged UCSC tables reproduces the bundled files byte for byte.

This is a maintainer tool, not part of the app: the app never downloads anything. Python 3.8+, standard library.

Usage:
    python3 scripts/build_reference.py                    # download, write src/data/hg19.json and hg38.json
    python3 scripts/build_reference.py --check            # download, report whether the bundled files match
    python3 scripts/build_reference.py --tables-dir DIR   # use already downloaded <build>_<table>.txt.gz files
"""
import argparse
import collections
import gzip
import io
import json
import os
import sys
import urllib.request

BUILDS = ["hg19", "hg38"]
TABLES = ["chromInfo", "cytoBandIdeo", "ncbiRefSeqCurated"]
CANONICAL = [f"chr{i}" for i in range(1, 23)] + ["chrX", "chrY"]
UCSC = "https://hgdownload.soe.ucsc.edu/goldenPath/{build}/database/{table}.txt.gz"


def read_table(build, table, tables_dir):
    """Rows (lists of fields) of a UCSC table, from tables_dir if given, otherwise downloaded."""
    if tables_dir:
        with open(os.path.join(tables_dir, f"{build}_{table}.txt.gz"), "rb") as f:
            raw = f.read()
    else:
        url = UCSC.format(build=build, table=table)
        print(f"  downloading {url}", file=sys.stderr)
        with urllib.request.urlopen(url, timeout=120) as r:
            raw = r.read()
    with gzip.open(io.BytesIO(raw), "rt") as f:
        return [line.rstrip("\n").split("\t") for line in f if line.strip()]


def build_reference(build, tables_dir=None):
    chrom_info = read_table(build, "chromInfo", tables_dir)            # chrom, size, fileName
    cytobands = read_table(build, "cytoBandIdeo", tables_dir)          # chrom, start, end, name, gieStain
    transcripts = read_table(build, "ncbiRefSeqCurated", tables_dir)   # genePred: [2]=chrom [4]=txStart [5]=txEnd [12]=name2

    chromosome_sizes = {row[0]: int(row[1]) for row in chrom_info if row[0] in CANONICAL}

    bands = [{"chromosome": r[0], "start": int(r[1]), "end": int(r[2]), "name": r[3], "stain": r[4]}
             for r in cytobands if r[0] in CANONICAL]

    by_gene = collections.defaultdict(list)
    for r in transcripts:
        if r[2] in CANONICAL:
            by_gene[r[12]].append((r[2], int(r[4]), int(r[5])))
    genes = []
    for gene in sorted(by_gene):
        spans = by_gene[gene]
        counts = collections.Counter(chrom for chrom, _, _ in spans)
        chrom = min(counts, key=lambda c: (-counts[c], CANONICAL.index(c)))
        on_chrom = [s for s in spans if s[0] == chrom]
        genes.append({"gene": gene, "chromosome": chrom,
                      "start": min(s[1] for s in on_chrom), "end": max(s[2] for s in on_chrom)})

    return {"chromosome_sizes": chromosome_sizes, "cytobands": bands, "genes": genes}


def main():
    p = argparse.ArgumentParser(description="Regenerate CNViz reference data from UCSC.")
    p.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "..", "src", "data"))
    p.add_argument("--tables-dir", help="use <build>_<table>.txt.gz files from this folder instead of downloading")
    p.add_argument("--check", action="store_true", help="compare with the bundled files instead of writing")
    a = p.parse_args()

    differs = False
    for build in BUILDS:
        print(f"{build}:", file=sys.stderr)
        text = json.dumps(build_reference(build, a.tables_dir), separators=(",", ":"))
        path = os.path.join(a.out_dir, f"{build}.json")
        if a.check:
            with open(path, encoding="utf-8") as f:
                same = f.read() == text
            differs |= not same
            print(f"  {path}: {'identical' if same else 'DIFFERS from current UCSC tables'}", file=sys.stderr)
        else:
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"  wrote {path}", file=sys.stderr)
    sys.exit(1 if differs else 0)


if __name__ == "__main__":
    main()
