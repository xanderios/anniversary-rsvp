// The family panel. One account, defined by ADMIN_USER and ADMIN_PASSWORD in .env.
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { config, evento, SENHA_MIN } from './config.js';
import { store } from './store.js';
import { chaveIp, contagem, iguais, limite, segredo, sha } from './security.js';

const SESSAO_MS = 7 * 864e5;
const JANELA_LOGIN = 15 * 60e3;
const cookie = { httpOnly: true, sameSite: 'Strict', secure: config.https, path: '/api/admin' };

// Sessions live in memory only: restarting the server signs everyone out.
const sessoes = new Map(); // sha(sid) -> expiry
setInterval(() => {
  const agora = Date.now();
  for (const [k, ate] of sessoes) if (ate < agora) sessoes.delete(k);
}, 600e3).unref();

function sessao(c) {
  const sid = getCookie(c, 'sid');
  if (!sid || sid.length > 100) return null;
  const k = sha(sid), ate = sessoes.get(k);
  if (!ate || ate < Date.now()) { sessoes.delete(k); return null; }
  return k;
}

const erro = (c, status, mensagem) => c.json({ erro: mensagem }, status);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const corpo = async (c) => {
  try {
    const j = await c.req.json();
    return j && typeof j === 'object' ? j : {};
  } catch {
    return {};
  }
};

const vista = (r) => ({
  id: r.id, nome: r.nome, resposta: r.resposta, criadoEm: r.criadoEm, abertoEm: r.abertoEm, respondidoEm: r.respondidoEm,
  link: `${config.baseUrl}/c/${r.token}`,
});

export function rotasAdmin(ipDe) {
  const app = new Hono();

  app.use('*', bodyLimit({ maxSize: 4096, onError: (c) => erro(c, 413, 'Pedido grande demais.') }));

  // Every state-changing call must come from our own page: custom header + same origin.
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      if (c.req.header('x-requested-with') !== 'convite') return erro(c, 403, 'Pedido recusado.');
      const origem = c.req.header('origin');
      if (origem) {
        let host = '';
        try { host = new URL(origem).host; } catch { /* malformed */ }
        if (host !== c.req.header('host') && origem !== new URL(config.baseUrl).origin) return erro(c, 403, 'Pedido recusado.');
      }
    }
    if (!config.adminOk) return erro(c, 503, `Painel desativado: defina ADMIN_USER e ADMIN_PASSWORD (${SENHA_MIN} caracteres ou mais) no arquivo .env e reinicie.`);
    await next();
  });

  // ---- sign-in: user + password, slow to guess
  app.post('/login', async (c) => {
    const ip = chaveIp(ipDe(c));
    // 5 wrong tries per address, 60 in total per quarter of an hour; then the door stays shut for a while.
    if (contagem('login:' + ip, JANELA_LOGIN) >= 5 || contagem('login:*', JANELA_LOGIN) >= 60) {
      return erro(c, 429, 'Muitas tentativas. Aguarde alguns minutos.');
    }
    const { usuario, senha } = await corpo(c);
    const okUsuario = iguais(String(usuario ?? '').trim(), config.adminUser);
    const okSenha = iguais(String(senha ?? ''), config.adminPassword);
    if (!(okUsuario && okSenha)) {
      limite('login:' + ip, 5, JANELA_LOGIN);
      limite('login:*', 60, JANELA_LOGIN);
      await pausa(400 + Math.random() * 300);
      return erro(c, 401, 'Usuário ou senha incorretos.');
    }
    const sid = segredo();
    if (sessoes.size >= 20) sessoes.delete(sessoes.keys().next().value);
    sessoes.set(sha(sid), Date.now() + SESSAO_MS);
    setCookie(c, 'sid', sid, { ...cookie, maxAge: SESSAO_MS / 1000 });
    return c.json({ ok: true });
  });

  app.post('/sair', (c) => {
    const k = sessao(c);
    if (k) sessoes.delete(k);
    deleteCookie(c, 'sid', { path: cookie.path });
    return c.json({ ok: true });
  });

  // ---- everything below needs a session
  app.use('*', async (c, next) => {
    if (!sessao(c)) return erro(c, 401, 'Sessão encerrada. Entre de novo.');
    await next();
  });

  app.get('/eu', (c) => c.json({ usuario: config.adminUser, evento: { nome: evento.nome, idade: evento.idade } }));

  app.get('/convites', (c) => {
    const linhas = store.todos();
    const total = (f) => linhas.filter(f).length;
    return c.json({
      convites: linhas.map(vista),
      resumo: { convites: linhas.length, sim: total((r) => r.resposta === 'sim'), nao: total((r) => r.resposta === 'nao'), pendentes: total((r) => !r.resposta) },
    });
  });

  app.post('/convites', async (c) => {
    if (store.todos().length >= 2000) return erro(c, 409, 'Limite de convites atingido.');
    const r = store.criar((await corpo(c)).nome);
    return r ? c.json(vista(r), 201) : erro(c, 400, 'Escreva o nome que vai no envelope.');
  });

  app.patch('/convites/:id', async (c) => {
    const nome = String((await corpo(c)).nome ?? '').trim();
    if (!nome) return erro(c, 400, 'Escreva o nome que vai no envelope.');
    return store.renomear(Number(c.req.param('id')), nome) ? c.json({ ok: true }) : erro(c, 404, 'Convite não encontrado.');
  });

  app.delete('/convites/:id', (c) => (store.excluir(Number(c.req.param('id'))) ? c.json({ ok: true }) : erro(c, 404, 'Convite não encontrado.')));

  app.get('/convites.csv', (c) => {
    const d = (ms) => (ms ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: evento.fuso || 'America/Sao_Paulo' }).format(new Date(ms)) : '');
    // quoted, and never starting with a character a spreadsheet would run as a formula
    const q = (s) => `"${String(s).replace(/^([=+\-@\t\r])/, "'$1").replace(/"/g, '""')}"`;
    const rot = { sim: 'Confirmado', nao: 'Não vai' };
    const csv = ['Convite;Resposta;Abriu em;Respondeu em;Link', ...store.todos().map((r) => [q(r.nome), rot[r.resposta] || 'Pendente', d(r.abertoEm), d(r.respondidoEm), `${config.baseUrl}/c/${r.token}`].join(';'))].join('\r\n');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="convites.csv"');
    return c.body('﻿' + csv);
  });

  return app;
}
