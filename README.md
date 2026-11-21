# Convite · castelo 3D com confirmação de presença

## Rodar no computador

```bash
npm install
cp .env.example .env      # defina ADMIN_USER e ADMIN_PASSWORD (10 caracteres ou mais)
npm run build             # compila o site em dist/
npm run seed:dev          # só para testes: cria convites de exemplo e mostra os links
npm start                 # http://localhost:3000 (ou a PORT do .env)
```

## Como funciona

- `/c/<token>`: o convite de cada convidado. Sem token válido, aparece a página de portões fechados.
- `/admin`: painel. Uma única conta, definida por `ADMIN_USER` e `ADMIN_PASSWORD` no `.env`. Sem e-mail, sem cadastro.
- Convites e respostas ficam em `data/convites.json`. Faça backup desse arquivo. Ele também pode ser editado à mão:
  basta acrescentar `{ "nome": "Família Tal" }` à lista e o servidor cria o link.
- Respostas podem ser dadas e alteradas até o fim do dia 7 de janeiro (`prazo` em `config/evento.json`; sem ele vale `prazoHorasAntes`, em horas antes da festa).
- Dados da festa: `config/evento.json`.
- `?imagens` no fim do link força a versão com imagens estáticas (sem 3D).

## Segurança

- Cada link tem 16 caracteres aleatórios (cerca de 93 bits): não dá para adivinhar.
- Quem errar 8 links em uma hora fica bloqueado de todos os convites por 1 hora (depois 2 h, 4 h... até 24 h).
- Login do painel: 5 tentativas erradas por endereço a cada 15 minutos (60 no total); a sessão vale 7 dias e
  termina quando o servidor reinicia.

## Produção (VPS)

1. Node 22+, clonar o projeto, `npm ci && npm run build`.
2. `.env` com `BASE_URL=https://seu-dominio`, `ADMIN_USER`, `ADMIN_PASSWORD` e `TRUST_PROXY=1`.
3. Rodar `npm start` como serviço (systemd ou pm2), ouvindo em 127.0.0.1.
4. Colocar um proxy com HTTPS na frente (ex.: Caddy: `seu-dominio { reverse_proxy 127.0.0.1:3000 }`). HTTPS é obrigatório para o iPhone liberar o movimento do aparelho.

## Modelos 3D

As cenas (castelo, jardim, caminho, salão) são geradas pelos scripts em `blender/`. Para reexportar os modelos da web
(`web/src/models/*.glb`) depois de mexer neles:

```bash
sh scripts/export-models.sh          # precisa do Blender no PATH; --save também regrava blender/castelo.blend
npm run build
```

O percurso da câmera fica em `web/src/scene/journey.js`; `CAM_TRACK` em `blender/exterior.py` repete os mesmos pontos
para que nada (árvores, arbustos, borboletas) fique no caminho da câmera.
