import { getDashboardStats, getPhaseEvolution } from "../services/analytics.js";
import { avatar, escapeHtml, icon, metricCard, number, progressBar, sectionHeader, teamLabel } from "../components/ui.js";
import { activeSeason, currentScout, findTeam } from "../utils/domain.js";

function lineChart(points) {
  const values = points.map((point) => Number(point.averageTotal ?? point.total ?? 0));
  if (!values.length) return '<div class="empty-state"><h3>Aguardando registros</h3><p>O gráfico aparece quando os scouts começarem a salvar partidas.</p></div>';
  const min = Math.min(...values, 0);
  const max = Math.max(...values, min + 1);
  const x = (index) => 8 + (index * 284) / Math.max(values.length - 1, 1);
  const y = (value) => 154 - ((value - min) / Math.max(max - min, 1)) * 124;
  const line = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area = `8,154 ${line} 292,154`;
  return `<div class="chart-shell"><svg class="svg-chart" viewBox="0 0 300 170" preserveAspectRatio="none" aria-label="Evolução da média de pontuação"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ed4ff" stop-opacity=".38"/><stop offset="100%" stop-color="#3ed4ff" stop-opacity="0"/></linearGradient></defs>${[30,70,110,150].map((value) => `<line class="chart-gridline" x1="8" x2="292" y1="${value}" y2="${value}"/>`).join("")}<polyline class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}"/>${values.map((value,index) => `<circle class="chart-dot" cx="${x(index)}" cy="${y(value)}" r="3.5"/>`).join("")}</svg><div class="chart-axis"><span>Partida 1</span><span>Média ${number(values.at(-1),1)} pts</span><span>Agora</span></div></div>`;
}

function topTeams(stats) {
  return `<div class="bar-chart">${stats.topTeams.slice(0,5).map((profile, index) => `<button class="bar-row" data-action="open-team" data-team-id="${escapeHtml(profile.teamId || profile.id)}" title="Abrir equipe"><span class="label">${index + 1}. ${escapeHtml(profile.teamNumber || profile.number || "—")} · ${escapeHtml(profile.teamName || profile.name || "Equipe")}</span>${progressBar(profile.scoutingRating, { tone: index === 0 ? "green" : "cyan" })}<span class="value">${number(profile.scoutingRating,1)}</span></button>`).join("") || '<span class="subtle">Nenhuma equipe com dados suficientes.</span>'}</div>`;
}

function recentRecords(state, stats, { observationsOnly = false } = {}) {
  return `<div class="recent-list">${stats.recentRecords.map((entry) => {
    const record = entry.record || entry;
    const team = findTeam(state, entry.teamId || record.teamId);
    const total = entry.total ?? record.total ?? record.score?.total ?? 0;
    const summary = observationsOnly ? '<div class="item-score"><small>observado</small></div>' : `<div class="item-score">${number(total)}<small>pts</small></div>`;
    return `<button class="recent-item" data-action="open-team" data-team-id="${escapeHtml(team?.id || entry.teamId || record.teamId)}"><div class="item-main">${icon("robot",18)}<div><strong>${escapeHtml(team?.number || entry.teamNumber || "—")} · ${escapeHtml(team?.name || entry.teamName || "Equipe")}</strong><span>${escapeHtml(entry.matchLabel || entry.matchId || record.matchId || "Partida")} · scout registrado</span></div></div>${summary}</button>`;
  }).join("") || '<span class="subtle">Nenhum scouting salvo ainda.</span>'}</div>`;
}

function onboardingCard(state) {
  const steps = [
    { done: (state.scouts || []).length > 0, label: "Cadastre o primeiro scout" },
    { done: (state.teams || []).length >= 4, label: "Cadastre pelo menos quatro equipes" },
    { done: (state.events || []).length > 0, label: "Crie e ative o evento" },
    { done: (state.matches || []).length > 0, label: "Monte a primeira partida" },
  ];
  if (steps.every((step) => step.done)) return "";
  return `<section class="card pad"><div class="card-header"><div><span class="eyebrow">Primeiro uso</span><h2>Prepare o scouting</h2><p class="subtle">O banco começa vazio para usar somente equipes e partidas reais.</p></div>${icon("clipboard", 20)}</div><div class="compact-list">${steps.map((step) => `<div class="compact-item"><div class="item-main">${icon(step.done ? "check" : "clock", 18)}<div><strong>${escapeHtml(step.label)}</strong><span>${step.done ? "Concluído" : "Pendente"}</span></div></div></div>`).join("")}</div><div class="form-actions"><a class="button primary" data-view="admin" href="#admin">Abrir administração ${icon("chevron", 16)}</a></div></section>`;
}

export function renderDashboard({ state }) {
  const stats = getDashboardStats(state);
  const scout = currentScout(state);
  const season = activeSeason(state);
  const observationsOnly = season?.scoringScope === "observations_only";
  const evolution = getPhaseEvolution(stats.recentRecords.map((entry) => entry.record || entry), undefined, state.seasonConfigs?.[0]);
  const maxPhase = Math.max(...stats.performanceByPhase.map((item) => item.value), 1);
  const averageLabel = observationsOnly ? "Pontuação oficial" : "Média geral";
  const averageValue = observationsOnly ? "—" : number(stats.averageScore, 1);
  const averageDetail = observationsOnly ? "aguardando regras FIRST" : "pontos estimados";
  const phaseContent = observationsOnly
    ? '<div class="card inset pad" style="margin-top:15px"><span class="icon-text">As fases registram observações; a pontuação oficial do BIOBUZZ ainda não foi publicada pela FIRST.</span></div>'
    : `<div class="bar-chart">${stats.performanceByPhase.map((item,index) => `<div class="bar-row"><span class="label">${escapeHtml(item.label)}</span>${progressBar(item.value,{max:maxPhase,tone:["violet","cyan","green"][index]})}<span class="value">${number(item.value,1)}</span></div>`).join("")}</div><div class="card inset pad" style="margin-top:15px"><span class="icon-text">${icon("sync",16)} ${stats.averageCycles ? `${number(stats.averageCycles,1)} ciclos em média` : "Dados de ciclo aparecem após os scouts"}</span></div>`;
  return `<section class="page">
    ${sectionHeader({ eyebrow: stats.event?.code || "Workspace local", title: `Pronto para a próxima partida${scout?.name ? `, ${scout.name.split(" ")[0]}` : ""}.`, description: `${stats.event?.name || "Configure seu evento"} · visão operacional do scouting.` , action: `<a class="button primary" data-view="${stats.event ? "matches" : "admin"}" href="#${stats.event ? "partidas" : "admin"}">${icon(stats.event ? "matches" : "settings",16)} ${stats.event ? "Abrir partidas" : "Configurar evento"}</a>` })}
    ${onboardingCard(state)}
    <div class="metric-grid">
      ${metricCard({label:"Equipes",value:number(stats.teamCount),detail:`${stats.analyzedTeams} analisadas`,tone:"cyan",iconName:"teams"})}
      ${metricCard({label:"Scouting",value:number(stats.recordsCount),detail:`${number(stats.completionRate)}% da agenda`,tone:"green",iconName:"clipboard"})}
      ${metricCard({label:"Scouts ativos",value:number(stats.activeScouts),detail:"Registraram nesta sessão",tone:"violet",iconName:"user"})}
      ${metricCard({label:averageLabel,value:averageValue,detail:averageDetail,tone:"amber",iconName:"chart"})}
      ${metricCard({label:"Watchlist",value:number(stats.watchlistTeams.length),detail:`${stats.unscoutedTeams.length} ainda sem scout`,tone:"red",iconName:"alert"})}
    </div>
    <div class="dashboard-layout"><div class="dashboard-main"><section class="card pad chart-card"><div class="card-header"><div><h2>${observationsOnly ? "Registros do evento" : "Evolução do evento"}</h2><span class="subtle">${observationsOnly ? "A pontuação oficial aparecerá após a atualização das regras." : "Média acumulada dos registros mais recentes."}</span></div>${observationsOnly ? "" : `<div class="legend"><span><i></i>Total</span><span>Atual: <b>${number(stats.averageScore,1)}</b></span></div>`}</div>${observationsOnly ? '<div class="empty-state"><h3>Aguardando regras oficiais</h3><p>As observações salvas continuam disponíveis por equipe e partida.</p></div>' : lineChart(evolution)}</section><div class="grid two"><section class="card pad"><div class="card-header"><div><h2>Melhores pelo Scouting Rating</h2><span class="subtle">Ranking interno configurável</span></div><button class="button ghost small" data-view="ranking">Ver ranking ${icon("chevron",14)}</button></div>${topTeams(stats)}</section><section class="card pad"><div class="card-header"><div><h2>${observationsOnly ? "Métricas por fase" : "Desempenho por fase"}</h2><span class="subtle">${observationsOnly ? "Acompanhe ciclos e notas até a regra oficial." : "Média de pontos por robô"}</span></div></div>${phaseContent}</section></div></div><aside class="grid"><section class="card pad"><div class="card-header"><div><h2>Alertas de estratégia</h2><span class="subtle">Priorize estas observações.</span></div>${icon("bell",18)}</div>${stats.alerts.slice(0,5).map((alert) => `<button class="alert-item" data-action="open-team" data-team-id="${escapeHtml(alert.teamId)}"><span class="alert-icon">${icon(alert.type === "standout" ? "trophy" : alert.type === "unscouted" ? "clipboard" : "alert",16)}</span><span><strong>TEAM ${escapeHtml(alert.teamNumber || "—")}</strong><p>${escapeHtml(alert.message)}</p></span></button>`).join("") || '<span class="subtle">Nenhum alerta crítico no momento.</span>'}</section><section class="card pad"><div class="card-header"><div><h2>Partidas recentes</h2><span class="subtle">Atualizado com cada scout salvo.</span></div><button class="button ghost small" data-view="matches">Agenda ${icon("chevron",14)}</button></div>${recentRecords(state,stats,{ observationsOnly })}</section></aside></div>
  </section>`;
}
