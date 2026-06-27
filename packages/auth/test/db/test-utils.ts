import { it } from "node:test";

type TestBody = () => Promise<void>;

export function databaseIt(name: string, body: TestBody): void {
  void it(name, { concurrency: false }, async () => {
    try {
      await body();
    } catch (error) {
      throw formatDatabaseError(error);
    }
  });
}

function formatDatabaseError(error: unknown): Error {
  if (!isErrorLike(error)) {
    return new Error(`Database test failed with non-error value: ${String(error)}`);
  }

  const lines = [
    "Database test failed",
    `name: ${error.name}`,
    `message: ${error.message}`,
    ...formatOptionalProperty("code", error.code),
    ...formatOptionalProperty("meta", error.meta),
  ];

  const formattedError = new Error(lines.join("\n"));
  formattedError.stack = `${formattedError.name}: ${formattedError.message}\nCaused by:\n${error.stack}`;
  return formattedError;
}

function formatOptionalProperty(name: string, value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  return [`${name}: ${JSON.stringify(value)}`];
}

function isErrorLike(error: unknown): error is Error & {
  code?: unknown;
  meta?: unknown;
} {
  return error instanceof Error;
}
