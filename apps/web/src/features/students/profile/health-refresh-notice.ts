import { createJobNotifier } from "~/features/shared/job-toast";

const notifier = createJobNotifier();
const titles: Record<string, string> = {
  STARTING: "Chamando o reforço para atualizar o score…",
  QUEUED: "Atualização do score na fila. Já vai!",
  RUNNING: "Conferindo o vínculo. Juntando as peças…",
  COMPLETED: "Score em dia. Vínculo no radar!",
};
export function notifyHealthRefresh(input: {
  studentId: string;
  state: string;
  description?: string | undefined;
  retry: () => void;
}): void {
  let outcome: "working" | "success" | "error" = "working";
  if (["FAILED", "CANCELLED", "UNAVAILABLE"].includes(input.state)) outcome = "error";
  if (input.state === "COMPLETED") outcome = "success";
  notifier.notify({
    key: input.studentId,
    state: input.state,
    outcome,
    title: titles[input.state] ?? "A atualização do score deu uma pausa. Vamos de novo?",
    description: input.description ?? "Saúde do vínculo deste aluno",
    retry: outcome === "error" ? input.retry : undefined,
  });
}
