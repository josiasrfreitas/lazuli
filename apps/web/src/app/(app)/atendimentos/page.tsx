import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string }>;
}): Promise<void> {
  const { aluno } = await searchParams;
  redirect(aluno ? `/aulas?aluno=${encodeURIComponent(aluno)}` : "/aulas");
}
