"use client";

import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";

import { trpc } from "~/lib/trpc";
import { useAnimationPreviewDelay } from "~/lib/animation-preview";

import { HomeArrival } from "./home-arrival";
import { HomeDefault } from "./home-default";

const PREVIEW_DELAY_MS = 1800;

export type InitialDashboardData = {
  home?: { data: RouterOutputs["dashboard"]["home"]; updatedAt: number };
  business?: { data: RouterOutputs["dashboard"]["business"]; updatedAt: number };
  pendingLessons?: {
    data: RouterOutputs["dashboard"]["pendingLessonSummaries"];
    updatedAt: number;
  };
};

export function AdminHome({
  name,
  canViewFinance,
  arriving = false,
  initial,
}: {
  name: string;
  canViewFinance: boolean;
  arriving?: boolean;
  initial?: InitialDashboardData;
}): ReactElement {
  const query = trpc.dashboard.home.useQuery(undefined, {
    refetchInterval: 60_000,
    ...(initial?.home
      ? { initialData: initial.home.data, initialDataUpdatedAt: initial.home.updatedAt }
      : {}),
  });
  const business = trpc.dashboard.business.useQuery(undefined, {
    enabled: canViewFinance,
    refetchInterval: 60_000,
    ...(initial?.business
      ? { initialData: initial.business.data, initialDataUpdatedAt: initial.business.updatedAt }
      : {}),
  });
  const previewReady = useAnimationPreviewDelay(PREVIEW_DELAY_MS);
  const entranceReady =
    previewReady && !query.isPending && (!query.data?.canViewFinance || !business.isPending);

  return (
    <>
      <HomeArrival enabled={arriving} ready={entranceReady} />
      <HomeDefault
        name={name}
        data={query.data}
        business={business.data}
        businessLoading={business.isPending}
        businessError={business.isError}
        initialLessons={initial?.pendingLessons}
        loading={query.isPending}
        error={query.isError}
        retry={() => void query.refetch()}
      />
    </>
  );
}
