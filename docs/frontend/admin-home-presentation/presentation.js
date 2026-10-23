const data = window.HOME_PRESENTATION;
const slides = data.slides;
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let mode = "essential";
let current = slides.findIndex(slide => slide.slug === location.hash.slice(1));
if (current < 0) current = 0;
if (!slides[current].essential) mode = "all";

const rules = `
  <table class="rule-table">
    <thead><tr><th>Ordem</th><th>Evidência que muda a posição</th><th>Tratamento</th></tr></thead>
    <tbody>
      <tr><td>01</td><td>Aula começou e ainda está sem professor.</td><td><span class="status danger"></span>Ação imediata; horário em destaque.</td></tr>
      <tr><td>02</td><td>Aula ou entrada hoje; data de entrada já passou.</td><td><span class="status warning"></span>Hoje em atenção; data passada em vermelho.</td></tr>
      <tr><td>03</td><td>Aula ou entrada nos próximos dois dias.</td><td><span class="status warning"></span>A data mais próxima vem primeiro.</td></tr>
      <tr><td>04</td><td>Espera conhecida de ao menos sete dias; registros de dias anteriores.</td><td><span class="status warning"></span>Espera em atenção; registros neutros.</td></tr>
      <tr><td>05</td><td>Aula ou entrada daqui a três a seis dias.</td><td><span class="status"></span>Preparação, pela data mais próxima.</td></tr>
      <tr><td>06</td><td>Nivelamento recente; encontro encerrado hoje sem registro.</td><td><span class="status"></span>Acompanhamento.</td></tr>
      <tr><td>07</td><td>Aluno sem turma, pedido recente de turma ou prazo desconhecido.</td><td><span class="status"></span>Organização, sem prazo inventado.</td></tr>
      <tr><td>08</td><td>Entrada planejada para daqui a sete dias ou mais.</td><td><span class="status"></span>Planejamento.</td></tr>
    </tbody>
  </table>
  <p class="rule-footnote">Filas independentes podem conter a mesma pessoa. Não existe soma de pessoas pendentes. O histórico anterior aos últimos sete dias tem acesso próprio.</p>`;

const debt = `
  <p class="debt-lead">Entregar a home agora.<br />Revisitar a definição e o contrato dos KPIs depois.</p>
  <div class="debt-grid">
    <section><h2>Débito aceito: KPIs canônicos</h2><p>Definições, cálculos, comparações, permissões e apresentação ainda são locais à home. O próximo trabalho deve estabelecer um contrato comum e migrar esta tela. <a href="../admin-home-kpi-debt.md">Registro completo do débito ↗</a></p></section>
    <section><h2>Movimento não mede aprendizagem</h2><p>Novos alunos, matrículas e experimentais descrevem atividade. Matrículas incluem transferências. Não há meta, nota de saúde da escola ou relação automática com vendas.</p></section>
    <section><h2>Pendências com evidência no domínio</h2><p>As prioridades usam encontros, datas de entrada e tempos de espera conhecidos. Ocorrências e intervenções ainda não oferecem um estado de vencimento que sustente novos alertas. Os limiares de atenção precisam de calibração com a rotina.</p></section>
    <section><h2>O que estas capturas comprovam</h2><p>Mostram a implementação no desktop, com dados controlados e sem gravar registros. A permissão financeira foi simulada. Animações, permissões ponta a ponta e ações de gravação não são comprovadas por uma imagem.</p></section>
  </div>`;

$("#slides").innerHTML = slides.map((slide, index) => `
  <article class="slide" id="slide-${escape(slide.slug)}" aria-labelledby="title-${index}" aria-hidden="true">
    <header class="slide-header">
      <div><p class="eyebrow"><span class="number">${String(index + 1).padStart(2, "0")}</span>${escape(slide.chapter)}</p><h1 id="title-${index}">${escape(slide.title)}</h1></div>
      <div class="capture-label">${slide.image ? "Implementação · dados ilustrativos" : "Critérios da entrega"}<span>${slide.image ? "Desktop · 1440 × 1000 · tema escuro" : "Versão de 23 out. 2026"}</span></div>
    </header>
    ${slide.image ? `<figure class="capture"><button data-zoom="${index}" aria-label="Ampliar captura: ${escape(slide.title)}"><img src="${escape(slide.image)}" alt="${escape(slide.title)}. ${escape(slide.emphasis)}" width="1440" height="1000" /></button></figure>` : `<div class="text-content">${slide.kind === "rules" ? rules : debt}</div>`}
    <div class="notes"><dl>
      <div><dt>Quando acontece</dt><dd>${escape(slide.trigger)}</dd></div>
      <div><dt>O que observar</dt><dd>${escape(slide.emphasis)}</dd></div>
      <div class="action"><dt>Próximo passo</dt><dd>${escape(slide.action)}</dd></div>
    </dl>${slide.note ? `<p class="annotation">${escape(slide.note)}</p>` : ""}</div>
  </article>`).join("");

const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function visibleSlides() {
  const query = normalize($("#search").value.trim());
  const base = mode === "essential" && !query ? slides.flatMap((slide, index) => slide.essential ? [index] : []) : slides.map((_, index) => index);
  return base.filter(index => !query || normalize([slides[index].title, slides[index].chapter, slides[index].trigger, slides[index].emphasis].join(" ")).includes(query));
}

function renderIndex() {
  const indices = visibleSlides();
  const groups = new Map();
  indices.forEach(index => {
    const slide = slides[index];
    if (!groups.has(slide.chapter)) groups.set(slide.chapter, []);
    groups.get(slide.chapter).push(index);
  });
  $("#chapters").innerHTML = [...groups].map(([chapter, items]) => `<section class="chapter"><h2>${escape(chapter)}</h2>${items.map(index => `<button data-slide="${index}" ${index === current ? 'aria-current="step"' : ""}><span>${String(index + 1).padStart(2, "0")}</span><span>${escape(slides[index].title)}</span></button>`).join("")}</section>`).join("");
  $("#no-results").hidden = indices.length > 0;
  $("#essential").setAttribute("aria-pressed", String(mode === "essential"));
  $("#all").setAttribute("aria-pressed", String(mode === "all"));
  const position = indices.indexOf(current);
  $("#position").textContent = position < 0 ? "Estado fora do filtro atual" : `${position + 1} de ${indices.length} · ${$("#search").value ? "resultados da busca" : mode === "essential" ? "roteiro essencial" : "apresentação completa"}`;
  $("#previous").disabled = position <= 0;
  $("#next").disabled = position < 0 || position >= indices.length - 1;
}

function show(index, updateHash = true) {
  if (index < 0 || index >= slides.length) return;
  current = index;
  document.querySelectorAll(".slide").forEach((node, i) => {
    node.classList.toggle("active", i === current);
    node.setAttribute("aria-hidden", String(i !== current));
  });
  if (updateHash) history.replaceState(null, "", `#${slides[current].slug}`);
  document.title = `${String(current + 1).padStart(2, "0")} · ${slides[current].title} — Lazuli`;
  renderIndex();
}

function step(amount) {
  const visible = visibleSlides();
  const position = visible.indexOf(current);
  if (position >= 0 && visible[position + amount] !== undefined) show(visible[position + amount]);
}

function zoom(index = current) {
  const slide = slides[index];
  if (!slide.image) return;
  $("#zoom-title").textContent = `${String(index + 1).padStart(2, "0")} · ${slide.title}`;
  $("#zoom-image").src = slide.image;
  $("#zoom-image").alt = `${slide.title}. ${slide.emphasis}`;
  $(".zoom-body").classList.remove("original");
  $("#original").setAttribute("aria-pressed", "false");
  $("#zoom").showModal();
  $(".zoom-body").scrollTo(0, 0);
}

$("#chapters").addEventListener("click", event => {
  const button = event.target.closest("[data-slide]");
  if (button) show(Number(button.dataset.slide));
});
$("#slides").addEventListener("click", event => {
  const button = event.target.closest("[data-zoom]");
  if (button) zoom(Number(button.dataset.zoom));
});
$("#previous").addEventListener("click", () => step(-1));
$("#next").addEventListener("click", () => step(1));
for (const nextMode of ["essential", "all"]) $("#" + nextMode).addEventListener("click", () => {
  mode = nextMode;
  $("#search").value = "";
  if (mode === "essential" && !slides[current].essential) show(0);
  else renderIndex();
});
$("#search").addEventListener("input", renderIndex);
$("#index-toggle").addEventListener("click", () => {
  const hidden = document.body.classList.toggle("hide-index");
  $("#index-toggle").setAttribute("aria-expanded", String(!hidden));
});
$("#close-zoom").addEventListener("click", () => $("#zoom").close());
$("#original").addEventListener("click", () => {
  const original = $(".zoom-body").classList.toggle("original");
  $("#original").setAttribute("aria-pressed", String(original));
});
$("#zoom").addEventListener("click", event => { if (event.target === $("#zoom")) $("#zoom").close(); });
$("#print").addEventListener("click", async () => {
  await Promise.all([...document.images].filter(image => image.getAttribute("src")).map(image => image.decode().catch(() => {})));
  window.print();
});
document.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest("input, textarea, select") || $("#zoom").open) return;
  if (["ArrowRight", "PageDown"].includes(event.key)) { event.preventDefault(); step(1); }
  if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); step(-1); }
  if (event.key.toLowerCase() === "f") { event.preventDefault(); zoom(); }
});
window.addEventListener("hashchange", () => {
  const index = slides.findIndex(slide => slide.slug === location.hash.slice(1));
  if (index >= 0) {
    if (!slides[index].essential) mode = "all";
    $("#search").value = "";
    show(index, false);
  }
});
show(current);
