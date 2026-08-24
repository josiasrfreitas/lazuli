import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Checkbox, type CheckboxProps } from "@lazuli/ui";

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: {
    "aria-label": "Receber avisos por e-mail",
    defaultChecked: false,
    size: "md",
  },
  argTypes: {
    invalid: { control: "boolean" },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Controle binário para formulários, com envio nativo, estados marcado, indeterminado, inválido, desabilitado e somente leitura.",
      },
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

function CheckboxField({ children, ...props }: CheckboxProps & { children: string }): ReactElement {
  return (
    <label className="flex items-center gap-2 text-caption font-medium text-foreground">
      <Checkbox {...props} />
      {children}
    </label>
  );
}

export const Playground: Story = {
  render: (args) => <Checkbox {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: "Receber avisos por e-mail" });

    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-3">
      <CheckboxField aria-label="Checkbox extra pequeno" size="xs">
        Extra pequeno
      </CheckboxField>
      <CheckboxField aria-label="Checkbox pequeno" size="sm">
        Compacto
      </CheckboxField>
      <CheckboxField aria-label="Checkbox médio" size="md">
        Padrão
      </CheckboxField>
      <CheckboxField aria-label="Checkbox grande" size="lg">
        Grande
      </CheckboxField>
      <CheckboxField aria-label="Checkbox extra grande" size="xl">
        Extra grande
      </CheckboxField>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid gap-3">
      <CheckboxField aria-label="Aceitar o contrato">Desmarcado</CheckboxField>
      <CheckboxField aria-label="Receber avisos" defaultChecked>
        Marcado
      </CheckboxField>
      <CheckboxField aria-label="Selecionar todas as parcelas" indeterminate>
        Indeterminado
      </CheckboxField>
      <CheckboxField aria-label="Li o regulamento" invalid>
        Inválido: aceite o regulamento
      </CheckboxField>
      <CheckboxField aria-label="Avisos indisponíveis" disabled>
        Desabilitado
      </CheckboxField>
      <CheckboxField aria-label="Preferência salva" defaultChecked readOnly>
        Somente leitura
      </CheckboxField>
    </div>
  ),
};

export const FocusVisible: Story = {
  render: () => (
    <CheckboxField aria-label="Aceitar os termos" autoFocus>
      Aceitar os termos
    </CheckboxField>
  ),
};
