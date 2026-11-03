# Building CNViz from source

This page is for bioinformatics teams who want to build CNViz themselves, for example to confirm a release matches
the published code, and for anyone changing CNViz's code to create a customized version. To simply use CNViz, download the files from the
[latest release](https://github.com/rebeccagreenblatt/cnviz-2.0/releases); no building is needed.

## Building a release from source

Requires Node 22.

```bash
cd frontend
npm ci --ignore-scripts
npm run build:offline
```

This writes `frontend/dist-offline/cnviz-<version>.html` and its `.sha256`. Built from the same release tag, the
file is identical to the release, with the same checksum.

## Developing CNViz

Requires Node 22 (see `frontend/.nvmrc`) and Python 3.8 or later. From `frontend/`, after `npm ci --ignore-scripts`:

| Command | What it does |
|---|---|
| `npm run dev` | Live preview of the demo-only website |
| `npx vite --mode offline` | Live preview of the full version (with uploads) |
| `npm test` | App tests |
| `npm run build` | The cnviz.com website, in `dist/` |
| `npm run build:offline` | The offline file, in `dist-offline/` |

Report script tests, from the repository root: `python3 -m unittest discover report`

## What's where

| Path | What it is |
|---|---|
| `frontend/src/` | The app (React + TypeScript + Plotly.js) |
| `frontend/src/parsers.ts` | Reading `.cnr`, `.cns`, VCF, `.baf` and MAF files |
| `frontend/src/compute.ts`, `purity.ts` | Gene means, the run-control band, purity/ploidy adjustment |
| `frontend/scripts/inline-offline.mjs` | Turns the offline build into one self-contained HTML file |
| `frontend/scripts/build_reference.py` | Regenerates the bundled hg19/hg38 reference data |
| `frontend/scripts/generate_demo_data.py` | Generates the synthetic demo case and controls |
| `report/cnviz_report.py` | Writes a report file for one case |
| `.github/workflows/` | Website deploy and release jobs (tests must pass first) |

## Reference data

Gene coordinates, cytobands and chromosome sizes come from UCSC (NCBI RefSeq Curated genes; each gene spans all of
its transcripts). `python3 frontend/scripts/build_reference.py --check` downloads the UCSC tables and reports whether
the bundled files still match; without `--check` it regenerates them.

## Demo data

The demo case and its run controls (`frontend/public/demo/`) are synthetic: no real sample or patient data is
used. `python3 frontend/scripts/generate_demo_data.py OUT_DIR` regenerates them; the output is identical to the
published files.
