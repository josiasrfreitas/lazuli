const CLOSE_DELAY_MS = 300;

type HoverLane = { id: string; lane: number; top: number; bottom: number };
export type WeeklyHoverSample = {
  groupId: string;
  left: number;
  width: number;
  columns: number;
  clientX: number;
  clientY: number;
  lanes: HoverLane[];
  revealed?: boolean;
};

type Anchor = Pick<WeeklyHoverSample, "groupId" | "left" | "width" | "columns">;

/** Freeze the horizontal hit zones while cards resize, so a sweep never chases moving edges. */
export class WeeklyHover {
  private anchor: Anchor | null = null;
  private closing: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly select: (id: string | null) => void) {}

  get groupId(): string | undefined {
    return this.anchor?.groupId;
  }

  move(sample: WeeklyHoverSample): void {
    if (this.anchor?.groupId !== sample.groupId || sample.revealed) this.anchor = sample;
    const { left, width, columns } = this.anchor;
    const lane = Math.max(
      0,
      Math.min(columns - 1, Math.floor(((sample.clientX - left) / width) * columns)),
    );
    const target = sample.lanes.find(
      (item) => item.lane === lane && sample.clientY >= item.top && sample.clientY < item.bottom,
    );
    if (!target) {
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
    this.anchor = null;
  }
}
