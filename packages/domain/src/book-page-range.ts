type Lesson = {
  id: string;
  title: string;
  pages: { id: string; number: number; activities: { id: string; title: string }[] }[];
};
type PageMatch = { lessonId: string; lessonTitle: string; page: Lesson["pages"][number] };
export function bookPageRange(
  lessons: readonly Lesson[],
  { start, end }: { start: number; end: number },
): PageMatch[] {
  return lessons
    .flatMap((lesson) =>
      lesson.pages
        .filter((page) => page.number >= start && page.number <= end)
        .map((page) => ({ lessonId: lesson.id, lessonTitle: lesson.title, page })),
    )
    .toSorted((left, right) => left.page.number - right.page.number);
}
