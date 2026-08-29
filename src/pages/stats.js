import { calculateTeamProfiles, getEventRecords, getPhaseTotals, rankTeams } from "../services/analytics.js";
import { escapeHtml, icon, number, progressBar, sectionHeader } from "../components/ui.js";
import { activeSeason } from "../utils/domain.js";

function filterRecords(state, filters) {
  return getEventRecords(state, filters.eventId || state.settings?.activeEventId).filter((record) => {
    if (filters.teamId && String(record.teamId) !== String(filters.teamId)) return false;
    if (filters.scoutId && String(record.scoutId) !== String(filters.scoutId)) return false;
    if (filters.alliance && record.alliance !== filters.alliance) return false;
    if (filters.date && new Date(record.savedAt || record.createdAt || 0).toISOString().slice(0,10) !== filters.date) return false;
    return true;
  });
}

function chartBars(records, season) {
  const series = records.slice(-6).map((record) => ({ record, ...getPhaseTotals(record,season) }));
  const max = Math.max(...series.map((item) => item.total),1);
  return `<div class="bar-chart">${series.map((item,index) => `<div class="bar-row"><span class="label">${escapeHtml(item.record.matchId?.replace("match-q-","Q") || `Scout ${index+1}`)}</span>${progressBar(item.total,{max,tone:"cyan"})}<span class="value">${number(item.total)}</span></div>`).join("") || '<span class="subtle">Ajuste os filtros para visualizar registros.</span>'}</div>`;
}

export function renderStats({ state, filters = {} }) {
  const season = activeSeason(state);
  const normalizedFilters = { eventId: state.settings?.activeEventId, ...filters };
  const records = filterRecords(state,normalizedFilters);
  const profiles = calculateTeamProfiles(state.teams || [], records, season, { eventId: normalizedFilters.eventId, favorites: state.favorites, watchlist: state.watchlist });
  const ranked = rankTeams(profiles, [], season, { ratingWeights: state.settings?.ratingWeights });
  const phase = records.reduce((total,record) => { const current=getPhaseTotals(record,season); total.auto+=current.auto; total.teleop+=current.teleop; total.endgame+=current.endgame; total.total+=current.total; return total; }, {auto:0,teleop:0,endgame:0,total:0});
  const denom=Math.max(records.length,1);
  return `<section class="page fullwide">
    ${sectionHeader({ eyebrow: "Análise", title: "Estatísticas", description: "Filtre registros reais para entender ritmo, fases e consistência do evento." })}
    <section class="card pad"><form data-form="stats-filters"><div class="field-grid three"><div class="field"><label>Evento</label><select name="eventId" data-action="set-stats-filter">${(state.events || []).map((event) => `<option value="${escapeHtml(event.id)}" ${String(event.id) === String(normalizedFilters.eventId) ? "selected" : ""}>${escapeHtml(event.name)}</option>`).join("")}</select></div><div class="field"><label>Time</label><select name="teamId" data-action="set-stats-filter"><option value="">Todos os times</option>${(state.teams || []).map((team) => `<option value="${escapeHtml(team.id)}" ${String(team.id) === String(normalizedFilters.teamId) ? "selected" : ""}>${escapeHtml(team.number)} · ${escapeHtml(team.name)}</option>`).join("")}</select></div><div class="field"><label>Scout</label><select name="scoutId" data-action="set-stats-filter"><option value="">Todos os scouts</option>${(state.scouts || []).map((scout) => `<option value="${escapeHtml(scout.id)}" ${String(scout.id) === String(normalizedFilters.scoutId) ? "selected" : ""}>${escapeHtml(scout.name)}</option>`).join("")}</select></div><div class="field"><label>Aliança</label><select name="alliance" data-action="set-stats-filter"><option value="">Todas</option><option value="red" ${normalizedFilters.alliance === "red" ? "selected" : ""}>Vermelha</option><option value="blue" ${normalizedFilters.alliance === "blue" ? "selected" : ""}>Azul</option></select></div><div class="field"><label>Data</label><input type="date" name="date" data-action="set-stats-filter" value="${escapeHtml(normalizedFilters.date || "")}" /></div><div class="field"><label>Dados</label><button class="button wide" type="button" data-action="clear-stats-filters">${icon("filter",16)} Limpar filtros</button></div></div></form></section>
    <div class="metric-grid" style="margin-top:16px">${[["Registros",records.length,"scouting filtrados","clipboard","cyan"],["Média total",number(phase.total/denom,1),"pontos por robô","chart","green"],["Auto médio",number(phase.auto/denom,1),"pontos","robot","violet"],["TeleOp médio",number(phase.teleop/denom,1),"pontos","matches","cyan"],["Endgame médio",number(phase.endgame/denom,1),"pontos","trophy","amber"]].map(([label,value,detail,iconName,tone]) => `<article class="metric-card ${tone}"><div class="metric-card__icon">${icon(iconName)}</div><div class="metric-card__body"><span class="eyebrow">${label}</span><strong>${value}</strong><span class="metric-card__detail">${detail}</span></div></article>`).join("")}</div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr);gap:16px"><section class="card pad"><div class="card-header"><div><h2>Pontuação dos últimos registros</h2><span class="subtle">Total por partida dentro dos filtros.</span></div></div>${chartBars(records,season)}</section><section class="card pad"><div class="card-header"><div><h2>Fases da partida</h2><span class="subtle">Média calculada sobre os registros filtrados.</span></div></div><div class="bar-chart">${[["Autonomous",phase.auto/denom,"violet"],["TeleOp",phase.teleop/denom,"cyan"],["Endgame",phase.endgame/denom,"green"]].map(([label,value,tone]) => `<div class="bar-row"><span class="label">${label}</span>${progressBar(value,{max:Math.max(phase.auto/denom,phase.teleop/denom,phase.endgame/denom,1),tone})}<span class="value">${number(value,1)}</span></div>`).join("")}</div></section><section class="card pad"><div class="card-header"><div><h2>Consistência por equipe</h2><span class="subtle">Ordenado pelo Rating do recorte atual.</span></div></div><div class="team-list">${ranked.map((profile) => `<button class="team-row" data-action="open-team" data-team-id="${escapeHtml(profile.teamId || profile.id)}"><span class="team-label"><b>${escapeHtml(profile.teamNumber || "—")} · ${escapeHtml(profile.name || "Equipe")}</b><span>${profile.matchesAnalyzed} partidas · média ${number(profile.averageScore,1)}</span></span><span class="average">${number(profile.consistency)}%</span><span class="rating">${number(profile.scoutingRating,1)}</span><span>${icon("chevron",16)}</span></button>`).join("") || '<div class="empty-state"><h3>Nenhum dado no recorte</h3><p>Remova filtros ou registre mais partidas.</p></div>'}</div></section></div>
  </section>`;
}
