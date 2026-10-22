"use client";
import type { JSX as ReactJSX } from "react";
import { useOrganizationPageModel } from "./page-model";
import { OrganizationPageView } from "./page-view";
export { OrganizationLoading } from "./page-loading";

export function ClassOrganizationPage(): ReactJSX.Element {
  const model = useOrganizationPageModel();
  return <OrganizationPageView model={model} />;
}
