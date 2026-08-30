import { calculateScoutingScore, getSeasonActions, normalizeSeasonConfig } from "../services/scoring.js";
import { escapeHtml, icon, sectionHeader, statusPill } from "../components/ui.js";
import { findTeam, findScout, getMatchTeams, matchLabel } from "../utils/domain.js";

const phaseMeta = {
  auto: { label: "Auto", title: "Autonomous", description: "Registre as ações realizadas antes do controle manual.", tone: "violet" },
  teleop: { label: "TeleOp", title: "TeleOp", description: "Registre ciclos, objetivos e ações durante o controle manual.", tone: "cyan" },
  endgame: { label: "Endgame", title: "Endgame", description: "Registre a ação final e o nível alcançado.", tone: "green" },
  robot: { label: "Robô", title: "Robô e observações", description: "Marque diagnósticos rápidos e deixe uma nota curta, se necessário.", tone: "amber" },
};

const diagnosticLabels = [
  ["brokeDown", "Robô quebrou", "critical"],
  ["stalled", "Robô ficou parado", "critical"],
  ["mechanicalIssue", "Problema mecânico", "critical"],
  ["electricalIssue", "Problema elétrico", "critical"],
  ["programmingIssue", "Problema de programação", ""],
  ["connectionIssue", "Problema de conexão", ""],
  ["penaltyObserved", "Penalidade observada", ""],
  ["exceptionalPerformance", "Desempenho excepcional", ""]
];

function pointsLabel(action, { observationsOnly = false } = {}) {
  if (observationsOnly) return "Métrica";
  if (typeof action.points === "number") return `${action.points >= 0 ? "+" : ""}${action.points} pts`;
  const success = action?.points?.success;
  return Number.isFinite(Number(success)) ? `+${success} pts` : "Config.";
}

function attempts(action, draft) {
  const status = draft.actionStatus?.[action.id] || "not_attempted";
  return `<div class="attempt-group" role="group" aria-label="Resultado de ${escapeHtml(action.label)}">
    <button class="attempt-button success ${status === "success" ? "active" : ""}" data-action="set-action-status" data-action-id="${escapeHtml(action.id)}" data-status="success">Sucesso</button>
    <button class="attempt-button failure ${status === "failure" ? "active" : ""}" data-action="set-action-status" data-action-id="${escapeHtml(action.id)}" data-status="failure">Falha</button>
    <button class="attempt-button skip ${status === "not_attempted" ? "active" : ""}" data-action="set-action-status" data-action-id="${escapeHtml(action.id)}" data-status="not_attempted">Não tentou</button>
  </div>`;
}

function actionCard(action, draft, { observationsOnly = false } = {}) {
  const raw = draft.actions?.[action.id];
  const type = action.inputType || action.type || "counter";
  let control = "";
  if (type === "counter") {
    const current = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
    control = `<div class="counter-control"><button aria-label="Diminuir ${escapeHtml(action.label)}" data-action="change-counter" data-action-id="${escapeHtml(action.id)}" data-delta="-1">${icon("minus")}</button><output class="counter-value">${current}</output><button aria-label="Aumentar ${escapeHtml(action.label)}" data-action="change-counter" data-action-id="${escapeHtml(action.id)}" data-delta="1">${icon("plus")}</button></div><div class="counter-caption"><span>Quantidade registrada</span><span>${action.max !== undefined ? `máx. ${action.max}` : "sem limite"}</span></div>${action.showAttemptState ? attempts(action, draft) : ""}`;
  } else if (type === "select" || type === "choice") {
    control = `<div class="option-grid">${(action.options || []).map((option) => {
      const value = option.value ?? option.id;
      const selected = String(raw ?? "") === String(value);
      return `<button class="option-button ${selected ? "active" : ""}" data-action="set-action-option" data-action-id="${escapeHtml(action.id)}" data-value="${escapeHtml(value)}">${escapeHtml(option.label ?? value)}${!observationsOnly && Number(option.points) ? ` <small>+${escapeHtml(option.points)}</small>` : ""}</button>`;
    }).join("") || '<span class="subtle">Configure opções na Temporada.</span>'}</div>${attempts(action, draft)}`;
  } else {
    control = attempts(action, draft);
  }
  return `<article class="action-card"><div class="action-card__top"><div><h3>${escapeHtml(action.label)}</h3><p>${escapeHtml(action.helper || action.description || "Ação configurada para esta temporada")}</p></div><span class="action-points">${escapeHtml(pointsLabel(action, { observationsOnly }))}</span></div>${control}</article>`;
}

function officialNotice(season) {
  if (!season?.officialNote) return "";
  let source = "";
  try {
    const url = new URL(season.officialSource || season.officialManual);
    if (url.protocol === "https:") source = `<a class="button ghost small" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">Fonte FIRST ${icon("chevron", 14)}</a>`;
  } catch {
    // Imported seasons can omit an official source without blocking scouting.
  }
  const title = season.scoringScope === "observations_only" ? "BIOBUZZ: observações sem placar oficial" : "Referência de pontuação";
  return `<section class="card inset pad" style="margin-bottom:14px"><div class="card-header"><div><h3>${escapeHtml(title)}</h3><p class="subtle">${escapeHtml(season.officialNote)}</p></div>${source}</div></section>`;
}

function diagnostics(draft) {
  const robot = draft.robot || {};
  return `<section class="card pad"><div class="card-header"><div><h2>Diagnóstico rápido</h2><span class="subtle">Toque apenas no que foi observado.</span></div></div><div class="diagnostics-grid">${diagnosticLabels.map(([key,label,kind]) => `<button class="diagnostic-toggle ${kind} ${robot[key] ? "active" : ""}" data-action="toggle-diagnostic" data-key="${key}"><span class="toggle-mark">${icon("check",13)}</span>${escapeHtml(label)}</button>`).join("")}</div><div class="field" style="margin-top:14px"><label>Defesa</label><div class="option-grid">${[["strong","Defesa forte"],["medium","Defesa média"],["none","Sem defesa"]].map(([value,label]) => `<button class="option-button ${robot.defense === value ? "active" : ""}" data-action="set-defense" data-value="${value}">${label}</button>`).join("")}</div></div><div class="field" style="margin-top:14px"><label for="scout-notes">Observações do scout <span class="subtle">(opcional)</span></label><textarea id="scout-notes" maxlength="600" data-action="update-notes" placeholder="Ex.: ciclo rápido, dificuldade ao alinhar…">${escapeHtml(draft.notes || "")}</textarea></div></section>`;
}

export function renderScout({ state, draft, phase = "auto" }) {
  const season = normalizeSeasonConfig(state.seasonConfig || state.seasonConfigs?.find((item) => String(item.id) === String(draft.seasonId)) || state.seasonConfigs?.[0] || {});
  const team = findTeam(state, draft.teamId);
  const scout = findScout(state, draft.scoutId);
  const match = (state.matches || []).find((item) => String(item.id) === String(draft.matchId));
  const score = calculateScoutingScore(draft, season);
  const current = phaseMeta[phase] || phaseMeta.auto;
  const actions = phase === "robot" ? [] : getSeasonActions(season, phase);
  const matchEntry = getMatchTeams(state, match).find((entry) => String(entry.teamId) === String(draft.teamId));
  const observationsOnly = season.scoringScope === "observations_only";
  const scoreLabel = observationsOnly ? "Pontuação oficial pendente" : season.scoringStatus === "official_archive" ? "Contribuição DECODE" : "Total estimado";
  const scoreValue = observationsOnly ? "—" : score.total;
  const footerSummary = observationsOnly
    ? `${score.actionScores.filter((item) => item.status !== "not_attempted").length} métrica(s) registrada(s)`
    : `Auto ${score.auto} · TeleOp ${score.teleop} · End ${score.endgame}`;
  return `<section class="page scout-shell">
    <div class="scout-top"><div class="scout-top__row"><div class="scout-context"><button class="icon-button" data-action="leave-scout" aria-label="Voltar às partidas">${icon("back")}</button><div class="scout-context__team"><strong>TEAM ${escapeHtml(team?.number || "—")} · ${escapeHtml(team?.name || "Equipe")}</strong><span>${escapeHtml(matchLabel(match))} · ${draft.alliance === "blue" ? "Aliança Azul" : "Aliança Vermelha"}${matchEntry?.position ? ` · Posição ${matchEntry.position}` : ""}</span></div></div><div class="scout-score"><strong>${scoreValue}</strong><small>${escapeHtml(scoreLabel)}</small></div></div><nav class="scout-phase-nav" aria-label="Fase da partida">${Object.entries(phaseMeta).map(([key,item]) => `<button class="${phase === key ? "active" : ""}" data-action="set-scout-phase" data-phase="${key}">${item.label}</button>`).join("")}</nav></div>
    <div class="phase-intro"><span class="eyebrow">${current.tone === "violet" ? "Fase 1" : current.tone === "cyan" ? "Fase 2" : current.tone === "green" ? "Fase 3" : "Condição do robô"}</span><h2>${current.title}</h2><p>${current.description}</p></div>
    ${officialNotice(season)}
    ${phase === "robot" ? diagnostics(draft) : `<div class="action-grid">${actions.map((action) => actionCard(action, draft, { observationsOnly })).join("") || '<div class="card pad"><p class="subtle">Nenhuma ação configurada nesta fase. Configure a temporada antes de iniciar o scouting.</p></div>'}</div>`}
    <footer class="scout-bottom"><div class="scout-bottom__score"><small>${scout?.name || "Scout"} · ${navigator.onLine ? "dados protegidos localmente" : "offline: rascunho protegido"}</small><strong>${escapeHtml(footerSummary)}</strong></div><button class="button primary" data-action="review-scout">Revisar e salvar ${icon("chevron",16)}</button></footer>
  </section>`;
}

export function renderScoutReview({ state, draft }) {
  const season = normalizeSeasonConfig(state.seasonConfig || state.seasonConfigs?.find((item) => String(item.id) === String(draft.seasonId)) || state.seasonConfigs?.[0] || {});
  const team = findTeam(state, draft.teamId);
  const match = (state.matches || []).find((item) => String(item.id) === String(draft.matchId));
  const score = calculateScoutingScore(draft, season);
  const cycles = score.actionScores.filter((item) => season.actionMap?.[item.id]?.countsTowardCycles).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const faults = Object.values(draft.robot || {}).filter((value) => value === true).length;
  const observationsOnly = season.scoringScope === "observations_only";
  const observedByPhase = (phase) => score.actionScores.filter((item) => item.phase === phase && item.status !== "not_attempted").length;
  const totalLabel = observationsOnly ? "Pontuação oficial" : season.scoringStatus === "official_archive" ? "Contribuição DECODE" : "Total estimado";
  const totalValue = observationsOnly ? "—" : score.total;
  const phaseValue = (phase, scoreValue) => observationsOnly ? observedByPhase(phase) : scoreValue;
  const phaseLabel = (label) => observationsOnly ? `${label} · métricas` : label;
  return `<div class="modal-backdrop" data-modal="scout-review"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><header class="modal__header"><div><span class="eyebrow">Confirmação necessária</span><h2 id="review-title">Salvar scouting?</h2><p>Confira o resumo antes de registrar definitivamente.</p></div><button class="icon-button" data-action="close-modal" aria-label="Fechar">${icon("close")}</button></header><div class="modal__body"><div class="card pad inset"><div class="item-main">${icon("robot",22)}<div><strong>TEAM ${escapeHtml(team?.number || "—")} · ${escapeHtml(team?.name || "Equipe")}</strong><span>${escapeHtml(matchLabel(match))} · ${draft.alliance === "blue" ? "Aliança Azul" : "Aliança Vermelha"}</span></div></div></div><div class="summary-grid" style="margin-top:12px"><div class="summary-stat"><span>${phaseLabel("Autonomous")}</span><b>${phaseValue("auto", score.auto)}</b></div><div class="summary-stat"><span>${phaseLabel("TeleOp")}</span><b>${phaseValue("teleop", score.teleop)}</b></div><div class="summary-stat"><span>${phaseLabel("Endgame")}</span><b>${phaseValue("endgame", score.endgame)}</b></div><div class="summary-stat total"><span>${escapeHtml(totalLabel)}</span><b>${totalValue}</b></div><div class="summary-stat"><span>Ciclos</span><b>${cycles}</b></div><div class="summary-stat"><span>Alertas</span><b>${faults}</b></div></div>${observationsOnly ? `<p class="subtle" style="margin:14px 0 0">${escapeHtml(season.officialNote || "Esta temporada registra observações, não uma pontuação oficial.")}</p>` : ""}${draft.notes ? `<div class="field" style="margin-top:13px"><label>Observações</label><div class="card inset pad">${escapeHtml(draft.notes)}</div></div>` : ""}<p class="subtle" style="margin:14px 0 0">Os dados serão validados e salvos no banco local deste dispositivo. Registros duplicados para o mesmo time e partida são bloqueados.</p></div><footer class="modal__footer"><button class="button" data-action="close-modal">Continuar editando</button><button class="button primary" data-action="confirm-save-scout">${icon("save",16)} Confirmar e salvar</button></footer></section></div>`;
}
