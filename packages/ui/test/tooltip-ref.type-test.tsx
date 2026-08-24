import { createRef } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../src/components/tooltip.js";

const triggerRef = createRef<HTMLButtonElement>();
const contentRef = createRef<HTMLDivElement>();

export const tooltipWithRefs = (
  <TooltipProvider delay={300}>
    <Tooltip>
      <TooltipTrigger ref={triggerRef} render={<button type="button">Ajuda</button>} />
      <TooltipContent ref={contentRef} side="right" sideOffset={12}>
        Informações adicionais
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// @ts-expect-error Tooltip side only accepts positioning sides from Base UI.
export const invalidTooltipSide = <TooltipContent side="center">Ajuda</TooltipContent>;
