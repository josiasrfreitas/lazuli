"use client";

import type { ReactElement } from "react";

import { trpc } from "~/lib/trpc";
import { useAnimationPreviewDelay } from "~/lib/animation-preview";

import { HomeArrival } from "./home-arrival";
import { HomeDefault } from "./home-default";

export function AdminHome({
  name,
  arriving = false,
}: {
  name: string;
  arriving?: boolean;
}): ReactElement {
  const query = trpc.dashboard.home.useQuery(undefined, { refetchInterval: 60_000 });
  const business = trpc.dashboard.business.useQuery(undefined, {
    enabled: query.data?.canViewFinance === true,
    refetchInterval: 60_000,
  });
  const previewReady = useAnimationPreviewDelay(1800);
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
        loading={query.isPending}
        error={query.isError}
        retry={() => void query.refetch()}
      />
    </>
  );
}
