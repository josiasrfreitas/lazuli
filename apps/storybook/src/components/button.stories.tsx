import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "@lazuli/ui";
import { Check, MoreHorizontal, Plus, Trash2 } from "lucide-react";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Save",
    onClick: fn(),
    size: "md",
    variant: "primary",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "destructive", "link"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "icon-sm", "icon-md", "icon-lg"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Lazuli command button. Use concise, action-oriented labels; icon-only buttons require an `aria-label`.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Save" });

    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Save</Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="ghost">View details</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">Open record</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Compact</Button>
      <Button size="md">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <Plus />
        New student
      </Button>
      <Button variant="secondary">
        <Check />
        Confirm payment
      </Button>
      <Button variant="destructive">
        <Trash2 />
        Delete
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button aria-label="More options" size="icon-sm" variant="ghost">
        <MoreHorizontal />
      </Button>
      <Button aria-label="More options" size="icon-md" variant="secondary">
        <MoreHorizontal />
      </Button>
      <Button aria-label="More options" size="icon-lg">
        <MoreHorizontal />
      </Button>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
      <Button className="w-full">Available</Button>
      <Button className="w-full" disabled>
        Disabled
      </Button>
      <Button className="w-full" loading>
        Saving
      </Button>
      <Button className="w-full" variant="secondary">
        Available
      </Button>
      <Button className="w-full" disabled variant="secondary">
        Disabled
      </Button>
      <Button className="w-full" loading variant="secondary">
        Loading
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const savingButton = canvas.getByRole("button", { name: "Saving" });

    for (const button of canvas.getAllByRole("button", { name: "Available" })) {
      await expect(button).toBeEnabled();
    }
    for (const button of canvas.getAllByRole("button", { name: "Disabled" })) {
      await expect(button).toBeDisabled();
    }
    await expect(savingButton).toBeDisabled();
    await expect(savingButton).toHaveAttribute("aria-busy", "true");
  },
};
