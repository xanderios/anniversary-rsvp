// Local development only: adds a few sample invitations to data/convites.json (when it is empty)
// and prints every link.
import { config } from '../server/config.js';
import { store } from '../server/store.js';

if (config.production) throw new Error('seed:dev não roda em produção.');
if (store.todos().length === 0) {
  for (const nome of ['Família Oliveira', 'Vovó Lúcia', 'Carla e Beto', 'Padrinhos Renata e Diego']) store.criar(nome);
}
for (const c of store.todos()) console.log(`${c.nome}: ${config.baseUrl}/c/${c.token}`);
