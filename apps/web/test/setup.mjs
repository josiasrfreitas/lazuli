import { register } from "node:module";
import * as React from "react";

// Component tests execute the real React tree; CSS is validated by the styles gate.
register("./support/css-loader.mjs", import.meta.url);
// The Node TSX loader uses classic JSX for modules with Next's "preserve" setting.
globalThis.React = React;
