import { icon, statusPill, toast, avatar, escapeHtml } from "./components/ui.js";
import { loadState, updateState, saveState, resetState, getStorageInfo, createDraft, normalizeDraft, submitRecord } from "./services/storage.js";
import { downloadExport } from "./services/export.js";
import { parseTeamLines, parseBackup } from "./services/import.js";
import { dialog, renderSetup, renderCreateModal } from "./components/forms.js";
import { getSeasonActions } from "./services/scoring.js";
import { createBiobuzzPreseasonConfig, createDecodeArchiveConfig } from "./data/seed.js";
import { activeEvent, activeSeason, currentScout, findTeam, getMatchTeams, recordFor } from "./utils/domain.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderMatches } from "./pages/matches.js";
import { renderScout, renderScoutReview, renderRecordDetails } from "./pages/scout.js";
import { renderTeams, renderTeamProfile } from "./pages/teams.js";
import { renderRanking } from "./pages/ranking.js";
import { renderCompare } from "./pages/compare.js";
import { renderFavorites } from "./pages/favorites.js";
import { renderStats } from "./pages/stats.js";
import { renderSeason } from "./pages/season.js";
import { renderAdmin, renderDeleteRecordConfirm } from "./pages/admin.js";
import { renderSettings, renderResetConfirm } from "./pages/settings.js";
import { renderMore } from "./pages/more.js";

const root = document.querySelector("#app");
const primaryNav = [
  ["dashboard", "Visão geral", "dashboard"],
  ["matches", "Partidas", "matches"],
  ["teams", "Equipes", "teams"],
  ["favorites", "Favoritos", "star"],
];
const managementNav = [
  ["admin", "Gerenciar evento", "matches"],
  ["season", "Temporada e regras", "settings"],
  ["settings", "Configurações", "settings"],
];
const analysisNav = [["stats", "Estatísticas", "chart"], ["ranking", "Ranking", "ranking"], ["compare", "Comparar equipes", "compare"]];
const mobileNav = [["dashboard", "Início", "dashboard"], ["matches", "Partidas", "matches"], ["teams", "Equipes", "teams"], ["stats", "Análise", "chart"], ["more", "Mais", "more"]];

let state;
let view = "dashboard";
let selectedTeamId = null;
let scoutDraft = null;
let scoutPhase = "auto";
let seasonPhase = "auto";
let modal = null;
let syncStatus = navigator.onLine ? "synced" : "offline";
let storageInfo = { backend: "carregando", persistent: false };
let compareSelection = [];
let filters = {
  matches: { term: "", status: "Todas" },
  teams: { term: "", onlyFavorites: false, onlyWatchlist: false },
  stats: {},
};
let channel = null;
let interactionQueue = Promise.resolve();
let pendingWrites = 0;
let displayedView = null;
let displayedModal = null;
let pendingBackup = null;
const validViews = new Set([...primaryNav, ...managementNav, ...analysisNav, ...mobileNav].map(([key]) => key).concat(["team", "scout"]));

function perform(operation) {
  pendingWrites++;
  const result = interactionQueue.then(operation);
  interactionQueue = result.catch((error) => {
    console.error(error);
    toast(error.message || "Não foi possível salvar. Tente novamente.", "error");
  }).finally(() => { pendingWrites--; });
  return interactionQueue;
}

function routeHash(nextView = view) {
  if (nextView === "team" && selectedTeamId) return `#team/${encodeURIComponent(selectedTeamId)}`;
  if (nextView === "scout" && scoutDraft) return `#scout/${encodeURIComponent(scoutDraft.matchId)}/${encodeURIComponent(scoutDraft.teamId)}`;
  return `#${nextView}`;
}

function writeRoute({ replace = false } = {}) {
  const hash = routeHash();
  if (location.hash !== hash) history[replace ? "replaceState" : "pushState"](null, "", hash);
}

const slugify = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
const makeId = (prefix, value = "") => `${prefix}-${slugify(value)}-${Date.now().toString(36)}`;

function appTitle() {
  const titles = { dashboard: "Visão geral", matches: "Partidas", teams: "Equipes", team: "Equipe", scout: "Observação", ranking: "Ranking", compare: "Comparar equipes", favorites: "Favoritos", stats: "Estatísticas", season: "Temporada e regras", admin: "Gerenciar evento", settings: "Configurações", more: "Mais ferramentas" };
  return `${titles[view] || "FTC Scout Arena"} · FTC Scout Arena`;
}

function navLink([key, label, iconName], compact = false) {
  const selected = view === key || (key === "teams" && view === "team") || (compact && key === "more" && ["more", "settings", "admin", "season", "ranking", "compare", "favorites"].includes(view)) || (key === "matches" && view === "scout");
  const count = key === "matches" ? (state.matches || []).filter((match) => String(match.eventId) === String(activeEvent(state)?.id) && match.status !== "complete").length : 0;
  return `<a href="#${key}" data-view="${key}" class="${selected ? "active" : ""}" ${selected ? 'aria-current="page"' : ""}>${icon(iconName, compact ? 20 : 18)}<span>${escapeHtml(label)}</span>${!compact && count ? `<span class="nav-count">${count}</span>` : ""}</a>`;
}

function searchHeader() {
  return `<header class="desktop-topbar"><form class="search-box" data-form="global-search">${icon("search",16)}<input id="global-search" name="term" type="search" placeholder="Buscar equipe pelo nome ou número..." aria-label="Busca global de equipes" autocomplete="off" /><span class="search-shortcut" aria-hidden="true">↵</span></form><div class="desktop-actions"><button class="event-switcher" data-view="admin" aria-label="Gerenciar evento ativo">${icon("matches",16)}<span><span>Evento ativo</span><strong>${escapeHtml(activeEvent(state)?.name || "Prepare seu primeiro evento")}</strong></span>${icon("chevron",12)}</button>${statusPill(syncStatus)}<button class="header-avatar" data-view="settings" aria-label="Escolher scout">${avatar(currentScout(state))}</button></div></header>`;
}

function mobileHeader() {
  return `<header class="mobile-topbar"><a class="brand" href="#dashboard" data-view="dashboard"><span class="brand-mark">${icon("robot",23)}</span><span class="brand-text"><strong>Scout Arena</strong><span>FTC SCOUTING</span></span></a><div class="mobile-header-actions">${navigator.onLine ? "" : statusPill("offline")}<button class="icon-button" data-view="settings" aria-label="Configurações">${icon("settings",19)}</button></div></header>`;
}

function shell(content) {
  const scout = currentScout(state);
  return `<a class="skip-link" href="#main-content">Pular para o conteúdo</a><div class="app-shell"><aside class="sidebar"><a class="brand" href="#dashboard" data-view="dashboard"><span class="brand-mark">${icon("robot",24)}</span><span class="brand-text"><strong>Scout Arena</strong><span>FTC SCOUTING</span></span></a><nav class="side-nav" aria-label="Navegação principal"><span class="side-nav__section">Workspace</span>${primaryNav.map((item) => navLink(item)).join("")}<span class="side-nav__section">Análise e estratégia</span>${analysisNav.map((item) => navLink(item)).join("")}<span class="side-nav__section">Organização</span>${managementNav.map((item) => navLink(item)).join("")}</nav><div class="side-help"><div><h3>${icon("clipboard",15)} Pronto para a arena?</h3><p>Um evento organizado começa com uma boa observação.</p><button data-action="start-scout">Iniciar observação ${icon("chevron",13)}</button></div></div><div class="side-footer"><button class="side-footer__scout" data-view="settings" aria-label="Alterar scout atual">${avatar(scout)}<div><strong>${escapeHtml(scout?.name || "Seu perfil de scout")}</strong><span><i class="online-dot"></i>${syncStatus === "offline" ? "Trabalhando offline" : "Dados neste dispositivo"}</span></div>${icon("more",17)}</button></div></aside><main class="main" id="main-content" tabindex="-1">${mobileHeader()}${searchHeader()}${content}</main><nav class="mobile-nav" aria-label="Atalhos">${mobileNav.map((item) => navLink(item, true)).join("")}</nav></div>`;
}

function seasonActionDeleteConfirm(actionId) {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal__header"><div><span class="eyebrow">Confirmação necessária</span><h2>Remover ação da temporada?</h2><p>Ela deixará de aparecer em novos scouting. Registros existentes mantêm os seus dados.</p></div><button class="icon-button" data-action="close-modal" aria-label="Fechar">${icon("close")}</button></header><div class="modal__body"><div class="card inset pad"><span class="icon-text">${icon("alert",18)} A alteração vale para a interface de scouting atual.</span></div></div><footer class="modal__footer"><button class="button" data-action="close-modal">Cancelar</button><button class="button danger" data-action="confirm-delete-season-action" data-action-id="${escapeHtml(actionId)}">Remover ação</button></footer></section></div>`;
}

function renderModal() {
  if (!modal) return "";
  if (modal.type === "setup") return renderSetup(state, modal.step);
  if (["add-team", "bulk-teams", "add-match", "start-scout"].includes(modal.type)) return renderCreateModal(state, modal.type);
  if (modal.type === "restore-backup" && pendingBackup) return dialog({
    title: "Restaurar este backup?",
    description: "Os dados deste navegador serão substituídos pelos dados do arquivo. Faça um backup dos dados atuais antes de continuar.",
    body: `<div class="summary-grid"><div class="summary-stat"><span>Equipes</span><b>${pendingBackup.teams.length}</b></div><div class="summary-stat"><span>Partidas</span><b>${pendingBackup.matches.length}</b></div><div class="summary-stat"><span>Observações</span><b>${pendingBackup.scoutingRecords.length}</b></div><div class="summary-stat"><span>Eventos</span><b>${pendingBackup.events.length}</b></div></div><div class="form-actions"><button class="button" data-action="export-state-json">${icon("download",16)} Baixar backup atual</button></div>`,
    footer: '<button class="button" data-action="close-modal">Cancelar</button><button class="button primary" data-action="confirm-restore">Restaurar backup</button>'
  });
  if (modal.type === "scout-review") return renderScoutReview({ state, draft: scoutDraft });
  if (modal.type === "record") return renderRecordDetails({ state, record: state.scoutingRecords.find((item) => String(item.id) === String(modal.recordId)) });
  if (modal.type === "discard-scout") return dialog({
    title: "Descartar este rascunho?",
    description: scoutDraft?.editingRecordId ? "As alterações deste rascunho serão removidas. A observação já salva continua no histórico." : "As ações e notas deste rascunho serão removidas. A equipe ficará disponível para uma nova observação.",
    body: '<p class="subtle">Use esta opção se você escolheu a equipe errada ou quer recomeçar.</p>',
    footer: '<button class="button" data-action="close-modal">Continuar editando</button><button class="button danger" data-action="confirm-discard-scout">Descartar rascunho</button>'
  });
  if (modal.type === "reset") return renderResetConfirm();
  if (modal.type === "delete-record") return renderDeleteRecordConfirm(modal.recordId);
  if (modal.type === "delete-season-action") return seasonActionDeleteConfirm(modal.actionId);
  return "";
}

function pageContent() {
  switch (view) {
    case "matches": return renderMatches({ state, filters: filters.matches });
    case "scout": return scoutDraft ? renderScout({ state, draft: scoutDraft, phase: scoutPhase }) : renderMatches({ state, filters: filters.matches });
    case "teams": return renderTeams({ state, filters: filters.teams });
    case "team": return renderTeamProfile({ state, teamId: selectedTeamId });
    case "ranking": return renderRanking({ state });
    case "compare": return renderCompare({ state, selectedIds: compareSelection });
    case "favorites": return renderFavorites({ state });
    case "stats": return renderStats({ state, filters: filters.stats });
    case "season": return renderSeason({ state, selectedPhase: seasonPhase });
    case "admin": return renderAdmin({ state });
    case "settings": return renderSettings({ state, storageInfo, online: navigator.onLine });
    case "more": return renderMore();
    default: return renderDashboard({ state });
  }
}

function render() {
  if (!state) return;
  const active = document.activeElement;
  const sameView = displayedView === view;
  const modalKey = modal ? `${modal.type}:${modal.step || ""}` : null;
  let selector = null;
  if (active && root.contains(active) && sameView && displayedModal === modalKey) {
    if (active.id) selector = `#${CSS.escape(active.id)}`;
    else if (active.dataset.filter) selector = `[data-filter="${CSS.escape(active.dataset.filter)}"]`;
    else if (active.dataset.action) selector = Object.entries(active.dataset).map(([key, value]) => `[data-${key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase())}="${CSS.escape(value)}"]`).join("");
  }
  const selection = typeof active?.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null;
  document.title = appTitle();
  root.innerHTML = `${shell(pageContent())}${renderModal()}`;
  document.body.classList.toggle("modal-open", Boolean(modal));
  root.querySelector(".app-shell").inert = Boolean(modal);
  // Older pages get native label associations without changing their contracts.
  root.querySelectorAll(".field").forEach((field, index) => {
    const control = field.querySelector("input, select, textarea");
    const label = field.querySelector("label");
    if (control && label) {
      if (!control.id) control.id = `field-${index}-${control.name || control.dataset.action || "input"}`;
      if (!label.htmlFor) label.htmlFor = control.id;
    }
  });
  root.querySelectorAll('button[data-action], button[data-view]').forEach((button) => { button.type = "button"; });
  root.querySelectorAll('.attempt-button, .option-button, .diagnostic-toggle, .compare-choice').forEach((button) => button.setAttribute("aria-pressed", String(button.classList.contains("active"))));
  const dialogNode = root.querySelector(".modal");
  if (dialogNode) {
    dialogNode.tabIndex = -1;
    if (!dialogNode.hasAttribute("aria-labelledby")) {
      const heading = dialogNode.querySelector("h2");
      if (heading) { heading.id = heading.id || "dialog-title"; dialogNode.setAttribute("aria-labelledby", heading.id); }
    }
  }
  if (modal && displayedModal !== modalKey) {
    const target = root.querySelector('.modal input:not([disabled]), .modal textarea:not([disabled]), .modal select:not([disabled])') || root.querySelector(".modal");
    target?.focus({ preventScroll: true });
  } else if (selector && root.querySelector(selector)) {
    const target = root.querySelector(selector);
    target.focus({ preventScroll: true });
    if (selection && typeof target.setSelectionRange === "function" && ["text", "search", "tel", "url", "password"].includes(target.type)) target.setSelectionRange(...selection);
  } else if (!sameView || (displayedModal && !modal)) {
    const heading = root.querySelector(".page h1") || root.querySelector(".phase-intro h2");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  updateMatchChoices();
  displayedView = view;
  displayedModal = modalKey;
}

function announceUpdate() {
  if (channel) channel.postMessage({ type: "state-updated", at: Date.now() });
}

async function mutate(mutator, { repaint = true } = {}) {
  syncStatus = navigator.onLine ? "syncing" : "offline";
  try {
    state = await updateState(mutator);
    storageInfo = getStorageInfo();
    syncStatus = navigator.onLine ? "synced" : "offline";
    announceUpdate();
    if (repaint) render();
    return state;
  } catch (error) {
    syncStatus = navigator.onLine ? "synced" : "offline";
    if (repaint) render();
    throw error;
  }
}

async function navigate(nextView, { teamId, fromHistory = false } = {}) {
  if (!validViews.has(nextView)) nextView = "dashboard";
  if (view === "scout" && nextView !== "scout" && scoutDraft) {
    await saveDraft({ repaint: false });
    scoutDraft = null;
  }
  if (nextView === "teams") selectedTeamId = null;
  if (nextView === "team" && teamId) selectedTeamId = teamId;
  if (nextView !== "scout") modal = null;
  view = nextView;
  if (!fromHistory) writeRoute();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function saveDraft({ repaint = true } = {}) {
  if (!scoutDraft) return;
  scoutDraft = normalizeDraft(scoutDraft, activeSeason(state));
  const snapshot = structuredClone(scoutDraft);
  await mutate((next) => {
    next.drafts = { ...(next.drafts || {}), [snapshot.id]: snapshot };
    return next;
  }, { repaint });
}

async function editDraft(change, { repaint = true } = {}) {
  if (!scoutDraft) return;
  change(scoutDraft);
  scoutDraft.updatedAt = new Date().toISOString();
  await saveDraft({ repaint });
}

function updateMatchChoices() {
  const selects = [...root.querySelectorAll("select[data-match-team]")];
  selects.forEach((select) => {
    const used = new Set(selects.filter((other) => other !== select).map((other) => other.value).filter(Boolean));
    [...select.options].forEach((option) => { option.disabled = Boolean(option.value && used.has(option.value)); });
  });
}

function openSetup() {
  const step = !activeEvent(state) || !currentScout(state) ? 1 : state.teams.length < 4 ? 2 : 3;
  modal = { type: "setup", step };
  render();
}

function findAction(actionId) {
  return getSeasonActions(activeSeason(state)).find((action) => String(action.id) === String(actionId));
}

function assignmentKeyFor({ alliance, position } = {}) {
  const resolvedAlliance = String(alliance).toLowerCase() === "blue" ? "blue" : "red";
  const resolvedPosition = Math.max(1, Number(position) || 1);
  return `${resolvedAlliance}-${resolvedPosition}`;
}

function hasLiveAssignment(next, match, assignmentKey, scoutId) {
  return Object.values(next?.drafts || {}).some((draft) => (
    String(draft?.matchId) === String(match?.id)
    && String(draft?.scoutId) === String(scoutId)
    && assignmentKeyFor(draft) === assignmentKey
  ));
}

function releaseScoutAssignment(next, draft) {
  const match = (next.matches || []).find((item) => String(item.id) === String(draft?.matchId));
  if (!match || !draft?.scoutId) return;
  const assignmentKey = assignmentKeyFor(draft);
  if (String(match.scoutAssignments?.[assignmentKey]) !== String(draft.scoutId)) return;
  const { [assignmentKey]: released, ...remaining } = match.scoutAssignments || {};
  match.scoutAssignments = remaining;
}

function refreshMatchStatus(next, matchId) {
  const match = (next.matches || []).find((item) => String(item.id) === String(matchId));
  if (!match) return;
  const entries = getMatchTeams(next, match);
  const completed = entries.filter((entry) => recordFor(next, match.id, entry.teamId)).length;
  match.status = entries.length && completed === entries.length
    ? "complete"
    : completed > 0 || Object.values(next.drafts || {}).some((draft) => String(draft.matchId) === String(matchId)) ? "in_progress" : "not_started";
}

async function discardScoutDraft() {
  const draft = scoutDraft;
  if (!draft) return;
  await mutate((next) => {
    if (next.drafts) delete next.drafts[draft.id];
    releaseScoutAssignment(next, draft);
    refreshMatchStatus(next, draft.matchId);
    return next;
  }, { repaint: false });
  scoutDraft = null;
  modal = null;
}

async function enterScout(data, { fromHistory = false } = {}) {
  const match = (state.matches || []).find((item) => String(item.id) === String(data.matchId));
  const team = findTeam(state, data.teamId);
  const scout = currentScout(state);
  const season = activeSeason(state);
  const event = activeEvent(state);
  if (!event) {
    toast("Crie e ative um evento antes de iniciar o scouting.", "info");
    return navigate("admin");
  }
  if (!scout) {
    toast("Cadastre um scout antes de iniciar o scouting.", "info");
    return navigate("admin");
  }
  if (!season) {
    toast("Configure uma temporada antes de iniciar o scouting.", "error");
    return navigate("season");
  }
  if (!match || !team || String(match.eventId) !== String(event.id)) {
    toast("Não foi possível preparar este scouting.", "error");
    return;
  }
  const entry = getMatchTeams(state, match).find((item) => String(item.teamId) === String(team.id));
  if (!entry) {
    toast("Esta equipe não está registrada na partida selecionada.", "error");
    return;
  }
  const existingDraft = Object.values(state.drafts || {}).find((draft) => String(draft.matchId) === String(match.id) && String(draft.teamId) === String(team.id) && String(draft.scoutId) === String(scout.id));
  const existingRecord = recordFor(state, match.id, team.id);
  if (existingRecord && !existingDraft?.editingRecordId) {
    modal = { type: "record", recordId: existingRecord.id }; render();
    return;
  }
  const assignmentKey = assignmentKeyFor(entry);
  const storedReservation = match.scoutAssignments?.[assignmentKey];
  const reservedBy = hasLiveAssignment(state, match, assignmentKey, storedReservation) ? storedReservation : null;
  if (reservedBy && String(reservedBy) !== String(scout.id)) {
    const owner = (state.scouts || []).find((item) => String(item.id) === String(reservedBy));
    toast(`Esta posição já está reservada por ${owner?.name || "outro scout"}.`, "error");
    return;
  }
  await mutate((next) => {
    const live = next.matches.find((item) => String(item.id) === String(match.id));
    if (!live) throw new Error("Esta partida não está mais disponível.");
    const ownerId = live.scoutAssignments?.[assignmentKey];
    if (ownerId && String(ownerId) !== String(scout.id) && hasLiveAssignment(next, live, assignmentKey, ownerId)) throw new Error("Outro scout já está observando esta posição.");
    const latestDraft = Object.values(next.drafts || {}).find((draft) => String(draft.matchId) === String(match.id) && String(draft.teamId) === String(team.id) && String(draft.scoutId) === String(scout.id));
    if (recordFor(next, match.id, team.id) && !latestDraft?.editingRecordId) throw new Error("Esta equipe já tem uma observação salva nesta partida.");
    scoutDraft = normalizeDraft(latestDraft || createDraft({ eventId: event.id, matchId: match.id, teamId: team.id, scoutId: scout.id, seasonId: season.id, alliance: entry.alliance, position: Number(entry.position || 1) }, season), season);
    next.drafts = { ...(next.drafts || {}), [scoutDraft.id]: structuredClone(scoutDraft) };
    live.scoutAssignments = { ...(live.scoutAssignments || {}), [assignmentKey]: scout.id };
    refreshMatchStatus(next, live.id);
    return next;
  }, { repaint: false });
  scoutPhase = ["auto", "teleop", "endgame", "robot"].includes(scoutDraft.phase) ? scoutDraft.phase : "auto";
  modal = null;
  view = "scout";
  if (!fromHistory) writeRoute();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function saveScouting() {
  const season = activeSeason(state);
  if (!scoutDraft || !season) return;
  try {
    await submitRecord(scoutDraft, season, { replace: Boolean(scoutDraft.editingRecordId && scoutDraft.editingRecordId === scoutDraft.id) });
    state = await loadState();
    storageInfo = getStorageInfo();
    announceUpdate();
    modal = null;
    const teamId = scoutDraft.teamId;
    scoutDraft = null;
    view = "team";
    selectedTeamId = teamId;
    writeRoute();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
    toast("Scouting salvo com sucesso. As estatísticas foram atualizadas.", "success");
  } catch (error) {
    toast(error?.code === "DUPLICATE_SCOUTING_RECORD" ? "Já existe um registro para este time nesta partida." : "Não foi possível salvar o scouting.", "error");
  }
}

async function toggleFavorite(teamId) {
  await mutate((next) => {
    const matches = (item) => String(item.teamId ?? item) === String(teamId) && (!item.eventId || String(item.eventId) === String(activeEvent(next)?.id));
    const exists = (next.favorites || []).some(matches);
    next.favorites = exists ? next.favorites.filter((item) => !matches(item)) : [...(next.favorites || []), { id: makeId("favorite", teamId), eventId: activeEvent(next)?.id, teamId, createdBy: currentScout(next)?.id, createdAt: new Date().toISOString() }];
    return next;
  });
  toast("Favoritos atualizados.", "success");
}

async function toggleWatchlist(teamId) {
  await mutate((next) => {
    const matches = (item) => String(item.teamId ?? item) === String(teamId) && (!item.eventId || String(item.eventId) === String(activeEvent(next)?.id));
    const exists = (next.watchlist || []).some(matches);
    next.watchlist = exists ? next.watchlist.filter((item) => !matches(item)) : [...(next.watchlist || []), { id: makeId("watch", teamId), eventId: activeEvent(next)?.id, teamId, category: "watch_again", priority: "medium", reason: "Equipe marcada para nova observação.", createdBy: currentScout(next)?.id, createdAt: new Date().toISOString() }];
    return next;
  });
  toast("Watchlist atualizada.", "success");
}

async function updateSeason(mutator) {
  await mutate((next) => {
    const event = activeEvent(next);
    const seasonId = event?.seasonConfigId || event?.seasonId || next.settings?.activeSeasonId;
    const season = (next.seasonConfigs || []).find((item) => String(item.id) === String(seasonId)) || next.seasonConfigs?.[0];
    if (season) mutator(season, next);
    return next;
  });
}

async function applySeasonPreset(preset) {
  const eventId = activeEvent(state)?.id;
  if ((state.scoutingRecords || []).some((record) => !eventId || String(record.eventId) === String(eventId)) || Object.values(state.drafts || {}).some((draft) => !eventId || String(draft.eventId) === String(eventId))) {
    toast("Este evento já tem observações ou rascunhos. Crie outro evento para usar uma temporada diferente e preservar o histórico.", "error");
    return;
  }
  const buildPreset = preset === "decode" ? createDecodeArchiveConfig : createBiobuzzPreseasonConfig;
  const configured = buildPreset();
  configured.updatedAt = new Date().toISOString();
  await mutate((next) => {
    if (!next.seasonConfigs.some((season) => String(season.id) === String(configured.id))) next.seasonConfigs.push(configured);
    next.settings = { ...(next.settings || {}), activeSeasonId: configured.id };
    const event = activeEvent(next);
    if (event) {
      event.seasonId = configured.id;
      event.seasonConfigId = configured.id;
      event.updatedAt = configured.updatedAt;
    }
    return next;
  });
  toast(preset === "decode" ? "Preset histórico DECODE aplicado." : "Preset BIOBUZZ de pré-temporada aplicado.", "success");
}

async function handleAction(button) {
  const action = button.dataset.action;
  const data = button.dataset;
  if (action === "open-record") { modal = { type: "record", recordId: data.recordId }; render(); return; }
  if (action === "edit-record") {
    const record = state.scoutingRecords.find((item) => String(item.id) === String(data.recordId));
    if (!record || String(record.eventId) !== String(activeEvent(state)?.id)) throw new Error("Ative o evento deste registro antes de editar.");
    const scout = currentScout(state);
    if (!scout) return openSetup();
    const season = activeSeason(state);
    const actions = Object.fromEntries(Object.entries(record.actions || {}).map(([key,value]) => [key, value && typeof value === "object" ? value.value : value]));
    scoutDraft = normalizeDraft({ ...record, actions, status: "draft", editingRecordId: record.id, originalScoutId: record.originalScoutId || record.scoutId, scoutId: scout.id }, season);
    scoutPhase = "auto"; modal = null;
    await saveDraft({ repaint: false });
    view = "scout"; writeRoute(); render(); window.scrollTo({ top: 0, behavior: "instant" }); return;
  }
  if (action === "set-current-scout") {
    if (!state.scouts.some((person) => String(person.id) === String(data.scoutId))) return;
    await mutate((next) => { next.settings.currentScoutId = data.scoutId; return next; });
    toast("Perfil de scout atualizado.", "success"); return;
  }
  if (action === "open-setup") return openSetup();
  if (action === "setup-next") { modal = { type: "setup", step: Number(data.step) }; render(); return; }
  if (action === "open-add-team") { modal = { type: "add-team" }; render(); return; }
  if (action === "open-bulk-teams") { modal = { type: "bulk-teams" }; render(); return; }
  if (action === "open-add-match") {
    if (!activeEvent(state) || !currentScout(state) || state.teams.length < 4) return openSetup();
    modal = { type: "add-match" }; render(); return;
  }
  if (action === "start-scout") {
    if (!activeEvent(state) || !currentScout(state) || state.teams.length < 4) return openSetup();
    modal = { type: "start-scout" }; render(); return;
  }
  if (action === "open-scout") return enterScout(data);
  if (action === "open-team") return navigate("team", { teamId: data.teamId });
  if (action === "leave-scout") return navigate("matches");
  if (action === "request-discard-scout") { modal = { type: "discard-scout" }; render(); return; }
  if (action === "confirm-discard-scout") { await discardScoutDraft(); view = "matches"; writeRoute(); render(); toast("Rascunho descartado.", "info"); return; }
  if (action === "set-scout-phase") {
    scoutPhase = data.phase;
    if (scoutDraft) { scoutDraft.phase = scoutPhase; await saveDraft({ repaint: false }); }
    render(); return;
  }
  if (action === "next-scout-phase") {
    const phases = ["auto", "teleop", "endgame", "robot"];
    scoutPhase = phases[Math.min(3, phases.indexOf(scoutPhase) + 1)];
    scoutDraft.phase = scoutPhase;
    await saveDraft({ repaint: false });
    render(); window.scrollTo({ top: 0, behavior: "instant" }); return;
  }
  if (action === "change-counter") {
    const definition = findAction(data.actionId);
    const current = Number(scoutDraft?.actions?.[data.actionId] || 0);
    const max = Number.isFinite(Number(definition?.max)) ? Number(definition.max) : 999;
    return editDraft((draft) => { draft.actions[data.actionId] = Math.max(0, Math.min(max, current + Number(data.delta))); draft.actionStatus[data.actionId] = draft.actions[data.actionId] > 0 ? "success" : "not_attempted"; });
  }
  if (action === "set-action-status") {
    const definition = findAction(data.actionId);
    return editDraft((draft) => { draft.actionStatus[data.actionId] = data.status; if (definition?.inputType === "boolean") draft.actions[data.actionId] = data.status === "success"; });
  }
  if (action === "set-action-option") return editDraft((draft) => { draft.actions[data.actionId] = data.value; draft.actionStatus[data.actionId] = data.value === "none" ? "not_attempted" : data.value === "attempted" ? "failure" : "success"; });
  if (action === "toggle-diagnostic") return editDraft((draft) => { draft.robot[data.key] = !draft.robot[data.key]; });
  if (action === "set-defense") return editDraft((draft) => { draft.robot.defense = data.value; });
  if (action === "review-scout") { modal = { type: "scout-review" }; render(); return; }
  if (action === "confirm-save-scout") return saveScouting();
  if (action === "close-modal") { modal = null; pendingBackup = null; render(); return; }
  if (action === "match-status") { filters.matches.status = data.status; render(); return; }
  if (action === "clear-match-filters") { filters.matches = { term: "", status: "Todas" }; render(); return; }
  if (action === "filter-favorites") { filters.teams.onlyFavorites = !filters.teams.onlyFavorites; render(); return; }
  if (action === "filter-watchlist") { filters.teams.onlyWatchlist = !filters.teams.onlyWatchlist; render(); return; }
  if (action === "toggle-favorite") return toggleFavorite(data.teamId);
  if (action === "toggle-watchlist") return toggleWatchlist(data.teamId);
  if (action === "toggle-compare") {
    if (compareSelection.includes(data.teamId)) compareSelection = compareSelection.filter((id) => id !== data.teamId);
    else if (compareSelection.length >= 4) toast("A comparação aceita no máximo quatro equipes.", "error");
    else compareSelection = [...compareSelection, data.teamId];
    render();
    return;
  }
  if (action === "clear-compare") { compareSelection = []; render(); return; }
  if (action === "apply-season-preset") return applySeasonPreset(data.preset);
  if (action === "season-tab") {
    seasonPhase = data.phase;
    document.querySelectorAll("[data-season-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.seasonPanel !== data.phase));
    document.querySelectorAll("[data-action='season-tab']").forEach((item) => item.classList.toggle("active", item.dataset.phase === data.phase));
    return;
  }
  if (action === "request-delete-season-action") {
    const used = state.scoutingRecords.some((record) => data.actionId in (record.actions || {})) || Object.values(state.drafts || {}).some((draft) => data.actionId in (draft.actions || {}));
    if (used) throw new Error("Esta métrica já foi usada em um registro ou rascunho. Mantenha-a para preservar o histórico.");
    modal = { type: "delete-season-action", actionId: data.actionId }; render(); return;
  }
  if (action === "confirm-delete-season-action") {
    await updateSeason((season) => { for (const phase of ["auto", "teleop", "endgame"]) season.actions[phase] = (season.actions?.[phase] || []).filter((item) => String(item.id) !== String(data.actionId)); });
    modal = null;
    render();
    toast("Ação removida da configuração da temporada.", "success");
    return;
  }
  if (action === "request-reset") { modal = { type: "reset" }; render(); return; }
  if (action === "confirm-reset") {
    state = await resetState(); storageInfo = getStorageInfo(); modal = null; scoutDraft = null; selectedTeamId = null; compareSelection = []; filters.stats = {}; view = "dashboard"; writeRoute(); announceUpdate(); render(); toast("Banco local limpo.", "success"); return;
  }
  if (action === "confirm-restore" && pendingBackup) {
    state = await saveState(pendingBackup);
    storageInfo = getStorageInfo();
    pendingBackup = null; modal = null; scoutDraft = null; selectedTeamId = null; compareSelection = [];
    filters = { matches: { term: "", status: "Todas" }, teams: { term: "", onlyFavorites: false, onlyWatchlist: false }, stats: {} };
    view = "dashboard"; writeRoute(); announceUpdate(); render();
    toast("Backup restaurado. Seus dados estão prontos para usar.", "success"); return;
  }
  if (action === "request-delete-record") { modal = { type: "delete-record", recordId: data.recordId }; render(); return; }
  if (action === "confirm-delete-record") {
    await mutate((next) => {
      const record = (next.scoutingRecords || []).find((item) => String(item.id) === String(data.recordId));
      next.scoutingRecords = (next.scoutingRecords || []).filter((item) => String(item.id) !== String(data.recordId));
      if (record) {
        releaseScoutAssignment(next, record);
        refreshMatchStatus(next, record.matchId);
      }
      return next;
    }, { repaint: false });
    modal = null; render(); toast("Registro excluído e estatísticas atualizadas.", "success"); return;
  }
  if (action === "set-active-event") {
    await mutate((next) => {
      const event = (next.events || []).find((item) => String(item.id) === String(data.eventId));
      if (!event) return next;
      next.settings.activeEventId = event.id;
      if (event.seasonConfigId || event.seasonId) next.settings.activeSeasonId = event.seasonConfigId || event.seasonId;
      return next;
    });
    filters.stats = {}; compareSelection = [];
    render();
    toast("Evento ativo atualizado.", "success"); return;
  }
  if (action === "clear-stats-filters") { filters.stats = {}; render(); return; }
  if (action === "export-scouting-csv") return exportData("csv", "scouting");
  if (action === "export-scouting-json") return exportData("json", "scouting");
  if (action === "export-teams-csv") return exportData("csv", "teams");
  if (action === "export-state-json") return exportData("json", "backup");
}

function exportData(format, scope) {
  const options = scope === "backup" ? { format: "json", scope: "backup", filename: "ftc-scout-arena-backup" } : { format, scope, eventId: activeEvent(state)?.id };
  const result = downloadExport(state, options);
  toast(result.downloaded ? `${result.filename} baixado.` : "Arquivo de exportação preparado.", "success");
}

async function handleForm(form) {
  const type = form.dataset.form;
  const values = Object.fromEntries(new FormData(form).entries());
  if (type === "global-search") { filters.teams.term = (values.term || "").trim(); return navigate("teams"); }
  if (type === "stats-filters") return;
  if (type === "setup-event") {
    const eventName = (values.eventName || "").trim();
    const scoutName = (values.scoutName || "").trim();
    if ((!activeEvent(state) && !eventName) || (!currentScout(state) && !scoutName)) throw new Error("Preencha o nome do evento e o seu nome.");
    await mutate((next) => {
      const now = new Date().toISOString();
      if (!currentScout(next)) {
        const scout = { id: makeId("scout", scoutName), name: scoutName, role: "Scout", isActive: true, createdAt: now };
        next.scouts.push(scout); next.settings.currentScoutId = scout.id;
      }
      if (!activeEvent(next)) {
        const season = activeSeason(next);
        const id = makeId("event", eventName);
        next.events.push({ id, name: eventName, type: values.eventType || "Regional", status: "active", seasonId: season.id, seasonConfigId: season.id, teamIds: next.teams.map((team) => team.id), createdAt: now });
        next.settings.activeEventId = id;
      }
      return next;
    }, { repaint: false });
    modal = { type: "setup", step: 2 }; render(); return;
  }
  if (type === "add-teams") {
    const teams = parseTeamLines(values.teams, state.teams);
    const setup = form.dataset.setup === "true";
    await mutate((next) => {
      next.teams.push(...teams);
      const event = activeEvent(next);
      if (event) event.teamIds = [...new Set([...(event.teamIds || []), ...teams.map((team) => team.id)])];
      return next;
    }, { repaint: false });
    if (setup && state.teams.length < 4) {
      modal = { type: "setup", step: 2 }; render();
      toast(`Equipes salvas. Adicione mais ${4 - state.teams.length} para montar uma partida.`, "info");
    } else {
      modal = setup ? { type: "setup", step: 3 } : null;
      render(); toast(`${teams.length} equipe(s) adicionada(s).`, "success");
    }
    return;
  }
  if (type === "current-scout") {
    if (!(state.scouts || []).some((scout) => String(scout.id) === String(values.scoutId))) {
      toast("Cadastre um scout antes de escolher a conta atual.", "error");
      return;
    }
    await mutate((next) => { next.settings.currentScoutId = values.scoutId; return next; });
    toast("Conta de scout atualizada.", "success"); return;
  }
  if (type === "season-identity") {
    if (!values.name.trim() || !values.gameName.trim()) throw new Error("O nome da temporada e do jogo não podem ficar vazios.");
    await updateSeason((season) => { season.name = values.name.trim(); season.gameName = values.gameName.trim(); season.updatedAt = new Date().toISOString(); });
    toast("Identidade da temporada salva.", "success"); return;
  }
  if (type === "rating-weights") {
    await mutate((next) => { next.settings.ratingWeights = Object.fromEntries(Object.entries(values).map(([key,value]) => [key, Number(value)])); return next; });
    toast("Pesos do Scouting Rating salvos.", "success"); return;
  }
  if (type === "add-season-action") {
    if (!values.label.trim()) throw new Error("Informe um nome para a métrica.");
    const base = slugify(values.label).replace(/-/g, "_");
    await updateSeason((season) => {
      const ids = new Set(getSeasonActions(season).map((action) => action.id));
      let id = base; let index = 2; while (ids.has(id)) { id = `${base}_${index++}`; }
      const action = { id, phase: values.phase, label: values.label.trim(), shortLabel: values.label.trim(), inputType: values.inputType, points: season.scoringScope === "observations_only" ? 0 : Math.max(0, Number(values.points) || 0), max: Math.max(1, Number(values.max) || 1), countsTowardCycles: values.countsTowardCycles === "true" };
      if (action.inputType === "select") action.options = [{ value: "none", label: "Não tentou", points: 0 }, { value: "success", label: "Concluído", points: action.points }];
      season.actions[action.phase] = [...(season.actions[action.phase] || []), action];
    });
    toast("Ação adicionada à temporada.", "success"); return;
  }
  if (type === "add-team") {
    const number = values.number.trim().replace(/^0+(?=\d)/, "");
    if (!/^[0-9]{1,8}$/.test(number) || Number(number) < 1 || !values.name.trim()) throw new Error("Preencha um número FTC válido e o nome da equipe.");
    if ((state.teams || []).some((team) => String(team.number) === number)) { toast("Esse número FTC já está cadastrado.", "error"); return; }
    await mutate((next) => { const team = { id: `team-${number}`, number, name: values.name.trim(), robotName: (values.robotName || "").trim(), city: (values.city || "").trim(), createdAt: new Date().toISOString() }; next.teams.push(team); const event = activeEvent(next); if (event) event.teamIds = [...new Set([...(event.teamIds || []), team.id])]; return next; }, { repaint: false });
    modal = null; render();
    toast("Equipe cadastrada.", "success"); return;
  }
  if (type === "add-scout") {
    const name = values.name.trim();
    if (!name) throw new Error("Informe o nome do scout.");
    await mutate((next) => {
      const scout = { id: makeId("scout", name), name, role: values.role, isActive: true, createdAt: new Date().toISOString() };
      next.scouts.push(scout);
      if (!next.settings.currentScoutId) next.settings.currentScoutId = scout.id;
      return next;
    });
    toast("Scout adicionado.", "success"); return;
  }
  if (type === "add-event") {
    if (!values.name.trim()) throw new Error("Informe o nome do evento.");
    await mutate((next) => {
      const id = makeId("event", values.name);
      const season = activeSeason(next);
      next.events.push({
        id,
        name: values.name.trim(),
        type: values.type,
        status: "active",
        seasonId: season?.id || null,
        seasonConfigId: season?.id || null,
        teamIds: (next.teams || []).map((team) => team.id),
        createdAt: new Date().toISOString(),
      });
      next.settings.activeEventId = id;
      return next;
    });
    filters.stats = {}; compareSelection = [];
    render();
    toast("Evento criado e ativado.", "success"); return;
  }
  if (type === "add-match") {
    const event = activeEvent(state);
    if (!event) { toast("Crie e ative um evento antes de cadastrar partidas.", "error"); return; }
    if ((state.teams || []).length < 4) { toast("Cadastre pelo menos quatro equipes antes de montar uma partida.", "error"); return; }
    const teamIds = [values.red1, values.red2, values.blue1, values.blue2];
    const allTeamsKnown = teamIds.every((teamId) => (state.teams || []).some((team) => String(team.id) === String(teamId)));
    if (!allTeamsKnown || new Set(teamIds).size !== 4) { toast("Selecione quatro equipes diferentes na mesma partida.", "error"); return; }
    const number = Number(values.number);
    if (!Number.isInteger(number) || number < 1) { toast("Informe um número de partida válido.", "error"); return; }
    const scheduledAt = values.scheduledAt ? new Date(values.scheduledAt) : null;
    if (scheduledAt && !Number.isFinite(scheduledAt.getTime())) { toast("Informe um horário válido para a partida.", "error"); return; }
    if ((state.matches || []).some((match) => String(match.eventId) === String(event.id) && Number(match.number) === number)) { toast("Esse número de partida já existe no evento.", "error"); return; }
    await mutate((next) => {
      const id = `match-q-${String(number).padStart(2,"0")}-${Date.now().toString(36).slice(-3)}`;
      const active = activeEvent(next);
      const season = activeSeason(next);
      next.matches.push({ id, eventId: active?.id || event.id, seasonId: season?.id || null, seasonConfigId: season?.id || null, number, label: `Qualificação ${number}`, level: "qualification", status: "not_started", scheduledAt: scheduledAt?.toISOString() || null, alliances: { red: { teamIds: [values.red1, values.red2] }, blue: { teamIds: [values.blue1, values.blue2] } }, scoutAssignments: {} });
      next.matchTeams = [...(next.matchTeams || []), ...[values.red1, values.red2].map((teamId, index) => ({ id: `${id}:${teamId}`, matchId: id, teamId, alliance: "red", station: index + 1 })), ...[values.blue1, values.blue2].map((teamId, index) => ({ id: `${id}:${teamId}`, matchId: id, teamId, alliance: "blue", station: index + 1 }))];
      return next;
    }, { repaint: false });
    modal = null;
    if (form.dataset.setup === "true" || view === "dashboard") { view = "matches"; writeRoute(); }
    render();
    toast("Partida cadastrada.", "success"); return;
  }
}

root.addEventListener("click", async (event) => {
  if (event.target.closest(".skip-link")) {
    event.preventDefault(); root.querySelector("#main-content")?.focus(); return;
  }
  if (event.target.classList.contains("modal-backdrop")) {
    await perform(() => handleAction({ dataset: { action: "close-modal" } })); return;
  }
  const viewNode = event.target.closest("[data-view]");
  if (viewNode) { event.preventDefault(); const nextView = viewNode.dataset.view; await perform(() => navigate(nextView)); return; }
  const actionNode = event.target.closest("[data-action]");
  if (actionNode && !["INPUT", "SELECT", "TEXTAREA"].includes(actionNode.tagName)) {
    event.preventDefault();
    const dataset = { ...actionNode.dataset };
    await perform(() => handleAction({ dataset }));
  }
});

root.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  if (button?.disabled) return;
  if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
  try { await perform(() => handleForm(form)); } finally {
    if (button?.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); }
  }
});

root.addEventListener("input", async (event) => {
  const target = event.target;
  if (target.dataset.filter === "match-search") { filters.matches.term = target.value; render(); return; }
  if (target.dataset.filter === "team-search") { filters.teams.term = target.value; render(); return; }
  if (target.dataset.action === "update-notes") { const value = target.value; await perform(() => editDraft((draft) => { draft.notes = value; }, { repaint: false })); return; }
  if (target.dataset.action === "rating-weight-input") { const output = root.querySelector(`[data-weight-output="${target.name}"]`); if (output) output.textContent = `${Number(target.value) > 0 ? "+" : ""}${target.value}`; }
});

root.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.matches("select[data-match-team]")) { updateMatchChoices(); return; }
  if (target.id === "backup-file") {
    const file = target.files?.[0];
    if (!file) return;
    await perform(async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error("O backup deve ter no máximo 5 MB.");
      pendingBackup = parseBackup(await file.text());
      modal = { type: "restore-backup" }; render();
    });
    target.value = ""; return;
  }
  await perform(async () => {
  try {
    if (target.dataset.filter === "match-search" || target.dataset.filter === "team-search") return;
    if (target.dataset.action === "set-stats-filter") { filters.stats[target.name] = target.value; render(); return; }
    if (target.dataset.action === "set-watch-category" || target.dataset.action === "set-watch-priority") {
      await mutate((next) => { const watch = (next.watchlist || []).find((item) => String(item.teamId) === String(target.dataset.teamId) && (!item.eventId || String(item.eventId) === String(activeEvent(next)?.id))); if (watch) watch[target.dataset.action === "set-watch-category" ? "category" : "priority"] = target.value; return next; }); return;
    }
    if (target.dataset.action === "change-season-action-label" || target.dataset.action === "change-season-action-points") {
      const value = target.dataset.action === "change-season-action-points" ? Math.max(0, Number(target.value) || 0) : target.value.trim();
      if (!value && typeof value === "string") { toast("O nome da ação não pode ficar vazio.", "error"); render(); return; }
      await updateSeason((season) => {
        const action = Object.values(season.actions || {}).flatMap((items) => Array.isArray(items) ? items : []).find((item) => String(item.id) === String(target.dataset.actionId));
        if (!action) return;
        const key = target.dataset.action === "change-season-action-points" ? "points" : "label";
        action[key] = value;
        if (key === "points") {
          const option = action.options?.find((item) => item.value === "success");
          if (option) option.points = value;
        }
        season.updatedAt = new Date().toISOString();
      });
      toast("Configuração atualizada.", "success"); return;
    }
  } catch (error) { console.error(error); toast("Não foi possível salvar essa alteração.", "error"); }
  });
});

root.addEventListener("keydown", async (event) => {
  if ((event.target.dataset.filter === "match-search" || event.target.dataset.filter === "team-search") && event.key === "Enter") {
    event.preventDefault();
    render();
    return;
  }
});

window.addEventListener("beforeunload", (event) => {
  if (pendingWrites > 0) { event.preventDefault(); event.returnValue = "Aguarde o salvamento terminar."; }
});
// Connectivity changes must not replace a form while the scout is typing.
window.addEventListener("online", () => { syncStatus = "synced"; toast("Conexão restabelecida. Os dados continuam neste dispositivo.", "success"); });
window.addEventListener("offline", () => { syncStatus = "offline"; toast("Modo offline. Continue observando: seus rascunhos ficam salvos.", "info"); });

document.addEventListener("keydown", (event) => {
  if (!modal) return;
  if (event.key === "Escape") {
    event.preventDefault(); perform(() => handleAction({ dataset: { action: "close-modal" } })); return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...root.querySelectorAll('.modal button:not([disabled]), .modal a[href], .modal input:not([disabled]), .modal select:not([disabled]), .modal textarea:not([disabled])')].filter((element) => element.getClientRects().length);
  const first = focusable[0], last = focusable.at(-1);
  if (!first) { event.preventDefault(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === root.querySelector(".modal"))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.querySelector(".modal"))) { event.preventDefault(); first.focus(); }
});

async function restoreRoute() {
  let parts;
  try { parts = location.hash.replace(/^#/, "").split("/").map(decodeURIComponent); } catch { parts = ["dashboard"]; }
  const [page, first, second] = parts;
  if (page === "scout" && first && second) {
    if (view === "scout" && scoutDraft?.matchId === first && scoutDraft?.teamId === second) return;
    if (scoutDraft) await saveDraft({ repaint: false });
    await enterScout({ matchId: first, teamId: second }, { fromHistory: true });
    if (view !== "scout") writeRoute({ replace: true });
    return;
  }
  await navigate(validViews.has(page) && page !== "scout" ? page : "dashboard", { teamId: first, fromHistory: true });
  writeRoute({ replace: true });
}

window.addEventListener("hashchange", () => perform(restoreRoute));

async function initialize() {
  state = await loadState();
  storageInfo = getStorageInfo();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel("ftc-scout-arena-state");
    channel.onmessage = async (message) => {
      if (message.data?.type !== "state-updated" || view === "scout") return;
      state = await loadState(); storageInfo = getStorageInfo();
      if (!root.contains(document.activeElement) || !document.activeElement.matches("input, select, textarea")) render();
    };
  }
  await restoreRoute();
}

initialize().catch((error) => {
  console.error(error);
  root.innerHTML = `<main class="main"><section class="page"><div class="empty-state"><span class="empty-state__icon">${icon("alert",28)}</span><h3>Não foi possível abrir o Scout Arena</h3><p>Recarregue a página para tentar restaurar o banco local.</p></div></section></main>`;
});
