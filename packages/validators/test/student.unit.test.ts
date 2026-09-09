import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dateOnlyInputSchema,
  documentTypeSchema,
  studentCreateInputSchema,
  studentSearchInputSchema,
  studentSetStatusInputSchema,
  studentStatusSchema,
  studentUpdateContactInputSchema,
  studentUpdateContactProcedureInputSchema,
  studentUpdateNotesInputSchema,
} from "../src/student.js";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const GUARDIAN_ID = "22222222-2222-4222-8222-222222222222";
const SEARCH_TOO_LONG_LENGTH = 81;
const LONG_QUERY = "x".repeat(SEARCH_TOO_LONG_LENGTH);
const DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE =
  "Informe o tipo do documento quando preencher o numero.";

void describe("student document pair input", () => {
  void it("requires a document type when a document number is filled", () => {
    const result = studentCreateInputSchema.safeParse({
      fullName: "Ana Souza",
      documentNumber: "12345678900",
    });

    assert.deepEqual(result.error?.issues, [
      {
        code: "custom",
        message: DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE,
        path: ["documentType"],
      },
    ]);
  });

  void it("accepts a document number with its document type", () => {
    const result = studentCreateInputSchema.safeParse({
      fullName: "Ana Souza",
      documentType: "CPF",
      documentNumber: "12345678900",
    });

    assert.equal(result.success, true);
  });

  void it("rejects a filled document number with a null document type", () => {
    const result = studentCreateInputSchema.safeParse({
      fullName: "Ana Souza",
      documentType: null,
      documentNumber: "12345678900",
    });

    assert.equal(result.error?.issues[0]?.message, DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE);
  });
});

void describe("student optional document input", () => {
  void it("accepts omitted document fields", () => {
    const result = studentCreateInputSchema.safeParse({ fullName: "Ana Souza" });

    assert.equal(result.success, true);
  });

  void it("accepts a null document number without a document type", () => {
    const result = studentCreateInputSchema.safeParse({
      fullName: "Ana Souza",
      documentNumber: null,
    });

    assert.equal(result.success, true);
  });
});

void describe("student contact input", () => {
  void it("trims required and optional student contact text", () => {
    const parsed = studentCreateInputSchema.parse({
      fullName: " Ana Souza ",
      phone: " 82999990000 ",
      email: null,
      notes: " Observacao ",
      address: {
        street: " Rua A ",
        city: null,
      },
    });

    assert.equal(parsed.fullName, "Ana Souza");
    assert.equal(parsed.phone, "82999990000");
    assert.equal(parsed.email, null);
    assert.equal(parsed.notes, "Observacao");
    assert.equal(parsed.address?.street, "Rua A");
  });

  void it("rejects blank required names after trimming", () => {
    const result = studentCreateInputSchema.safeParse({ fullName: "   " });

    assert.equal(result.error?.issues[0]?.message, "Campo obrigatorio.");
    assert.deepEqual(result.error?.issues[0]?.path, ["fullName"]);
  });

  void it("coerces date-only input and reports the shared invalid date message", () => {
    const parsed = dateOnlyInputSchema.parse("2026-03-01");
    const result = dateOnlyInputSchema.safeParse("not-a-date");

    assert.equal(parsed.toISOString(), "2026-03-01T00:00:00.000Z");
    assert.equal(result.error?.issues[0]?.message, "Data invalida.");
  });

  void it("keeps CPF/RG document types and the student status lifecycle values", () => {
    assert.equal(documentTypeSchema.safeParse("CPF").success, true);
    assert.equal(documentTypeSchema.safeParse("RG").success, true);
    assert.equal(documentTypeSchema.safeParse("CNH").success, false);
    assert.equal(studentStatusSchema.safeParse("ACTIVE").success, true);
    assert.equal(studentStatusSchema.safeParse("INACTIVE").success, true);
    assert.equal(studentStatusSchema.safeParse("DROPPED").success, true);
    assert.equal(studentStatusSchema.safeParse("SUSPENDED").success, true);
    assert.equal(studentStatusSchema.safeParse("TRANSFERRED").success, false);
  });
});

void describe("student guardian input", () => {
  void it("validates create and update guardian reference modes", () => {
    const created = studentCreateInputSchema.parse({
      fullName: "Ana Souza",
      guardian: { mode: "connect", id: GUARDIAN_ID },
    });
    const createdGuardian = studentCreateInputSchema.parse({
      fullName: "Bruno Souza",
      guardian: {
        mode: "create",
        input: { fullName: " Maria Souza ", phone: "82999990000" },
        useStudentAddress: true,
      },
    });
    const connected = studentUpdateContactInputSchema.parse({
      guardian: { mode: "connect", id: GUARDIAN_ID },
    });
    const disconnected = studentUpdateContactProcedureInputSchema.parse({
      id: STUDENT_ID,
      input: { guardian: { mode: "disconnect" } },
    });
    const replaced = studentUpdateContactInputSchema.parse({
      guardian: {
        mode: "create",
        input: { fullName: " Joana Souza ", email: "joana@example.com" },
      },
    });
    const updated = studentUpdateContactInputSchema.parse({
      guardian: { mode: "update", input: { fullName: " Maria " }, useStudentAddress: false },
    });

    assert.equal(created.guardian?.mode, "connect");
    assert.equal(createdGuardian.guardian?.mode, "create");
    assert.equal(connected.guardian?.mode, "connect");
    assert.equal(disconnected.input.guardian?.mode, "disconnect");
    assert.equal(replaced.guardian?.mode, "create");
    assert.equal(updated.guardian?.mode, "update");
    assert.equal(
      studentUpdateContactInputSchema.safeParse({ guardian: { mode: "replace" } }).success,
      false,
    );
  });
});

void describe("student mutation input", () => {
  void it("validates search, notes, and status mutation inputs", () => {
    const search = studentSearchInputSchema.parse({ query: " Ana " });
    const notes = studentUpdateNotesInputSchema.parse({ id: STUDENT_ID, notes: " Alerta " });
    const status = studentSetStatusInputSchema.parse({ id: STUDENT_ID, status: "SUSPENDED" });

    assert.equal(search.query, "Ana");
    assert.equal(notes.notes, "Alerta");
    assert.equal(status.status, "SUSPENDED");
    assert.equal(studentSearchInputSchema.safeParse({ query: "   " }).success, false);
    assert.equal(studentSearchInputSchema.safeParse({ query: LONG_QUERY }).success, false);
    assert.equal(
      studentSetStatusInputSchema.safeParse({ id: STUDENT_ID, status: "TRANSFERRED" }).success,
      false,
    );
  });
});
