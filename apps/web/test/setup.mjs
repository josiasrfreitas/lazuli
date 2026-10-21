import { register } from "node:module";

// Component tests execute the real React tree; CSS is validated by the styles gate.
register("./support/css-loader.mjs", import.meta.url);
