import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";

import { Field, Input, Label } from "@lazuli/ui";

const LABEL_TEXT = "Email institucional";
const EMAIL_PLACEHOLDER = "ana@escola.com.br";

const meta = {
  title: "Components/Label",
  component: Label,
  tags: ["autodocs"],
  args: {
    children: LABEL_TEXT,
  },
  parameters: {
    docs: {
      description: {
        component:
          "The visible name of a form control. Inside a Field it associates itself with that field's control; standalone it needs `htmlFor` like a native label.",
      },
    },
  },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Field className="max-w-sm">
      <Label {...args} />
      <Input placeholder={EMAIL_PLACEHOLDER} type="email" />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByText(LABEL_TEXT));
    await expect(canvas.getByRole("textbox", { name: LABEL_TEXT })).toHaveFocus();
  },
};

export const Standalone: Story = {
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label {...args} htmlFor="standalone-email" />
      <Input id="standalone-email" placeholder={EMAIL_PLACEHOLDER} type="email" />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Field className="max-w-sm" disabled>
      <Label {...args} />
      <Input disabled placeholder={EMAIL_PLACEHOLDER} type="email" />
    </Field>
  ),
};
