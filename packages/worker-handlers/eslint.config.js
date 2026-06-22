import { createConfig } from "@lazuli/eslint-config/base";

export default createConfig({ packageType: "worker", tsconfigRootDir: import.meta.dirname });
