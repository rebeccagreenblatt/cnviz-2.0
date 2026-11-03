import type { Gene } from "../types";

interface PopupProps {
  popup: { x: number; y: number; lines: string[]; gene?: string };
  selectedGene?: Gene | null;
  genesByName: Map<string, Gene>;
  onGeneSelect?: (gene: Gene) => void;
  onClose: () => void;
}

export default function Popup({ popup, selectedGene, genesByName, onGeneSelect, onClose }: PopupProps) {
  return (
    <div
      style={{
        position: "fixed",
        left: popup.x + 12,
        top: popup.y - 10,
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: "6px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        padding: "0.5rem 0.75rem",
        fontSize: "0.8rem",
        fontFamily: "monospace",
        userSelect: "text",
        zIndex: 1000,
        maxWidth: "400px",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {popup.lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      {popup.gene && selectedGene?.gene !== popup.gene && (
        <div
          style={{ marginTop: "0.4rem", cursor: "pointer", color: "#0072B2", fontWeight: 500 }}
          onClick={() => {
            const gene = genesByName.get(popup.gene!);
            if (gene) onGeneSelect?.(gene);
            onClose();
          }}
        >
          {"Open gene view →"}
        </div>
      )}
    </div>
  );
}
