import type { ReactNode } from "react";

import styles from "./login-transition.module.css";

const LOADING_PHRASES = [
  "Conjugando o verbo entrar…",
  "Só mais uma página…",
  "Ajeitando os óculos da coruja…",
  "Esse loading vale presença?",
];

/** The loader's stable status is announced separately; playful copy stays decorative. */
export function LoginLoadingCaption(): ReactNode {
  return (
    <div className={styles.loadingLabel} aria-hidden="true" data-login-caption-loading>
      {LOADING_PHRASES.map((phrase) => (
        <p className={styles.loadingPhrase} key={phrase}>
          {[...phrase].map((letter, index) => (
            <span className={styles.loadingLetter} key={`${index}-${letter}`}>
              {letter}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
