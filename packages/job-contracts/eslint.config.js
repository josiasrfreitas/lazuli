import { createConfig } from "@lazuli/eslint-config/base";

export default createConfig({
  packageType: "job-contracts",
  tsconfigRootDir: import.meta.dirname,
});
