import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@lazuli/ui/components/button";
import { Input } from "@lazuli/ui/components/input";
import { ArrowRight, Check, Copy, ExternalLink, Paperclip, X } from "lucide-react";
import { DOCUMENTS, prefill } from "./documents.mjs";
import { ReviewNotice, documentStatus } from "./client.jsx";

const identityFields = [["name", "Nome completo"], ["birthDate", "Nascimento"], ["cpf", "CPF"], ["rg", "RG"]];
function IdentityFields({ prefix = "", fields, change }) {
  return <div className="identity-fields">{identityFields.map(([key,label]) => {
    const name = prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key;
    return <label className={key === "name" ? "full-field" : ""} key={name}><span>{label}</span><Input name={name} value={fields[name] ?? ""} placeholder={key === "birthDate" ? "dd/mm/aaaa" : key === "name" ? "Como está no documento" : ""} onChange={event => change(name,event.target.value)}/></label>;
  })}</div>;
}
export function Desktop({ session, api, token }) {
  const [fields, setFields] = useState({});
  const touched = useRef(new Set());
  const [panel, setPanel] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const previewRef = useRef(null);
  const url = `${location.origin}/document-prototype/#${token}`;
  const docs = session.documents ?? {};
  const revisions = DOCUMENTS.map(doc => `${doc.id}:${docs[doc.id]?.revision}:${docs[doc.id]?.status}`).join("|");
  useEffect(() => {
    setFields(current => prefill(current, docs, touched.current));
    setReviewed(false);
  }, [revisions]);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  function change(key,value) { touched.current.add(key); setFields(current => ({...current,[key]:value})); setReviewed(false); }
  async function showImage(doc) {
    try {
      const blob = await api(`documents/${doc.id}`, {image:true});
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = URL.createObjectURL(blob);
      setPreview({ title:doc.title, url:previewRef.current });
    } catch { setNotice("Não foi possível abrir o anexo. Tente novamente."); }
  }
  return <main className="desktop-stage">
    <div className="enrollment-layout" data-panel={panel}>
      <section className="enrollment-sheet" aria-labelledby="student-title">
        <header className="enrollment-heading"><h1 id="student-title">Novo aluno</h1><p>Preencha os dados ou envie as identidades pelo celular.</p><ol className="intake-steps"><li aria-current="step"><span>1</span> Aluno</li><li><span>2</span> Pedagógico</li><li><span>3</span> Contrato</li></ol></header>
        <form id="student-preview" onSubmit={event => {event.preventDefault();setNotice("Conferência concluída neste protótipo. Nenhum cadastro foi salvo.");}}>
          <section className="form-section"><div className="section-heading"><h2>Identificação</h2><Button variant="ghost" size="sm" aria-expanded={panel} onClick={() => setPanel(!panel)}><Paperclip/> Anexos</Button></div><IdentityFields fields={fields} change={change}/></section>
          {docs.student?.status === "done" && <p className="prefill-note" role="status">Dados recebidos da identidade. Confira os campos antes de continuar. Na CIN, o CPF substitui o RG.</p>}
          <section className="form-section"><h2>Contato</h2><div className="contact-fields"><label><span>Telefone</span><Input type="tel" value={fields.phone ?? ""} placeholder="(79) 99999-9999" onChange={event => change("phone",event.target.value)}/></label><label><span>Email</span><Input type="email" value={fields.email ?? ""} placeholder="nome@exemplo.com" onChange={event => change("email",event.target.value)}/></label></div></section>
          <section className="form-section"><h2>Responsável</h2><p>Para alunos menores de idade.</p><IdentityFields prefix="guardian" fields={fields} change={change}/></section>
          <label className="review-check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/><span>Conferi os dados preenchidos e os anexos enviados.</span></label>
          {notice && <p role="status" className="notice">{notice}</p>}
        </form>
        <footer className="enrollment-footer"><span>Prévia do cadastro · etapa Aluno</span><Button type="submit" form="student-preview" disabled={!reviewed}>Concluir conferência <ArrowRight/></Button></footer>
      </section>
      {panel && <aside className="attachment-panel" aria-labelledby="attachment-title">
        <div className="section-heading"><h2 id="attachment-title">Anexos do aluno</h2><Button variant="ghost" size="icon-sm" aria-label="Fechar painel de anexos" onClick={() => setPanel(false)}><X/></Button></div>
        <p>Escaneie uma vez para enviar todos os documentos pelo celular.</p>
        <div className="qr-code"><QRCodeSVG value={url} size={160} marginSize={4} title="Abrir envio de documentos no celular"/></div>
        <div className="link-actions"><Button variant="secondary" size="sm" onClick={async () => {try {await navigator.clipboard.writeText(url);setCopied(true);}catch {setNotice("Não foi possível copiar. Use Abrir no celular para acessar o link.");}}}><Copy/>{copied ? "Link copiado" : "Copiar link"}</Button><a href={url} target="_blank" rel="noreferrer">Abrir <ExternalLink size={14}/></a></div>
        <ul className="attachment-status">{DOCUMENTS.map(doc => <li key={doc.id}><div><strong>{doc.title}</strong><small>{documentStatus(docs[doc.id])}</small></div>{docs[doc.id]?.hasImage ? <Button variant="ghost" size="sm" onClick={() => showImage(doc)}>Ver</Button> : null}</li>)}</ul>
        <p className="support-copy">O cadastro acompanha os envios automaticamente. Só RG e CIN preenchem os dados; suas edições manuais são preservadas.</p>
        <ReviewNotice/>
        {preview && <section className="attachment-preview"><div className="section-heading"><h3>{preview.title}</h3><Button variant="ghost" size="icon-sm" aria-label="Fechar imagem" onClick={() => setPreview(null)}><X/></Button></div><img src={preview.url} alt={preview.title}/></section>}
      </aside>}
    </div>
  </main>;
}
