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
export type FollowUpScenario = {
  key: string;
  studentIndex: number;
  category: SeedOccurrenceCategory;
  daysAgo: readonly number[];
  related?: boolean;
  intervention?: {
    title: string;
    treatment: string;
    evolution: string;
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
      title: "Organização do material antes da aula",
      treatment:
        "Conversei com a mãe por telefone sobre as aulas em que o aluno ficou sem o livro. Ela explicou que o material fica em outra mochila. Combinamos separar o livro na noite anterior; disponibilizei uma cópia para a atividade de hoje.",
      evolution:
        "O aluno trouxe o livro nas duas aulas seguintes e realizou as atividades com o próprio material.",
    },
  },
  {
    key: "homework-open-overdue",
    studentIndex: 70,
    category: "HOMEWORK",
    daysAgo: [35, 28, 21],
    intervention: {
      title: "Retomada das etapas da atividade de casa",
      treatment:
        "Conversei com o aluno após a aula. Ele relatou dificuldade para conciliar a tarefa com as provas da escola. Retomamos juntos os dois primeiros exercícios e combinamos entregar o restante na próxima aula. Enviei o combinado à família.",
      evolution:
        "O aluno entregou três dos cinco exercícios. Corrigimos as dúvidas em sala. A família ainda não respondeu à mensagem.",
    },
  },
  {
    key: "oral-progress",
    studentIndex: 94,
    category: "PARTICIPATION",
    daysAgo: [35, 25, 15],
    intervention: {
      title: "Preparação gradual para a prática oral",
      treatment:
        "Conversei com o aluno em particular sobre o receio de falar inglês diante da turma. Fizemos um ensaio curto e ele escolheu apresentar o diálogo com um colega, usando palavras-chave no caderno.",
      evolution:
        "Na aula seguinte, apresentou o diálogo em dupla. Consultou o caderno algumas vezes e respondeu a uma pergunta sem ler.",
    },
  },
  {
    key: "listening-progress-overdue",
    studentIndex: 129,
    category: "LEARNING",
    daysAgo: [50, 40, 30],
    intervention: {
      title: "Acompanhamento de instruções em listening",
      treatment:
        "Revimos juntos a atividade de listening após a aula. O aluno compreendeu o vocabulário, mas se perdeu ao ouvir todas as instruções de uma vez. Repeti o áudio em trechos e pedi que explicasse o que precisava fazer antes de responder.",
      evolution:
        "Conseguiu realizar a primeira parte com uma repetição do áudio. Na segunda, ainda precisou que eu dividisse a instrução em etapas.",
    },
  },
  {
    key: "turns-concluded",
    studentIndex: 146,
    category: "BEHAVIOR",
    daysAgo: [60, 50, 40],
    intervention: {
      title: "Combinados de escuta nas atividades em grupo",
      treatment:
        "Ouvi o aluno e o colega separadamente após a discussão durante o trabalho em grupo. Conversamos juntos sobre o que ocorreu e combinamos alternar os turnos de fala. Os dois retomaram a atividade e finalizaram o diálogo.",
      evolution:
        "Na atividade em grupo desta semana, os dois trabalharam juntos sem nova discussão. Foi necessário apenas um lembrete sobre o turno de fala.",
    },
  },
  {
    key: "routine-reopened",
    studentIndex: 193,
    category: "OTHER",
    daysAgo: [65, 55, 45],
    intervention: {
      title: "Autonomia na organização das atividades",
      treatment:
        "Sentei com o aluno no início da aula e organizamos o livro, o caderno e a atividade impressa. Anotamos três passos no canto do quadro. Ele conferiu cada etapa antes de passar para a seguinte.",
      evolution:
        "Usou a lista sozinho na primeira atividade. Quando mudamos para uma tarefa nova, pediu ajuda para localizar a página e retomou o trabalho após a orientação.",
    },
  },
];

export const PEDAGOGICAL_FOLLOW_UP_SCENARIOS: readonly FollowUpScenario[] = [
  ...SINGLES,
  ...RELATED,
  ...INTERVENTIONS,
];
