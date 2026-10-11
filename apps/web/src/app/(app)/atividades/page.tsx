import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ActivityPage } from "~/features/activity/activity-page";
export const metadata: Metadata = { title: "Log de atividades" };
export default function ActivityRoute(): ReactElement {
  return <ActivityPage />;
}
