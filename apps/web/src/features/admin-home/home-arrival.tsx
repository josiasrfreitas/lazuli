"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, type ReactElement, type RefObject } from "react";

import { playHomeArrival } from "./home-arrival-motion";
import styles from "./home-arrival.module.css";

function useHomeArrival(enabled: boolean, ready: boolean): RefObject<HTMLDivElement | null> {
  const root = useRef<HTMLDivElement>(null);
  const eligible = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const element = root.current;
    if (!enabled || !element || !ready) return;

    const url = new URL(globalThis.location.href);
    eligible.current ??= url.searchParams.get("entrada") === "1";
    if (!eligible.current) {
      element.hidden = true;
      return;
    }
    url.searchParams.delete("entrada");
    globalThis.history.replaceState(
      globalThis.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );

    return playHomeArrival(element);
  }, [enabled, ready]);
  return root;
}

/** The callback hint travels with the email link, including when it opens a new tab. */
export function HomeArrival({
  enabled,
  ready,
}: {
  enabled: boolean;
  ready: boolean;
}): ReactElement | null {
  const root = useHomeArrival(enabled, ready);
  if (!enabled) return null;

  return (
    <div
      ref={root}
      className={styles.arrival}
      aria-hidden="true"
      data-home-arrival
      data-ready={ready}
    >
      <div className={styles.cover} data-arrival-cover>
        <Image
          alt=""
          className={styles.photo}
          fill
          priority
          quality={90}
          sizes="100vw"
          src="/brand/login-students.jpg"
        />
        <div className={styles.scrim} />
      </div>
      <ArrivalSignature />
    </div>
  );
}

function ArrivalSignature(): ReactElement {
  return (
    <div className={styles.signature}>
      <Image
        alt=""
        className={styles.symbol}
        data-arrival-symbol
        height={100}
        width={100}
        src="/brand/lazuli-symbol-dark.svg"
        priority
      />
      <Image
        alt=""
        className={styles.wordmark}
        data-arrival-wordmark
        height={100}
        width={320}
        src="/brand/lazuli-wordmark-dark.svg"
        priority
      />
    </div>
  );
}
