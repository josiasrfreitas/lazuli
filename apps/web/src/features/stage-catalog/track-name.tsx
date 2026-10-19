import { Badge } from "@lazuli/ui";
import type { StageSummary } from "./types";
import styles from "./catalog.module.css";

export function TrackName({ track }: { track: StageSummary["track"] }) {
  const legacy = track.status === "LEGACY";
  const name = legacy ? track.name.replace(/\s+Legacy$/i, "") : track.name;

  return (
    <span className={styles.trackName}>
      <span>{name}</span>
      {legacy && <Badge variant="neutral">Legacy</Badge>}
    </span>
  );
}
