import type { Address, Guardian, Student } from "@lazuli/db";

import { toWhatsAppUrl } from "@lazuli/domain";

import { toDateOnlyString } from "./date-rules.js";

type AddressProfile = {
  city: string | null;
  complement: string | null;
  id: string;
  neighborhood: string | null;
  number: string | null;
  postalCode: string | null;
  state: string | null;
  street: string | null;
};

type GuardianProfile = {
  address: AddressProfile | null;
  documentNumber: string | null;
  documentType: string | null;
  email: string | null;
  fullName: string;
  id: string;
  phone: string | null;
  relationship: string | null;
};

type StudentRecord = Student & {
  address: Address | null;
  guardian: (Guardian & { address: Address | null }) | null;
};

export type StudentProfile = {
  address: AddressProfile | null;
  attendanceSummary: { semesters: [] };
  classes: [];
  contact: {
    birthDate: string | null;
    documentNumber: string | null;
    documentType: string | null;
    email: string | null;
    fullName: string;
    phone: string | null;
    status: string;
  };
  finance: { installments: []; openOrders: []; paymentHistory: [] };
  guardian: GuardianProfile | null;
  id: string;
  notes: string | null;
  whatsAppUrl: string | null;
};

export function toStudentProfile(student: StudentRecord): StudentProfile {
  return {
    id: student.id,
    contact: {
      birthDate: toDateOnlyString(student.birthDate),
      documentNumber: student.documentNumber,
      documentType: student.documentType,
      email: student.email,
      fullName: student.fullName,
      phone: student.phone,
      status: student.status,
    },
    address: toAddressProfile(student.address),
    guardian: toGuardianProfile(student.guardian),
    notes: student.notes,
    whatsAppUrl: toWhatsAppUrl(student.phone),
    classes: [],
    attendanceSummary: { semesters: [] },
    finance: { openOrders: [], installments: [], paymentHistory: [] },
  };
}

function toGuardianProfile(guardian: StudentRecord["guardian"]): GuardianProfile | null {
  if (guardian === null) {
    return null;
  }

  return {
    id: guardian.id,
    address: toAddressProfile(guardian.address),
    documentNumber: guardian.documentNumber,
    documentType: guardian.documentType,
    email: guardian.email,
    fullName: guardian.fullName,
    phone: guardian.phone,
    relationship: guardian.relationship,
  };
}

function toAddressProfile(address: Address | null): AddressProfile | null {
  if (address === null) {
    return null;
  }

  return {
    id: address.id,
    city: address.city,
    complement: address.complement,
    neighborhood: address.neighborhood,
    number: address.number,
    postalCode: address.postalCode,
    state: address.state,
    street: address.street,
  };
}
