import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

import { Field, FieldDescription, FieldError, Input, Label } from "@lazuli/ui";

const LABEL_TEXT = "Email institucional";
const EMAIL_PLACEHOLDER = "ana@escola.com.br";
const DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";

const meta = {
  title: "Components/Field",
  component: Field,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Groups a label, a control, and its messages. The control registers itself with the group, so `id` and `aria-describedby` resolve without manual wiring. Pass `match` to FieldError to drive visibility from outside the browser's own validity state.",
      },
    },
  },
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Field {...args} className="max-w-sm">
      <Label>{LABEL_TEXT}</Label>
      <Input placeholder={EMAIL_PLACEHOLDER} type="email" />
      <FieldDescription>Enviamos um link de acesso para este endereço.</FieldDescription>
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: LABEL_TEXT });

    await expect(input).toHaveAccessibleDescription(
      "Enviamos um link de acesso para este endereço.",
    );
  },
};

export const WithError: Story = {
  render: (args) => (
    <Field {...args} className="max-w-sm">
      <Label>{LABEL_TEXT}</Label>
      <Input defaultValue="ana@" invalid type="email" />
      <FieldError match>{DENIED_MESSAGE}</FieldError>
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: LABEL_TEXT });

    await expect(input).toHaveAccessibleDescription(DENIED_MESSAGE);
    await expect(input).toHaveAttribute("aria-invalid", "true");
  },
};

export const Disabled: Story = {
  render: (args) => (
    <Field {...args} className="max-w-sm" disabled>
      <Label>{LABEL_TEXT}</Label>
      <Input disabled placeholder={EMAIL_PLACEHOLDER} type="email" />
      <FieldDescription>Indisponível enquanto o envio está em andamento.</FieldDescription>
    </Field>
  ),
};
