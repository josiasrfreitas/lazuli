"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { CheckCircle2, MapPin, CircleAlert, ArrowRight } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { matchAttendanceNames } from "@lazuli/domain";
import { attendanceTokenSchema } from "@lazuli/validators";
import { StudentNameField, StudentNameChoices } from "./student-fields";
import { currentAttendanceLocation, attendanceTime } from "./location";
import { attendanceBrowserId } from "./browser";
import { StudentAttendanceFrame } from "./student-frame";
export function StudentAttendancePage(): ReactElement {
  const [token, setToken] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inspect = trpc.studentAttendance.inspect.useMutation();
  const receipt = trpc.studentAttendance.receipt.useMutation();
  const readReceipt = receipt.mutate;
  const inspectLink = inspect.mutate;
  useEffect(() => {
    const read = () => {
      const value = window.location.hash.slice(1);
      setToken(value);
      setLoaded(true);
      const valid = attendanceTokenSchema.safeParse({ token: value }).success;
      setInvalid(Boolean(value) && !valid);
      if (valid) {
        inspectLink({ token: value });
        try {
          readReceipt({ token: value, browserId: attendanceBrowserId() });
        } catch {
          /* The form explains unavailable browser storage before sending. */
        }
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [inspectLink, readReceipt]);
  return (
    <StudentAttendanceFrame lesson={inspect.data}>
      {receipt.data ? (
        <div role="status" className="grid gap-3">
          <CheckCircle2 className="size-8 text-success" />
          <h2 className="font-semibold">Este navegador já enviou uma presença</h2>
          <p>{receipt.data.name}</p>
          <p className="text-sm text-muted-foreground">
            Recebida às {attendanceTime(receipt.data.submittedAt)}. Para qualquer ajuste, fale com o
            professor.
          </p>
        </div>
      ) : !loaded || inspect.isPending ? (
        <p role="status">Abrindo sua aula…</p>
      ) : !token ? (
        <Alert>Abra o QR ou o link de presença compartilhado pelo professor.</Alert>
      ) : invalid ? (
        <Alert>
          Este link de presença está incompleto ou é inválido. Peça ao professor um novo acesso.
        </Alert>
      ) : inspect.error ? (
        <div className="grid gap-4">
          <Alert>{inspect.error.message}</Alert>
          <Button
            size="compact-responsive"
            variant="secondary"
            onClick={() => inspectLink({ token })}
          >
            Tentar novamente
          </Button>
        </div>
      ) : inspect.data ? (
        <StudentDeclaration key={token} token={token} info={inspect.data} />
      ) : null}
    </StudentAttendanceFrame>
  );
}
type Info = RouterOutputs["studentAttendance"]["inspect"];
export function StudentDeclaration({
  token,
  info,
  preview = false,
}: {
  token: string;
  info: Info;
  preview?: boolean;
}): ReactElement {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const { mutateAsync: searchName } = trpc.studentAttendance.search.useMutation();
  const submit = trpc.studentAttendance.submit.useMutation();
  const searchVersion = useRef(0);
  const [retry, setRetry] = useState(0);
  const [searchState, setSearchState] = useState<{
    matches: RouterOutputs["studentAttendance"]["search"] | null;
    error: string | null;
  } | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<
    RouterOutputs["studentAttendance"]["submit"] | null
  >(null);
  const matches = searchState?.matches;
  const result = preview ? previewReceipt : submit.data;
  const pending = submit.isPending || locating;
  const searching = name.trim().length >= 3 && !searchState;
  const canSubmit =
    !pending &&
    !searching &&
    Boolean(matches?.options.some((person) => person.id === selected && !person.manualRequired));
  useEffect(() => {
    const query = name.trim();
    if (query.length < 3) return;
    const version = searchVersion.current;
    let active = true;
    const timer = window.setTimeout(() => {
      const lookup = preview
        ? Promise.resolve(
            matchAttendanceNames(
              [
                {
                  id: "00000000-0000-4000-8000-000000000002",
                  name: "Ana Beatriz Martins",
                  phone: null,
                },
              ],
              query,
            ),
          )
        : searchName({ token, name: query });
      void lookup.then(
        (found) => {
          if (!active || version !== searchVersion.current) return;
          setSearchState({ matches: found, error: null });
          setSelected(found.exactId ?? "");
        },
        (error: unknown) => {
          if (!active || version !== searchVersion.current) return;
          setSearchState({
            matches: null,
            error: error instanceof Error ? error.message : "Não foi possível buscar seu nome.",
          });
        },
      );
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [name, token, preview, searchName, retry]);
  useEffect(() => {
    document.getElementById("student-name")?.focus();
  }, []);
  async function send(): Promise<void> {
    if (preview) {
      setPreviewReceipt({ name: "Ana Beatriz Martins", submittedAt: new Date(), repeated: false });
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("lazuli-attendance-preview");
        channel.postMessage("ana-present");
        channel.close();
      }
      return;
    }
    setLocationError(null);
    setLocating(true);
    try {
      const location = info.format === "IN_PERSON" ? await currentAttendanceLocation() : null;
      let browserId: string;
      try {
        browserId = attendanceBrowserId();
      } catch {
        throw new Error(
          "Permita o armazenamento deste navegador ou peça a chamada manual ao professor.",
        );
      }
      submit.mutate({ token, name: name.trim(), enrollmentId: selected, location, browserId });
    } catch (cause) {
      setLocationError(
        cause instanceof Error ? cause.message : "Tente obter a localização novamente.",
      );
    } finally {
      setLocating(false);
    }
  }
  if (result)
    return (
      <div className="grid gap-4 border-t border-border pt-6" role="status">
        <CheckCircle2 className="size-9 text-success" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold">
          {preview ? "Assim aparece a confirmação" : "Presença enviada"}
        </h2>
        <p className="text-sm">{result.name}</p>
        <p className="text-caption text-muted-foreground">
          {preview
            ? "Na aula, o professor recebe sua presença e confere a chamada."
            : `Recebida às ${attendanceTime(result.submittedAt)}. O professor vai conferir na chamada.`}
          {result.repeated ? " Seu primeiro envio foi preservado." : ""}
        </p>
        {preview && (
          <Button
            variant="secondary"
            onClick={() => {
              searchVersion.current += 1;
              setPreviewReceipt(null);
              setSearchState(null);
              setName("");
              setSelected("");
            }}
          >
            Ver novamente
          </Button>
        )}
      </div>
    );
  return (
    <>
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending || searching) return;
          if (name.trim().length < 3) {
            setNameError("Digite pelo menos três caracteres do seu nome.");
            document.getElementById("student-name")?.focus();
            return;
          }
          if (canSubmit) void send();
        }}
      >
        <StudentNameField
          name={name}
          disabled={pending}
          error={nameError}
          hint={
            name.trim().length < 3
              ? "Digite pelo menos três letras. A busca é automática."
              : undefined
          }
          change={(value) => {
            searchVersion.current += 1;
            setName(value);
            setSelected("");
            setNameError(null);
            setLocationError(null);
            submit.reset();
            setSearchState(null);
          }}
        />
        {searching && (
          <p role="status" className="text-sm text-muted-foreground">
            Buscando seu nome…
          </p>
        )}
        {matches && (
          <StudentNameChoices
            matches={matches}
            selected={selected}
            select={setSelected}
            disabled={pending}
          />
        )}
        {selected && info.format === "IN_PERSON" && (
          <p className="flex items-start gap-2 text-caption text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span>
              Ao confirmar, permita sua localização para verificar que você está na escola.
            </span>
          </p>
        )}
        {searchState?.error && (
          <Alert variant="destructive">
            {searchState.error}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                searchVersion.current += 1;
                setSearchState(null);
                setRetry((value) => value + 1);
              }}
            >
              Tentar novamente
            </Button>
          </Alert>
        )}
        {submit.error && <Alert variant="destructive">{submit.error.message}</Alert>}
        {locationError && <Alert>{locationError}</Alert>}
        <Button size="compact-responsive" type="submit" disabled={!canSubmit}>
          {locating
            ? "Obtendo localização…"
            : submit.isPending
              ? "Enviando…"
              : "Enviar minha presença"}
          <ArrowRight aria-hidden="true" />
        </Button>
        <aside
          className="flex gap-2.5 border-t border-border pt-4 text-caption text-muted-foreground"
          aria-label="Atenção"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          <div className="grid gap-1.5">
            <p className="font-semibold text-foreground">Atenção</p>
            <p>Registre apenas uma presença por dispositivo nesta aula.</p>
            <p>O professor sempre confere a chamada.</p>
          </div>
        </aside>
      </form>
    </>
  );
}
