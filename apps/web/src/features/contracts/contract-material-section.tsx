"use client";
import type { ReactElement } from "react";
import type { FormProps } from "./contract-form-fields";
import { SetupMaterialFields, useSetupMaterial } from "./contract-setup-material";

type Props = Pick<FormProps, "fields" | "change" | "errors"> & {
  required?: boolean;
  suggestedStageId?: string | null | undefined;
};

export function ContractMaterialSection({ required = false, ...props }: Props): ReactElement {
  const material = useSetupMaterial(props);
  return (
    <section aria-label="Material do contrato" className="min-w-0">
      <SetupMaterialFields {...props} material={material} allowNoAcquisition={!required} />
    </section>
  );
}
