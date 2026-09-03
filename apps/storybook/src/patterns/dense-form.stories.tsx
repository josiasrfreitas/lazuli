import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState, type ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import {
  Button,
  Field,
  FieldError,
  FormRow,
  FormSection,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";

const DOCUMENT_TYPE_LABEL_ID = "dense-form-document-type";

function IdentitySection(): ReactElement {
  const [documentType, setDocumentType] = useState<string | null>(null);

  return (
    <FormSection title="Identificação">
      <Field>
        <Label>Nome completo</Label>
        <Input autoComplete="off" name="fullName" placeholder="Como está no documento" size="sm" />
      </Field>
      <FormRow className="sm:grid-cols-[8.5rem_auto_1fr]">
        <Field>
          <Label>Nascimento</Label>
          <Input
            autoComplete="off"
            inputMode="numeric"
            name="birthDate"
            placeholder="dd/mm/aaaa"
            size="sm"
          />
        </Field>
        <Field>
          <Label id={DOCUMENT_TYPE_LABEL_ID}>Documento</Label>
          <SegmentedControl
            aria-labelledby={DOCUMENT_TYPE_LABEL_ID}
            onValueChange={setDocumentType}
            size="sm"
            value={documentType}
          >
            <SegmentedControlItem value="CPF">CPF</SegmentedControlItem>
            <SegmentedControlItem value="RG">RG</SegmentedControlItem>
          </SegmentedControl>
        </Field>
        <Field>
          <Label>Número</Label>
          <Input
            autoComplete="off"
            inputMode="numeric"
            name="documentNumber"
            placeholder={documentType === "RG" ? "00.000.000-0" : "000.000.000-00"}
            size="sm"
          />
        </Field>
      </FormRow>
    </FormSection>
  );
}

function ContactSection({ submitted }: { submitted: boolean }): ReactElement {
  return (
    <FormSection title="Contato">
      <FormRow columns={2}>
        <Field>
          <Label>Telefone</Label>
          <Input
            autoComplete="off"
            inputMode="tel"
            name="phone"
            placeholder="(11) 99999-9999"
            size="sm"
            type="tel"
          />
        </Field>
        <Field>
          <Label>Email</Label>
          <Input
            autoComplete="off"
            invalid={submitted}
            name="email"
            placeholder="nome@exemplo.com"
            size="sm"
            type="email"
          />
          {submitted ? <FieldError match>Email inválido.</FieldError> : null}
        </Field>
      </FormRow>
    </FormSection>
  );
}

/**
 * Reference for every product form (docs/frontend/forms.md): sections, dense
 * `size="sm"` controls, placeholders as format hints, pills for ≤ 5 options,
 * masked text instead of native date pickers, and a real `form` so Enter
 * submits. Copy this shape; do not restyle field by field.
 */
function DenseFormExample(): ReactElement {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="grid max-w-xl gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <IdentitySection />
      <ContactSection submitted={submitted} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost">
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}

const meta = {
  title: "Patterns/DenseForm",
  component: DenseFormExample,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The canonical dense product form: grouped sections, compact controls with placeholders as format hints, inline pills instead of a two-option dropdown, masked text instead of a native date picker, and a real form so Enter submits. New forms start from this pattern.",
      },
    },
  },
} satisfies Meta<typeof DenseFormExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByRole("textbox", { name: "Nome completo" });

    await userEvent.click(name);
    await userEvent.tab();
    await expect(canvas.getByRole("textbox", { name: "Nascimento" })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "CPF" })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("textbox", { name: "Número" })).toHaveFocus();

    await userEvent.type(name, "Ana Souza{Enter}");
    await expect(canvas.getByText("Email inválido.")).toBeVisible();
  },
};
