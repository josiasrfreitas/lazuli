const ASSET_DEADLINE_MS = 10_000;

type LoginImage = Pick<HTMLImageElement, "decode" | "dataset">;

/** Decode before revealing: load can precede the browser's final painted image. */
export async function waitForLoginAssets(
  images: Iterable<LoginImage>,
  signal: AbortSignal,
): Promise<void> {
  const pending = [...images].map((image) => decodeImage(image, signal));
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let release: (() => void) | undefined;
  const timeout = new Promise<void>((resolve) => {
    release = resolve;
    deadline = setTimeout(resolve, ASSET_DEADLINE_MS);
    signal.addEventListener("abort", release, { once: true });
  });
  await Promise.race([Promise.allSettled([...pending, document.fonts.ready]), timeout]);
  clearTimeout(deadline);
  if (release !== undefined) signal.removeEventListener("abort", release);
}

async function decodeImage(image: LoginImage, signal: AbortSignal): Promise<void> {
  image.dataset.assetPending = "true";
  try {
    await image.decode();
    if (!signal.aborted) delete image.dataset.assetPending;
  } catch {
    // Failed or timed-out images stay hidden; the form remains usable.
  }
}
