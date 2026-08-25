import { createRef } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type SelectSize,
} from "../src/components/select.js";

const triggerRef = createRef<HTMLButtonElement>();

const statusItems = [{ label: "Ativa", value: "active" }];

export const selectWithRef = (
  <Select defaultValue="active" items={statusItems} name="student-status">
    <SelectTrigger ref={triggerRef}>
      <SelectValue placeholder="Selecione a situação" />
    </SelectTrigger>
    <SelectContent alignItemWithTrigger>
      <SelectItem value="active">Ativa</SelectItem>
    </SelectContent>
  </Select>
);

const sizes: SelectSize[] = ["sm", "md", "lg"];

export const selectContract = (
  <>
    <Select defaultValue="morning" name="readonly-schedule" readOnly>
      <SelectTrigger>
        <SelectValue placeholder="Selecione o horário" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="morning">Manhã</SelectItem>
      </SelectContent>
    </Select>
    {sizes.map((size) => (
      <Select defaultValue="morning" key={size} name={`schedule-${size}`}>
        <SelectTrigger invalid={size === "lg"} size={size}>
          <SelectValue placeholder="Selecione o horário" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Horários</SelectLabel>
            <SelectItem value="morning">Manhã</SelectItem>
            <SelectItem value="afternoon">Tarde</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem disabled value="evening">
            Noite
          </SelectItem>
        </SelectContent>
      </Select>
    ))}
  </>
);

// @ts-expect-error Select trigger sizes are a closed public contract.
export const invalidSelectSize = <SelectTrigger size="xl" />;

// @ts-expect-error Select invalid state is boolean.
export const invalidSelectState = <SelectTrigger invalid="error" />;
