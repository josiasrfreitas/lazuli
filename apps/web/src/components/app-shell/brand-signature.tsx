import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@lazuli/ui";

/** Use the matching brand artwork without waiting for client theme hydration. */
function BrandArtwork({
  kind,
  onNavy,
}: {
  kind: "symbol" | "symbol-small" | "wordmark";
  onNavy: boolean;
}): ReactNode {
  if (kind === "wordmark") {
    return (
      <svg aria-hidden="true" className="size-full text-brand" viewBox="0 0 330 100">
        <image
          className={onNavy ? "hidden" : "dark:hidden"}
          height="100"
          href="/brand/lazuli-wordmark-light.svg"
          width="320"
        />
        <image
          className={onNavy ? undefined : "hidden dark:block"}
          height="100"
          href="/brand/lazuli-wordmark-dark.svg"
          width="320"
        />
        <circle data-brand-dot cx="317" cy="69" fill="currentColor" r="5" />
      </svg>
    );
  }

  return (
    <>
      <Image
        alt=""
        className={cn("size-full object-contain", onNavy ? "hidden" : "dark:hidden")}
        height={100}
        width={100}
        src={`/brand/lazuli-${kind}-light.svg`}
        loading="eager"
      />
      <Image
        alt=""
        className={cn("size-full object-contain", !onNavy && "hidden dark:block")}
        height={100}
        width={100}
        src={`/brand/lazuli-${kind}-dark.svg`}
        loading="eager"
      />
    </>
  );
}

export function BrandSignature({
  entry = false,
  onNavy = false,
  expanded = false,
}: {
  entry?: boolean;
  onNavy?: boolean;
  expanded?: boolean;
}): ReactNode {
  return (
    <p aria-label="Lazuli" className="flex items-center" role="img">
      <span
        aria-hidden="true"
        data-brand-symbol
        className={entry ? "size-16 shrink-0" : "size-8 shrink-0"}
      >
        <BrandArtwork onNavy={onNavy} kind={entry ? "symbol" : "symbol-small"} />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          entry ? "-ml-1.5 h-16 w-52" : "h-8 w-28",
          !entry &&
            !expanded &&
            "opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:opacity-100 group-has-[[data-popup-open]]/sidebar:opacity-100 motion-reduce:transition-none",
        )}
      >
        <BrandArtwork onNavy={onNavy} kind="wordmark" />
      </span>
    </p>
  );
}
