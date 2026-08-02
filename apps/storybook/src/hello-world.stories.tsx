import type { Meta, StoryObj } from "@storybook/nextjs";

import { HelloWorld } from "@lazuli/ui";

const meta = {
  title: "Foundation/HelloWorld",
  component: HelloWorld,
  args: {
    message: "Olá, Lazuli",
  },
} satisfies Meta<typeof HelloWorld>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
