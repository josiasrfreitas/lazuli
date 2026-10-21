import { useState, type ReactElement } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { FileUpload, type FileUploadProps } from "@lazuli/ui";

const MAX_FILE_MB = 50;
const KIB = 1024;
const MAX_FILE_BYTES = MAX_FILE_MB * KIB * KIB;
const PDF_CONTENT_TYPE = "application/pdf";
const EXAMPLE_CONTENT = "Example";
const EXAMPLE_FILE_NAME = "prova-de-nivelamento.pdf";
const meta = {
  title: "Components/FileUpload",
  component: FileUpload,
  tags: ["autodocs"],
  args: {
    value: [],
    onValueChange: () => {},
    maxSize: MAX_FILE_BYTES,
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

function PlaygroundUpload(props: FileUploadProps): ReactElement {
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
      value={[new File([EXAMPLE_CONTENT], EXAMPLE_FILE_NAME, { type: PDF_CONTENT_TYPE })]}
      status="uploading"
      progress={42}
    />
  ),
};
export const Indeterminate: Story = {
  render: (args) => (
    <FileUpload
      {...args}
      value={[new File([EXAMPLE_CONTENT], EXAMPLE_FILE_NAME, { type: PDF_CONTENT_TYPE })]}
      status="uploading"
    />
  ),
};
export const Success: Story = {
  render: (args) => (
    <FileUpload
      {...args}
      value={[new File([EXAMPLE_CONTENT], EXAMPLE_FILE_NAME, { type: PDF_CONTENT_TYPE })]}
      status="success"
    />
  ),
};
export const LongFilename: Story = {
  render: (args) => <PlaygroundUploadWithFile {...args} />,
};

function PlaygroundUploadWithFile(props: FileUploadProps): ReactElement {
  const [files, setFiles] = useState(() => [
    new File(
      [EXAMPLE_CONTENT],
      "prova-de-nivelamento-com-nome-longo-para-conferencia-no-celular.pdf",
      {
        type: PDF_CONTENT_TYPE,
      },
    ),
  ]);
  return (
    <div className="max-w-sm">
      <FileUpload {...props} value={files} onValueChange={setFiles} />
    </div>
  );
}

export const Compact: Story = {
  args: { compact: true, multiple: true },
  render: (args) => <PlaygroundUpload {...args} />,
};
