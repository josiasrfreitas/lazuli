export type DebouncedCallback<Arguments extends unknown[]> = ((...args: Arguments) => void) & {
  cancel: () => void;
};

/** Delays a callback until calls have stopped for `waitMs`. */
export function debounce<Arguments extends unknown[]>(
  callback: (...args: Arguments) => void,
  waitMs: number,
): DebouncedCallback<Arguments> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Arguments): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      callback(...args);
    }, waitMs);
  };

  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return debounced;
}
