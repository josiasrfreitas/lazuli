import type { ReactElement } from "react";
import { DetailHeader, InlineSkeleton } from "@lazuli/ui";
export function ClassOverviewLoading(): ReactElement {
  return (
    <DetailHeader
      size="sm"
      title={<InlineSkeleton className="h-7 w-48" />}
      metadata={
        <div className="flex flex-wrap gap-4" aria-hidden="true">
          <InlineSkeleton className="h-4 w-32" />
          <InlineSkeleton className="h-4 w-40" />
        </div>
      }
      actions={<InlineSkeleton className="h-8 w-lg max-w-full" />}
    />
  );
}
