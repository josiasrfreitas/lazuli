import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

function compatibleRule(name) {
  const rule = importX.rules[name];
  return {
    ...rule,
    create(context) {
      const resolver = createTypeScriptImportResolver({
        project: path.join(context.cwd, "tsconfig.json"),
      });
      const adapted = new Proxy(context, {
        get(target, property) {
          if (property === "settings")
            return { ...target.settings, "import-x/resolver-next": [resolver] };
          if (property === "options" && name === "no-restricted-paths") {
            return [{ ...target.options[0], basePath: repositoryRoot }];
          }
          return Reflect.get(target, property);
        },
      });
      return rule.create(adapted);
    },
  };
}

export default {
  rules: {
    "no-cycle": compatibleRule("no-cycle"),
    "no-restricted-paths": compatibleRule("no-restricted-paths"),
  },
};
