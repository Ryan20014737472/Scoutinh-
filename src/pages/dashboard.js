import { getDashboardStats } from "../services/analytics.js";
import { escapeHtml, icon, metricCard, number, sectionHeader } from "../components/ui.js";
import { activeEvent, currentScout, findTeam, getMatchTeams, matchLabel, recordFor } from "../utils/domain.js";

function arenaIllustration() {
  return `<div class="arena-illustration" aria-hidden="true"><span class="arena-orbit orbit-one"></span><span class="arena-orbit orbit-two"></span><div class="arena-field"><svg viewBox="0 0 260 190" fill="none"><path d="M130 15 242 76 130 141 18 76Z" fill="#f4fffb" stroke="#acd8c8" stroke-width="2"/><path d="m18 76 112 65 112-65v15l-112 65L18 91Z" fill="#a7d1c1"/><path d="m55 55 112 65M92 35l112 65M55 98l111-63M92 120 204 56" stroke="#d0e9df"/><path d="m22 75 36-20 36 21-36 21Z" fill="#f6d1ce"/><path d="m166 77 36-21 36 20-36 21Z" fill="#c4d9f8"/><g transform="translate(88 57)"><path d="m0 9 22-13 23 13-23 13Z" fill="#1b7960"/><path d="m0 9 22 13v20L0 29Z" fill="#16624d"/><path d="m22 22 23-13v20L22 42Z" fill="#0e4739"/><path d="m6 5 16-9 16 9-16 9Z" fill="#92e4b2"/><circle cx="13" cy="28" r="3" fill="#baf2c8"/><circle cx="33" cy="28" r="3" fill="#baf2c8"/><path d="M22-4v-12" stroke="#29735b" stroke-width="2"/><circle cx="22" cy="-17" r="4" fill="#55c88b"/></g><circle cx="72" cy="111" r="5" fill="#e3ab56"/><circle cx="165" cy="101" r="5" fill="#e3ab56"/><circle cx="174" cy="44" r="4" fill="#e3ab56"/><path d="m47 108 47 28" stroke="#698e7d" stroke-width="2" stroke-linecap="round"/><path d="m166 136 47-28" stroke="#698e7d" stroke-width="2" stroke-linecap="round"/></svg></div><span class="arena-label"><i></i> Da arena à estratégia</span><span class="arena-chip chip-auto">${icon("robot", 14)} Autonomous</span><span class="arena-chip chip-data">${icon("chart", 14)} Dados que fazem diferença</span></div>`;
}

function setupChecklist(state) {
  const event = activeEvent(state);
  const matches = (state.matches || []).filter((match) => String(match.eventId) === String(event?.id));
  const steps = [
    { done: Boolean(event && currentScout(state)), title: "Prepare o evento", description: "Dê um nome ao evento e identifique seu scout.", action: "open-setup" },
    { done: state.teams.length >= 4, title: "Adicione as equipes", description: "Cadastre uma a uma ou cole uma lista inteira.", action: "open-bulk-teams" },
    { done: matches.length > 0, title: "Comece a observar", description: "Monte a partida e escolha sua equipe.", action: "open-add-match" },
  ];
  if (steps.every((step) => step.done)) return "";
  const completed = steps.filter((step) => step.done).length;
  return `<section class="card setup-card"><div class="card-header"><div><h2>Seu evento começa aqui</h2><span class="subtle">Três passos para sair do cadastro e ir para a arena.</span></div><span class="setup-count">${completed} de 3 prontos</span></div><div class="setup-steps">${steps.map((step, index) => `<button class="setup-step ${step.done ? "done" : ""}" data-action="${step.action}"><span class="setup-step__number">${step.done ? icon("check", 18) : String(index + 1).padStart(2, "0")}</span><span><strong>${step.title}</strong><small>${step.description}</small><b>${step.done ? "Concluído" : "Vamos lá"} ${icon(step.done ? "check" : "chevron", 13)}</b></span></button>`).join("")}</div></section>`;
}

function scheduleCard(state, stats) {
  const event = activeEvent(state);
  const matches = (state.matches || []).filter((match) => String(match.eventId) === String(event?.id));
  const pending = matches.filter((match) => getMatchTeams(state, match).some((entry) => !recordFor(state, match.id, entry.teamId))).sort((a, b) => Number(a.number) - Number(b.number));
  return `<section class="card pad schedule-card"><div class="card-header"><div><h2>Próximas partidas</h2><span class="subtle">Escolha uma equipe e entre em campo.</span></div><a class="text-link" href="#matches" data-view="matches">Ver agenda ${icon("chevron", 14)}</a></div>${pending.length ? `<div class="schedule-list">${pending.slice(0, 3).map((match) => {
    const entries = getMatchTeams(state, match);
    const done = entries.filter((entry) => recordFor(state, match.id, entry.teamId)).length;
    return `<div class="schedule-row"><span class="match-number">${String(match.number).padStart(2, "0")}</span><div class="schedule-row__body"><strong>${escapeHtml(matchLabel(match))}</strong><div class="schedule-alliance-numbers">${entries.map((entry) => `<button class="team-number-chip ${entry.alliance} ${recordFor(state, match.id, entry.teamId) ? "recorded" : ""}" data-action="open-scout" data-match-id="${escapeHtml(match.id)}" data-team-id="${escapeHtml(entry.teamId)}" aria-label="${recordFor(state, match.id, entry.teamId) ? "Ver registro" : "Observar equipe"} ${escapeHtml(entry.team?.number)}">${escapeHtml(entry.team?.number || "—")}${recordFor(state, match.id, entry.teamId) ? icon("check", 11) : ""}</button>`).join("")}</div></div><span class="schedule-completion">${done}/${entries.length}<small>observadas</small></span></div>`;
  }).join("")}</div>` : `<div class="dashboard-empty"><span class="empty-state__icon">${icon(matches.length ? "check" : "matches", 26)}</span><h3>${matches.length ? "Agenda em dia!" : "A arena está esperando"}</h3><p>${matches.length ? "Todas as equipes da agenda foram observadas. Crie a próxima partida quando estiver pronto." : "Adicione sua primeira partida para começar a acompanhar as equipes."}</p><button class="button" data-action="open-add-match">${icon("plus", 16)} ${matches.length ? "Adicionar partida" : "Criar primeira partida"}</button></div>`}<div class="card-footnote">${icon("clipboard", 15)} ${stats.recordsCount} observações salvas neste evento</div></section>`;
}

function coverageCard(stats) {
  const percent = Math.round(stats.completionRate);
  return `<section class="card pad coverage-card"><div class="card-header"><div><h2>Cobertura do evento</h2><span class="subtle">Cada observação melhora sua estratégia.</span></div>${icon("chart", 20)}</div><div class="coverage-ring" style="--coverage:${percent}%"><div><strong>${percent}<span>%</span></strong><small>da agenda observada</small></div></div><div class="coverage-legend"><span><i></i> Salvas <b>${stats.recordsCount}</b></span><span><i></i> Pendentes <b>${Math.max(0, stats.totalScoutingSlots - stats.recordsCount)}</b></span></div><p class="coverage-note">${stats.totalScoutingSlots ? `${stats.analyzedTeams} de ${stats.teamCount} equipes já têm observações.` : "O progresso aparece assim que você criar a primeira partida."}</p></section>`;
}

function recentCard(state, stats) {
  return `<section class="card pad"><div class="card-header"><div><h2>Últimas observações</h2><span class="subtle">O que acabou de acontecer na arena.</span></div>${icon("clock", 19)}</div><div class="recent-list">${stats.recentRecords.slice(0, 4).map((entry) => {
    const record = entry.record || entry;
    const team = findTeam(state, record.teamId);
    const match = state.matches.find((item) => String(item.id) === String(record.matchId));
    return `<button class="recent-item" data-action="open-team" data-team-id="${escapeHtml(record.teamId)}"><div class="item-main"><span class="record-team-number">${escapeHtml(team?.number || "—")}</span><div><strong>${escapeHtml(team?.name || "Equipe")}</strong><span>${escapeHtml(matchLabel(match))}</span></div></div><span class="status-pill good">${icon("check", 13)} Salva</span></button>`;
  }).join("") || `<div class="mini-empty"><span class="mini-empty-icon">${icon("clipboard", 22)}</span><p>Sua primeira observação aparece aqui.<small>Os registros ficam salvos automaticamente neste dispositivo.</small></p></div>`}</div></section>`;
}

function attentionCard(stats) {
  return `<section class="card pad"><div class="card-header"><div><h2>De olho nas equipes</h2><span class="subtle">Priorize quem merece outra observação.</span></div><a class="text-link" href="#favorites" data-view="favorites">Favoritos ${icon("chevron", 14)}</a></div>${stats.alerts.slice(0, 3).map((alert) => `<button class="alert-item" data-action="open-team" data-team-id="${escapeHtml(alert.teamId)}"><span class="alert-icon">${icon(alert.type === "standout" ? "trophy" : "teams", 18)}</span><span><strong>Equipe ${escapeHtml(alert.teamNumber || "—")}</strong><p>${alert.type === "unscouted" ? "Ainda sem observações. Comece pela próxima partida." : escapeHtml(alert.message)}</p></span>${icon("chevron", 15)}</button>`).join("") || `<div class="mini-empty"><span class="mini-empty-icon">${icon("star", 22)}</span><p>Suas escolhas, em um só lugar.<small>Favorite equipes e marque as que você quer observar novamente.</small></p></div>`}</section>`;
}

export function renderDashboard({ state }) {
  const stats = getDashboardStats(state);
  const scout = currentScout(state);
  const ready = activeEvent(state) && scout && state.teams.length >= 4 && stats.totalMatches > 0;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return `<section class="page dashboard-page">
    ${sectionHeader({ eyebrow: "SEU CENTRO DE SCOUTING", title: scout?.name ? `Olá, ${scout.name.split(" ")[0]} 👋` : "Bem-vindo à arena 👋", description: "Menos planilhas. Mais clareza para a sua próxima decisão.", action: `<span class="dashboard-date">${icon("matches", 16)} ${date}</span>` })}
    <section class="dashboard-hero"><div class="hero-copy"><span class="hero-badge"><i></i> FIRST TECH CHALLENGE</span><h2>Observe melhor.<br />Decida com confiança.</h2><p>Do primeiro autônomo à escolha da aliança, transforme cada partida em uma estratégia melhor.</p><div class="hero-actions"><button class="button primary" data-action="${ready ? "start-scout" : "open-setup"}">${icon(ready ? "clipboard" : "plus", 18)} ${ready ? "Nova observação" : "Preparar meu evento"} ${icon("chevron", 16)}</button><button class="button hero-secondary" data-view="${ready ? "stats" : "teams"}">${ready ? "Ver minhas análises" : "Conhecer as equipes"} ${icon("chevron", 15)}</button></div><span class="hero-footnote">${icon("check", 14)} Funciona offline · rascunhos salvos automaticamente</span></div>${arenaIllustration()}</section>
    <div class="metric-grid dashboard-metrics">
      ${metricCard({ label: "Equipes no radar", value: number(stats.teamCount), detail: `${stats.analyzedTeams} já observadas`, tone: "cyan", iconName: "teams" })}
      ${metricCard({ label: "Partidas na agenda", value: number(stats.totalMatches), detail: `${stats.matchesAnalyzed} com observações`, tone: "violet", iconName: "matches" })}
      ${metricCard({ label: "Observações salvas", value: number(stats.recordsCount), detail: "Seu conhecimento em campo", tone: "green", iconName: "clipboard" })}
      ${metricCard({ label: "Equipes favoritas", value: number(stats.favoriteTeams.length), detail: "Para acompanhar de perto", tone: "amber", iconName: "star" })}
    </div>
    ${setupChecklist(state)}
    <div class="dashboard-layout">${scheduleCard(state, stats)}${coverageCard(stats)}</div>
    <div class="grid two dashboard-bottom">${recentCard(state, stats)}${attentionCard(stats)}</div>
    <footer class="page-footer"><span><span class="footer-mark">${icon("robot", 15)}</span> Scout Arena <span>·</span> Da observação à decisão.</span><button class="text-link" data-view="settings">${icon("save", 14)} Fazer backup dos dados</button></footer>
  </section>`;
}
