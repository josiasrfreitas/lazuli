import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@lazuli/ui/components/button";
import { ArrowRight, Check, FileText, Smartphone } from "lucide-react";
import { DOCUMENTS } from "./documents.mjs";
import { Capture } from "./capture.jsx";
import { Desktop } from "./desktop.jsx";

const token = location.hash.slice(1);
const base = "/document-prototype";
export async function api(path, options = {}) {
  const response = await fetch(`${base}/api/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
    cache: "no-store",
  });
  if (options.image) {
    if (!response.ok) throw new Error("IMAGE_FAILED");
    return response.blob();
  }
  const value = await response.json();
  if (!response.ok) throw new Error(value.code);
  return value;
}
export function documentStatus(record) {
  if (record?.status === "working") return "Lendo os dados…";
  if (record?.status === "error") return "Anexo recebido · leitura falhou";
  if (record?.status === "done") return "Enviado";
  return "Aguardando foto";
}
export function ReviewNotice() {
  return <div className="review-notice"><strong>Confira antes de salvar</strong><p>A leitura automática pode conter erros. Revise os dados preenchidos e a legibilidade dos anexos com os documentos originais.</p></div>;
}
function App() {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const desktop = new URLSearchParams(location.search).get("view") === "desktop";
  useEffect(() => {
    let live = true;
    let timer;
    async function refresh() {
      try {
        const value = await api("session");
        if (!live) return;
        setSession(value);
        setError("");
      } catch (failure) {
        if (!live) return;
        setError(failure.message === "EXPIRED" ? "SESSION_CLOSED" : "CONNECTION");
        if (failure.message === "EXPIRED") return;
      }
      if (live) timer = setTimeout(refresh, 1500);
    }
    void refresh();
    return () => { live = false; clearTimeout(timer); };
  }, []);
  async function send(path, options) {
    const result = await api(path, options);
    setSession(await api("session"));
    return result;
  }
  if (error === "SESSION_CLOSED") return <main className="mobile-shell"><h1>Sessão encerrada</h1><p>Abra o QR code atual no computador para continuar. O servidor de teste pode ter sido reiniciado.</p></main>;
  if (!session) return <main className="mobile-shell"><h1>Documentos do cadastro</h1><p role="status">{error ? "Não foi possível conectar. Tentando novamente…" : "Abrindo sessão…"}</p></main>;
  return <>
    <div className="prototype-note">Protótipo de experiência · anexos temporários, sem salvar no cadastro.</div>
    {error && <div role="alert" className="connection-notice">Conexão interrompida. Tentando novamente; seus campos continuam nesta tela.</div>}
    {desktop ? <Desktop session={session} api={api} token={token}/> : <main className="mobile-shell">
      {selected ? <Capture key={selected.id} document={selected} session={session} api={send} onBack={() => setSelected(null)}/> : <>
        <header className="mobile-heading"><Smartphone size={26}/><h1>Documentos do cadastro</h1><p>Envie as fotos por aqui e acompanhe o preenchimento no computador.</p></header>
        <div className="section-heading"><h2>Enviar documentos</h2><span>{DOCUMENTS.filter(doc => session.documents?.[doc.id]?.status === "done").length} de 4 enviados</span></div>
        <div className="document-list">{DOCUMENTS.map(doc => {
          const record = session.documents?.[doc.id];
          return <button className="document-action" key={doc.id} onClick={() => setSelected(doc)} disabled={session.status === "working" || session.status === "uploading"}>
            {record?.status === "done" ? <Check className="received-icon"/> : <FileText/>}
            <span><strong>{doc.title}</strong><small>{doc.detail}</small><small className="document-state">{documentStatus(record)}</small></span><ArrowRight/>
          </button>;
        })}</div>
        <p className="support-copy">Só as identidades (RG ou CIN) preenchem dados automaticamente. Os comprovantes são enviados apenas como anexos.</p>
        <ReviewNotice/>
        <p className="support-copy">O documento do responsável é necessário para alunos menores de idade. Você pode enviar os documentos em qualquer ordem.</p>
      </>}
    </main>}
  </>;
}
createRoot(document.getElementById("root")).render(<App/>);
