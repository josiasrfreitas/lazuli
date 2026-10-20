import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { FileUpload, type FileUploadProps } from "@lazuli/ui";

const meta = {
  title: "Components/FileUpload",
  component: FileUpload,
  tags: ["autodocs"],
  args: {
    value: [],
    onValueChange: () => undefined,
    maxSize: 50 * 1024 * 1024,
    accept: "application/pdf,image/jpeg,image/png",
    acceptLabel: "PDF, JPG ou PNG",
    camera: true,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Accessible file selection with drag and drop, mobile camera input, image previews and validation. Transport and persistence belong to the consumer. Only show numeric progress when the transport supplies it. The picker is keyboard accessible; file errors are announced, and motion respects reduced-motion preferences.",
      },
    },
  },
} satisfies Meta<typeof FileUpload>;
export default meta;
type Story = StoryObj<typeof meta>;

function PlaygroundUpload(props: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div className="mx-auto max-w-lg">
      <FileUpload {...props} value={files} onValueChange={setFiles} />
    </div>
  );
}

export const Playground: Story = { render: (args) => <PlaygroundUpload {...args} /> };
export const Multiple: Story = {
  args: { multiple: true },
  render: (args) => <PlaygroundUpload {...args} />,
};
export const Disabled: Story = { args: { disabled: true } };
export const ValidationError: Story = {
  args: { error: "O arquivo ultrapassa 50 MB. Escolha um arquivo menor." },
};
export const Uploading: Story = {
  render: (args) => (
    <FileUpload
      {...args}
      value={[new File(["Example"], "prova-de-nivelamento.pdf", { type: "application/pdf" })]}
      status="uploading"
      progress={42}
    />
  ),
};
export const Indeterminate: Story = {
  render: (args) => (
    <FileUpload
      {...args}
      value={[new File(["Example"], "prova-de-nivelamento.pdf", { type: "application/pdf" })]}
      status="uploading"
    />
  ),
};
export const Success: Story = {
  render: (args) => (
    <FileUpload
      {...args}
      value={[new File(["Example"], "prova-de-nivelamento.pdf", { type: "application/pdf" })]}
      status="success"
    />
  ),
};
export const LongFilename: Story = {
  render: (args) => <PlaygroundUploadWithFile {...args} />,
};

function PlaygroundUploadWithFile(props: FileUploadProps) {
  const [files, setFiles] = useState(() => [
    new File(["Example"], "prova-de-nivelamento-com-nome-longo-para-conferencia-no-celular.pdf", {
      type: "application/pdf",
    }),
  ]);
  return (
    <div className="max-w-sm">
      <FileUpload {...props} value={files} onValueChange={setFiles} />
    </div>
  );
}
