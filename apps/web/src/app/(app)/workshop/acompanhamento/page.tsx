import type { ReactElement } from "react";
import { workshopEnabled } from "~/features/students/follow-up-workshop/config";
import { notFound } from "next/navigation";
import { FollowUpWorkshop } from "~/features/students/follow-up-workshop/workshop";

export const metadata = { title: "Workshop · Acompanhamento no aluno" };

export default function WorkshopPage(): ReactElement {
  if (!workshopEnabled) notFound();
  return <FollowUpWorkshop />;
}
