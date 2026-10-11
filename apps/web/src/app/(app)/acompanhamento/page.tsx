import type { Metadata } from "next";
import type { ReactElement } from "react";
import { FollowUpPage } from "~/features/pedagogical-follow-up/follow-up-page";
export const metadata: Metadata = { title: "Acompanhamento" };
export default function Page(): ReactElement {
  return <FollowUpPage />;
}
