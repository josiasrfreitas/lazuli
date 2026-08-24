import { createRef } from "react";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "../src/components/popover.js";

const triggerRef = createRef<HTMLButtonElement>();
const contentRef = createRef<HTMLDivElement>();
const titleRef = createRef<HTMLHeadingElement>();
const descriptionRef = createRef<HTMLParagraphElement>();
const closeRef = createRef<HTMLButtonElement>();

export const popoverWithRefs = (
  <Popover>
    <PopoverTrigger ref={triggerRef} render={<button type="button">Filtros</button>} />
    <PopoverContent ref={contentRef} showArrow={false} side="right" sideOffset={12} size="lg">
      <PopoverTitle ref={titleRef}>Filtrar contratos</PopoverTitle>
      <PopoverDescription ref={descriptionRef}>
        Selecione o período e a situação.
      </PopoverDescription>
      <PopoverClose ref={closeRef} render={<button type="button">Cancelar</button>} />
    </PopoverContent>
  </Popover>
);

// @ts-expect-error Popover size only accepts the sizes defined by the variants.
export const invalidPopoverSize = <PopoverContent size="xl">Filtros</PopoverContent>;
