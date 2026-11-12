import type { ReactElement } from "react";
import { CalendarDays, Clock, FileText, MessageSquare, Tag, Zap } from "lucide-react";
import { FormSection, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { NarrativeField } from "~/features/shared/task-form";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { CATEGORY } from "./shared";
import { maskDateBR, maskTime24 } from "~/lib/masks";
import type { OccurrenceFormModel } from "./occurrence-form-model";
import styles from "./occurrence-form.module.css";

type OutsideModel = Pick<
  OccurrenceFormModel,
  "outside" | "view" | "save" | "setOutside" | "setView" | "change" | "values" | "validation"
>;

export function OccurrenceViewControl({ model }: { model: OutsideModel }): ReactElement {
  return (
    <SegmentedControl
      size="sm"
      aria-label="Contexto da ocorrência"
      value={model.outside ? "outside" : model.view}
      onValueChange={(value) => {
        if (model.save.isPending) return;
        model.setOutside(value === "outside");
        if (value === "day" || value === "week") model.setView(value);
        model.change("classSessionId", "");
      }}
    >
      <SegmentedControlItem value="day">Dia</SegmentedControlItem>
      <SegmentedControlItem value="week">Semana</SegmentedControlItem>
      <SegmentedControlItem value="outside">Fora de Aula</SegmentedControlItem>
    </SegmentedControl>
  );
}

export function OutsideOccurrenceFields({ model }: { model: OutsideModel }): ReactElement {
  return (
    <div className={styles.outside}>
      <OccurrenceViewControl model={model} />
      <FormSection
        title="Quando aconteceu?"
        description="Use o horário de São Paulo. Data, horário, título e descrição são obrigatórios."
      >
        <div className={styles.outsideDateTime}>
          <TextControl
            name="occurredOn"
            label="Data"
            labelIcon={<CalendarDays aria-hidden="true" className="size-3.5" />}
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            value={model.values.occurredOn}
            onChange={(value) => model.change("occurredOn", maskDateBR(value))}
            error={model.validation.errors.occurredOn}
          />
          <TextControl
            name="occurredTime"
            label="Horário"
            labelIcon={<Clock aria-hidden="true" className="size-3.5" />}
            placeholder="HH:mm"
            inputMode="numeric"
            value={model.values.occurredTime}
            onChange={(value) => model.change("occurredTime", maskTime24(value))}
            error={model.validation.errors.occurredTime}
          />
          <SelectControl
            name="category"
            label="Contexto"
            labelIcon={<Tag aria-hidden="true" className="size-3.5" />}
            value={model.values.category}
            onChange={(value) => model.change("category", value)}
            choices={Object.entries(CATEGORY).map(([value, label]) => ({ value, label }))}
            error={model.validation.errors.category}
          />
        </div>
        <TextControl
          name="title"
          label="Título"
          labelIcon={<FileText aria-hidden="true" className="size-3.5" />}
          placeholder="Ex.: Evento cultural, intervalo ou conversa na saída"
          value={model.values.title}
          onChange={(value) => model.change("title", value)}
          error={model.validation.errors.title}
        />
        <NarrativeField
          name="account"
          label="Descrição"
          labelIcon={<MessageSquare aria-hidden="true" className="size-3.5" />}
          placeholder="Descreva o evento ou a situação e o que aconteceu."
          value={model.values.account}
          onChange={(value) => model.change("account", value)}
          error={model.validation.errors.account}
          rows={4}
        />
        <NarrativeField
          name="initialResponse"
          label="Ação imediata (opcional)"
          labelIcon={<Zap aria-hidden="true" className="size-3.5" />}
          placeholder="Ex.: Conversei com o aluno e combinei como seguir."
          value={model.values.initialResponse}
          onChange={(value) => model.change("initialResponse", value)}
          error={model.validation.errors.initialResponse}
          rows={2}
        />
      </FormSection>
    </div>
  );
}
