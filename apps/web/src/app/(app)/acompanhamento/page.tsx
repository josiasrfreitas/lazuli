import { redirect } from "next/navigation";
import { z } from "@lazuli/validators";
import { studentFollowUpHref } from "~/features/pedagogical-follow-up/student-navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string }>;
}): Promise<never> {
  const { aluno } = await searchParams;
  const student = z.string().uuid().safeParse(aluno);
  redirect(student.success ? studentFollowUpHref(student.data) : "/alunos");
}
