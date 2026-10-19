import type { Meta, StoryObj } from "@storybook/nextjs";
import { BookOpen, CalendarDays, Check } from "lucide-react";
import { Badge, Timeline, TimelineSkeleton, type TimelineGroup } from "@lazuli/ui";

const groups: TimelineGroup[] = [
  {
    id: "today",
    label: "Hoje",
    description: "18 de outubro de 2026",
    items: [
      {
        id: "lesson",
        icon: <BookOpen />,
        title: "Aula registrada",
        timestamp: <time dateTime="2026-10-18T10:30:00-03:00">10:30</time>,
        metadata: <Badge>Pedagógico</Badge>,
        children: <p>Inglês · Turma da manhã</p>,
        footer: "Registrado pela coordenação",
      },
      {
        id: "appointment",
        icon: <CalendarDays />,
        title: "Atendimento agendado",
        timestamp: <time dateTime="2026-10-18T09:15:00-03:00">09:15</time>,
        metadata: <Badge>Escola</Badge>,
        children: (
          <details>
            <summary>Ver detalhes</summary>
            <p>Conversa com os responsáveis para acompanhar o desenvolvimento do aluno.</p>
          </details>
        ),
        footer: "Registrado pela secretaria",
      },
    ],
  },
  {
    id: "yesterday",
    label: "Ontem",
    description: "17 de outubro de 2026",
    items: [
      {
        id: "enrollment",
        icon: <Check />,
        title: "Matrícula concluída",
        timestamp: <time dateTime="2026-10-17T16:00:00-03:00">16:00</time>,
        children: <p>Novo vínculo confirmado para o semestre.</p>,
      },
    ],
  },
];

const meta = {
  title: "Components/Timeline",
  component: Timeline,
  tags: ["autodocs"],
  args: { groups, layout: "alternating" },
  argTypes: { layout: { control: "radio", options: ["single", "alternating"] } },
  parameters: {
    docs: {
      description: {
        component:
          "Ordered event groups with marker, title, timestamp, metadata, content and footer slots. " +
          "The caller owns ordering, date formatting, fetching and pagination. Alternating layout " +
          "collapses to a single column below 48rem of container width. DOM and keyboard order " +
          "always follow the supplied event order. Icons are decorative; describe their meaning in text.",
      },
    },
  },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Alternating: Story = {};
export const SingleColumn: Story = { args: { layout: "single" } };
export const NarrowContainer: Story = {
  render: (args) => (
    <div className="max-w-sm">
      <Timeline {...args} />
    </div>
  ),
};
export const Loading: Story = {
  render: (args) => <TimelineSkeleton layout={args.layout} />,
};
export const Empty: Story = {
  args: { groups: [], emptyState: <p>Nenhuma atividade neste período.</p> },
};
export const LongContent: Story = {
  args: {
    groups: [
      {
        id: "long",
        label: "Hoje",
        items: [
          {
            id: "long-entry",
            title: "Atendimento pedagógico de acompanhamento registrado para o semestre atual",
            metadata: <Badge>Pedagógico</Badge>,
            children: (
              <p>
                Contexto extenso com nomes e observações que podem ocupar várias linhas sem alterar
                a ordem cronológica nem ultrapassar a largura do cartão.
              </p>
            ),
            footer: "Registrado pela equipe de acompanhamento pedagógico",
          },
        ],
      },
    ],
  },
};
