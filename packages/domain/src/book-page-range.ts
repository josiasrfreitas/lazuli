type Lesson = {
  id: string;
  title: string;
  pages: { id: string; number: number; activities: { id: string; title: string }[] }[];
};
export function bookPageRange(lessons: readonly Lesson[], start: number, end: number) {
  return lessons
    .flatMap((lesson) =>
      lesson.pages
        .filter((page) => page.number >= start && page.number <= end)
        .map((page) => ({ lessonId: lesson.id, lessonTitle: lesson.title, page })),
    )
    .sort((a, b) => a.page.number - b.page.number);
}
