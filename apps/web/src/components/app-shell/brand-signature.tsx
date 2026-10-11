import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@lazuli/ui";

/** The navigation and entrance both provide a dark surface for the signature. */
function BrandArtwork({ kind }: { kind: "symbol" | "symbol-small" | "wordmark" }): ReactNode {
  if (kind === "wordmark") {
    return (
      <svg aria-hidden="true" className="size-full text-brand" viewBox="0 0 330 100">
        <image height="100" href="/brand/lazuli-wordmark-dark.svg" width="320" />
        <circle data-brand-dot cx="317" cy="69" fill="currentColor" r="5" />
      </svg>
    );
  }

  return (
    <Image
      alt=""
      className="size-full object-contain"
      height={100}
      width={100}
      src={`/brand/lazuli-${kind}-dark.svg`}
    />
  );
}

export function BrandSignature({
  entry = false,
  expanded = false,
}: {
  entry?: boolean;
  expanded?: boolean;
}): ReactNode {
  return (
    <p aria-label="Lazuli" className="flex items-center" role="img">
      <span aria-hidden="true" className={entry ? "size-16 shrink-0" : "size-8 shrink-0"}>
        <BrandArtwork kind={entry ? "symbol" : "symbol-small"} />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          entry ? "-ml-1.5 h-16 w-52" : "h-8 w-28",
          !entry &&
            !expanded &&
            "opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:opacity-100 motion-reduce:transition-none",
        )}
      >
        <BrandArtwork kind="wordmark" />
      </span>
    </p>
  );
}
