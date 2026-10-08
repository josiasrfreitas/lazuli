import type { ReactElement } from "react";

const PAGE_COUNT = 6;
const pages = Array.from({ length: PAGE_COUNT }, (_unused, index) => index);
const pagePath =
  "M90 0V120H11A11 11 0 0 1 0 109V11A11 11 0 0 1 11 0H90Z M18.5 81a2.5 2.5 0 0 0 0 5h53a2.5 2.5 0 0 0 0-5h-53Z M18.5 57a2.5 2.5 0 0 0 0 5h53a2.5 2.5 0 0 0 0-5h-53Z M18.5 33a2.5 2.5 0 0 0 0 5h53a2.5 2.5 0 0 0 0-5h-53Z";

export type BookLoaderProps = { label?: string };

export function BookLoader({ label = "Carregando" }: BookLoaderProps): ReactElement {
  return (
    <div className="lz-book-loader-wrapper" role="status" aria-label={label}>
      <div className="lz-book-loader-loader" aria-hidden="true">
        <div className="lz-book-loader-book">
          <ul className="lz-book-loader-pages">
            {pages.map((page) => (
              <li key={page} className="lz-book-loader-page">
                <svg fill="currentColor" viewBox="0 0 90 120" focusable="false">
                  <path d={pagePath} fillRule="evenodd" />
                </svg>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
