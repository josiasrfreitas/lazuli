import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

import { Button, Field, FormRow, FormSection, Input, Label } from "@lazuli/ui";

const SECTION_TITLE = "Responsável";

const meta = {
  title: "Components/FormSection",
  component: FormSection,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Chunks related fields under a compact header (a real `fieldset` with a `legend`). `FormRow` lays short, related fields side by side; pass a `grid-cols-[…]` class for uneven tracks.",
      },
    },
  },
} satisfies Meta<typeof FormSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: {
    title: SECTION_TITLE,
    description: "Obrigatório para menores de idade: nome e telefone ou email.",
  },
  render: (args) => (
    <FormSection {...args} className="max-w-md">
      <Field>
        <Label>Nome do responsável</Label>
        <Input placeholder="Nome completo do responsável" size="sm" />
      </Field>
      <FormRow columns={2}>
        <Field>
          <Label>Telefone</Label>
          <Input placeholder="(11) 99999-9999" size="sm" type="tel" />
        </Field>
        <Field>
          <Label>Email</Label>
          <Input placeholder="nome@exemplo.com" size="sm" type="email" />
        </Field>
      </FormRow>
    </FormSection>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: SECTION_TITLE });

    await expect(within(group).getByRole("textbox", { name: "Telefone" })).toBeVisible();
  },
};

export const WithAction: Story = {
  args: {
    title: SECTION_TITLE,
    description: "Opcional para adultos.",
    action: (
      <Button size="sm" variant="ghost">
        Adicionar responsável
      </Button>
    ),
  },
  render: (args) => <FormSection {...args} className="max-w-md" />,
};

export const UnevenRow: Story = {
  args: { title: "Identificação" },
  render: (args) => (
    <FormSection {...args} className="max-w-md">
      <FormRow className="grid-cols-[8.5rem_1fr]">
        <Field>
          <Label>Nascimento</Label>
          <Input placeholder="dd/mm/aaaa" size="sm" />
        </Field>
        <Field>
          <Label>Número do documento</Label>
          <Input placeholder="000.000.000-00" size="sm" />
        </Field>
      </FormRow>
    </FormSection>
  ),
};
