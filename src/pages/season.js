import { escapeHtml, icon, sectionHeader } from "../components/ui.js";
import { activeSeason } from "../utils/domain.js";
import { RATING_WEIGHT_LABELS } from "../types/domain.js";

const phaseInfo = {
  auto: ["Autonomous", "Antes do controle manual"],
  teleop: ["TeleOp", "Controle manual e ciclos"],
  endgame: ["Endgame", "Ações finais da partida"],
};

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function externalLink(url, label) {
  const href = safeExternalUrl(url);
  return href ? `<a class="button ghost small" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ${icon("chevron", 14)}</a>` : "";
}

function officialStatusCard(season) {
  const isPreseason = season.scoringStatus === "preseason_pending_official_rules";
  const isArchive = season.scoringStatus === "official_archive";
  const eyebrow = isPreseason ? "Situação oficial: pré-temporada" : isArchive ? "Referência histórica oficial" : "Configuração da temporada";
  const title = isPreseason ? "BIOBUZZ ainda não tem pontuação pública" : isArchive ? "DECODE 2025-2026 · valores do manual" : "Fontes e regras";
  const defaultNote = isPreseason
    ? "Registre observações do robô sem transformar métricas internas em placar oficial."
    : "Confirme o manual da FIRST antes de usar esta configuração em um evento.";
  return `<section class="card pad"><div class="card-header"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2><p class="subtle">${escapeHtml(season.officialNote || defaultNote)}</p></div>${icon("clipboard", 20)}</div><div class="form-actions">${externalLink(season.officialSource, isArchive ? "Abrir Competition Manual DECODE" : "Abrir materiais FTC da FIRST")}${externalLink(season.officialManual, "Abrir manual")}</div><div class="form-actions" style="margin-top:8px"><button class="button ${isPreseason ? "primary" : ""}" data-action="apply-season-preset" data-preset="biobuzz">Usar BIOBUZZ atual</button><button class="button ghost" data-action="apply-season-preset" data-preset="decode">Usar DECODE 2025-2026</button></div></section>`;
}

function actionEditor(action, { observationsOnly = false, locked = false } = {}) {
  const pointControl = observationsOnly
    ? '<span class="status-pill info">Métrica interna</span>'
    : locked
      ? `<span class="status-pill good">${action.inputType === "select" ? "Opções" : `${Number(action.points) || 0} pts`}</span>`
      : `<input type="number" min="0" max="999" data-action="change-season-action-points" data-action-id="${escapeHtml(action.id)}" value="${Number(action.points) || 0}" aria-label="Pontos para ${escapeHtml(action.label)}" />`;
  const controls = locked ? "" : `<button data-action="request-delete-season-action" data-action-id="${escapeHtml(action.id)}" title="Remover ação" aria-label="Remover ${escapeHtml(action.label)}">${icon("close", 16)}</button>`;
  const label = locked
    ? `<strong>${escapeHtml(action.label)}</strong>`
    : `<input class="inline-label" data-action="change-season-action-label" data-action-id="${escapeHtml(action.id)}" value="${escapeHtml(action.label)}" aria-label="Nome da ação" />`;
  return `<article class="config-action" data-action-row="${escapeHtml(action.id)}"><div>${label}<p>${escapeHtml(action.inputType || "counter")} · limite ${action.max ?? "—"}${action.countsTowardCycles ? " · conta ciclos" : ""}</p></div>${pointControl}${controls}</article>`;
}

function addActionForm() {
  return `<form data-form="add-season-action" class="card inset pad" style="margin-top:14px"><div class="card-header"><h3>Adicionar ação personalizada</h3></div><div class="field-grid three"><div class="field"><label>Nome</label><input name="label" placeholder="Ex.: Objeto no nível X" required maxlength="60" /></div><div class="field"><label>Fase</label><select name="phase"><option value="auto">Autonomous</option><option value="teleop" selected>TeleOp</option><option value="endgame">Endgame</option></select></div><div class="field"><label>Tipo</label><select name="inputType"><option value="counter">Contador</option><option value="boolean">Sim / não</option><option value="select">Seleção</option></select></div><div class="field"><label>Pontos</label><input type="number" name="points" min="0" max="999" value="1" required /></div><div class="field"><label>Limite</label><input type="number" name="max" min="1" max="999" value="20" required /></div><div class="field"><label>Conta ciclo?</label><select name="countsTowardCycles"><option value="false" selected>Não</option><option value="true">Sim</option></select></div></div><div class="form-actions"><button class="button" type="submit">${icon("plus", 16)} Adicionar ação</button></div></form>`;
}

export function renderSeason({ state }) {
  const season = activeSeason(state) || { id: "season", name: "Temporada", gameName: "Jogo", actions: { auto: [], teleop: [], endgame: [] } };
  const weights = state.settings?.ratingWeights || {};
  const observationsOnly = season.scoringScope === "observations_only";
  const locked = Boolean(season.scoringStatus);
  return `<section class="page">
    ${sectionHeader({ eyebrow: "Administração", title: "Configuração da Temporada", description: "O formulário de scouting reflete a configuração exibida e sempre mostra a fonte FIRST associada." })}
    <div class="grid" style="grid-template-columns:minmax(0,1fr)">
      ${officialStatusCard(season)}
      <section class="card pad"><div class="card-header"><div><h2>Identidade da temporada</h2><span class="subtle">Configuração ativa do evento.</span></div></div><form data-form="season-identity"><div class="form-row two"><div class="field"><label for="season-name">Nome da temporada</label><input id="season-name" name="name" value="${escapeHtml(season.name || "")}" required /></div><div class="field"><label for="season-game">Nome do jogo</label><input id="season-game" name="gameName" value="${escapeHtml(season.gameName || "")}" required /></div></div><div class="form-actions"><button class="button primary" type="submit">${icon("save", 16)} Salvar identidade</button></div></form></section>
      <section class="card pad"><div class="card-header"><div><h2>${observationsOnly ? "Métricas de observação" : "Ações de pontuação"}</h2><span class="subtle">${observationsOnly ? "Sem valores oficiais enquanto o manual BIOBUZZ não estiver publicado." : "Valores preservados do manual associado ao preset."}</span></div></div><div class="tabs" role="tablist">${Object.entries(phaseInfo).map(([phase, [label]]) => `<button class="${phase === "auto" ? "active" : ""}" data-action="season-tab" data-phase="${phase}">${label}</button>`).join("")}</div>${Object.entries(phaseInfo).map(([phase, [label, description]]) => `<div class="season-panel ${phase === "auto" ? "" : "hidden"}" data-season-panel="${phase}"><div class="card inset"><div class="card-header" style="padding:12px 12px 0;margin-bottom:5px"><div><h3>${label}</h3><span class="subtle">${description}</span></div></div>${(season.actions?.[phase] || []).map((action) => actionEditor(action, { observationsOnly, locked })).join("") || '<div class="empty-state"><h3>Sem ações nessa fase</h3><p>Escolha um preset ou adicione uma ação.</p></div>'}</div></div>`).join("")}${locked ? '<p class="subtle" style="margin:14px 0 0">Os valores de presets oficiais são protegidos para não alterar a referência do manual. Use os botões acima para alternar apenas em um workspace sem registros.</p>' : addActionForm()}</section>
      <section class="card pad"><div class="card-header"><div><h2>Scouting Rating</h2><span class="subtle">Ajuste os pesos do ranking interno. Não substitui o ranking oficial da FTC.</span></div></div><form data-form="rating-weights"><div class="rating-breakdown">${Object.entries(RATING_WEIGHT_LABELS).map(([key, label]) => { const value = Number(weights[key] ?? 0); return `<div class="weight-row"><label for="weight-${key}">${escapeHtml(label)}</label><input id="weight-${key}" type="range" min="-20" max="50" step="1" name="${key}" value="${value}" data-action="rating-weight-input" /><output data-weight-output="${key}">${value > 0 ? "+" : ""}${value}</output></div>`; }).join("")}</div><div class="form-actions"><button class="button primary" type="submit">${icon("save", 16)} Salvar pesos</button></div></form></section>
    </div>
  </section>`;
}
