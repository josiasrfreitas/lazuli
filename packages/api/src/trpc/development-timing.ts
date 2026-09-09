type TimingOptions<Result> = {
  delayMs: number;
  log: (message: string) => void;
  next: () => Promise<Result>;
  now?: () => number;
  path: string;
  sleep?: (milliseconds: number) => Promise<void>;
};

export function parseTrpcDevelopmentDelay(value?: string): number {
  if (value === undefined || value === "" || value === "0") return 0;
  if (!/^\d+$/u.test(value)) {
    throw new TypeError("TRPC_DEV_DELAY_MS must be a non-negative integer.");
  }
  const delayMs = Number(value);
  if (!Number.isSafeInteger(delayMs)) {
    throw new TypeError("TRPC_DEV_DELAY_MS must be a non-negative integer.");
  }
  return delayMs;
}

export async function withDevelopmentTiming<Result>(
  options: TimingOptions<Result>,
): Promise<Result> {
  if (options.delayMs === 0) return await options.next();

  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const start = now();
  await sleep(options.delayMs);
  try {
    return await options.next();
  } finally {
    options.log(`[TRPC] ${options.path} took ${now() - start}ms\n`);
  }
}
