"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCheck, Clock3, UserRound } from "lucide-react";
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@lazuli/ui";
import { calendarDate, lessonStates, type CalendarLesson } from "./calendar-model";
import styles from "./calendar.module.css";

export function CalendarLessonCard({ lesson }: { lesson: CalendarLesson }) {
  return (
    <Popover>
      <PopoverTrigger
        className={styles.lesson}
        data-state={lesson.state}
        aria-label={`${lesson.className}, ${lesson.teacher ?? "Professor a definir"}, ${lesson.startTime} às ${lesson.endTime}, ${lessonStates[lesson.state]}`}
      >
        <span className={styles.lessonTitle}>{lesson.className}</span>
        <span className={styles.lessonTeacher}>{lesson.teacher ?? "Professor a definir"}</span>
        <span className={styles.lessonMeta}>
          <span>{lesson.endTime}</span>
          <span className={styles.state}>
            <span className={styles.dot} />
            {lessonStates[lesson.state]}
          </span>
        </span>
        {lesson.attendanceOnly && <span className={styles.attendance}>Chamada confirmada</span>}
      </PopoverTrigger>
      <PopoverContent size="md" align="start" showArrow={false}>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <PopoverTitle>{lesson.className}</PopoverTitle>
            <PopoverDescription>
              {calendarDate(lesson.date, { weekday: "long", day: "numeric", month: "long" })}
            </PopoverDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                lesson.state === "RECORDED"
                  ? "success"
                  : lesson.state === "PENDING"
                    ? "warning"
                    : "neutral"
              }
            >
              {lessonStates[lesson.state]}
            </Badge>
            <Badge variant="neutral">{lesson.scheduleType === "REGULAR" ? "Regular" : "PPT"}</Badge>
          </div>
          <div className="grid gap-2 text-caption">
            <p className="flex items-center gap-2">
              <Clock3 aria-hidden className="size-4 text-muted-foreground" />
              {lesson.startTime}–{lesson.endTime}
            </p>
            <p className="flex items-center gap-2">
              <UserRound aria-hidden className="size-4 text-muted-foreground" />
              {lesson.teacher ?? "Professor a definir"}
            </p>
            {lesson.attendanceOnly && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <CheckCheck aria-hidden className="size-4 shrink-0" />
                Chamada confirmada. Conteúdo a registrar.
              </p>
            )}
          </div>
          <Button nativeButton={false} render={<Link href={`/aulas/${lesson.id}`} />}>
            Abrir aula <ArrowUpRight />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
