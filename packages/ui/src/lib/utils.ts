import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const mergeClassNames = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "h1", "h2", "h3", "body", "control", "caption", "micro"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return mergeClassNames(clsx(inputs));
}
