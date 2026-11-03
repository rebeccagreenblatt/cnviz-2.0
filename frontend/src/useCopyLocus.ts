import { useState } from "react";

/**
 * Copies a locus (e.g. "chr12:25398284") to the clipboard so it can be pasted into IGV's locus box.
 * CNViz makes no network connections at all, including to IGV's local port.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (older browsers, some file:// contexts): fall back to a hidden textarea
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function useCopyLocus() {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const copyLocus = async (locus: string) => {
    const ok = await copyText(locus);
    setMessage(ok
      ? { text: `Copied ${locus}`, ok: true }
      : { text: `Couldn't copy automatically. Locus: ${locus}`, ok: false });
  };
  return { message, copyLocus };
}
