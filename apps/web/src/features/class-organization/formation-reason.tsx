import {
  Activity,
  Ban,
  BookOpen,
  CalendarClock,
  CalendarMinus,
  CalendarX,
  ChartNoAxesColumnDecreasing,
  ClipboardList,
  DoorClosed,
  DoorOpen,
  FileClock,
  FileX,
  Flag,
  GraduationCap,
  Layers,
  Link2Off,
  MessageSquare,
  NotebookPen,
  Repeat2,
  Route,
  Signpost,
  UserRoundX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { blockerRisk, type AttentionReason, type Risk } from "./attention-reasons";
import styles from "./formation-reason.module.css";

const riskIcons = {
  classClosed: DoorClosed,
  lowGrade: ChartNoAxesColumnDecreasing,
  incomplete: ClipboardList,
  lowAttendance: CalendarX,
  missingAttendance: CalendarMinus,
  lowHealth: Activity,
  missingContract: FileX,
  earlyContractEnd: FileClock,
  change: Repeat2,
  unassigned: Signpost,
  leaving: DoorOpen,
  staff: Flag,
  material: BookOpen,
  other: MessageSquare,
} satisfies Record<Risk, LucideIcon>;

const placementIcons = new Map<string, LucideIcon>([
  ["Professor pendente na data de entrada", Users],
  ["Turma de destino indisponível", Signpost],
  ["Cadastro do aluno não está ativo", UserRoundX],
  ["Defina o estágio de destino", Layers],
  ["Estágio diferente do estágio da turma regular", Layers],
  ["Continuidade deve preservar o estágio", Layers],
  ["Continuidade no mesmo estágio exige origem e destino PPT", Layers],
  ["Avanço exige o próximo estágio da mesma trilha", Route],
  ["Percurso de origem mudou; revise a proposta", Route],
  ["Repetência deve manter o estágio", Repeat2],
  ["Confirmação de repetência pendente", Repeat2],
  ["Aprovação pedagógica pendente", GraduationCap],
  ["O plano ou a avaliação PPT mudou após a publicação", NotebookPen],
  ["Entrada nova não pode substituir um vínculo vigente", Link2Off],
  ["A entrada programada mudou", CalendarClock],
  ["A entrada antecede o início da turma.", CalendarClock],
  ["Revise a vigência: a data proposta já passou", CalendarClock],
  ["Vigência fora do período letivo", CalendarClock],
]);

export function FormationReason({ reason }: { reason: AttentionReason }) {
  const risk =
    reason.risk && Object.hasOwn(riskIcons, reason.risk)
      ? (reason.risk as Risk)
      : reason.blocker && blockerRisk(reason.blocker);
  const Icon = risk ? riskIcons[risk] : (placementIcons.get(reason.label) ?? Ban);
  return (
    <span className={styles.reason} data-blocking={reason.blocker ? true : undefined}>
      <Icon aria-hidden="true" size={15} />
      <span>{reason.label}</span>
    </span>
  );
}
