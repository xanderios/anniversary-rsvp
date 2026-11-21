// The whole "database": data/convites.json, read into memory and rewritten on every change.
// It can also be edited by hand; an entry only needs a "nome" (the rest is filled in).
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { tokenConvite, tokenOk } from './security.js';

const arquivo = path.join(config.dataDir, 'convites.json');
let convites = [];
let visto = -1; // mtime of the file as we last read or wrote it

const limpo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const tempo = (v) => (Number.isFinite(v) && v > 0 ? v : null);

function normalizar(bruto) {
  const lista = Array.isArray(bruto) ? bruto : bruto?.convites;
  if (!Array.isArray(lista)) throw new Error('esperado { "convites": [...] }');
  const tokens = new Set(), ids = new Set();
  let mudou = false;
  const saida = [];
  for (const c of lista) {
    const nome = limpo(c?.nome);
    if (!nome) { mudou = true; continue; }
    let token = c.token;
    if (!tokenOk(token) || tokens.has(token)) { do token = tokenConvite(); while (tokens.has(token)); mudou = true; }
    tokens.add(token);
    let id = Number.isInteger(c.id) && c.id > 0 && !ids.has(c.id) ? c.id : 0;
    saida.push({
      id, token, nome,
      resposta: c.resposta === 'sim' || c.resposta === 'nao' ? c.resposta : null,
      criadoEm: tempo(c.criadoEm) || Date.now(),
      abertoEm: tempo(c.abertoEm),
      respondidoEm: tempo(c.respondidoEm),
    });
    if (id) ids.add(id);
  }
  let prox = Math.max(0, ...ids) + 1;
  for (const c of saida) if (!c.id) { c.id = prox++; mudou = true; }
  return { saida, mudou };
}

function gravar() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ convites }, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, arquivo); // atomic: a crash never leaves half a file
  visto = fs.statSync(arquivo).mtimeMs;
}

function carregar(inicial) {
  let m;
  try { m = fs.statSync(arquivo).mtimeMs; } catch { m = 0; }
  if (m === visto) return;
  if (!m) { convites = []; visto = 0; return; }
  try {
    const { saida, mudou } = normalizar(JSON.parse(fs.readFileSync(arquivo, 'utf8')));
    convites = saida;
    visto = m;
    if (mudou) gravar();
  } catch (e) {
    if (inicial) throw new Error(`data/convites.json inválido: ${e.message}`);
    console.error(`data/convites.json foi alterado e ficou inválido (${e.message}); mantendo a última versão boa.`);
    visto = m;
  }
}
carregar(true);

export const store = {
  todos() { carregar(); return [...convites].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })); },
  porToken(token) { carregar(); return convites.find((c) => c.token === token) || null; },
  criar(nomeBruto) {
    carregar();
    const nome = limpo(nomeBruto);
    if (!nome) return null;
    let token;
    do token = tokenConvite(); while (convites.some((c) => c.token === token));
    const c = { id: Math.max(0, ...convites.map((x) => x.id)) + 1, token, nome, resposta: null, criadoEm: Date.now(), abertoEm: null, respondidoEm: null };
    convites.push(c);
    gravar();
    return c;
  },
  renomear(id, nomeBruto) {
    carregar();
    const c = convites.find((x) => x.id === id), nome = limpo(nomeBruto);
    if (!c || !nome) return false;
    c.nome = nome;
    gravar();
    return true;
  },
  excluir(id) {
    carregar();
    const i = convites.findIndex((x) => x.id === id);
    if (i < 0) return false;
    convites.splice(i, 1);
    gravar();
    return true;
  },
  abrir(c) {
    if (c.abertoEm) return;
    c.abertoEm = Date.now();
    gravar();
  },
  responder(c, resposta) {
    c.resposta = resposta;
    c.respondidoEm = Date.now();
    gravar();
  },
};
