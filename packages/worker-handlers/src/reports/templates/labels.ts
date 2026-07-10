/** pt-BR labels for enum values shown in generated reports (§8). */

import type {
  InstallmentDisplayStatus,
  MakeupDisplayStatus,
  OrderDisplayStatus,
} from "@lazuli/domain";

const INSTALLMENT_STATUS_LABELS = new Map<InstallmentDisplayStatus, string>([
  ["WAIVED", "Isenta"],
  ["PAID", "Paga"],
  ["OVERDUE", "Vencida"],
  ["DUE_THIS_MONTH", "Vence este mês"],
  ["UPCOMING", "A vencer"],
]);

const ORDER_STATUS_LABELS = new Map<OrderDisplayStatus, string>([
  ["CANCELLED", "Cancelado"],
  ["COMPLETED", "Quitado"],
  ["ACTIVE", "Ativo"],
]);

const ORDER_KIND_LABELS = new Map<string, string>([
  ["TUITION", "Mensalidade"],
  ["ENROLLMENT_FEE", "Matrícula"],
  ["MATERIAL", "Material"],
  ["OTHER", "Outro"],
]);

const PAYMENT_METHOD_LABELS = new Map<string, string>([
  ["PIX", "Pix"],
  ["CASH", "Dinheiro"],
  ["TRANSFER", "Transferência"],
  ["CARD", "Cartão"],
  ["CHEQUE", "Cheque"],
  ["BOLETO", "Boleto"],
  ["OTHER", "Outro"],
]);

const WEEKDAY_LABELS = new Map<string, string>([
  ["MONDAY", "Segunda-feira"],
  ["TUESDAY", "Terça-feira"],
  ["WEDNESDAY", "Quarta-feira"],
  ["THURSDAY", "Quinta-feira"],
  ["FRIDAY", "Sexta-feira"],
  ["SATURDAY", "Sábado"],
  ["SUNDAY", "Domingo"],
]);

const MAKEUP_STATUS_LABELS = new Map<MakeupDisplayStatus, string>([
  ["CANCELLED", "Cancelada"],
  ["ATTENDED", "Realizada"],
  ["NO_SHOW", "Falta"],
  ["SCHEDULED", "Agendada"],
]);

export function installmentStatusLabel(status: InstallmentDisplayStatus): string {
  return INSTALLMENT_STATUS_LABELS.get(status) ?? status;
}

export function orderStatusLabel(status: OrderDisplayStatus): string {
  return ORDER_STATUS_LABELS.get(status) ?? status;
}

export function orderKindLabel(kind: string): string {
  return ORDER_KIND_LABELS.get(kind) ?? kind;
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS.get(method) ?? method;
}

export function weekdayLabel(weekday: string): string {
  return WEEKDAY_LABELS.get(weekday) ?? weekday;
}

export function makeupStatusLabel(status: MakeupDisplayStatus): string {
  return MAKEUP_STATUS_LABELS.get(status) ?? status;
}
