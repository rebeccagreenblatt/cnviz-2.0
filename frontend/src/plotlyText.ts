// Plotly hover/label text understands a little HTML (<b>, <br>, <span style>, <a href>). Values that come from
// input files (gene names in a .cnr, alleles in a VCF/MAF) are escaped so they always show as literal text.

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Hover text → plain lines for the click popup (tags removed, escaped characters restored). */
export function hoverLines(hover: string): string[] {
  return hover.split(/<br>/gi).map((s) =>
    s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
}
