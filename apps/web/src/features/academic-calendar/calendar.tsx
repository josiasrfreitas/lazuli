"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { CalendarManagement } from "./management";
import { CalendarProcessing } from "./processing";
import { AcademicEventForm } from "./event-form";
import { CalendarChangeForm } from "./change-form";
import { AcademicDayAgenda } from "./day-agenda";
import { AcademicCalendarWorkspace } from "./workspace";
import { useAcademicCalendarNavigation } from "./navigation";
import { schoolDate, type CalendarEntry } from "./date-model";
import { calendarDay, type AcademicYear } from "./model";
import { useCalendarPeriodData } from "./use-period-data";

type Editor =
  | { kind: "event"; date: string; item?: AcademicYear["events"][number] | undefined }
  | { kind: "period" | "interruption"; date?: string; id?: string };

export function AcademicCalendar() {
  const [managing, setManaging] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const restoreFocus = useRef<HTMLElement | null>(null);
  const calendarScroll = useRef(0);
  const navigation = useAcademicCalendarNavigation();
  const query = useCalendarPeriodData(navigation);
  function openEditor(value: Editor) {
    restoreFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor(value);
    setAnnouncement("");
  }
  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() => {
      if (restoreFocus.current?.isConnected) restoreFocus.current.focus();
    });
  }
  function configure(open: boolean) {
    const main = document.querySelector("main");
    if (open) calendarScroll.current = main?.scrollTop ?? 0;
    setManaging(open);
    requestAnimationFrame(() => {
      if (main) main.scrollTop = open ? 0 : calendarScroll.current;
    });
  }
  function editEntry(entry: CalendarEntry) {
    if (!entry.editor || pending) return;
    if (entry.editor === "event") {
      const item = query.data?.events.find((row) => row.id === entry.id);
      if (item) openEditor({ kind: "event", date: schoolDate(item.startsAt), item });
    } else openEditor({ kind: entry.editor, id: entry.id });
  }
  const { date, daily } = navigation.location;
  const day = date && query.data ? calendarDay(date, query.data) : null;
  return (
    <>
      {editor && editor.kind !== "event" && (
        <CalendarChangeForm
          key={`${editor.kind}:${editor.id ?? editor.date ?? "new"}`}
          mode={editor.kind}
          item={
            editor.kind === "period"
              ? query.data?.periods.find((row) => row.id === editor.id)
              : query.data?.interruptions.find((row) => row.id === editor.id)
          }
          initialDate={editor.date}
          onClose={closeEditor}
          onPendingChange={setPending}
        />
      )}
      {managing && query.data ? (
        <CalendarManagement
          data={query.data}
          year={navigation.year}
          onClose={() => configure(false)}
        />
      ) : (
        <AcademicCalendarWorkspace
          data={query.data}
          navigation={navigation}
          period={query.period}
          periods={query.periods}
          refreshing={query.isFetching}
          unavailable={Boolean(query.error && !query.data)}
          disabled={pending}
          onConfigure={() => configure(true)}
          onCreate={(date) => openEditor({ kind: "event", date })}
          onEdit={editEntry}
          onInterruption={(date) => openEditor({ kind: "interruption", date })}
          editor={
            editor?.kind === "event" ? (
              <AcademicEventForm
                key={editor.item?.id ?? editor.date}
                inline
                item={editor.item}
                initialDate={editor.date}
                onClose={closeEditor}
                onPendingChange={setPending}
                onCompleted={setAnnouncement}
              />
            ) : undefined
          }
          notice={
            <>
              {announcement && (
                <p role="status" className="text-caption text-interactive">
                  {announcement}
                </p>
              )}
              {query.error && (
                <Alert>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {query.data
                        ? "Não foi possível atualizar o calendário. As últimas informações continuam visíveis."
                        : "Não foi possível carregar as datas deste ano."}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
                      <RotateCcw aria-hidden="true" /> Tentar novamente
                    </Button>
                  </div>
                </Alert>
              )}
              {query.data && (
                <CalendarProcessing
                  requests={query.data.requests}
                  planWarnings={query.data.planWarnings}
                />
              )}
            </>
          }
          dailyAgenda={
            daily && date && query.data ? (
              <AcademicDayAgenda
                date={date}
                data={query.data}
                onDateChange={(value) =>
                  navigation.setLocation({
                    month: Number(value.slice(5, 7)) - 1,
                    date: value,
                    daily: true,
                  })
                }
                onEditEvent={(id) => {
                  const item = query.data?.events.find((row) => row.id === id);
                  if (item) openEditor({ kind: "event", date: schoolDate(item.startsAt), item });
                }}
                suspension={day?.kind === "holiday" ? day.label : undefined}
              />
            ) : undefined
          }
        />
      )}
    </>
  );
}
