import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "../../src/lib/trpc.js";
import { AddressStep } from "../../src/features/students/new-student/address-step.js";
import {
  toCreateInput,
  toContactUpdate,
} from "../../src/features/students/new-student/finance-model.js";
import {
  initialNewStudentState,
  newStudentReducer,
} from "../../src/features/students/new-student/reducer.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("labels address controls and prevents staff browser autofill", () => {
  const queryClient = new QueryClient();
  const markup = renderToStaticMarkup(
    React.createElement(trpc.Provider, {
      client: createTRPCClient(),
      queryClient,
      children: React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(AddressStep, {
          value: undefined,
          onChange: () => {},
          onBusyChange: () => {},
        }),
      ),
    }),
  );
  const visibleInputs = (markup.match(/<input\b[^>]*>/g) ?? []).filter(
    (tag) => !tag.includes('aria-hidden="true"'),
  );
  assert.equal(visibleInputs.length, 7);
  for (const tag of visibleInputs) {
    assert.match(tag, /name="address\.[a-zA-Z]+"/);
    assert.match(tag, /placeholder="[^"]+"/);
    assert.match(tag, /autoComplete="off"/i);
  }
  assert.match(markup, /Endereço do aluno/);
  assert.match(markup, /Rua ou avenida/);
  queryClient.clear();
});

void it("preserves the address draft in both creation and continuation commands", () => {
  const address = {
    street: "Rua das Flores",
    number: "s/n",
    complement: "Casa B",
    neighborhood: "Centro",
    city: "Maceió",
    state: "AL",
    postalCode: "57000-000",
  };
  const draft = newStudentReducer(initialNewStudentState, { type: "addressChanged", address });
  const fields = { ...draft.fields, fullName: "Aluno de teste" };
  assert.deepEqual(toCreateInput(fields).address, address);
  assert.deepEqual(toContactUpdate(fields, false).address, address);
  const cleared = {
    ...fields,
    address: {
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      postalCode: "",
    },
  };
  assert.equal(toContactUpdate(cleared, false).address, null);
  assert.equal(
    toContactUpdate({ ...initialNewStudentState.fields, fullName: "Aluno" }, false).address,
    undefined,
  );
});
