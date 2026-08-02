import { createRef } from "react";

import { Button } from "../src/components/button.js";

const buttonRef = createRef<HTMLButtonElement>();

export const buttonWithRef = <Button ref={buttonRef}>Salvar</Button>;
