import { InlineSkeleton } from "@lazuli/ui";
import styles from "./catalog.module.css";

export function StageLoading(): React.JSX.Element {
  return (
    <div aria-label="Carregando catálogo" aria-busy="true" className="grid gap-4 py-3">
      <InlineSkeleton className="h-6 w-32" />
      <InlineSkeleton className="h-4 w-56" />
      <InlineSkeleton className="h-10 w-full" />
      <InlineSkeleton className="h-10 w-full" />
    </div>
  );
}

export function TrackListLoading(): React.JSX.Element {
  return (
    <div role="status">
      <span className="sr-only">Carregando tracks e estágios…</span>
      {["w-28", "w-36", "w-24", "w-32", "w-28"].map((width, index) => (
        <div key={index} className={styles.track} aria-hidden="true">
          <div className={styles.loadingTrack}>
            <InlineSkeleton shape="block" className="size-3" />
            <div className={styles.loadingIdentity}>
              <div className={width}>
                <InlineSkeleton shape="block" className="w-full" />
              </div>
              <InlineSkeleton className="h-2 w-24" />
            </div>
            <InlineSkeleton className="h-2 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}
