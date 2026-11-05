import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToastAlert } from "../../src/components/toast-alert.js";

void it("keeps the failed state's explanation and retry action in the page", () => {
  const markup = renderToStaticMarkup(
    createElement(ToastAlert, {
      variant: "destructive",
      toastTimeout: 5000,
      children: [
        "Não foi possível carregar.",
        createElement("button", { onClick: () => {} }, "Tentar novamente"),
      ],
    }),
  );
  assert.match(markup, /Não foi possível carregar\./u);
  assert.match(markup, /<button[^>]*>Tentar novamente<\/button>/u);
});
