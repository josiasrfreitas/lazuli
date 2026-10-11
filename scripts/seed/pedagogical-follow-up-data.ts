export const OCCURRENCE_EXAMPLES = {
  MATERIAL: {
    title: "Material de apoio não estava disponível",
    account:
      "No início da atividade, o material previsto não estava disponível. A participação continuou com uma cópia emprestada.",
    initialResponse:
      "Disponibilizado material de apoio e combinado conferir os itens antes da próxima aula.",
  },
  HOMEWORK: {
    title: "Atividade anterior ficou para retomada",
    account:
      "A atividade combinada para esta aula não foi apresentada. O aluno explicou quais etapas ainda precisava retomar.",
    initialResponse:
      "Dividida a atividade em etapas menores e combinada uma nova oportunidade de apresentação.",
  },
  PARTICIPATION: {
    title: "Apoio para iniciar a prática oral",
    account:
      "Na prática em duplas, o aluno pediu tempo adicional e um exemplo antes de iniciar sua fala.",
    initialResponse: "Oferecidos um modelo curto e tempo de preparação antes da troca com a dupla.",
  },
  BEHAVIOR: {
    title: "Retomada dos combinados de escuta",
    account:
      "Durante a explicação, conversas simultâneas dificultaram acompanhar as instruções. O combinado de escuta foi retomado com o aluno.",
    initialResponse:
      "Reorganizados os turnos de fala; a atividade foi retomada com instruções breves.",
  },
  LEARNING: {
    title: "Pedido de apoio na compreensão de instruções",
    account:
      "Na atividade de listening, foi necessário repetir as instruções e destacar palavras de referência antes da resposta.",
    initialResponse:
      "Repetido o trecho com apoio visual e conferida a compreensão de uma instrução por vez.",
  },
  OTHER: {
    title: "Organização da troca de atividade",
    account:
      "Na troca entre as atividades, o aluno precisou de orientação adicional para localizar a página e organizar a sequência de tarefas.",
    initialResponse:
      "Apresentada a sequência no quadro e conferido o próximo passo junto ao aluno.",
  },
} as const;
export type SeedOccurrenceCategory = keyof typeof OCCURRENCE_EXAMPLES;
export type InterventionVariant =
  | "open"
  | "open-overdue"
  | "progress"
  | "progress-overdue"
  | "concluded"
  | "reopened";
export type FollowUpScenario = {
  key: string;
  studentIndex: number;
  category: SeedOccurrenceCategory;
  daysAgo: readonly number[];
  related?: boolean;
  intervention?: {
    variant: InterventionVariant;
    title: string;
    objective: string;
    nextStep: string;
    outcome: string;
  };
};

const SINGLE_STUDENT_INDICES = [0, 19, 38, 51, 63, 83, 95, 108, 121, 137, 164, 191];
const CATEGORIES = Object.keys(OCCURRENCE_EXAMPLES) as SeedOccurrenceCategory[];
const SINGLES: FollowUpScenario[] = SINGLE_STUDENT_INDICES.map((studentIndex, index) => ({
  key: `point-${index + 1}`,
  studentIndex,
  category: CATEGORIES[index % CATEGORIES.length]!,
  daysAgo: [3 + index * 2],
}));
const RELATED: FollowUpScenario[] = [12, 57, 132, 205].map((studentIndex, index) => ({
  key: `related-${index + 1}`,
  studentIndex,
  category: CATEGORIES[index % CATEGORIES.length]!,
  daysAgo: [28, 14],
  related: true,
}));
const INTERVENTIONS: FollowUpScenario[] = [
  {
    key: "material-open",
    studentIndex: 27,
    category: "MATERIAL",
    daysAgo: [18, 11, 4],
    intervention: {
      variant: "open",
      title: "Organização do material antes da aula",
      objective: "Ampliar a autonomia para separar os itens usados nas atividades.",
      nextStep: "Combinar uma lista curta de materiais e conferir sua utilização em duas aulas.",
      outcome:
        "Nas duas observações seguintes, o aluno localizou os materiais combinados com autonomia.",
    },
  },
  {
    key: "homework-open-overdue",
    studentIndex: 70,
    category: "HOMEWORK",
    daysAgo: [35, 28, 21],
    intervention: {
      variant: "open-overdue",
      title: "Retomada das etapas da atividade de casa",
      objective: "Estabelecer uma rotina possível para concluir as etapas combinadas.",
      nextStep:
        "Conversar com o aluno sobre a rotina e definir uma etapa curta para a próxima aula.",
      outcome:
        "O aluno apresentou as etapas combinadas e explicou como organizou o tempo de realização.",
    },
  },
  {
    key: "oral-progress",
    studentIndex: 94,
    category: "PARTICIPATION",
    daysAgo: [35, 25, 15],
    intervention: {
      variant: "progress",
      title: "Preparação gradual para a prática oral",
      objective:
        "Participar de trocas orais com tempo de preparação e apoio progressivamente menor.",
      nextStep: "Manter preparação em dupla e observar a passagem para uma fala curta sem leitura.",
      outcome:
        "O aluno realizou duas falas curtas com preparação prévia e menor dependência do modelo escrito.",
    },
  },
  {
    key: "listening-progress-overdue",
    studentIndex: 129,
    category: "LEARNING",
    daysAgo: [50, 40, 30],
    intervention: {
      variant: "progress-overdue",
      title: "Acompanhamento de instruções em listening",
      objective:
        "Identificar instruções curtas com palavras de referência e conferir a compreensão.",
      nextStep: "Rever o apoio usado nas últimas aulas e combinar uma nova observação com o aluno.",
      outcome:
        "Em duas atividades, o aluno identificou as instruções com uma repetição e apoio visual reduzido.",
    },
  },
  {
    key: "turns-concluded",
    studentIndex: 146,
    category: "BEHAVIOR",
    daysAgo: [60, 50, 40],
    intervention: {
      variant: "concluded",
      title: "Combinados de escuta nas atividades em grupo",
      objective: "Organizar os turnos de fala e retomar instruções antes da atividade em grupo.",
      nextStep: "Manter os combinados de escuta e observar sua continuidade na rotina da turma.",
      outcome:
        "Nas duas últimas observações, o aluno aguardou o turno de fala e retomou a instrução antes de iniciar a atividade.",
    },
  },
  {
    key: "routine-reopened",
    studentIndex: 193,
    category: "OTHER",
    daysAgo: [65, 55, 45],
    intervention: {
      variant: "reopened",
      title: "Autonomia na organização das atividades",
      objective:
        "Localizar materiais e seguir a sequência de tarefas com apoio gradualmente menor.",
      nextStep:
        "Ampliar a lista visual para atividades novas e observar a organização em outra sequência de tarefas.",
      outcome:
        "O aluno organizou a sequência de duas atividades conhecidas usando a lista visual combinada.",
    },
  },
];

export const PEDAGOGICAL_FOLLOW_UP_SCENARIOS: readonly FollowUpScenario[] = [
  ...SINGLES,
  ...RELATED,
  ...INTERVENTIONS,
];
