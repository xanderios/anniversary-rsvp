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
- Dados da festa: `config/evento.json` (o servidor lê o arquivo ao iniciar: reinicie depois de editar).
  Opcionais, para a página que aparece depois da carta: `contato.whatsapp` (só dígitos, com DDI: botão "Falar no WhatsApp") e
  `presentes` (`itens`: lista de `{ "nome", "obs", "url" }`; `pix`: chave PIX) para as sugestões de presente. Sem um campo,
  a parte correspondente some. Os valores que estão lá são exemplos: troque antes de enviar os convites.
- O convite inteiro é uma rolagem só: o passeio pelo jardim, o salão, o envelope que sobe, o selo que se rompe, a carta
  que sai e se desdobra e, depois dela, a resposta, os presentes e a despedida. Rolar para cima desfaz tudo, até o
  jardim. O selo e o aviso "Role para abrir o convite" também são botões (rolam a abertura sozinhos), e "Pular para o
  convite" leva até o envelope ainda fechado. O tamanho de cada trecho está em `web/src/scene/journey.js`
  (`TAIL_SCREENS`, `OPEN_SCREENS`, `ENVELOPE`, `OPENING`). Com "reduzir movimento" ligado, a carta só tem dois estados:
  fechada e aberta.
- A última linha da página é o crédito "Feito com ❤️ por Alexandre Rios" (`CREDITO` em `web/src/ui/page.js`).
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

## Qualidade da imagem

- O site mede a placa de vídeo do aparelho (biblioteca `detect-gpu`, com as tabelas servidas pelo próprio site em
  `/benchmarks`) e escolhe uma de três versões da cena: **baixa**, **média** ou **alta**. Depois acompanha os quadros
  por segundo: se cair abaixo de 50, desenha menos pixels; se ainda assim não bastar, passa para a versão mais leve.
- A engrenagem no canto superior direito deixa o convidado escolher (Automática, Alta, Média, Baixa). A escolha fica
  guardada no aparelho. No mesmo menu fica a escolha entre dia e noite (veja abaixo).
- O que cada versão desenha está em `web/src/quality.js` (`PRESETS`).
- Para testar: `?q=low`, `?q=medium`, `?q=high` no fim do link.

## Dia e noite

O céu segue o relógio de quem abre o convite: azul de dia, com o sol saindo de trás da nuvem à direita do castelo,
borboletas e pétalas caindo; à noite, a lua minguante ao lado da mesma nuvem, estrelas, estrelas cadentes, os postes
acesos e vaga-lumes no lugar das borboletas, sem pétalas do lado de fora (amanhecer das 5h30 às 6h30, anoitecer das
17h30 às 18h30). Para testar: `?ceu=noite`, `?ceu=dia` ou `?hora=18`.

- A engrenagem também deixa escolher o céu: **Relógio** (o padrão), **Dia** ou **Noite**. A escolha vale para aquela
  visita; na seguinte, o relógio volta a decidir.
- O sol e a lua acompanham essa nuvem durante todo o passeio; a lua fica um pouco acima e à direita dela (`REST`).
- Ao trocar, o sol e a lua giram na mesma roda, sempre para a esquerda: um se põe à esquerda enquanto o outro nasce à
  direita, e a luz passa por um crepúsculo rosado no meio do caminho. Cores do céu em `web/src/scene/sky.js` (`SKY`),
  luz em `LIGHT` e posição, tamanho, desenho da lua e velocidade em `REST`, `BODY`, `MOON`, `SHADE` e `TURN`, no começo
  de `web/src/scene/world.js`. O sol e a lua são figuras planas (um disco e um crescente), desenhadas pela própria cena.
- Os vaga-lumes são modelinhos (`fireflyGeometry` em `web/src/scene/world.js`) com a lanterna acesa, e os mais próximos
  de onde a câmera olha iluminam de verdade o que está em volta.

## Modelos 3D

As cenas (castelo, jardim, caminho, postes, salão) são geradas pelos scripts em `blender/`, uma vez para cada versão
(`garden-low.glb`, `garden.glb`, `garden-high.glb` e o mesmo para `hall`). A luz do salão é calculada pelo Blender
(Cycles) e gravada nos vértices; o site só a mostra. Para reexportar depois de mexer nos scripts:

```bash
sh scripts/export-models.sh          # as três versões; precisa do Blender no PATH; leva uns 3 minutos
sh scripts/export-models.sh medium   # só uma
sh scripts/export-models.sh --save   # também regrava blender/castelo.blend
npm run build
```

O percurso da câmera fica em `web/src/scene/journey.js`; `CAM_TRACK` em `blender/exterior.py` repete os mesmos pontos
para que nada (árvores, arbustos, postes, borboletas, vaga-lumes) fique no caminho da câmera.

As imagens estáticas (`web/public/stills`, usadas com `?imagens`, sem WebGL ou com "reduzir movimento" ligado) são
desenhadas pela própria cena, de dia e de noite, deitadas e em pé. Para refazê-las depois de mudar os modelos: com
`npm run dev` e `npm run dev:web` rodando, abra um convite com `?fotos` no fim do link e espere a mensagem
"22 imagens salvas".
