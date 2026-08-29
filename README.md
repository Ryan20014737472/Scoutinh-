# FTC Scout Arena

Aplicação mobile-first para registrar scouting de FIRST Tech Challenge durante partidas.

## O que está implementado

- fluxo de scouting por Autonomous, TeleOp, Endgame e diagnóstico do robô;
- ações e pontos configuráveis por temporada;
- rascunhos e registros persistentes no navegador (IndexedDB, com fallback local);
- validação de quantidades, bloqueio de registros duplicados e confirmação antes de salvar;
- painel, perfis de equipe, ranking interno, comparação, favoritos, watchlist, estatísticas e exportação CSV/JSON;
- modo offline visual e cache do app por service worker.

## Desenvolvimento

O projeto não depende de pacotes externos. Use o Node.js para validar e gerar o bundle estático:

```text
node scripts/check.mjs
node scripts/build.mjs
```

O build compatível com Sites é criado em `dist/`, com arquivos estáticos em
`dist/client/` e a entrada de hospedagem em `dist/server/index.js`.

## Limite da versão local

Os dados são mantidos no dispositivo, então a colaboração entre celulares e a sincronização com banco central ainda exigem uma camada de backend/autenticação. A estrutura de entidades, regras de temporada e registros já está organizada para essa próxima integração.
