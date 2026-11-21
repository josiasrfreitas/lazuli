import { useState, type ComponentProps, type ReactElement } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { AttachmentPanel, AttachmentUploadRow, AttachmentAdd } from "@lazuli/ui";
const meta = {
  title: "Components/AttachmentPanel",
  component: AttachmentPanel,
  argTypes: { variant: { control: "radio", options: ["sidebar", "card"] } },
  tags: ["autodocs"],
} satisfies Meta<typeof AttachmentPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
function Example({
  variant = "sidebar",
}: Pick<ComponentProps<typeof AttachmentPanel>, "variant">): ReactElement {
  const [rows, setRows] = useState([
    { title: "Identidade do aluno", subtitle: "RG ou CIN · frente e verso" },
    { title: "Comprovante de residência", subtitle: "Foto do comprovante completo" },
  ]);
  const [received, setReceived] = useState<string[]>([]);
  const [qr, setQr] = useState(false);
  return (
    <div className="max-w-lg">
      <AttachmentPanel
        variant={variant}
        title={qr ? "Enviar pelo celular" : "Anexos"}
        onBack={qr ? () => setQr(false) : undefined}
        onMobile={() => setQr(true)}
      >
        {qr ? (
          <p>A área de QR code é fornecida pelo contexto.</p>
        ) : (
          <>
            <ul>
              {rows.map((row, index) => (
                <AttachmentUploadRow
                  key={index}
                  {...row}
                  accept="application/pdf,image/jpeg,image/png"
                  acceptLabel="PDF, JPG ou PNG"
                  maxSize={5_242_880}
                  uploaded={received.includes(row.title)}
                  onFile={() => setReceived((previous) => [...previous, row.title])}
                />
              ))}
            </ul>
            <AttachmentAdd onAdd={(row) => setRows((previous) => [...previous, row])} />
          </>
        )}
      </AttachmentPanel>
    </div>
  );
}
export const Playground: Story = {
  args: { children: null, variant: "sidebar" },
  render: (args) => <Example {...args} />,
};
