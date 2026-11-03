# Security

## Reporting a problem

Please report security problems privately rather than in a public GitHub issue. Use GitHub's
**Report a vulnerability** button (Security tab of this repository) or email cnviz.help@gmail.com.

## Where data goes

Nowhere. CNViz is a static web page with no backend.

- Files are read and processed in the browser. Nothing is uploaded, and nothing is stored: no cookies,
  localStorage, IndexedDB or service worker cache. Closing the page discards the case.
- The page's Content-Security-Policy blocks network connections (`connect-src 'none'`): the browser refuses fetch,
  XHR and WebSocket requests from the page, whether from CNViz's code or its libraries. (See Known limits for
  what a policy cannot block.)
- Everything CNViz needs, including its libraries (React and Plotly.js), is built into CNViz itself. No analytics,
  fonts, scripts or images are loaded from other websites.
- Clicking a variant position copies the locus to the clipboard (for IGV); CNViz never contacts IGV or any
  other local service.

**Report files** contain the case's data (the input files, embedded as non-executable JSON). Store them like any
case result.

## What runs

| | cnviz.com (demo) | Offline file / report files |
|---|---|---|
| Uploads | None (demo case only) | Files chosen by the user, or embedded by the pipeline |
| Script policy | `script-src 'self' 'unsafe-eval'` | `script-src 'sha256-…' 'unsafe-eval'`: only the one released script, by hash |
| Other policy | `default-src 'self'`, `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'` | `default-src 'none'`, `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'` |
| Updates | Redeployed from this repository | Never; a new version is a new file your team installs |

## Trusting a release

- **Pinned dependencies:** `package-lock.json` fixes every dependency version, and builds install with
  `npm ci --ignore-scripts`, so no dependency code runs at install time.
- **Tests first:** the release job runs the app and report-script tests before building.
- **Pinned build steps:** the GitHub Actions it uses are pinned to exact commits. The build job is read-only;
  only the publish step can write.
- **Checksum and provenance:** each release lists the file's SHA-256, and GitHub signs a build-provenance record.
  `gh attestation verify cnviz-<version>.html --repo rebeccagreenblatt/cnviz-2.0` confirms the file was built by
  GitHub from this repository's source, not uploaded by hand.
- **Reproducible:** building from source gives an identical file, with the same checksum (see [BUILDING.md](BUILDING.md)).
- **Report script:** `cnviz_report.py --expect-sha256 <checksum>` refuses to use a template that doesn't match.
  Pin the checksum from the release page in your pipeline configuration. A `.sha256` file stored next to the
  template only detects corruption, since anyone able to replace the template could replace it too.

## Known limits

- **A modified copy of CNViz** could disable all of the above. The protection is verifying what you install
  (checksum, provenance, or your own build) and controlling who can replace it, for example with a read-only share.
- **`'unsafe-eval'`** is required: Plotly's WebGL plots compile functions at runtime. Only the released script
  can run, and CNViz's own code never evaluates input data as code.
- **Policy set in the page:** for files opened from disk there are no server headers, so the policy is a `<meta>`
  tag. That can't set `frame-ancestors` (framing protection). Labs serving the file from a web server can add the
  same policy, plus `frame-ancestors 'none'`, as headers.
- **Navigation:** a Content-Security-Policy can't stop code from navigating the page to another address. CNViz's
  code never does, but this is another reason to verify the release.
- **Browser extensions** can read any page. Use a managed browser profile without third-party extensions.
- **Text from input files** (gene names, alleles, MAF fields) is shown as plain text; React escapes table text, and
  hover text is escaped before it reaches Plotly.

## Dependencies

The shipped code (React, Plotly.js) has no known vulnerabilities (`npm audit --omit=dev`). Development-only tools
(ESLint, the Vite React plugin, Vitest) have advisories at times. They run on developer machines and in the build,
and never ship in CNViz or handle case data.
