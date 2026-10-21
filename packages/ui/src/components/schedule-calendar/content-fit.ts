/** Measure the rendered card, including content hidden by responsive density rules. */
export function calendarCardNeedsExpansion(element: HTMLElement): boolean {
  // Keep the open card stable until pointer/focus leaves; never measure its expanded width
  // as evidence that the resting card fits.
  if (element.dataset.expanded === "true") return true;
  if (element.querySelector(".lz-calendar-overflow")) return false;
  const content = element.querySelector<HTMLElement>(".rbc-event-content");
  if (!content) return false;
  const nodes = [content, ...content.querySelectorAll<HTMLElement>("*")];
  return nodes.some((node) => {
    if (!(node instanceof HTMLElement) || !node.textContent?.trim()) return false;
    if (node.getClientRects().length === 0) return Object.hasOwn(node.dataset, "calendarDetail");
    return node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
  });
}
