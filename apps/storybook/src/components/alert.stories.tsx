import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, within } from "storybook/test";

import {
  Alert,
  AlertAction,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@lazuli/ui";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const variants = [
  {
    description: "Your saved filters are available on this device.",
    icon: Info,
    title: "Saved preferences",
    variant: "neutral",
  },
  {
    description: "The class schedule has been updated for next week.",
    icon: Info,
    title: "Schedule updated",
    variant: "info",
  },
  {
    description: "The payment receipt was sent to the responsible person.",
    icon: CircleCheck,
    title: "Payment confirmed",
    variant: "success",
  },
  {
    description: "The enrollment form is missing the guardian's phone number.",
    icon: TriangleAlert,
    title: "Information needed",
    variant: "warning",
  },
  {
    description: "This action cannot be undone after the term is closed.",
    icon: CircleAlert,
    title: "Review before closing",
    variant: "destructive",
  },
] as const;

const meta = {
  title: "Components/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: {
    variant: "info",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "info", "success", "warning", "destructive"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Status message with a title, supporting description, optional decorative icon, and optional action. It uses `role="alert"` by default; use `role="status"` for non-urgent updates.',
      },
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

function AlertExample({
  description,
  icon: Icon,
  title,
  variant,
}: (typeof variants)[number]): ReactElement {
  return (
    <Alert variant={variant}>
      <AlertIcon>
        <Icon />
      </AlertIcon>
      <AlertContent>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export const Playground: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertIcon>
        <Info />
      </AlertIcon>
      <AlertContent>
        <AlertTitle>Schedule updated</AlertTitle>
        <AlertDescription>The class schedule has been updated for next week.</AlertDescription>
      </AlertContent>
    </Alert>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("alert");

    await expect(alert).toHaveTextContent("Schedule updated");
  },
};

export const Variants: Story = {
  render: () => (
    <div className="grid w-full max-w-2xl gap-3">
      {variants.map((variant) => (
        <AlertExample {...variant} key={variant.variant} />
      ))}
    </div>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Alert variant="warning">
      <AlertIcon>
        <TriangleAlert />
      </AlertIcon>
      <AlertContent>
        <AlertTitle>Guardian information needed</AlertTitle>
        <AlertDescription>Add a phone number before sending the enrollment form.</AlertDescription>
      </AlertContent>
      <AlertAction>
        <a className="text-interactive underline underline-offset-4" href="https://lazuli.example">
          Review form
        </a>
      </AlertAction>
    </Alert>
  ),
};
