import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button, FileAttachmentDialog, type FileAttachmentDialogProps } from "@lazuli/ui";

const meta = {
  title: "Components/FileAttachmentDialog",
  component: FileAttachmentDialog,
  tags: ["autodocs"],
  args: {
    open: false,
    onOpenChange: () => undefined,
    target: {
      name: "Aluno de exemplo",
      description: "Prova de nivelamento",
      detail: "20/10/2026 · 14:00–15:00 · Presencial",
    },
    maxSize: 50 * 1024 * 1024,
    accept: "application/pdf,image/jpeg,image/png",
    acceptLabel: "PDF, JPG ou PNG",
    camera: true,
    onAttach: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Reusable attachment workflow with an explicit destination, optional contextual fields, selection, upload, retry and success. This story simulates the upload; no file is sent. The popup keeps its footer visible on narrow screens, guards dismissal during submission and restores focus to the completion action.",
      },
    },
  },
} satisfies Meta<typeof FileAttachmentDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

function AttachmentExample(props: FileAttachmentDialogProps) {
  const [open, setOpen] = useState(props.open);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Anexar arquivo</Button>
      <FileAttachmentDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

export const Playground: Story = { render: (args) => <AttachmentExample {...args} /> };
export const Open: Story = {
  args: { open: true },
  render: (args) => <AttachmentExample {...args} />,
};
export const Retry: Story = {
  render: (args) => <RetryExample {...args} />,
  parameters: {
    docs: {
      description: {
        story: "The first simulated request fails. Retry succeeds with the same selected file.",
      },
    },
  },
};

function RetryExample(props: FileAttachmentDialogProps) {
  const attempts = useRef(0);
  return (
    <AttachmentExample
      {...props}
      onAttach={async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (attempts.current++ === 0)
          throw new Error(
            "A conexão foi interrompida. O arquivo continua selecionado; tente novamente.",
          );
      }}
    />
  );
}
export const Multiple: Story = {
  args: { multiple: true, submitLabel: "Anexar arquivos" },
  render: (args) => <AttachmentExample {...args} />,
};
