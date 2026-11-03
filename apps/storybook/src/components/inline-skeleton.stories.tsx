import type { Meta, StoryObj } from "@storybook/nextjs";
import { InlineSkeleton } from "@lazuli/ui";

const meta = {
  title: "Components/InlineSkeleton",
  component: InlineSkeleton,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Placeholder for one fetched value. Keep known labels and the final layout visible; use text for lines and block for headings, badges or numeric readings. Size placeholders to their content, not the containing panel. The placeholder is hidden from assistive technology: label its loading region and set aria-busy there. Motion respects prefers-reduced-motion.",
      },
    },
  },
  argTypes: {
    shape: { control: "radio", options: ["text", "block"] },
  },
  args: {
    shape: "text",
    className: "w-32",
  },
} satisfies Meta<typeof InlineSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {};

export const Block: Story = {
  args: { shape: "block", className: "h-7 w-48" },
};

export const LabeledValues: Story = {
  render: () => (
    <section className="grid w-72 gap-4" aria-label="Carregando matrícula" aria-busy="true">
      <h2 className="text-h3 text-heading">Matrícula atual</h2>
      <InlineSkeleton shape="block" className="h-7 w-48" />
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div className="grid gap-2">
          <dt className="text-muted-foreground">Professor</dt>
          <dd>
            <InlineSkeleton className="w-28" />
          </dd>
        </div>
        <div className="grid gap-2">
          <dt className="text-muted-foreground">Aulas</dt>
          <dd>
            <InlineSkeleton className="w-24" />
          </dd>
        </div>
      </dl>
    </section>
  ),
};
