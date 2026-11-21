import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ docente?: string }>;
}): Promise<never> {
  const { docente } = await searchParams;
  redirect(
    docente ? `/professor/agenda?docente=${encodeURIComponent(docente)}` : "/professor/agenda",
  );
}
