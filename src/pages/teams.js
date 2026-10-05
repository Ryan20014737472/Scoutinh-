import { getPhaseEvolution, getRanking, getTeamStats } from "../services/analytics.js";
import { escapeHtml, icon, metricCard, number, progressBar, sectionHeader, statusPill } from "../components/ui.js";
import { activeSeason, findTeam, isFavorite, watchMeta, matchLabel } from "../utils/domain.js";

function simpleChart(points, tone = "cyan", metric = "total") {
  const values = points.map((point) => Number(point[metric] ?? 0));
  if (!values.length) return '<div class="empty-state"><h3>Sem histórico</h3><p>Salve uma partida para formar o gráfico desta equipe.</p></div>';
  const max = Math.max(...values, 1);
  const coords = values.map((value, index) => `${8 + index * (284 / Math.max(values.length - 1, 1))},${154 - (value / max) * 125}`).join(" ");
  return `<div class="chart-shell"><svg class="svg-chart" viewBox="0 0 300 170" preserveAspectRatio="none">${[30, 70, 110, 150].map((value) => `<line class="chart-gridline" x1="8" x2="292" y1="${value}" y2="${value}"/>`).join("")}<polyline class="chart-line ${tone}" style="stroke:var(--${tone})" points="${coords}"/>${values.map((value, index) => { const [x, y] = coords.split(" ")[index].split(","); return `<circle class="chart-dot" style="stroke:var(--${tone})" cx="${x}" cy="${y}" r="3"/>`; }).join("")}</svg><div class="chart-axis"><span>Primeira partida</span><span>${values.length} partidas</span><span>Melhor ${number(Math.max(...values))}</span></div></div>`;
}

function profileMetrics(profile, state, observationsOnly) {
  if (observationsOnly) {
    return `${metricCard({ label: "Registros", value: number(profile.matchesAnalyzed), detail: "partidas observadas", tone: "cyan", iconName: "clipboard" })}${metricCard({ label: "Ciclos", value: number(profile.averageCycles, 1), detail: "média por partida", tone: "green", iconName: "sync" })}${metricCard({ label: "Confiabilidade", value: `${number(profile.reliability)}%`, detail: "sem alertas de robô", tone: "violet", iconName: "robot" })}${metricCard({ label: "Alertas", value: number(profile.failures?.total || 0), detail: "ocorrências registradas", tone: "amber", iconName: "alert" })}`;
  }
  return `${metricCard({ label: "Média", value: number(profile.averageScore, 1), detail: `${profile.matchesAnalyzed} partidas`, tone: "cyan", iconName: "chart" })}${metricCard({ label: "Melhor", value: number(profile.bestScore), detail: `Pior ${number(profile.worstScore)}`, tone: "green", iconName: "trophy" })}${metricCard({ label: "Rating", value: number(profile.scoutingRating ?? getRanking(state).find((item) => item.teamId === profile.teamId)?.scoutingRating, 1), detail: "Scouting Rating", tone: "violet", iconName: "ranking" })}${metricCard({ label: "Consistência", value: `${number(profile.consistency)}%`, detail: `${number(profile.averageCycles, 1)} ciclos em média`, tone: "amber", iconName: "sync" })}`;
}

export function renderTeams({ state, filters = {} }) {
  const term = String(filters.term || "").trim().toLowerCase();
  const ranked = getRanking(state);
  const observationsOnly = activeSeason(state)?.scoringScope === "observations_only";
  const teams = ranked.filter((profile) => !term || `${profile.teamNumber} ${profile.name} ${profile.robotName || ""}`.toLowerCase().includes(term));
  const secondaryLabel = observationsOnly ? "Ciclos" : "Média";
  return `<section class="page">
    ${sectionHeader({ eyebrow: "BASE DE SCOUTING", title: "Equipes", description: "Encontre suas equipes, acompanhe os registros e escolha quem merece atenção.", action: `<button class="button primary" data-action="open-add-team">${icon("plus",17)} Adicionar equipe</button>` })}
    <div class="filterbar"><div class="search-box">${icon("search", 18)}<input data-filter="team-search" value="${escapeHtml(filters.term || "")}" placeholder="Buscar por número ou nome" aria-label="Buscar equipe" /></div><div class="filter-chips"><button class="chip ${filters.onlyFavorites ? "active" : ""}" data-action="filter-favorites">${icon("star", 14)} Favoritas</button><button class="chip ${filters.onlyWatchlist ? "active" : ""}" data-action="filter-watchlist">${icon("alert", 14)} Watchlist</button></div></div>
    <section class="card pad"><div class="team-row" style="color:var(--dim);font-size:10px;font-weight:800;text-transform:uppercase"><span>Equipe</span><span style="text-align:right">${secondaryLabel}</span><span style="text-align:right">Rating</span><span></span></div><div class="team-list">${teams.filter((profile) => !filters.onlyFavorites || profile.favorite).filter((profile) => !filters.onlyWatchlist || profile.watchlist).map((profile) => { const middle = observationsOnly ? number(profile.averageCycles, 1) : number(profile.averageScore, 1); return `<button class="team-row" data-action="open-team" data-team-id="${escapeHtml(profile.teamId || profile.id)}"><span class="team-label"><b>${escapeHtml(profile.teamNumber || profile.number || "—")} ${profile.favorite ? icon("star", 13) : ""}</b><span>${escapeHtml(profile.name || "Equipe")} · ${profile.matchesAnalyzed} scouts</span></span><span class="average">${middle}</span><span class="rating">${number(profile.scoutingRating, 1)}</span><span>${icon("chevron", 16)}</span></button>`; }).join("") || '<div class="empty-state"><h3>Nenhuma equipe encontrada</h3><p>Ajuste sua busca ou adicione a primeira equipe.</p><button class="button" data-action="open-add-team">Adicionar equipe</button></div>'}</div></section>
  </section>`;
}

export function renderTeamProfile({ state, teamId }) {
  const team = findTeam(state, teamId);
  if (!team) return `<section class="page"><div class="empty-state"><h3>Equipe não encontrada</h3><p>Ela pode ter sido removida ou o link está desatualizado.</p><button class="button" data-view="teams">Voltar às equipes</button></div></section>`;
  const profile = getTeamStats(state, team.id);
  const season = activeSeason(state);
  const observationsOnly = season?.scoringScope === "observations_only";
  const evolution = getPhaseEvolution(profile.records || [], undefined, season);
  const favorite = isFavorite(state, team.id);
  const watch = watchMeta(state, team.id);
  const history = (profile.history || []).slice().reverse().map((entry) => {
    const description = observationsOnly ? `${number(entry.cycles)} ciclos · observação salva` : `Auto ${number(entry.auto)} · TeleOp ${number(entry.teleop)} · End ${number(entry.endgame)}`;
    const total = observationsOnly ? '<div class="item-score"><small>observado</small></div>' : `<div class="item-score">${number(entry.total)}<small>pts</small></div>`;
    const match = state.matches.find((item) => String(item.id) === String(entry.matchId));
    return `<button class="recent-item" data-action="open-record" data-record-id="${escapeHtml(entry.id)}"><div class="item-main">${icon("matches", 18)}<div><strong>${escapeHtml(matchLabel(match))}</strong><span>${description}</span></div></div>${total}${icon("chevron",16)}</button>`;
  }).join("") || '<span class="subtle">Nenhum histórico disponível.</span>';
  const performanceRows = observationsOnly
    ? [["Ciclos", profile.averageCycles, "amber"], ["Defesa forte", profile.defense?.strong || 0, "violet"], ["Alertas", profile.failures?.total || 0, "red"]]
    : [["Autonomous", profile.averageAuto, "violet"], ["TeleOp", profile.averageTeleop, "cyan"], ["Endgame", profile.averageEndgame, "green"], ["Ciclos", profile.averageCycles, "amber"]];
  const performanceMax = Math.max(...performanceRows.map(([, value]) => Number(value) || 0), 1);
  const trendCard = observationsOnly
    ? simpleChart(profile.history || [], "cyan", "cycles")
    : simpleChart(evolution);
  return `<section class="page"><button class="button ghost small" data-view="teams">${icon("back", 15)} Equipes</button><header class="team-profile-head" style="margin-top:12px"><div class="team-profile-title"><span class="team-number-mark">${escapeHtml(team.number)}</span><div><h1>${escapeHtml(team.name)}</h1><p>${escapeHtml(team.robotName || "Robô sem nome")} · ${escapeHtml(team.city || "Local não informado")}</p></div></div><div class="team-profile-actions"><button class="button ${favorite ? "primary" : ""}" data-action="toggle-favorite" data-team-id="${escapeHtml(team.id)}">${icon("star", 16)} ${favorite ? "Favorita" : "Favoritar"}</button><button class="button ${watch ? "primary" : ""}" data-action="toggle-watchlist" data-team-id="${escapeHtml(team.id)}">${icon("alert", 16)} ${watch ? "Na watchlist" : "Observar"}</button></div></header><div class="metric-grid" style="margin-top:16px">${profileMetrics(profile, state, observationsOnly)}</div><div class="team-layout"><div class="grid"><section class="card pad chart-card"><div class="card-header"><div><h2>${observationsOnly ? "Ciclos por partida" : "Pontuação por partida"}</h2><span class="subtle">${observationsOnly ? "O ritmo da equipe ao longo do evento." : "Auto + TeleOp + Endgame"}</span></div></div>${trendCard}</section><section class="card pad"><div class="card-header"><div><h2>Histórico de scouting</h2><span class="subtle">Registros salvos para esta equipe.</span></div></div><div class="record-list">${history}</div></section></div><aside class="grid"><section class="card pad"><div class="card-header"><div><h2>${observationsOnly ? "Métricas observadas" : "Quebra de desempenho"}</h2><span class="subtle">${observationsOnly ? "Indicadores do scout." : "Média por fase."}</span></div></div><div class="bar-chart">${performanceRows.map(([label, value, tone]) => `<div class="bar-row"><span class="label">${label}</span>${progressBar(value, { max: performanceMax, tone })}<span class="value">${number(value, 1)}</span></div>`).join("")}</div></section><section class="card pad"><div class="card-header"><div><h2>Confiabilidade</h2><span class="subtle">Indicadores de risco observados.</span></div></div><div class="compact-list"><div class="compact-item"><div class="item-main">${icon("robot", 17)}<div><strong>${number(profile.reliability)}% sem falhas</strong><span>${number(profile.failures?.mechanical || 0)} mec. · ${number(profile.failures?.electrical || 0)} elétricas · ${number(profile.failures?.programming || 0)} software</span></div></div></div><div class="compact-item"><div class="item-main">${icon("trophy", 17)}<div><strong>Auto ${number(profile.autoSuccessRate)}% · Endgame ${number(profile.endgameSuccessRate)}%</strong><span>${profile.defense?.strong || 0} partidas com defesa forte · ${number(profile.penalties)} penalidades</span></div></div></div></div></section>${watch ? `<section class="card pad"><div class="card-header"><div><h2>Watchlist</h2><span class="subtle">${escapeHtml(watch.category || "Observar novamente")}</span></div>${statusPill(watch.priority === "high" ? "Incompleta" : "Em andamento")}</div><p class="subtle">${escapeHtml(watch.reason || "Equipe marcada para uma nova observação.")}</p></section>` : ""}</aside></div></section>`;
}
