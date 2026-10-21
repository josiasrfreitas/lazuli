import type { ReactElement } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Receipt } from "./public-link";
import { attendanceTime } from "./location";
export function StudentReceipt({ receipt }: { receipt: Receipt }): ReactElement {
  return (
    <div role="status" className="grid gap-3">
      <CheckCircle2 className="size-8 text-success" aria-hidden />
      <h2 className="font-semibold">Presença enviada</h2>
      <p>{receipt.name}</p>
      <p className="text-sm text-muted-foreground">
        Recebida às {attendanceTime(receipt.submittedAt)}. O professor revisará a chamada. Para
        qualquer ajuste, fale com ele.
      </p>
    </div>
  );
}
