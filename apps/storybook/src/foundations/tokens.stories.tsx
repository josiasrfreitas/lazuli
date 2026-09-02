import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";

const semanticPairs = [
  ["Page", "bg-background text-foreground"],
  ["Card", "bg-card text-card-foreground"],
  ["Popover", "bg-popover text-popover-foreground"],
  ["Primary", "bg-primary text-primary-foreground"],
  ["Secondary", "bg-secondary text-secondary-foreground"],
  ["Muted", "bg-muted text-muted-foreground"],
  ["Accent", "bg-accent text-accent-foreground"],
  ["Destructive", "bg-destructive text-destructive-foreground"],
  ["Brand", "bg-brand text-brand-foreground"],
  ["Success", "bg-success-muted text-success"],
  ["Warning", "bg-warning-muted text-warning"],
  ["Info", "bg-info-muted text-info"],
  ["Error", "bg-destructive-muted text-destructive"],
] as const;

const meta = {
  title: "Foundations/Tokens",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function ColorMatrix({ theme, title }: { theme: "light" | "dark"; title: string }): ReactElement {
  return (
    <section className={`${theme} border border-border bg-background p-5 text-foreground`}>
      <h2 className="font-display text-h3 font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {semanticPairs.map(([label, classes]) => (
          <div className="overflow-hidden rounded-sm border border-border" key={label}>
            <div className={`${classes} min-h-20 p-3 text-control font-semibold`}>{label}</div>
            <div className="border-t border-border bg-card px-3 py-2 text-micro text-muted-foreground">
              {classes}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 text-control">
        <a className="text-interactive underline underline-offset-4" href="https://lazuli.example">
          Interactive action
        </a>
        <span className="rounded-full border-2 border-border-strong px-3 py-1">Strong border</span>
      </div>
    </section>
  );
}

export const Colors: Story = {
  render: () => (
    <main className="mx-auto grid w-full max-w-6xl gap-6">
      <ColorMatrix theme="light" title="Light" />
      <ColorMatrix theme="dark" title="Dark" />
    </main>
  ),
};

export const Typography: Story = {
  render: () => (
    <main className="mx-auto grid w-full max-w-4xl gap-6 bg-card p-6 text-foreground">
      <p className="font-display text-display font-bold">Education that brings people together.</p>
      <p className="font-display text-h1 font-bold">First-level heading</p>
      <p className="font-display text-h2 font-semibold">Second-level heading</p>
      <p className="font-display text-h3 font-semibold">Third-level heading</p>
      <p className="text-body">
        The school brings families, students, and educators together in a clear, welcoming routine.
      </p>
      <p className="text-control">Control: enrollment confirmed</p>
      <p className="text-caption text-muted-foreground">Caption: updated in local time</p>
      <p className="text-micro tracking-label text-muted-foreground">ACADEMIC DATA</p>
    </main>
  ),
};

function ScrollbarSample(): ReactElement {
  return (
    <section>
      <h2 className="font-display text-h3 font-semibold">Scrollbar</h2>
      <div className="scrollbar-subtle mt-4 h-32 overflow-auto rounded-md border border-border bg-background p-4">
        <div className="w-[48rem] space-y-3 text-control">
          <p>Scrollbars use semantic thumb and track colors for both themes.</p>
          <p className="text-muted-foreground">
            The subtle treatment stays quiet at rest and gains contrast on hover while preserving
            native scrolling behavior.
          </p>
          <p className="text-muted-foreground">
            This wide sample demonstrates the same design-system treatment on both axes.
          </p>
          <p className="text-muted-foreground">End of the scrollable content.</p>
        </div>
      </div>
    </section>
  );
}

export const ScaleAndEffects: Story = {
  render: () => (
    <main className="mx-auto grid w-full max-w-4xl gap-8 bg-card p-6 text-foreground">
      <section>
        <h2 className="font-display text-h3 font-semibold">Spacing and controls</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="h-1 w-1 bg-brand" />
          <div className="h-2 w-2 bg-brand" />
          <div className="h-4 w-4 bg-brand" />
          <div className="h-control-sm border border-input px-3 text-control">32</div>
          <div className="h-control-md border border-input px-3 text-control">40</div>
          <div className="h-control-lg border border-input px-3 text-control">48</div>
        </div>
      </section>
      <section>
        <h2 className="font-display text-h3 font-semibold">Radii and shadows</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-sm border border-border p-4 shadow-sm">6 px</div>
          <div className="rounded-md border border-border p-4 shadow-md">10 px</div>
          <div className="rounded-lg border border-border p-4 shadow-lg">14 px</div>
          <button
            className="rounded-xl bg-secondary p-4 text-secondary-foreground shadow-focus"
            type="button"
          >
            3px focus
          </button>
        </div>
      </section>
      <section>
        <h2 className="font-display text-h3 font-semibold">Motion</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-control">
          <span className="rounded-sm bg-muted px-3 py-2 duration-fast ease-standard">120 ms</span>
          <span className="rounded-sm bg-muted px-3 py-2 duration-base ease-standard">180 ms</span>
          <span className="rounded-sm bg-muted px-3 py-2 duration-slow ease-standard">280 ms</span>
        </div>
      </section>
      <ScrollbarSample />
    </main>
  ),
};
