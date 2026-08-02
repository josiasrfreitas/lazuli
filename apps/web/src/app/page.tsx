import type { ReactNode } from "react";

import { HelloWorld } from "@lazuli/ui";

export default function HomePage(): ReactNode {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <HelloWorld message="Hello World" />
    </main>
  );
}
