import React, { useEffect, useRef, useState } from "react";
import { scanDocument, createCornerEditor, extractDocument } from "scanic";
import { Button } from "@lazuli/ui/components/button";
import { ArrowLeft, Camera, RotateCcw } from "lucide-react";

export function Capture({ document, session, api, onBack }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState(null);
  const [pages, setPages] = useState([]);
  const host = useRef(null);
  const fileInput = useRef(null);
  const editor = useRef(null);
  const expiry = useRef(Infinity);
  const record = session.documents?.[document.id];
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (record?.status === "done" || record?.status === "error") setBusy(false);
  }, [record?.status]);
  useEffect(() => {
    if (!source || !host.current) return;
    let disposed = false;
    async function mount() {
      let corners;
      try {
        const detection = await scanDocument(source, { mode: "detect" });
        if (detection.success) corners = detection.corners;
      } catch {
        /* Manual adjustment remains available when automatic detection fails. */
      }
      if (disposed) return;
      setMessage(
        corners
          ? "Bordas detectadas. Ajuste os cantos se necessário."
          : "Arraste os quatro cantos até as bordas do documento.",
      );
      editor.current = createCornerEditor({
        container: host.current,
        image: source,
        corners,
        toolbar: { labels: { reset: "Reiniciar", cancel: "Cancelar", apply: "Recortar" } },
        onCancel: () => setSource(null),
        onConfirm: async (selected) => {
          try {
            const cropped = await extractDocument(source, selected, { output: "canvas" });
            if (Date.now() >= expiry.current || disposed) return;
            if (!cropped.success) throw new Error("CROP");
            setPages((current) => [...current, cropped.output]);
            setSource(null);
            setMessage("");
          } catch {
            setMessage("Não foi possível recortar. Ajuste os cantos e tente novamente.");
          }
        },
      });
    }
    void mount();
    return () => {
      disposed = true;
      editor.current?.destroy();
      editor.current = null;
    };
  }, [source]);
  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setMessage("Escolha uma foto de até 25 MB.");
      return;
    }
    setMessage("Preparando foto…");

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      if (Date.now() < expiry.current) setSource(canvas);
    } catch {
      setMessage("Não foi possível abrir a foto. Use JPG ou PNG.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function extract() {
    setBusy(true);
    setMessage("");

    try {
      const width = Math.max(...pages.map((page) => page.width));
      const gap = 32;
      const heights = pages.map((page) => Math.round((page.height * width) / page.width));
      const sheet = document.createElement("canvas");
      sheet.width = width;
      sheet.height = heights.reduce((a, b) => a + b, 0) + gap * (pages.length - 1);
      const ctx = sheet.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      let y = 0;
      pages.forEach((page, index) => {
        ctx.drawImage(page, 0, y, width, heights[index]);
        y += heights[index] + gap;
      });
      const blob = await new Promise((resolve) => sheet.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob || blob.size > 5 * 1024 * 1024) throw new Error("SIZE");
      await api(`documents/${document.id}`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      setSent(true);
    } catch (error) {
      setBusy(false);
      setMessage("Não foi possível enviar. Confira a conexão e tente novamente.");
    }
  }
  return (
    <section className="capture-flow">
      <Button variant="ghost" disabled={busy} onClick={onBack}><ArrowLeft /> Todos os documentos</Button>
      <header><h1>{document.title}</h1><p>{document.extracts ? "Fotografe a frente e o verso. Ajuste o recorte antes de enviar." : "Fotografe o comprovante inteiro, com as informações legíveis."}</p></header>
      {message && <p role="status" className="notice">{message}</p>}
      {record?.status === "error" && <p role="alert" className="notice">O anexo chegou, mas a leitura falhou. Você pode reenviar uma foto mais nítida ou preencher os dados no computador.</p>}
      {sent && record?.status === "done" ? (
        <div className="capture-success">
          <h2>Documento enviado</h2>
          <p>{document.extracts ? "Os dados identificados já estão disponíveis no computador. Confira a leitura com o documento original." : "O comprovante está disponível para conferência no computador. Não extraímos dados deste anexo."}</p>
          <Button size="lg" onClick={onBack}>Continuar com os documentos</Button>
        </div>
      ) : source ? (
        <section className="stack"><h2>Ajuste o recorte</h2><p>Arraste os quatro cantos até as bordas do documento.</p><div className="editor-host" ref={host} /></section>
      ) : (
        <>
          <div className="capture-pages">{pages.map((page,index) => <figure key={index}><img className="preview" src={page.toDataURL("image/jpeg", .85)} alt={index ? "Verso recortado" : "Frente recortada"}/><figcaption>{index ? "Verso" : document.extracts ? "Frente" : "Comprovante"}</figcaption></figure>)}</div>
          {!pages.length && <div className="camera-guide"><Camera size={36}/><h2>{document.extracts ? "Comece pela frente" : "Prepare o comprovante"}</h2><p>Apoie o documento em uma superfície plana, com boa luz e sem reflexos.</p></div>}
          <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/heic,image/heif" capture="environment" aria-label="Foto do documento" onChange={choose} disabled={busy}/>
          <div className="capture-actions">
            {pages.length < (document.extracts ? 2 : 1) && <Button size="lg" variant={pages.length === 1 && !document.extracts ? "secondary" : "primary"} disabled={busy} onClick={() => fileInput.current.click()}><Camera/>{pages.length ? "Fotografar verso" : "Tirar foto"}</Button>}
            {pages.length > 0 && <Button size="lg" variant={document.extracts && pages.length < 2 ? "secondary" : "primary"} loading={busy} onClick={extract}>{document.extracts && pages.length < 2 ? "Enviar somente frente" : "Enviar documento"}</Button>}
            {pages.length > 0 && <Button variant="ghost" disabled={busy} onClick={() => {setPages([]); setSent(false);}}><RotateCcw/> Refazer fotos</Button>}
          </div>
          {busy && <p role="status">{document.extracts ? "Enviando e lendo os dados…" : "Enviando comprovante…"}</p>}
        </>
      )}
    </section>
  );
}
