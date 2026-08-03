import type { Meta, StoryObj } from "@storybook/nextjs";

import { HelloWorld } from "@lazuli/ui";

const meta = {
  title: "Components/HelloWorld",
  component: HelloWorld,
  args: {
    message: "Hello, Lazuli",
  },
} satisfies Meta<typeof HelloWorld>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
