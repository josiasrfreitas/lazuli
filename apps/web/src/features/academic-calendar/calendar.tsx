"use client";

import { useRef, useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
import { useQueryState } from "nuqs";
import { RotateCcw } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { CalendarManagement } from "./management";
import { CalendarExecutionNotifications } from "./execution-notifications";
import { CalendarProcessing } from "./processing";
import { AcademicEventForm } from "./event-form";
import { CalendarChangeForm } from "./change-form";
import { AcademicDayAgenda } from "./day-agenda";
import { AcademicCalendarWorkspace } from "./workspace";
import { useAcademicCalendarNavigation } from "./navigation";
import { schoolDate, type CalendarEntry } from "./date-model";
import { calendarDay, type AcademicYear, type DayInfo } from "./model";
import { useCalendarPeriodData } from "./use-period-data";

type Editor =
  | { kind: "event"; date: string; item?: AcademicYear["events"][number] | undefined }
  | { kind: "period" | "interruption"; date?: string; id?: string };

export function AcademicCalendar(): ReactElement {
  const controller = useCalendarController();
  const { managing, query, navigation, pending, configure, openEditor, editEntry } = controller;
  return (
    <>
      <CalendarExecutionNotifications requests={query.data?.requests ?? []} />
      {renderChangeEditor(controller)}
      {managing && query.data && (
        <CalendarManagement
          data={query.data}
          year={navigation.year}
          section={controller.section ?? "semestres"}
          onSectionChange={(section) => configure(true, section)}
          onClose={() => configure(false)}
        />
      )}
      <AcademicCalendarWorkspace
        data={query.data}
        navigation={navigation}
        period={query.period}
        periods={query.periods}
        refreshing={query.isFetching}
        unavailable={Boolean(query.error && !query.data)}
        disabled={pending}
        onConfigure={(section) => configure(true, section)}
        onCreate={(date) => openEditor({ kind: "event", date })}
        onEdit={editEntry}
        onInterruption={(date) => openEditor({ kind: "interruption", date })}
        editor={renderEventEditor(controller)}
        notice={renderNotice(controller)}
        dailyAgenda={renderDailyAgenda(controller)}
      />
    </>
  );
}

type CalendarController = {
  managing: boolean;
  editor: Editor | null;
  pending: boolean;
  announcement: string;
  setPending: Dispatch<SetStateAction<boolean>>;
  setAnnouncement: Dispatch<SetStateAction<string>>;
  navigation: ReturnType<typeof useAcademicCalendarNavigation>;
  query: ReturnType<typeof useCalendarPeriodData>;
  openEditor: (value: Editor) => void;
  closeEditor: () => void;
  configure: (open: boolean, section?: string) => void;
  section: string | null;
  editEntry: (entry: CalendarEntry) => void;
  date: string | null;
  daily: boolean;
  day: DayInfo | null;
};
function useCalendarController(): CalendarController {
  const [section, setSection] = useQueryState("configurar");
  const managing = section !== null;
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const restoreFocus = useRef<HTMLElement | null>(null);
  const navigation = useAcademicCalendarNavigation();
  const query = useCalendarPeriodData(navigation);
  function openEditor(value: Editor): void {
    restoreFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor(value);
    setAnnouncement("");
  }
  function closeEditor(): void {
    setEditor(null);
    requestAnimationFrame(() => {
      if (restoreFocus.current?.isConnected) restoreFocus.current.focus();
    });
  }
  function configure(open: boolean, nextSection = "semestres"): void {
    void setSection(open ? nextSection : null);
  }
  function editEntry(entry: CalendarEntry): void {
    if (!entry.editor || pending) return;
    if (entry.editor === "event") {
      const item = query.data?.events.find((row) => row.id === entry.id);
      if (item) openEditor({ kind: "event", date: schoolDate(item.startsAt), item });
    } else openEditor({ kind: entry.editor, id: entry.id });
  }
  const { date, daily } = navigation.location;
  const day = date && query.data ? calendarDay(date, query.data) : null;
  return {
    managing,
    section,
    editor,
    pending,
    announcement,
    setPending,
    setAnnouncement,
    navigation,
    query,
    openEditor,
    closeEditor,
    configure,
    editEntry,
    date,
    daily,
    day,
  };
}
function renderChangeEditor({
  editor,
  query,
  closeEditor,
  setPending,
}: CalendarController): ReactElement | null {
  if (!editor || editor.kind === "event") return null;
  return (
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
  );
}
function renderEventEditor({
  editor,
  closeEditor,
  setPending,
  setAnnouncement,
}: CalendarController): ReactElement | undefined {
  return editor?.kind === "event" ? (
    <AcademicEventForm
      key={editor.item?.id ?? editor.date}
      inline
      item={editor.item}
      initialDate={editor.date}
      onClose={closeEditor}
      onPendingChange={setPending}
      onCompleted={setAnnouncement}
    />
  ) : undefined;
}
function renderNotice({ announcement, query }: CalendarController): ReactElement {
  return (
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
      {query.data && <CalendarProcessing requests={query.data.requests} />}
    </>
  );
}
const MONTH_START = 5;
const MONTH_END = 7;
function renderDailyAgenda({
  daily,
  date,
  query,
  navigation,
  openEditor,
  day,
}: CalendarController): ReactElement | undefined {
  return daily && date && query.data ? (
    <AcademicDayAgenda
      date={date}
      data={query.data}
      onDateChange={(value) =>
        navigation.setLocation({
          month: Number(value.slice(MONTH_START, MONTH_END)) - 1,
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
  ) : undefined;
}
