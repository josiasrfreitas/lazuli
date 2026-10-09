import Image from "next/image";
import type { ReactNode } from "react";

function BrandArtwork({ kind }: { kind: "symbol-small" | "wordmark" }): ReactNode {
  const dimensions =
    kind === "wordmark" ? { width: 320, height: 100 } : { width: 100, height: 100 };
  return (
    <>
      <Image
        alt=""
        className="size-full object-contain dark:hidden"
        height={dimensions.height}
        width={dimensions.width}
        src={`/brand/lazuli-${kind}-light.svg`}
      />
      <Image
        alt=""
        className="hidden size-full object-contain dark:block"
        height={dimensions.height}
        width={dimensions.width}
        src={`/brand/lazuli-${kind}-dark.svg`}
      />
    </>
  );
}

export function BrandSignature(): ReactNode {
  return (
    <p aria-label="Lazuli" className="flex items-center gap-2.5" role="img">
      <span aria-hidden="true" className="size-8 shrink-0">
        <BrandArtwork kind="symbol-small" />
      </span>
      <span
        aria-hidden="true"
        className="h-8 w-28 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:opacity-100 motion-reduce:transition-none"
      >
        <BrandArtwork kind="wordmark" />
      </span>
    </p>
  );
}
