"use client";

import { useState, type ReactElement } from "react";
import { FileImage } from "lucide-react";
import { Button } from "@lazuli/ui";
import styles from "./student-registration.module.css";

export function RegistrationDocumentLoading({
  label = "Carregando documentos…",
}: {
  label?: string;
}): ReactElement {
  return (
    <div className={styles.documentLoading} role="status">
      <div className={styles.loadingPaper} aria-hidden="true">
        <span className={styles.loadingPortrait} />
        <span className={styles.loadingLine} />
        <span className={styles.loadingLine} />
        <span className={styles.loadingLine} />
        <span className={styles.loadingScan} />
      </div>
      <p>{label}</p>
    </div>
  );
}

export function DocumentImage({
  id,
  title,
  photo,
  version,
}: {
  id: string;
  title: string;
  photo: boolean;
  version: number;
}): ReactElement {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  return (
    <div className={styles.preview} data-photo={photo}>
      {state === "loading" && <RegistrationDocumentLoading label="Carregando imagem…" />}
      {state === "error" ? (
        <div className={styles.empty} role="alert">
          <FileImage aria-hidden="true" />
          <p>Não foi possível abrir a imagem.</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setState("loading");
              setAttempt(attempt + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <img
          src={`/api/student-document-files/${id}?v=${version}&retry=${attempt}`}
          alt={title}
          data-loaded={state === "ready"}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}
    </div>
  );
}

export function DocumentThumbnail({ src }: { src: string }): ReactElement {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  return (
    <span className={styles.fileThumbnail} data-loading={state === "loading"}>
      {state !== "ready" && <FileImage size={20} aria-hidden="true" />}
      {state !== "error" && (
        <img
          src={src}
          alt=""
          data-loaded={state === "ready"}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}
    </span>
  );
}
