// plotly.js-dist-min is the minified bundle of plotly.js — it exports
// the same API, so we point its types at @types/plotly.js.
declare module "plotly.js-dist-min" {
  import Plotly from "plotly.js";
  export default Plotly;
}
