"use client";

import { useEffect, useRef, useState } from "react";
import { trpc, type QueryResult } from "~/lib/trpc";
import type { HomeData, PendingLesson } from "./home-parts";

const REFRESH_MS = 60_000;
export type HomeState = {
  home: QueryResult<HomeData>;
  pending: QueryResult<PendingLesson[]>;
  firstName: string | undefined;
  lesson: string | null;
  assessment: string | null;
  appointment: string | null;
  visit: string | null;
  setLesson: (id: string | null) => void;
  setAssessment: (id: string | null) => void;
  setAppointment: (id: string | null) => void;
  setVisit: (id: string | null) => void;
  celebration: string | null;
  dismissCelebration: () => void;
};

export function useTeacherHome(): HomeState {
  const home = trpc.teacherWorkspace.home.useQuery(undefined, { refetchInterval: REFRESH_MS });
  const pending = trpc.teacherWorkspace.pending.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
  });
  const me = trpc.me.useQuery();
  const [lesson, setLesson] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<string | null>(null);
  const [visit, setVisit] = useState<string | null>(null);
  const [celebration, dismissCelebration] = useHomeCelebration(pending.data?.length);
  const firstName = (home.data?.teacherName ?? me.data?.name)?.trim().split(/\s+/u)[0];
  return {
    home,
    pending,
    firstName,
    lesson,
    setLesson,
    assessment,
    setAssessment,
    appointment,
    setAppointment,
    visit,
    setVisit,
    celebration,
    dismissCelebration,
  };
}

function useHomeCelebration(count: number | undefined): [string | null, () => void] {
  const [message, setMessage] = useState<string | null>(null);
  const previousCount = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (count === undefined) return;
    if (previousCount.current !== undefined && count < previousCount.current)
      setMessage(
        count === 0
          ? "Diário em dia! Mais espaço para a próxima aula."
          : "Uma pendência a menos. Mais espaço para as próximas aulas.",
      );
    else if (previousCount.current !== undefined && count > previousCount.current) setMessage(null);
    previousCount.current = count;
  }, [count]);
  return [message, () => setMessage(null)];
}
