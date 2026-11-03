import { useState } from "react";
import { OUT_OF_RANGE_COLOR, REPORTABLE_COLOR, HAS_VARIANTS_COLOR } from "../constants";

interface LegendPanelProps {
  hasVariants: boolean;
}

export default function LegendPanel({ hasVariants }: LegendPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #e0e0e0", background: "#f8f8f8", padding: "0.3rem 0.75rem", display: "flex", gap: open ? "1.25rem" : 0, flexWrap: "wrap", fontSize: "0.75rem", alignItems: "center" }}>
      <span
        style={{ color: "#555", fontWeight: 500, cursor: "pointer", userSelect: "none", marginRight: open ? 0 : "0.5rem" }}
        onClick={() => setOpen(!open)}
      >
        {open ? "▾" : "▸"} Legend
      </span>
      {open && <>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#0072B2" }} />
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#E69F00" }} />
          Chromosomes
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#333" }} />
          Gene means
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: OUT_OF_RANGE_COLOR }} />
          Out of range
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{
            display: "inline-block", width: 12, height: 12,
            background: REPORTABLE_COLOR,
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          }} />
          Highlighted genes
        </span>
        {hasVariants && (
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: `3px solid ${HAS_VARIANTS_COLOR}`, background: "#333", boxSizing: "border-box" }} />
            Has variants
          </span>
        )}
      </>}
    </div>
  );
}
