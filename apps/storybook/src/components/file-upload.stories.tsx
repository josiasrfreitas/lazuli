import { useState, type ReactElement } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { FileUpload, type FileUploadProps } from "@lazuli/ui";

const MAX_UPLOAD_BYTES = 52_428_800;

const SAMPLE_FILE_NAME = "prova-de-nivelamento.pdf";
const SAMPLE_CONTENT_TYPE = "application/pdf";

const meta = {
  title: "Components/FileUpload",
  component: FileUpload,
  tags: ["autodocs"],
  args: {
    value: [],
    onValueChange: () => {},
    maxSize: MAX_UPLOAD_BYTES,
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
export const FormatSizeLimits: Story = {
  args: {
    maxSize: 26_214_400,
    maxSizeByType: { "application/pdf": 5_242_880 },
    sizeLabel: "imagens até 25 MB; PDF até 5 MB",
  },
  render: (args) => <PlaygroundUpload {...args} />,
};
export const ValidationError: Story = {
  args: { error: "O arquivo ultrapassa 50 MB. Escolha um arquivo menor." },
};
export const Uploading: Story = {
  render: (args) => (
    <FileUpload
      {...args}
      value={[new File(["Example"], SAMPLE_FILE_NAME, { type: SAMPLE_CONTENT_TYPE })]}
      status="uploading"
      progress={42}
    />
  ),
};
export const Indeterminate: Story = {
  render: (args) => (
    <FileUpload
      {...args}
      value={[new File(["Example"], SAMPLE_FILE_NAME, { type: SAMPLE_CONTENT_TYPE })]}
      status="uploading"
    />
  ),
};
export const Success: Story = {
  render: (args) => (
    <FileUpload
      {...args}
      value={[new File(["Example"], SAMPLE_FILE_NAME, { type: SAMPLE_CONTENT_TYPE })]}
      status="success"
    />
  ),
};
export const LongFilename: Story = {
  render: (args) => <PlaygroundUploadWithFile {...args} />,
};

function PlaygroundUploadWithFile(props: FileUploadProps): ReactElement {
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
