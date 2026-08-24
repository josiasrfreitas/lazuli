import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@lazuli/ui";

const DEFAULT_SCHEDULE_VALUE = "morning";
const MORNING_SCHEDULE_LABEL = "Manhã · 08:00–10:00";
const AFTERNOON_SCHEDULE_LABEL = "Tarde · 14:00–16:00";
const WEEKDAY_GROUP = "weekday";
const WEEKEND_GROUP = "weekend";

const scheduleItems = [
  { group: WEEKDAY_GROUP, label: MORNING_SCHEDULE_LABEL, value: DEFAULT_SCHEDULE_VALUE },
  { group: WEEKDAY_GROUP, label: AFTERNOON_SCHEDULE_LABEL, value: "afternoon" },
  { group: WEEKEND_GROUP, label: "Sábado · 09:00–11:00", value: "saturday" },
] as const;

const classLevelItems = [
  { label: "Nível 1", value: "level-1" },
  { label: "Nível 2", value: "level-2" },
  { label: "Nível 3", value: "level-3" },
] as const;

const weekdayScheduleItems = scheduleItems.filter((item) => item.group === WEEKDAY_GROUP);
const weekendScheduleItems = scheduleItems.filter((item) => item.group === WEEKEND_GROUP);

async function expectPopupBelowTrigger(trigger: HTMLElement): Promise<HTMLElement> {
  const popup = await within(document.body).findByRole("listbox");

  await waitFor(async () => {
    await expect(popup.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      trigger.getBoundingClientRect().bottom,
    );
  });

  return popup;
}

async function closePopup(): Promise<void> {
  await userEvent.keyboard("{Escape}");
  await waitFor(async () => {
    await expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument();
  });
}

const meta = {
  title: "Components/Select",
  component: SelectTrigger,
  subcomponents: {
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectValue,
  },
  tags: ["autodocs"],
  argTypes: {
    invalid: { control: "boolean" },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Seleção de um valor conhecido. Passe `items` ao `Select` para associar valores internos aos rótulos exibidos. O conteúdo abre abaixo do gatilho por padrão; use `alignItemWithTrigger` no `SelectContent` apenas quando o item selecionado precisar ficar alinhado sobre o gatilho.",
      },
    },
  },
} satisfies Meta<typeof SelectTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

function ScheduleSelect({
  disabled = false,
  invalid = false,
  readOnly = false,
  size = "md",
}: {
  disabled?: boolean;
  invalid?: boolean;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
}): ReactElement {
  return (
    <Select
      defaultValue={DEFAULT_SCHEDULE_VALUE}
      disabled={disabled}
      items={scheduleItems}
      name="schedule"
      readOnly={readOnly}
    >
      <SelectTrigger aria-label="Horário da turma" invalid={invalid} size={size}>
        <SelectValue placeholder="Selecione o horário" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Dias úteis</SelectLabel>
          {weekdayScheduleItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Fim de semana</SelectLabel>
          {weekendScheduleItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export const Playground: Story = {
  render: (args) => (
    <label className="grid w-full max-w-sm gap-2 text-caption font-medium">
      Horário da turma
      <Select defaultValue={DEFAULT_SCHEDULE_VALUE} items={scheduleItems} name="schedule">
        <SelectTrigger {...args}>
          <SelectValue placeholder="Selecione o horário" />
        </SelectTrigger>
        <SelectContent>
          {weekdayScheduleItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="grid w-full gap-4 md:grid-cols-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <section className="grid min-h-56 content-start gap-2" key={size}>
          <h2 className="text-caption font-medium">Tamanho {size}</h2>
          <ScheduleSelect size={size} />
        </section>
      ))}
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <label className="grid min-h-56 content-start gap-2 text-caption font-medium">
        Sem seleção
        <Select items={scheduleItems} name="empty-schedule">
          <SelectTrigger aria-label="Horário sem seleção">
            <SelectValue placeholder="Selecione o horário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={scheduleItems[0].value}>{scheduleItems[0].label}</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <section className="grid min-h-56 content-start gap-2">
        <h2 className="text-caption font-medium">Inválido</h2>
        <ScheduleSelect invalid />
      </section>
      <section className="grid min-h-56 content-start gap-2">
        <h2 className="text-caption font-medium">Desabilitado</h2>
        <ScheduleSelect disabled />
      </section>
      <section className="grid min-h-56 content-start gap-2">
        <h2 className="text-caption font-medium">Somente leitura</h2>
        <ScheduleSelect readOnly />
      </section>
    </div>
  ),
};

export const Open: Story = {
  render: () => (
    <Select
      defaultOpen
      defaultValue={DEFAULT_SCHEDULE_VALUE}
      items={scheduleItems}
      name="open-schedule"
    >
      <SelectTrigger aria-label="Horário da turma" className="max-w-sm">
        <SelectValue placeholder="Selecione o horário" />
      </SelectTrigger>
      <SelectContent>
        {weekdayScheduleItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};

export const FocusVisible: Story = {
  render: () => (
    <Select defaultValue={DEFAULT_SCHEDULE_VALUE} items={scheduleItems} name="focused-schedule">
      <SelectTrigger aria-label="Horário da turma" autoFocus className="max-w-sm">
        <SelectValue placeholder="Selecione o horário" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={scheduleItems[0].value}>{scheduleItems[0].label}</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const GroupsAndDisabledOptions: Story = {
  render: () => (
    <Select defaultValue="level-1" items={classLevelItems} name="class-level">
      <SelectTrigger aria-label="Nível da turma" className="max-w-sm">
        <SelectValue placeholder="Selecione o nível" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Níveis disponíveis</SelectLabel>
          {classLevelItems.slice(0, 2).map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Indisponível</SelectLabel>
          <SelectItem disabled value={classLevelItems[2].value}>
            {classLevelItems[2].label}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const InteractionRegression: Story = {
  tags: ["!autodocs", "!dev"],
  render: () => (
    <div className="grid w-full gap-4 md:grid-cols-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <ScheduleSelect key={size} size={size} />
      ))}
      <ScheduleSelect invalid />
      <ScheduleSelect disabled />
      <ScheduleSelect readOnly />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [
      smallTrigger,
      mediumTrigger,
      largeTrigger,
      invalidTrigger,
      disabledTrigger,
      readOnlyTrigger,
    ] = within(canvasElement).getAllByRole("combobox");

    if (
      !smallTrigger ||
      !mediumTrigger ||
      !largeTrigger ||
      !invalidTrigger ||
      !disabledTrigger ||
      !readOnlyTrigger
    ) {
      throw new Error("Select regression triggers are missing");
    }

    await userEvent.click(smallTrigger);
    const smallPopup = await expectPopupBelowTrigger(smallTrigger);
    await userEvent.click(
      within(smallPopup).getByRole("option", { name: AFTERNOON_SCHEDULE_LABEL }),
    );
    await expect(smallTrigger).toHaveTextContent(AFTERNOON_SCHEDULE_LABEL);

    for (const trigger of [mediumTrigger, largeTrigger]) {
      await userEvent.click(trigger);
      await expectPopupBelowTrigger(trigger);
      await closePopup();
    }

    await expect(invalidTrigger).toHaveAttribute("aria-invalid", "true");
    await expect(disabledTrigger).toBeDisabled();
    await expect(disabledTrigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(readOnlyTrigger);
    const readOnlyPopup = await expectPopupBelowTrigger(readOnlyTrigger);
    await userEvent.click(
      within(readOnlyPopup).getByRole("option", { name: AFTERNOON_SCHEDULE_LABEL }),
    );
    await expect(readOnlyTrigger).toHaveTextContent(MORNING_SCHEDULE_LABEL);
  },
};
