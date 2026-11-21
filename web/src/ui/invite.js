// The letter inside the envelope: "Bem-vindo ao castelo", with the countdown, the three
// details, the address, the map / calendar buttons and the notes.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icone = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;

export function buildInvite(dados, token) {
  const ev = dados.evento;
  const el = document.createElement('div');
  el.className = 'inv';
  el.innerHTML = `
    <div class="inv-title">${esc(ev.boasVindas)}</div>
    <p class="inv-sub">${esc(ev.subtitulo)}</p>
    <div class="inv-count" data-count>
      <div class="inv-tile"><b data-u="d">–</b><span>dias</span></div>
      <div class="inv-tile"><b data-u="h">–</b><span>horas</span></div>
      <div class="inv-tile"><b data-u="m">–</b><span>min</span></div>
      <div class="inv-tile"><b data-u="s">–</b><span>seg</span></div>
    </div>
    <p class="inv-note" data-count-note>${esc(ev.contagemNota)}</p>
    <div class="inv-details">
      <div>${icone('cal')}<b>${esc(ev.dataLonga)}</b><span>${esc(ev.diaSemana)}</span></div>
      <div>${icone('clock')}<b>${esc(ev.horaLonga)}</b><span>${esc(ev.horaNota)}</span></div>
      <div>${icone('pin')}<b>${esc(ev.local)}</b><span>${esc(ev.bairro)}</span></div>
    </div>
    <p class="inv-addr">${esc(ev.enderecoLinha)}</p>
    <div class="inv-actions">
      <a class="inv-btn pri" data-k="mapa" href="${esc(dados.mapaUrl)}" target="_blank" rel="noopener noreferrer">${icone('pin')}Abrir no mapa</a>
      <a class="inv-btn" data-k="waze" href="${esc(dados.wazeUrl)}" target="_blank" rel="noopener noreferrer">Waze</a>
      <a class="inv-btn" data-k="agenda" href="/c/${esc(token)}/evento.ics">${icone('agenda')}Salvar na agenda</a>
    </div>
    <ul class="inv-notes">${(ev.avisos || []).map((a) => `<li>${icone('heart')}<span>${esc(a)}</span></li>`).join('')}</ul>`;
  return el;
}

// Keeps every copy of the countdown (one per folded panel) in step with the clock.
export function startCountdown(root, inicioIso) {
  const alvo = Date.parse(inicioIso);
  if (Number.isNaN(alvo)) return;
  const dois = (n) => String(n).padStart(2, '0');
  let timer = 0;
  function tick() {
    let falta = alvo - Date.now();
    if (falta <= 0) {
      root.querySelectorAll('[data-count]').forEach((c) => { c.innerHTML = '<div class="inv-tile hoje"><b>É hoje!</b></div>'; });
      root.querySelectorAll('[data-count-note]').forEach((n) => { n.textContent = 'a princesa está esperando por você'; });
      clearInterval(timer);
      return;
    }
    const d = Math.floor(falta / 864e5); falta -= d * 864e5;
    const h = Math.floor(falta / 36e5); falta -= h * 36e5;
    const m = Math.floor(falta / 6e4), s = Math.floor((falta % 6e4) / 1e3);
    const v = { d: String(d), h: dois(h), m: dois(m), s: dois(s) };
    root.querySelectorAll('[data-u]').forEach((b) => { const t = v[b.dataset.u]; if (b.textContent !== t) b.textContent = t; });
  }
  tick();
  timer = setInterval(tick, 1000);
}

// One plain reading of the letter for screen readers (the three folded panels are visual only).
export function inviteText(ev) {
  return `${ev.boasVindas}. ${ev.subtitulo}. ${ev.dataLonga}, ${ev.diaSemana}, ${ev.horaLonga}: ${ev.horaNota}. ${ev.local}, ${ev.enderecoLinha}. ${(ev.avisos || []).join('. ')}.`;
}
