import type {
  ClassRecordContent,
  ClassRecordSnapshot,
} from "../../packages/validators/src/class-records.js";

const FIRST_CONTENT_PAGE = 6;
const CONTENT_PAGE_CYCLE = 14;
const REFERENCE_PRACTICE_CYCLE = 8;

const ACTIVITIES = [
  "CONTENT",
  "CONTENT",
  "REVIEW",
  "CONTENT",
  "ACTIVITY",
  "CONTENT",
  "ASSESSMENT",
  "CONTENT",
  "REVIEW",
  "CONTENT",
] as const;
const TOPICS = [
  "perguntas pessoais e respostas completas",
  "rotina e preferências",
  "descrição de pessoas e lugares",
  "relato de experiências",
  "pedidos e situações do cotidiano",
  "planos e possibilidades",
];
const CHILD_TOPICS = [
  "cores e objetos da sala",
  "família e amigos",
  "animais e movimentos",
  "brinquedos e brincadeiras",
  "alimentos e preferências",
  "casa e escola",
];

/** Actual accounts are authored independently of plan pages, titles and completion. */
export function performedContent(input: {
  stage: string | null;
  variation: number;
  review?: boolean;
}): ClassRecordContent {
  const child = input.stage?.startsWith("Magic Way") ?? false;
  const topic = (child ? CHILD_TOPICS : TOPICS)[input.variation % TOPICS.length]!;
  const kind = input.review ? "REVIEW" : ACTIVITIES[input.variation % ACTIVITIES.length]!;
  const account = contentAccount(kind, { child, topic });
  const pageFrom =
    kind === "CONTENT" ? FIRST_CONTENT_PAGE + (input.variation % CONTENT_PAGE_CYCLE) * 2 : null;
  return {
    kind,
    account,
    reference:
      kind === "CONTENT" || kind === "REVIEW"
        ? `Material ${input.stage ?? "do estágio"} — prática ${1 + (input.variation % REFERENCE_PRACTICE_CYCLE)}`
        : null,
    pageFrom,
    pageTo: pageFrom === null ? null : pageFrom + 1,
  };
}

function contentAccount(
  kind: ClassRecordContent["kind"],
  { child, topic }: { child: boolean; topic: string },
): string {
  return {
    CONTENT: child
      ? `Praticamos ${topic} com imagens, escuta e uso das expressões em pequenos grupos.`
      : `Trabalhamos ${topic} com leitura breve, prática guiada e diálogo em duplas.`,
    REVIEW: `Retomamos ${topic}, esclarecemos dúvidas e repetimos a prática oral com novas situações.`,
    ASSESSMENT: `Realizada verificação de compreensão e expressão sobre ${topic}, com orientações individuais ao final.`,
    ACTIVITY: child
      ? `Jogo de escuta, identificação e interação sobre ${topic}.`
      : `Atividade colaborativa de diálogo e produção curta sobre ${topic}.`,
  }[kind];
}

export function copyClassSnapshot(snapshot: ClassRecordSnapshot): ClassRecordSnapshot {
  return {
    ...snapshot,
    sharedContent: snapshot.sharedContent ? { ...snapshot.sharedContent } : null,
    entries: snapshot.entries.map((row) => ({
      ...row,
      content: row.content ? { ...row.content } : null,
    })),
  };
}

export function correctedContent(content: ClassRecordContent): ClassRecordContent {
  return {
    ...content,
    account: `${content.account} O registro inclui a prática de escuta e a devolutiva realizada ao final do encontro.`,
  };
}
