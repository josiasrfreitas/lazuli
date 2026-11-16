type Coverage = {
  id: string;
  status?: "PARTIAL" | "COMPLETED" | undefined;
  title?: string | undefined;
};
type Content = {
  planItems?: Coverage[] | undefined;
  planItemId?: string | null | undefined;
  planItemStatus?: "PARTIAL" | "COMPLETED" | undefined;
  planItemTitle?: string | undefined;
};
/** An explicit empty array clears coverage; absent arrays preserve legacy single-step records. */
export function recordedActivities(content: Content): Coverage[] {
  if (content.planItems !== undefined) return content.planItems;
  return content.planItemId
    ? [
        {
          id: content.planItemId,
          ...(content.planItemStatus ? { status: content.planItemStatus } : {}),
          ...(content.planItemTitle ? { title: content.planItemTitle } : {}),
        },
      ]
    : [];
}
