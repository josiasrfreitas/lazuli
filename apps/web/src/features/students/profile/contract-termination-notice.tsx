import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { FileX2 } from "lucide-react";
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle, Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { formatDateOnlyBR } from "~/lib/format";

type Termination = RouterOutputs["finance"]["studentSummary"]["latestTermination"];

export function ContractTerminationNotice({
  termination,
  studentId,
}: {
  termination: Termination | undefined;
  /** Pedagogy offers a route to the financial settlement. */
  studentId?: string;
}): ReactJSX.Element | null {
  if (!termination) return null;
  return (
    <Alert variant={studentId ? "info" : "neutral"} role="note">
      <AlertIcon>
        <FileX2 />
      </AlertIcon>
      <AlertContent>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            <AlertTitle>Contrato rescindido · {formatDateOnlyBR(termination.date)}</AlertTitle>
            <AlertDescription>
              {studentId
                ? "O histórico pedagógico foi preservado. Consulte o acerto no Financeiro."
                : "A rescisão não quita saldos pendentes. Confira abaixo as cobranças e os pagamentos recebidos."}
            </AlertDescription>
          </div>
          {studentId && (
            <Button
              variant="link"
              size="inline"
              nativeButton={false}
              render={<Link href={`/alunos/${studentId}?secao=financeiro`} />}
            >
              Ver financeiro
            </Button>
          )}
        </div>
      </AlertContent>
    </Alert>
  );
}
