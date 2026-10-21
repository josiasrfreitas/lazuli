"use client";

import { useId, type ReactElement } from "react";
import { cn } from "../lib/utils";

export type PencilLoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** Adapted from gustavofusco on Uiverse.io. */
export function PencilLoader({
  label = "Carregando",
  size = "md",
  className,
}: PencilLoaderProps): ReactElement {
  const eraserId = useId();
  return (
    <span role="status" className={cn("lz-pencil-loader", className)} data-size={size}>
      <svg className="lz-pencil" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={eraserId}>
            <rect width="30" height="30" rx="5" ry="5" />
          </clipPath>
        </defs>
        <circle
          className="lz-pencil__stroke"
          r="70"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="439.82 439.82"
          strokeDashoffset="439.82"
          strokeLinecap="round"
        />
        <g className="lz-pencil__rotate">
          <PencilBody />
          <PencilEraser eraserId={eraserId} />
          <PencilPoint />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function PencilEraser({ eraserId }: { eraserId: string }): ReactElement {
  return (
    <g className="lz-pencil__eraser" transform="rotate(-90) translate(49,0)">
      <g className="lz-pencil__eraser-skew">
        <rect width="30" height="30" rx="5" ry="5" fill="var(--lz-pencil-eraser)" />
        <rect width="5" height="30" clipPath={`url(#${eraserId})`} fill="var(--lz-pencil-blue)" />
        <rect width="30" height="20" fill="var(--muted)" />
        <rect width="15" height="20" fill="var(--muted-foreground)" />
        <rect width="5" height="20" fill="var(--border)" />
        <rect width="30" height="2" y="6" fill="var(--foreground)" opacity="0.2" />
        <rect width="30" height="2" y="13" fill="var(--foreground)" opacity="0.2" />
      </g>
    </g>
  );
}
function PencilPoint(): ReactElement {
  return (
    <g className="lz-pencil__point" transform="rotate(-90) translate(49,-30)">
      <polygon points="15 0,30 30,0 30" fill="var(--lz-pencil-wood)" />
      <polygon points="15 0,6 30,0 30" fill="var(--lz-pencil-wood-shadow)" />
      <path d="M15 0 20 10H10Z" fill="var(--foreground)" />
    </g>
  );
}

function PencilBody(): ReactElement {
  return (
    <g fill="none">
      <circle
        className="lz-pencil__body1"
        r="64"
        stroke="var(--lz-pencil-blue)"
        strokeWidth="30"
        strokeDasharray="402.12 402.12"
        strokeDashoffset="402"
      />
      <circle
        className="lz-pencil__body2"
        r="74"
        stroke="var(--lz-pencil-light)"
        strokeWidth="10"
        strokeDasharray="464.96 464.96"
        strokeDashoffset="465"
      />
      <circle
        className="lz-pencil__body3"
        r="54"
        stroke="var(--lz-pencil-dark)"
        strokeWidth="10"
        strokeDasharray="339.29 339.29"
        strokeDashoffset="339"
      />
    </g>
  );
}
