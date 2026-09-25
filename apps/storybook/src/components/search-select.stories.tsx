import { useState, type ReactElement } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  Field,
  Label,
  SearchSelect,
  type SearchSelectOption,
  type SearchSelectProps,
} from "@lazuli/ui";

const OPTIONS = [
  { id: "ana", label: "Ana", description: "Contato cadastrado" },
  { id: "bruno", label: "Bruno" },
];

function Example(props: SearchSelectProps & { onSubmit: () => void }): ReactElement {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState<SearchSelectOption | null>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <Field name="person">
        <Label>Pessoa</Label>
        <SearchSelect
          {...props}
          query={query}
          value={value}
          options={props.options.filter((option) =>
            option.label.toLowerCase().includes(query.toLowerCase()),
          )}
          onQueryChange={(next) => {
            setQuery(next);
            setValue(null);
          }}
          onSelect={(option) => {
            setValue(option);
            props.onSelect(option);
          }}
          onClear={() => {
            setValue(null);
            setQuery("");
          }}
        />
      </Field>
    </form>
  );
}

const meta = {
  title: "Components/SearchSelect",
  component: SearchSelect,
  args: {
    name: "person",
    placeholder: "Buscar pessoa",
    query: "",
    value: null,
    options: OPTIONS,
    onQueryChange: fn(),
    onSelect: fn(),
    onClear: fn(),
    onCreate: fn(),
    onSubmit: fn(),
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<SearchSelectProps & { onSubmit: () => void }>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SearchAndCreate: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const popup = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole("combobox", { name: "Pessoa" });
    await userEvent.click(input);
    await expect(popup.getAllByRole("option").at(-1)).toHaveTextContent("Cadastrar novo");
    await userEvent.type(input, "Ana");
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "ana" }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Remover Ana" }));
    await userEvent.type(canvas.getByRole("combobox", { name: "Pessoa" }), "Sem resultado");
    await expect(popup.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    await expect(args.onCreate).toHaveBeenCalledWith("Sem resultado");
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const ArrowNavigation: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole("combobox", { name: "Pessoa" });
    await userEvent.type(input, "Ana");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onCreate).toHaveBeenCalledWith("Ana");
    await expect(args.onSelect).not.toHaveBeenCalled();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const Loading: Story = { args: { loading: true, options: [] } };
export const Error: Story = { args: { failed: true, options: [] } };
