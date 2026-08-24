import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";

import { Textarea } from "@lazuli/ui";

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    placeholder: "Escreva uma observação",
    rows: 4,
  },
  argTypes: {
    invalid: { control: "boolean" },
    rows: { control: { min: 2, max: 12, type: "number" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Campo de texto para observações e outros conteúdos com várias linhas. Use sempre um rótulo e associe mensagens de erro com `aria-describedby`.",
      },
    },
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <label className="grid w-full max-w-sm gap-2 text-caption font-medium">
      Observações do aluno
      <Textarea {...args} />
    </label>
  ),
};

export const Rows: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-3">
      <Textarea aria-label="Observação breve" placeholder="Observação breve" rows={3} />
      <Textarea aria-label="Observação detalhada" placeholder="Observação detalhada" rows={6} />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-3">
      <label className="grid gap-2 text-caption font-medium">
        Observação vazia
        <Textarea placeholder="Escreva uma observação" />
      </label>
      <label className="grid gap-2 text-caption font-medium">
        Observação preenchida
        <Textarea defaultValue="A aluna precisa de material complementar para a próxima aula." />
      </label>
      <label className="grid gap-2 text-caption font-medium">
        Observação inválida
        <Textarea
          aria-describedby="observacao-invalida-erro"
          invalid
          placeholder="Informe a observação"
        />
        <span className="text-caption font-normal text-destructive" id="observacao-invalida-erro">
          Informe uma observação antes de continuar.
        </span>
      </label>
      <label className="grid gap-2 text-caption font-medium">
        Observação desabilitada
        <Textarea disabled placeholder="Observações indisponíveis" />
      </label>
      <label className="grid gap-2 text-caption font-medium">
        Observação somente leitura
        <Textarea defaultValue="Registro importado em 03/08/2026." readOnly />
      </label>
    </div>
  ),
};

export const FocusVisible: Story = {
  render: () => (
    <label className="grid w-full max-w-sm gap-2 text-caption font-medium">
      Observações do aluno
      <Textarea autoFocus defaultValue="A família confirmou presença na reunião." />
    </label>
  ),
};

export const InteractionRegression: Story = {
  tags: ["!autodocs", "!dev"],
  render: () => (
    <div className="grid w-full max-w-sm gap-3">
      <label className="grid gap-2 text-caption font-medium">
        Observações do aluno
        <Textarea placeholder="Escreva uma observação" />
      </label>
      <Textarea aria-label="Observação inválida" invalid />
      <Textarea aria-label="Observação desabilitada" disabled />
      <Textarea
        aria-label="Observação somente leitura"
        defaultValue="Registro importado."
        readOnly
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole("textbox", { name: "Observações do aluno" });
    const invalidTextarea = canvas.getByRole("textbox", { name: "Observação inválida" });
    const disabledTextarea = canvas.getByRole("textbox", { name: "Observação desabilitada" });
    const readOnlyTextarea = canvas.getByRole("textbox", { name: "Observação somente leitura" });

    await expect(textarea).toHaveValue("");
    await userEvent.click(textarea);
    await expect(textarea).toHaveFocus();
    await userEvent.type(textarea, "Contato feito com a responsável.");
    await expect(textarea).toHaveValue("Contato feito com a responsável.");

    await expect(invalidTextarea).toHaveAttribute("aria-invalid", "true");
    await expect(invalidTextarea).toHaveAttribute("data-invalid", "true");
    await expect(disabledTextarea).toBeDisabled();

    await userEvent.type(readOnlyTextarea, " Texto alterado.");
    await expect(readOnlyTextarea).toHaveValue("Registro importado.");
  },
};
