/** Shared entrance and exit for anchored menus and selection lists. */
export const anchoredMotion = [
  "origin-(--transform-origin) transition-[opacity,transform,scale,translate] duration-base ease-standard data-[ending-style]:duration-fast",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-98 data-[ending-style]:opacity-0",
  "data-[side=top]:data-[starting-style]:translate-y-1.5 data-[side=top]:data-[ending-style]:translate-y-0.5",
  "data-[side=bottom]:data-[starting-style]:-translate-y-1.5 data-[side=bottom]:data-[ending-style]:-translate-y-0.5",
  "data-[side=left]:data-[starting-style]:translate-x-1.5 data-[side=left]:data-[ending-style]:translate-x-0.5",
  "data-[side=right]:data-[starting-style]:-translate-x-1.5 data-[side=right]:data-[ending-style]:-translate-x-0.5",
  "motion-reduce:transition-none motion-reduce:data-[starting-style]:translate-x-0 motion-reduce:data-[starting-style]:translate-y-0 motion-reduce:data-[starting-style]:scale-100",
].join(" ");
