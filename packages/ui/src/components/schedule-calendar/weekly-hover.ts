const CLOSE_DELAY_MS = 255;
type HoverLane = {
  id: string;
  lane: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  expandable?: boolean;
};
export type WeeklyHoverSample = {
  groupId: string;
  left: number;
  width: number;
  columns: number;
  clientX: number;
  clientY: number;
  lanes: HoverLane[];
  revealed?: boolean;
  targetId?: string;
};

/** Hit-test the rendered cards so expansion and clicking refer to the same visible lesson. */
export class WeeklyHover {
  private activeGroup: string | undefined;
  private closing: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly select: (id: string | null) => void) {}

  get groupId(): string | undefined {
    return this.activeGroup;
  }

  move(sample: WeeklyHoverSample): void {
    this.activeGroup = sample.groupId;
    const target = sample.lanes.find(
      (item) =>
        (!sample.targetId || sample.targetId === item.id) &&
        sample.clientX >= item.left &&
        sample.clientX < item.right &&
        sample.clientY >= item.top &&
        sample.clientY < item.bottom,
    );
    // Empty time slots belong to the open day; only leaving its horizontal bounds closes it.
    if (sample.revealed || !target) {
      this.cancelClose();
      return;
    }
    if (target.expandable === false) {
      this.leave();
      return;
    }
    this.cancelClose();
    this.select(target.id);
  }

  leave(): void {
    if (this.closing !== undefined) return;
    this.closing = setTimeout(() => {
      this.reset();
      this.select(null);
    }, CLOSE_DELAY_MS);
  }

  cancelClose(): void {
    clearTimeout(this.closing);
    this.closing = undefined;
  }

  reset(): void {
    this.cancelClose();
    this.activeGroup = undefined;
  }
}
