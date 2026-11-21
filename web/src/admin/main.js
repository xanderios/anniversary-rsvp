import '../styles/admin.css';

const app = document.getElementById('app');

// ---------------------------------------------------------------- tiny helpers
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const mount = (...nodes) => app.replaceChildren(...nodes);

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch('/api/admin' + path, {
    method,
    headers: { 'X-Requested-With': 'convite', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.erro || 'Algo deu errado. Tente de novo.'), { status: r.status });
  return j;
}

const quando = (ms) => (ms ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)) : '—');

// A form that shows its own errors and disables itself while sending.
function formulario(campos, rotulo, enviar, extra = []) {
  const aviso = h('p', { class: 'msg err', hidden: true, role: 'alert' });
  const botao = h('button', { class: 'btn pri full', type: 'submit', text: rotulo });
  const form = h('form', {
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      aviso.hidden = true;
      botao.disabled = true;
      try {
        await enviar(Object.fromEntries(new FormData(form)));
      } catch (x) {
        aviso.textContent = x.message;
        aviso.hidden = false;
      } finally {
        botao.disabled = false;
      }
    },
  }, campos, aviso, botao, extra);
  return form;
}
const campo = (rotulo, attrs) => h('label', {}, rotulo, h('input', attrs));

// ---------------------------------------------------------------- sign-in
function telaLogin() {
  mount(h('section', { class: 'auth' },
    h('span', { class: 'eyebrow', text: 'Painel de convites' }),
    h('h1', { text: 'Entrar' }),
    formulario(
      [campo('Usuário', { name: 'usuario', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true, id: 'f-usuario' }),
        campo('Senha', { name: 'senha', type: 'password', autocomplete: 'current-password', required: true, id: 'f-senha' })],
      'Entrar',
      async (d) => { await api('/login', { method: 'POST', body: d }); painel(); },
    ),
  ));
  app.querySelector('input')?.focus();
}

// ---------------------------------------------------------------- panel
async function painel() {
  let eu, lista;
  try {
    [eu, lista] = await Promise.all([api('/eu'), api('/convites')]);
  } catch (x) {
    if (x.status === 401) return telaLogin();
    mount(h('section', { class: 'auth' }, h('p', { class: 'msg err', text: x.message })));
    return;
  }
  document.title = `Convites · ${eu.evento.nome}`;
  const aviso = h('p', { class: 'msg err', hidden: true, role: 'alert' });
  const falha = (x) => { if (x.status === 401) return telaLogin(); aviso.textContent = x.message; aviso.hidden = false; aviso.scrollIntoView({ block: 'nearest' }); };
  const recarregar = () => painel();

  // two-step delete without a browser dialog
  const perigoso = (rotulo, confirma, acao) => {
    const b = h('button', { class: 'txt danger', type: 'button', text: rotulo });
    let armado = false, t;
    b.addEventListener('click', async () => {
      if (!armado) { armado = true; b.textContent = confirma; t = setTimeout(() => { armado = false; b.textContent = rotulo; }, 4000); return; }
      clearTimeout(t);
      b.disabled = true;
      try { await acao(); recarregar(); } catch (x) { falha(x); b.disabled = false; }
    });
    return b;
  };

  const copiar = (texto, b) => {
    const ok = () => { const o = b.textContent; b.textContent = 'Copiado'; setTimeout(() => (b.textContent = o), 1600); };
    (navigator.clipboard?.writeText(texto) || Promise.reject()).then(ok).catch(() => { window.prompt('Copie o link:', texto); });
  };
  const zap = (c) => 'https://wa.me/?text=' + encodeURIComponent(`Você está convidado para o aniversário de ${eu.evento.idade} de ${eu.evento.nome}. Abra o seu convite: ${c.link}`);
  const rot = { sim: ['sim', 'Confirmado'], nao: ['nao', 'Não vai'] };

  const linha = (c) => {
    const nome = h('td', { class: 'nome', text: c.nome });
    const renomear = h('button', { class: 'txt', type: 'button', text: 'Renomear' });
    renomear.addEventListener('click', () => {
      const inp = h('input', { value: c.nome, maxlength: '80', 'aria-label': 'Nome no envelope' });
      const salvar = async () => {
        const v = inp.value.trim();
        if (!v || v === c.nome) return recarregar();
        try { await api('/convites/' + c.id, { method: 'PATCH', body: { nome: v } }); recarregar(); } catch (x) { falha(x); }
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') recarregar(); });
      inp.addEventListener('blur', salvar);
      nome.replaceChildren(inp);
      inp.focus(); inp.select();
    });
    const [cls, txt] = rot[c.resposta] || ['pend', 'Pendente'];
    const bCopiar = h('button', { class: 'txt', type: 'button', text: 'Copiar link' });
    bCopiar.addEventListener('click', () => copiar(c.link, bCopiar));
    return h('tr', {}, nome,
      h('td', {}, h('span', { class: 'st ' + cls, text: txt })),
      h('td', { text: c.abertoEm ? quando(c.abertoEm) : 'ainda não' }),
      h('td', { text: quando(c.respondidoEm) }),
      h('td', { class: 'acts' }, bCopiar, h('a', { class: 'txt', href: zap(c), target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp' }), renomear,
        perigoso('Excluir', 'Confirmar exclusão?', () => api('/convites/' + c.id, { method: 'DELETE' }))));
  };

  const r = lista.resumo;
  const novoNome = h('input', { name: 'nome', maxlength: '80', placeholder: 'Família Oliveira', required: true, id: 'f-convite', autocomplete: 'off' });
  const novo = h('form', {
    class: 'novo',
    onsubmit: async (e) => {
      e.preventDefault();
      aviso.hidden = true;
      try { await api('/convites', { method: 'POST', body: { nome: novoNome.value } }); recarregar(); } catch (x) { falha(x); }
    },
  }, h('label', {}, 'Nome no envelope', novoNome), h('button', { class: 'btn pri', type: 'submit', text: 'Criar convite' }));

  mount(h('div', { class: 'panel' },
    h('header', {},
      h('div', {}, h('span', { class: 'eyebrow', text: 'Painel da família' }), h('h1', { text: `Convites de ${eu.evento.nome}` })),
      h('div', { class: 'who' }, eu.usuario, h('button', { class: 'txt', type: 'button', text: 'Sair', onclick: async () => { await api('/sair', { method: 'POST' }).catch(() => {}); telaLogin(); } }))),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', { text: r.convites }), h('span', { text: 'convites' })),
      h('div', { class: 'stat' }, h('b', { text: r.sim }), h('span', { text: 'confirmados' })),
      h('div', { class: 'stat' }, h('b', { text: r.nao }), h('span', { text: 'não vão' })),
      h('div', { class: 'stat' }, h('b', { text: r.pendentes }), h('span', { text: 'pendentes' }))),
    aviso,
    h('section', { class: 'card' },
      h('span', { class: 'eyebrow', text: 'Novo convite' }),
      novo,
      h('p', { class: 'muted', text: 'Um convite por casa, família, casal ou pessoa. O nome aparece no envelope.' })),
    h('section', { class: 'card' },
      h('div', { class: 'foot' }, h('span', { class: 'eyebrow', text: 'Convites' }), lista.convites.length ? h('a', { class: 'txt', href: '/api/admin/convites.csv', text: 'Baixar planilha' }) : null),
      lista.convites.length
        ? h('div', { class: 'tbl' }, h('table', {},
            h('thead', {}, h('tr', {}, ['Convite', 'Resposta', 'Abriu', 'Respondeu', ''].map((t) => h('th', { text: t })))),
            h('tbody', {}, lista.convites.map(linha))))
        : h('p', { class: 'empty', text: 'Nenhum convite ainda. Crie o primeiro acima.' })),
  ));
}

// ---------------------------------------------------------------- start
painel();
