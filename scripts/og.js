// Draws (again) the link picture of every invitation: the one WhatsApp shows beside the link.
// The server makes each one by itself when an invitation is created, renamed or first shared;
// this is for seeing them all at once, or for having them ready after editing config/evento.json.
import { store } from '../server/store.js';
import { ogAtivo, ogImagem, ogVersao } from '../server/og.js';
import { config } from '../server/config.js';
import path from 'node:path';

if (!ogAtivo) throw new Error('A biblioteca de desenho (@napi-rs/canvas) não pôde ser carregada.');
const todos = store.todos();
for (const c of todos) {
  const jpg = await ogImagem(c);
  console.log(`${c.nome}: ${path.join(config.dataDir, 'og', `${c.id}-${ogVersao(c)}.jpg`)} (${Math.round(jpg.length / 1024)} KB)`);
}
if (!todos.length) console.log('Nenhum convite ainda.');
