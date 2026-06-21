import { createConfig } from "@lazuli/eslint-config/base";

export default createConfig({ packageType: "web", tsconfigRootDir: import.meta.dirname });
