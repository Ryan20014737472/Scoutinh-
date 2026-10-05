import { calculateTeamProfiles, getEventRecords, getPhaseTotals, getRecordCycles, getRecordFailures, rankTeams } from "../services/analytics.js";
import { escapeHtml, icon, number, progressBar, sectionHeader } from "../components/ui.js";
import { activeSeason } from "../utils/domain.js";

function filterRecords(state, filters) {
  return getEventRecords(state, filters.eventId || state.settings?.activeEventId).filter((record) => {
    if (filters.teamId && String(record.teamId) !== String(filters.teamId)) return false;
    if (filters.scoutId && String(record.scoutId) !== String(filters.scoutId)) return false;
    if (filters.alliance && record.alliance !== filters.alliance) return false;
    if (filters.date && new Date(record.savedAt || record.createdAt || 0).toISOString().slice(0, 10) !== filters.date) return false;
    return true;
  });
}

function chartBars(records, season, { observationsOnly = false } = {}) {
  const series = records.slice(-6).map((record) => ({ record, value: observationsOnly ? getRecordCycles(record, season) : getPhaseTotals(record, season).total }));
  const max = Math.max(...series.map((item) => item.value), 1);
  return `<div class="bar-chart">${series.map((item, index) => `<div class="bar-row"><span class="label">${escapeHtml(item.record.matchId?.replace("match-q-", "Q") || `Scout ${index + 1}`)}</span>${progressBar(item.value, { max, tone: "cyan" })}<span class="value">${number(item.value)}</span></div>`).join("") || '<span class="subtle">Ajuste os filtros para visualizar registros.</span>'}</div>`;
}

function filterForm(state, filters) {
  return `<section class="card pad"><form data-form="stats-filters"><div class="field-grid three"><div class="field"><label>Evento</label><select name="eventId" data-action="set-stats-filter">${(state.events || []).map((event) => `<option value="${escapeHtml(event.id)}" ${String(event.id) === String(filters.eventId) ? "selected" : ""}>${escapeHtml(event.name)}</option>`).join("")}</select></div><div class="field"><label>Time</label><select name="teamId" data-action="set-stats-filter"><option value="">Todos os times</option>${(state.teams || []).map((team) => `<option value="${escapeHtml(team.id)}" ${String(team.id) === String(filters.teamId) ? "selected" : ""}>${escapeHtml(team.number)} · ${escapeHtml(team.name)}</option>`).join("")}</select></div><div class="field"><label>Scout</label><select name="scoutId" data-action="set-stats-filter"><option value="">Todos os scouts</option>${(state.scouts || []).map((scout) => `<option value="${escapeHtml(scout.id)}" ${String(scout.id) === String(filters.scoutId) ? "selected" : ""}>${escapeHtml(scout.name)}</option>`).join("")}</select></div><div class="field"><label>Aliança</label><select name="alliance" data-action="set-stats-filter"><option value="">Todas</option><option value="red" ${filters.alliance === "red" ? "selected" : ""}>Vermelha</option><option value="blue" ${filters.alliance === "blue" ? "selected" : ""}>Azul</option></select></div><div class="field"><label>Data</label><input type="date" name="date" data-action="set-stats-filter" value="${escapeHtml(filters.date || "")}" /></div><div class="field"><label>Dados</label><button class="button wide" type="button" data-action="clear-stats-filters">${icon("filter", 16)} Limpar filtros</button></div></div></form></section>`;
}

function scoreMetrics(records, phase, denom) {
  return [["Registros", records.length, "scouting filtrados", "clipboard", "cyan"], ["Média total", number(phase.total / denom, 1), "pontos por robô", "chart", "green"], ["Auto médio", number(phase.auto / denom, 1), "pontos", "robot", "violet"], ["TeleOp médio", number(phase.teleop / denom, 1), "pontos", "matches", "cyan"], ["Endgame médio", number(phase.endgame / denom, 1), "pontos", "trophy", "amber"]];
}

function observationMetrics(records, season, profiles, denom) {
  const cycles = records.reduce((sum, record) => sum + getRecordCycles(record, season), 0);
  const alerts = records.reduce((sum, record) => sum + (getRecordFailures(record, season)?.total || 0), 0);
  return [["Registros", records.length, "scouting filtrados", "clipboard", "cyan"], ["Ciclos médios", number(cycles / denom, 1), "por robô", "sync", "green"], ["Alertas", alerts, "ocorrências registradas", "alert", "amber"], ["Equipes", profiles.filter((profile) => profile.matchesAnalyzed > 0).length, "com observações", "teams", "violet"], ["Pontuação oficial", "—", "regras FIRST pendentes", "chart", "red"]];
}

export function renderStats({ state, filters = {} }) {
  const season = activeSeason({ ...state, settings: { ...state.settings, activeEventId: filters.eventId || state.settings?.activeEventId } });
  const observationsOnly = season?.scoringScope === "observations_only";
  const normalizedFilters = { eventId: state.settings?.activeEventId, ...filters };
  const records = filterRecords(state, normalizedFilters);
  const profiles = calculateTeamProfiles(state.teams || [], records, season, { eventId: normalizedFilters.eventId, favorites: state.favorites, watchlist: state.watchlist });
  const ranked = rankTeams(profiles, [], season, { ratingWeights: state.settings?.ratingWeights });
  const phase = records.reduce((total, record) => { const current = getPhaseTotals(record, season); total.auto += current.auto; total.teleop += current.teleop; total.endgame += current.endgame; total.total += current.total; return total; }, { auto: 0, teleop: 0, endgame: 0, total: 0 });
  const denom = Math.max(records.length, 1);
  const metrics = observationsOnly ? observationMetrics(records, season, profiles, denom) : scoreMetrics(records, phase, denom);
  const performance = observationsOnly
    ? '<div class="empty-state"><h3>Modo de observação</h3><p>Este evento acompanha ações e ciclos. Compare as equipes pelos registros coletados.</p></div>'
    : `<div class="bar-chart">${[["Autonomous", phase.auto / denom, "violet"], ["TeleOp", phase.teleop / denom, "cyan"], ["Endgame", phase.endgame / denom, "green"]].map(([label, value, tone]) => `<div class="bar-row"><span class="label">${label}</span>${progressBar(value, { max: Math.max(phase.auto / denom, phase.teleop / denom, phase.endgame / denom, 1), tone })}<span class="value">${number(value, 1)}</span></div>`).join("")}</div>`;
  return `<section class="page fullwide">
    ${sectionHeader({ eyebrow: "Análise", title: "Estatísticas", description: observationsOnly ? "Ciclos, confiabilidade e observações coletadas durante o evento." : "Filtre registros reais para entender ritmo, fases e consistência do evento." })}
    ${filterForm(state, normalizedFilters)}
    <div class="metric-grid" style="margin-top:16px">${metrics.map(([label, value, detail, iconName, tone]) => `<article class="metric-card ${tone}"><div class="metric-card__icon">${icon(iconName)}</div><div class="metric-card__body"><span class="eyebrow">${label}</span><strong>${value}</strong><span class="metric-card__detail">${detail}</span></div></article>`).join("")}</div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr);gap:16px"><section class="card pad"><div class="card-header"><div><h2>${observationsOnly ? "Ciclos dos últimos registros" : "Pontuação dos últimos registros"}</h2><span class="subtle">${observationsOnly ? "Métrica por partida dentro dos filtros." : "Total por partida dentro dos filtros."}</span></div></div>${chartBars(records, season, { observationsOnly })}</section><section class="card pad"><div class="card-header"><div><h2>${observationsOnly ? "Como interpretar os dados" : "Fases da partida"}</h2><span class="subtle">${observationsOnly ? "Métricas do scout para apoiar sua estratégia." : "Média calculada sobre os registros filtrados."}</span></div></div>${performance}</section><section class="card pad"><div class="card-header"><div><h2>${observationsOnly ? "Confiabilidade por equipe" : "Consistência por equipe"}</h2><span class="subtle">Ordenado pelo Rating do recorte atual.</span></div></div><div class="team-list">${ranked.map((profile) => { const summary = observationsOnly ? `${profile.matchesAnalyzed} partidas · ${number(profile.averageCycles, 1)} ciclos médios` : `${profile.matchesAnalyzed} partidas · média ${number(profile.averageScore, 1)}`; return `<button class="team-row" data-action="open-team" data-team-id="${escapeHtml(profile.teamId || profile.id)}"><span class="team-label"><b>${escapeHtml(profile.teamNumber || "—")} · ${escapeHtml(profile.name || "Equipe")}</b><span>${summary}</span></span><span class="average">${number(profile.consistency)}%</span><span class="rating">${number(profile.scoutingRating, 1)}</span><span>${icon("chevron", 16)}</span></button>`; }).join("") || '<div class="empty-state"><h3>Nenhum dado no recorte</h3><p>Remova filtros ou registre mais partidas.</p></div>'}</div></section></div>
  </section>`;
}
