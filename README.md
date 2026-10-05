# Acrux Scout

Scouting de FIRST Tech Challenge em português, com uma interface para computador e celular. Cadastre seu evento, observe as equipes e acompanhe os resultados sem depender da conexão durante as partidas.

A identidade visual usa a marca da Acrux #23311: azul profundo, ciano, branco e a estrela amarela. A logo original está em `assets/acrux-logo.jpg` e é incluída no build e no cache offline. As telas de trabalho mantêm fundos claros e controles com contraste.

## Como usar

1. Clique em **Preparar meu evento** na visão geral. Informe o evento e seu nome.
2. Cole as equipes, uma por linha, no formato `12345; Nome da equipe`. Também é possível adicionar equipes individualmente na página **Equipes**.
3. Monte a partida com duas equipes em cada aliança. O horário é opcional.
4. Em **Partidas**, toque na equipe que você vai observar. Avance por Auto, TeleOp, Endgame e Robô; os rascunhos são salvos automaticamente.
5. Revise e confirme o registro. Para corrigir uma observação, abra-a pelo histórico da equipe ou em **Gerenciar evento**.

A visão geral mostra a agenda, a cobertura do evento, os últimos registros e as equipes que precisam de atenção. A busca filtra enquanto você digita; favoritos, comparações, ranking e estatísticas ficam acessíveis também no celular. Links de equipes e rascunhos podem ser reabertos ou recarregados, e os botões de voltar e avançar do navegador funcionam.

## Dados e backup

Os dados ficam no navegador, usando IndexedDB ou localStorage. Sair de uma observação mantém o rascunho. Escritas são organizadas em uma fila e, em navegadores com Web Locks, coordenadas entre abas. Registros duplicados da mesma equipe e partida são bloqueados.

Em **Configurações**, exporte planilhas CSV ou observações em JSON. **Backup completo** inclui todos os eventos e rascunhos. Para transferir para outro dispositivo, baixe o backup e use **Restaurar um backup** no destino. O arquivo é validado e um resumo pede confirmação antes de substituir os dados.

O app funciona offline depois da primeira abertura com internet. O cache busca arquivos atualizados quando há conexão. Se o navegador impedir o armazenamento, as configurações mostram que os dados estão apenas na sessão.

Não há backend ou sincronização entre dispositivos. Os backups permitem transferir o workspace, mas não mesclam registros de scouts diferentes.

## Temporada e pontuação

O workspace começa vazio, com o preset BIOBUZZ 2026–2027 em **modo de observação**: registra ações, ciclos e a condição do robô, sem calcular placar. É possível adaptar as métricas na página **Temporada e regras**. Métricas usadas em registros ou rascunhos não podem ser removidas; a consistência considera a variação dos ciclos observados.

O preset DECODE 2025–2026 mantém a referência histórica do [Competition Manual FIRST](https://ftc-resources.firstinspires.org/ftc/archive/2026/game/cm-html/DECODE_Competition_Manual_TU32.htm). Seus valores ficam protegidos. Consulte os [materiais oficiais da FIRST](https://ftc-resources.firstinspires.org/ftc/game) para revisar as regras do seu evento. O ranking do aplicativo é um índice interno, e as estimativas de contribuição não substituem o placar oficial da aliança.

## Desenvolvimento

Node.js 20 ou superior. A aplicação e o build não precisam de pacotes externos.

```sh
npm run dev          # http://localhost:4173
npm run check        # verifica a sintaxe dos módulos, scripts e service worker
npm test             # testes de dados, importação, pontuação e persistência
npm run build        # cria dist/client e dist/server
npm run preview      # serve o build de produção
```

O repositório pode ser servido diretamente pelo GitHub Pages, inclusive sob `/Scoutinh-/`: os caminhos dos recursos são relativos. O build mantém compatibilidade com a entrada de hospedagem existente em `.openai/hosting.json`.

O teste no navegador cobre preparação, busca durante a digitação, navegação, contadores rápidos, retomada, correção de registros, backup, offline, teclado e telas de 320, 390, 768 e 1440 pixels. Com Playwright para Python e Chromium instalados, execute contra um servidor ativo:

```sh
python tests/browser.py
```

Use `SCOUT_TEST_URL` e `CHROMIUM_PATH` para selecionar o servidor e o executável do navegador. As capturas de tela e os backups de teste são gravados em `outputs/`, fora do controle de versão.
