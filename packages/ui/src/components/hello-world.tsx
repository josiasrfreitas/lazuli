import type { ReactElement } from "react";

import { Button } from "./button";

export type HelloWorldProps = {
  message?: string;
};

const DEFAULT_MESSAGE = "Hello World";

export function HelloWorld({ message = DEFAULT_MESSAGE }: HelloWorldProps): ReactElement {
  return (
    <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">Lazuli UI</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">{message}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Global theme, Tailwind v4, and shadcn/ui are connected.
      </p>
      <Button className="mt-5" type="button">
        Pronto
      </Button>
    </section>
  );
}
