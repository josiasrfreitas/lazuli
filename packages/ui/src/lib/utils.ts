import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge only recognises utilities whose values it knows about, so the
 * design tokens that extend Tailwind's theme must be declared here too.
 * Without the control sizes, `h-control-md` (from a button variant) and an
 * `h-control-lg` override are kept side by side and stylesheet order decides
 * which one wins.
 */
const mergeClassNames = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ["control-sm", "control-md", "control-lg"],
      text: ["display", "h1", "h2", "h3", "body", "control", "caption", "micro"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return mergeClassNames(clsx(inputs));
}
