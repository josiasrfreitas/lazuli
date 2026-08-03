import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";

const semanticPairs = [
  ["Página", "bg-background text-foreground"],
  ["Cartão", "bg-card text-card-foreground"],
  ["Popover", "bg-popover text-popover-foreground"],
  ["Primária", "bg-primary text-primary-foreground"],
  ["Secundária", "bg-secondary text-secondary-foreground"],
  ["Suave", "bg-muted text-muted-foreground"],
  ["Destaque", "bg-accent text-accent-foreground"],
  ["Destrutiva", "bg-destructive text-destructive-foreground"],
  ["Marca", "bg-brand text-brand-foreground"],
  ["Sucesso", "bg-success-muted text-success"],
  ["Atenção", "bg-warning-muted text-warning"],
  ["Informação", "bg-info-muted text-info"],
  ["Erro", "bg-destructive-muted text-destructive"],
] as const;

const meta = {
  title: "Foundation/Tokens",
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
          Ação interativa
        </a>
        <span className="rounded-full border-2 border-border-strong px-3 py-1">Borda forte</span>
      </div>
    </section>
  );
}

export const Colors: Story = {
  render: () => (
    <main className="mx-auto grid w-full max-w-6xl gap-6">
      <ColorMatrix theme="light" title="Claro" />
      <ColorMatrix theme="dark" title="Escuro" />
    </main>
  ),
};

export const Typography: Story = {
  render: () => (
    <main className="mx-auto grid w-full max-w-4xl gap-6 bg-card p-6 text-foreground">
      <p className="font-display text-display font-bold">Educação que aproxima pessoas.</p>
      <p className="font-display text-h1 font-bold">Título de primeiro nível</p>
      <p className="font-display text-h2 font-semibold">Título de segundo nível</p>
      <p className="font-display text-h3 font-semibold">Título de terceiro nível</p>
      <p className="text-body">
        A escola reúne famílias, estudantes e educadores em uma rotina clara e acolhedora.
      </p>
      <p className="text-control">Controle: matrícula confirmada</p>
      <p className="text-caption text-muted-foreground">Legenda: atualização em horário local</p>
      <p className="text-micro tracking-label text-muted-foreground">DADOS ACADÊMICOS</p>
    </main>
  ),
};

export const ScaleAndEffects: Story = {
  render: () => (
    <main className="mx-auto grid w-full max-w-4xl gap-8 bg-card p-6 text-foreground">
      <section>
        <h2 className="font-display text-h3 font-semibold">Espaçamento e controles</h2>
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
        <h2 className="font-display text-h3 font-semibold">Raios e sombras</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-sm border border-border p-4 shadow-sm">6 px</div>
          <div className="rounded-md border border-border p-4 shadow-md">10 px</div>
          <div className="rounded-lg border border-border p-4 shadow-lg">14 px</div>
          <button
            className="rounded-xl bg-secondary p-4 text-secondary-foreground shadow-focus"
            type="button"
          >
            Foco de 3 px
          </button>
        </div>
      </section>
      <section>
        <h2 className="font-display text-h3 font-semibold">Movimento</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-control">
          <span className="rounded-sm bg-muted px-3 py-2 duration-fast ease-standard">120 ms</span>
          <span className="rounded-sm bg-muted px-3 py-2 duration-base ease-standard">180 ms</span>
          <span className="rounded-sm bg-muted px-3 py-2 duration-slow ease-standard">280 ms</span>
        </div>
      </section>
    </main>
  ),
};
