"use client";
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // Server render failures are captured by onRequestError with their original stack.
    if (!error.digest) Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
