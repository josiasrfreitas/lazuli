import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, within } from "storybook/test";

import { Avatar, type AvatarSize } from "@lazuli/ui";

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Círculo com iniciais e cor de fundo determinística por chave — o mesmo aluno recebe sempre o mesmo tom.",
      },
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

const sizes: AvatarSize[] = ["sm", "md", "lg"];

const primaryStudent = { id: "stu-001", name: "Ana Beatriz Nogueira" };

const students = [
  primaryStudent,
  { id: "stu-002", name: "Caio Fernandes" },
  { id: "stu-003", name: "Duda Martins" },
  { id: "stu-004", name: "Enzo Ribeiro Prado" },
  { id: "stu-005", name: "Helena Vasconcelos" },
  { id: "stu-006", name: "Milena" },
];

function VariationsGrid(): ReactElement {
  return (
    <div className="grid gap-6">
      {sizes.map((size) => (
        <div className="flex items-center gap-3" key={size}>
          <span className="w-8 text-caption text-muted-foreground">{size}</span>
          {students.map((student) => (
            <Avatar colorKey={student.id} key={student.id} name={student.name} size={size} />
          ))}
        </div>
      ))}
    </div>
  );
}

export const Playground: Story = {
  args: {
    name: primaryStudent.name,
    colorKey: primaryStudent.id,
    size: "md",
  },
  play: async ({ canvasElement }) => {
    const avatar = canvasElement.querySelector('[data-slot="avatar"]');

    await expect(avatar).not.toBeNull();
    await expect(avatar).toHaveTextContent("AN");
    await expect(avatar).toHaveAttribute("aria-hidden", "true");
  },
};

export const Sizes: Story = {
  args: { name: primaryStudent.name },
  render: () => <VariationsGrid />,
};

export const DeterministicTones: Story = {
  args: { name: primaryStudent.name },
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar colorKey={primaryStudent.id} name={primaryStudent.name} />
      <Avatar colorKey={primaryStudent.id} name={primaryStudent.name} />
      <Avatar colorKey="stu-002" name="Caio Fernandes" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first, second] = canvas.getAllByText("AN");

    await expect(first?.className).toBe(second?.className);
  },
};
