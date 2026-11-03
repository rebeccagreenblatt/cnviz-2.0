import { useEffect, useLayoutEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";

export interface ClickAnnotationEvent {
  index: number;
  annotation: Partial<Plotly.Annotations>;
  event: MouseEvent;
}

// The plot <div> gets Plotly's event methods once plotted (not declared in Plotly's types)
type PlotlyElement = HTMLDivElement & {
  on?: (event: string, handler: (e: never) => void) => void;
  removeAllListeners?: (event: string) => void;
};

interface PlotlyChartProps {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  config?: Partial<Plotly.Config>;
  style?: React.CSSProperties;
  onClick?: (event: Plotly.PlotMouseEvent) => void;
  onRelayout?: (event: Plotly.PlotRelayoutEvent) => void;
  // Fires when the user clicks a layout annotation (not declared in Plotly's types)
  onClickAnnotation?: (event: ClickAnnotationEvent) => void;
}

/**
 * Minimal React wrapper for plotly.js.
 *
 * We do not use react-plotly.js because its 2.x line is not
 * compatible with React 19 (silent render failures).
 */
export default function PlotlyChart({
  data,
  layout,
  config,
  style,
  onClick,
  onRelayout,
  onClickAnnotation,
}: PlotlyChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep latest callbacks in refs so we can attach listeners once
  const onClickRef = useRef(onClick);
  const onRelayoutRef = useRef(onRelayout);
  const onClickAnnotationRef = useRef(onClickAnnotation);
  useLayoutEffect(() => {
    onClickRef.current = onClick;
    onRelayoutRef.current = onRelayout;
    onClickAnnotationRef.current = onClickAnnotation;
  });

  // Render / re-render plot when data or layout changes
  useEffect(() => {
    if (!ref.current) return;
    Plotly.react(ref.current, data, layout || {}, config || { responsive: true });
  }, [data, layout, config]);

  // Attach event listeners once
  useEffect(() => {
    const el = ref.current as PlotlyElement | null;
    if (!el) return;
    const clickHandler = (e: Plotly.PlotMouseEvent) => onClickRef.current?.(e);
    const relayoutHandler = (e: Plotly.PlotRelayoutEvent) =>
      onRelayoutRef.current?.(e);
    const clickAnnotationHandler = (e: ClickAnnotationEvent) =>
      onClickAnnotationRef.current?.(e);
    el.on?.("plotly_click", clickHandler);
    el.on?.("plotly_relayout", relayoutHandler);
    el.on?.("plotly_clickannotation", clickAnnotationHandler);
    return () => {
      el.removeAllListeners?.("plotly_click");
      el.removeAllListeners?.("plotly_relayout");
      el.removeAllListeners?.("plotly_clickannotation");
    };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, []);

  return <div ref={ref} style={{ width: "100%", ...style }} />;
}
