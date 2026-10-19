import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Badge,
  Button,
  DetailFact,
  DetailFacts,
  DetailHeader,
  Tabs,
  TabsList,
  TabsTab,
} from "@lazuli/ui";

const meta = {
  title: "Components/DetailHeader",
  component: DetailHeader,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shared identity for detail pages. Plain headers can host page navigation; card headers group compact facts above it. Provides the page h1. Use one per page and label any navigation supplied in actions.",
      },
    },
  },
  argTypes: {
    variant: { control: "radio", options: ["plain", "card"] },
    size: { control: "radio", options: ["sm", "md"] },
    metadataPlacement: { control: "radio", options: ["inline", "below"] },
  },
  args: {
    title: "Ana Beatriz",
    variant: "plain",
    size: "md",
    metadata: <Badge variant="success">Ativo</Badge>,
  },
} satisfies Meta<typeof DetailHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {};
export const WithNavigation: Story = {
  render: (args) => (
    <Tabs defaultValue="academic" variant="underline" size="md">
      <DetailHeader
        {...args}
        actions={
          <TabsList aria-label="Student sections">
            <TabsTab value="academic">Pedagógico</TabsTab>
            <TabsTab value="finance">Financeiro</TabsTab>
          </TabsList>
        }
      />
    </Tabs>
  ),
};
export const ClassBrief: Story = {
  args: {
    title: "REG 14:00 · 5",
    size: "md",
    variant: "card",
    metadataPlacement: "below",
    metadata: <span>2026.2 · Regular · Presencial</span>,
    actions: <Button>Matricular aluno</Button>,
    children: (
      <DetailFacts layout="columns">
        <DetailFact label="Curso">Teens Connect · Connect 1</DetailFact>
        <DetailFact label="Professor">Beatriz Albuquerque</DetailFact>
        <DetailFact label="Horários">Seg/Qua · 14:00–15:30</DetailFact>
        <DetailFact label="Alunos">12 / 25 de referência</DetailFact>
      </DetailFacts>
    ),
  },
};
export const LongIdentity: Story = {
  args: {
    title: "Ana Beatriz de Albuquerque Rodrigues da Silva",
    metadata: <Badge>Cadastro incompleto</Badge>,
    actions: <Button variant="secondary">Editar cadastro</Button>,
  },
};
