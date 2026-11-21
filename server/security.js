import crypto from 'node:crypto';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no look-alikes

// 16 characters out of 57 = about 93 random bits: links cannot be guessed.
export function tokenConvite(n = 16) {
  let s = '';
  while (s.length < n) {
    const b = crypto.randomBytes(1)[0];
    if (b < 228) s += ALFABETO[b % 57];
  }
  return s;
}
export const tokenOk = (t) => typeof t === 'string' && /^[A-Za-z0-9]{8,32}$/.test(t);

export const segredo = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Constant-time comparison of two strings of any length.
export function iguais(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// One key per visitor: an IPv4 address, or the /64 network of an IPv6 one.
export function chaveIp(ip) {
  let s = String(ip || 'local').toLowerCase();
  if (s.startsWith('::ffff:') && s.includes('.')) s = s.slice(7);
  if (!s.includes(':')) return s;
  const [cabeca, cauda = ''] = s.split('::');
  const a = cabeca ? cabeca.split(':') : [], b = cauda ? cauda.split(':') : [];
  const cheio = s.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return cheio.slice(0, 4).join(':') + '::/64';
}

// ---- small in-memory rate limiter (one process, one VPS)
const MAX_CHAVES = 20000;
const baldes = new Map();
export function limite(chave, max, janelaMs) {
  const agora = Date.now();
  const lista = (baldes.get(chave) || []).filter((t) => agora - t < janelaMs);
  if (lista.length >= max) {
    baldes.set(chave, lista);
    return false;
  }
  lista.push(agora);
  if (!baldes.has(chave) && baldes.size >= MAX_CHAVES) baldes.delete(baldes.keys().next().value);
  baldes.set(chave, lista);
  return true;
}
// How many marks a key has in the window, without adding one.
export function contagem(chave, janelaMs) {
  const agora = Date.now();
  return (baldes.get(chave) || []).filter((t) => agora - t < janelaMs).length;
}

// ---- link guessing: a few wrong links and the address is shut out of every invitation
const FALTAS_MAX = 8, FALTAS_JANELA = 3600e3, BLOQUEIO_BASE = 3600e3, BLOQUEIO_MAX = 24 * 3600e3;
const visitantes = new Map(); // key -> { faltas: [ms], ate: ms, vezes: n }

export function bloqueado(ip) {
  const v = visitantes.get(chaveIp(ip));
  return !!v && v.ate > Date.now();
}

export function falta(ip) {
  const k = chaveIp(ip), agora = Date.now();
  let v = visitantes.get(k);
  if (!v) {
    if (visitantes.size >= MAX_CHAVES) visitantes.delete(visitantes.keys().next().value);
    v = { faltas: [], ate: 0, vezes: 0 };
    visitantes.set(k, v);
  }
  v.faltas = v.faltas.filter((t) => agora - t < FALTAS_JANELA);
  v.faltas.push(agora);
  if (v.faltas.length >= FALTAS_MAX) {
    v.vezes += 1;
    v.ate = agora + Math.min(BLOQUEIO_MAX, BLOQUEIO_BASE * 2 ** (v.vezes - 1)); // 1 h, 2 h, 4 h ... 24 h
    v.faltas = [];
    console.warn(`Bloqueio por tentativa de adivinhar convites: ${k} até ${new Date(v.ate).toISOString()}`);
  }
}

setInterval(() => {
  const agora = Date.now();
  for (const [k, v] of baldes) if (!v.some((t) => agora - t < 3600e3)) baldes.delete(k);
  for (const [k, v] of visitantes) if (v.ate < agora - BLOQUEIO_MAX && !v.faltas.some((t) => agora - t < FALTAS_JANELA)) visitantes.delete(k);
}, 600e3).unref();
