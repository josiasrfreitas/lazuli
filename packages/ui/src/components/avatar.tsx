import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

export const avatarVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-semibold",
  {
    variants: {
      size: {
        sm: "size-6 text-micro",
        md: "size-8 text-caption",
        lg: "size-12 text-h3",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>["size"]>;

// Quiet tints only — status colors (success/destructive) stay reserved for
// meaning in the rows next to the avatar, so identity never reads as state.
const avatarTones = [
  "bg-accent text-accent-foreground",
  "bg-info-muted text-info",
  "bg-secondary text-secondary-foreground",
  "bg-muted text-muted-foreground",
];

const HASH_MULTIPLIER = 31;
const HASH_MODULUS = 2_147_483_647;

function hashString(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = (hash * HASH_MULTIPLIER + (character.codePointAt(0) ?? 0)) % HASH_MODULUS;
  }

  return hash;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";

  return `${first}${last}`.toUpperCase();
}

export type AvatarProps = useRender.ComponentProps<"span"> &
  VariantProps<typeof avatarVariants> & {
    /** Name the initials are derived from. */
    name: string;
    /**
     * Stable key for the background tone (e.g. the student id). Falls back to
     * `name`, which shifts tone whenever the name is edited.
     */
    colorKey?: string;
  };

/**
 * Circle with initials and a background tone chosen deterministically from the
 * `colorKey`. Decorative by default (`aria-hidden`): every planned usage shows
 * the name right next to it. Standalone usages must pass `aria-hidden={false}`
 * plus an `aria-label`.
 */
export function Avatar({
  className,
  colorKey,
  name,
  render,
  size,
  ...props
}: AvatarProps): ReactElement {
  const tone = avatarTones[hashString(colorKey ?? name) % avatarTones.length];

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        "aria-hidden": true,
        children: initialsOf(name),
        className: cn(avatarVariants({ size }), tone, className),
      },
      props,
    ),
    render,
    state: { slot: "avatar", size },
  });
}
