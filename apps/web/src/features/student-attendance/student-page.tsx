"use client";
import { useEffect, useState, type ReactElement } from "react";
import { CheckCircle2, MapPin, Video, ArrowRight } from "lucide-react";
import { Alert, Badge, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { attendanceTokenSchema } from "@lazuli/validators";
import { StudentNameField, StudentNameChoices } from "./student-fields";
import { currentAttendanceLocation, attendanceTime } from "./location";
export function StudentAttendancePage(): ReactElement {
  const [token, setToken] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inspect = trpc.studentAttendance.inspect.useMutation();
  const inspectLink = inspect.mutate;
  useEffect(() => {
    const read = () => {
      const value = window.location.hash.slice(1);
      setToken(value);
      setLoaded(true);
      const valid = attendanceTokenSchema.safeParse({ token: value }).success;
      setInvalid(Boolean(value) && !valid);
      if (valid) inspectLink({ token: value });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [inspectLink]);
  return (
    <main className="grid min-h-dvh content-start bg-background px-5 py-8 sm:content-center sm:py-12">
      <div className="mx-auto grid w-full max-w-md gap-8">
        <header className="flex items-center gap-3">
          <img
            src="/brand/lazuli-symbol-small-mono-navy.svg"
            alt=""
            className="size-9 dark:hidden"
          />
          <img
            src="/brand/lazuli-symbol-small-mono-white.svg"
            alt=""
            className="hidden size-9 dark:block"
          />
          <span className="font-display text-lg font-semibold tracking-widest text-heading">
            LAZULI
          </span>
        </header>
        <section className="grid gap-6 rounded-lg border border-border bg-card p-5 sm:p-7">
          <div className="grid gap-2">
            <p className="text-caption font-medium uppercase tracking-widest text-muted-foreground">
              Sua aula
            </p>
            <h1 className="font-display text-h2 font-semibold text-heading">Estou presente</h1>
            <p className="text-sm text-muted-foreground">
              Envie sua presença para a revisão do professor.
            </p>
          </div>
          {!loaded || inspect.isPending ? (
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
        </section>
        <p className="text-center text-caption text-muted-foreground">
          Precisa de ajuda? O professor também pode registrar sua presença.
        </p>
      </div>
    </main>
  );
}
type Info = RouterOutputs["studentAttendance"]["inspect"];
function StudentDeclaration({ token, info }: { token: string; info: Info }): ReactElement {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const search = trpc.studentAttendance.search.useMutation({
    onSuccess: (result) => setSelected(result.exactId ?? ""),
  });
  const submit = trpc.studentAttendance.submit.useMutation();
  const pending = search.isPending || submit.isPending || locating;
  useEffect(() => {
    document.getElementById("student-name")?.focus();
  }, []);
  async function send(): Promise<void> {
    setLocationError(null);
    setLocating(true);
    try {
      const location = info.format === "IN_PERSON" ? await currentAttendanceLocation() : null;
      submit.mutate({ token, name: name.trim(), enrollmentId: selected, location });
    } catch (cause) {
      setLocationError(
        cause instanceof Error ? cause.message : "Tente obter a localização novamente.",
      );
    } finally {
      setLocating(false);
    }
  }
  if (submit.data)
    return (
      <div className="grid gap-4 border-t border-border pt-6" role="status">
        <CheckCircle2 className="size-9 text-success" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold">Presença enviada</h2>
        <p className="text-sm">{submit.data.name}</p>
        <p className="text-caption text-muted-foreground">
          Recebida às {attendanceTime(submit.data.submittedAt)}. O professor vai conferir na
          chamada.{submit.data.repeated ? " Seu primeiro envio foi preservado." : ""}
        </p>
      </div>
    );
  return (
    <>
      <div className="grid gap-2 border-y border-border py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{info.className}</h2>
          <Badge variant="neutral">{info.format === "ONLINE" ? "Online" : "Presencial"}</Badge>
        </div>
        <p className="text-caption text-muted-foreground">
          {info.date.split("-").reverse().join("/")} · {info.startTime}–{info.endTime}
        </p>
        <p className="text-caption text-muted-foreground">
          Envios até {attendanceTime(info.expiresAt)}
        </p>
      </div>
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          if (name.trim().length < 3) {
            setNameError("Digite pelo menos três caracteres do seu nome.");
            document.getElementById("student-name")?.focus();
            return;
          }
          if (search.data && selected) void send();
          else search.mutate({ token, name: name.trim() });
        }}
      >
        <StudentNameField
          name={name}
          disabled={pending}
          error={nameError}
          change={(value) => {
            setName(value);
            setSelected("");
            setNameError(null);
            setLocationError(null);
            search.reset();
            submit.reset();
          }}
        />
        {search.data && (
          <StudentNameChoices
            matches={search.data}
            selected={selected}
            select={setSelected}
            disabled={pending}
          />
        )}
        {selected && (
          <p className="flex items-start gap-2 text-caption text-muted-foreground">
            {info.format === "ONLINE" ? (
              <Video className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {info.format === "ONLINE"
                ? "Aula online: confirme para enviar ao professor."
                : "Ao enviar, compartilhe sua localização atual para a revisão do professor."}
            </span>
          </p>
        )}
        {search.error && <Alert variant="destructive">{search.error.message}</Alert>}
        {submit.error && <Alert variant="destructive">{submit.error.message}</Alert>}
        {locationError && <Alert>{locationError}</Alert>}
        <Button
          size="compact-responsive"
          type="submit"
          disabled={pending || Boolean(search.data && !selected)}
        >
          {locating
            ? "Obtendo localização…"
            : submit.isPending
              ? "Enviando…"
              : search.isPending
                ? "Buscando…"
                : selected
                  ? "Enviar minha presença"
                  : "Encontrar meu nome"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>
    </>
  );
}
