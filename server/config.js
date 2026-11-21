import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const env = process.env;

const port = Number(env.PORT || 3000);
export const SENHA_MIN = 10;

export const config = {
  port,
  baseUrl: (env.BASE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  // The one and only panel account lives in .env.
  adminUser: (env.ADMIN_USER || '').trim(),
  adminPassword: env.ADMIN_PASSWORD || '',
  dataDir: path.resolve(ROOT, env.DATA_DIR || 'data'),
  distDir: path.join(ROOT, 'dist'),
  trustProxy: env.TRUST_PROXY === '1',
  production: env.NODE_ENV === 'production',
};
config.https = config.baseUrl.startsWith('https://');
config.adminOk = config.adminUser.length > 0 && config.adminPassword.length >= SENHA_MIN;

// ---- the party (config/evento.json): the only place its details live
export const evento = JSON.parse(fs.readFileSync(env.EVENTO_FILE ? path.resolve(ROOT, env.EVENTO_FILE) : path.join(ROOT, 'config', 'evento.json'), 'utf8'));
export const inicioMs = Date.parse(evento.inicio);
if (Number.isNaN(inicioMs)) throw new Error('config/evento.json: "inicio" inválido');
// Answers close at "prazo" (a date and time); without it, "prazoHorasAntes" hours before the party (24 by default).
export const prazoMs = evento.prazo ? Date.parse(evento.prazo) : inicioMs - (evento.prazoHorasAntes ?? 24) * 3600e3;
if (Number.isNaN(prazoMs)) throw new Error('config/evento.json: "prazo" inválido');

const fuso = evento.fuso || 'America/Sao_Paulo';
function quando(ms, comAno) {
  const d = new Date(ms);
  const dia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', ...(comAno ? { year: 'numeric' } : {}), timeZone: fuso }).format(d);
  const [h, m] = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: fuso }).format(d).split(':');
  if (h === '23' && m === '59') return dia;          // "until the end of that day" reads better as just the day
  return `${dia}, às ${Number(h)}h${m === '00' ? '' : m}`;
}
const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: fuso }).format(new Date(inicioMs));
export const textos = {
  prazo: quando(prazoMs, false),      // "7 de janeiro" (or "16 de janeiro, às 17h")
  inicio: quando(inicioMs, true),     // "17 de janeiro de 2027, às 17h"
  diaSemana: semana.charAt(0).toUpperCase() + semana.slice(1), // "Domingo"
};
const destino = encodeURIComponent([evento.local, ...evento.endereco].join(', '));
export const mapaUrl = 'https://www.google.com/maps/search/?api=1&query=' + destino;
export const wazeUrl = 'https://waze.com/ul?q=' + destino + '&navigate=yes';
