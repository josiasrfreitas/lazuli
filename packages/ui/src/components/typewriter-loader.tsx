import type { ReactElement } from "react";

export type TypewriterLoaderProps = { label?: string };

export function TypewriterLoader({ label = "Carregando" }: TypewriterLoaderProps): ReactElement {
  return (
    <div className="lz-typewriter-loader-wrapper" role="status" aria-label={label}>
      <div className="lz-typewriter-loader-typewriter" aria-hidden="true">
        <div className="lz-typewriter-loader-slide">
          <i />
        </div>
        <div className="lz-typewriter-loader-paper" />
        <div className="lz-typewriter-loader-keyboard" />
      </div>
    </div>
  );
}
