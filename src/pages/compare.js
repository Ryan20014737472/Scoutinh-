import { compareTeams, getRanking } from "../services/analytics.js";
import { escapeHtml, icon, number, sectionHeader } from "../components/ui.js";
import { activeSeason } from "../utils/domain.js";

const formatMetric = (value, key) => {
  const numeric = Number(value || 0);
  if (key.includes("Rate") || key === "consistency") return `${number(numeric)}%`;
  return number(numeric, key.includes("average") ? 1 : 0);
};

function strategyNote(profile, selected, observationsOnly) {
  if (!profile.matchesAnalyzed) return "Esta equipe ainda não tem observações. Registre uma partida para avaliar sua estratégia.";
  selected = selected.filter((team) => team.matchesAnalyzed > 0);
  if (observationsOnly) {
    const highestCycles = Math.max(...selected.map((item) => item.averageCycles || 0));
    const strongestDefense = Math.max(...selected.map((item) => item.defense?.score || 0));
    return `${profile.averageCycles >= highestCycles ? "Maior ritmo de ciclos observado. " : ""}${profile.defense?.score >= strongestDefense ? "Pode complementar com defesa. " : ""}${profile.failureRate > 35 ? "Requer atenção à confiabilidade." : "Boa estabilidade nas observações."}`;
  }
  return `${profile.averageAuto >= Math.max(...selected.map((item) => item.averageAuto)) ? "Destaque no Autonomous. " : ""}${profile.averageEndgame >= Math.max(...selected.map((item) => item.averageEndgame)) ? "Endgame forte. " : ""}${profile.defense?.score >= Math.max(...selected.map((item) => item.defense?.score || 0)) ? "Pode complementar com defesa. " : ""}${profile.failureRate > 35 ? "Requer atenção à confiabilidade." : "Boa estabilidade nas observações."}`;
}

export function renderCompare({ state, selectedIds = [] }) {
  const ranking = getRanking(state);
  const selected = ranking.filter((profile) => selectedIds.includes(profile.teamId || profile.id));
  const observationsOnly = activeSeason(state)?.scoringScope === "observations_only";
  const rawComparison = compareTeams(selected).comparison || [];
  const comparison = observationsOnly ? rawComparison.filter((metric) => !["averageScore", "averageAuto", "averageTeleop", "averageEndgame", "bestScore"].includes(metric.key)) : rawComparison;
  const ratingMetric = selected.length ? [{ key: "scoutingRating", label: "Scouting Rating", higherIsBetter: true, bestValue: Math.max(...selected.map((team) => team.scoutingRating)), values: selected.map((team) => ({ teamId: team.teamId || team.id, teamNumber: team.teamNumber, value: team.scoutingRating })) }] : [];
  return `<section class="page fullwide">
    ${sectionHeader({ eyebrow: "DECISÃO DE ALIANÇA", title: "Comparar equipes", description: "Selecione de 2 a 4 equipes para comparar ritmo, resultados e confiabilidade." })}
    <section class="card pad"><div class="card-header"><div><h2>Equipes selecionadas</h2><span class="subtle">${selected.length}/4 selecionadas · mínimo de 2 para comparação.</span></div><button class="button ghost small" data-action="clear-compare">Limpar</button></div><div class="compare-selector">${ranking.map((profile) => { const id=profile.teamId || profile.id; const active=selectedIds.includes(id); const summary=observationsOnly ? `${number(profile.averageCycles,1)} ciclos médios · ${number(profile.scoutingRating,1)} rating` : `${number(profile.averageScore,1)} média · ${number(profile.scoutingRating,1)} rating`; return `<button class="compare-choice ${active ? "active" : ""}" data-action="toggle-compare" data-team-id="${escapeHtml(id)}"><span class="check-badge">${icon("check",11)}</span><span class="team-number-mark" style="width:34px;height:34px;border-radius:10px;font-size:10px">${escapeHtml(profile.teamNumber || "—")}</span><span><strong>${escapeHtml(profile.teamNumber || "—")} · ${escapeHtml(profile.name || "Equipe")}</strong><span>${summary}</span></span></button>`; }).join("")}</div></section>
    ${selected.length >= 2 ? `<section class="card pad" style="margin-top:16px"><div class="card-header"><div><h2>Comparação lado a lado</h2><span class="subtle">O melhor valor de cada métrica recebe destaque.</span></div></div><div class="compare-table"><table><thead><tr><th>Métrica</th>${selected.map((profile) => `<th><button class="button ghost small" data-action="open-team" data-team-id="${escapeHtml(profile.teamId || profile.id)}">${escapeHtml(profile.teamNumber || "—")}</button></th>`).join("")}</tr></thead><tbody>${[...ratingMetric,...comparison].map((metric) => `<tr><td>${escapeHtml(metric.label)}</td>${metric.values.map((entry) => `<td class="${Number(entry.value) === Number(metric.bestValue) ? "winner" : ""}">${formatMetric(entry.value,metric.key)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section><section class="card pad" style="margin-top:16px"><div class="card-header"><div><h2>Leitura estratégica</h2><span class="subtle">Sugestões calculadas a partir das métricas selecionadas.</span></div></div><div class="grid three">${selected.map((profile) => `<div class="card inset pad"><strong>${escapeHtml(profile.teamNumber || "—")} · ${escapeHtml(profile.name || "Equipe")}</strong><p class="subtle" style="margin:5px 0 0">${strategyNote(profile, selected, observationsOnly)}</p></div>`).join("")}</div></section>` : `<section class="card pad" style="margin-top:16px"><div class="empty-state"><span class="empty-state__icon">${icon("compare",28)}</span><h3>Escolha pelo menos duas equipes</h3><p>As métricas comparativas aparecerão aqui sem esconder variações de desempenho.</p></div></section>`}
  </section>`;
}
