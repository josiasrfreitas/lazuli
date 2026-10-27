import { builtinRules } from "eslint/use-at-your-own-risk";

// Keep the existing implementations for rules Oxlint cannot yet replace.
export default {
  rules: Object.fromEntries(
    [
      "no-undef",
      "no-useless-assignment",
      "no-restricted-syntax",
      "id-length",
      "no-magic-numbers",
    ].map((name) => [name, builtinRules.get(name)]),
  ),
};
