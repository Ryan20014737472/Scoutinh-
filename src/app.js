import { icon, statusPill, toast, avatar, escapeHtml } from "./components/ui.js";
import { loadState, updateState, resetState, getStorageInfo, createDraft, normalizeDraft, submitRecord } from "./services/storage.js";
import { downloadExport } from "./services/export.js";
import { getRanking } from "./services/analytics.js";
import { getSeasonActions } from "./services/scoring.js";
import { createBiobuzzPreseasonConfig, createDecodeArchiveConfig } from "./data/seed.js";
import { activeEvent, activeSeason, currentScout, findTeam, getMatchTeams, recordFor } from "./utils/domain.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderMatches } from "./pages/matches.js";
import { renderScout, renderScoutReview } from "./pages/scout.js";
import { renderTeams, renderTeamProfile } from "./pages/teams.js";
import { renderRanking } from "./pages/ranking.js";
import { renderCompare } from "./pages/compare.js";
import { renderFavorites } from "./pages/favorites.js";
import { renderStats } from "./pages/stats.js";
import { renderSeason } from "./pages/season.js";
import { renderAdmin, renderDeleteRecordConfirm } from "./pages/admin.js";
import { renderSettings, renderResetConfirm } from "./pages/settings.js";

const root = document.querySelector("#app");
const primaryNav = [
  ["dashboard", "Dashboard", "dashboard"],
  ["matches", "Partidas", "matches"],
  ["teams", "Equipes", "teams"],
  ["ranking", "Ranking", "ranking"],
  ["compare", "Comparar times", "compare"],
  ["favorites", "Favoritos", "star"],
  ["stats", "Estatísticas", "chart"],
];
const managementNav = [
  ["season", "Config. da temporada", "settings"],
  ["admin", "Administração", "user"],
  ["settings", "Configurações", "settings"],
];
const mobileNav = primaryNav.slice(0, 4).concat([["settings", "Mais", "settings"]]);

let state;
let view = "dashboard";
let selectedTeamId = null;
let scoutDraft = null;
let scoutPhase = "auto";
let draftDirty = false;
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

const slugify = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
const makeId = (prefix, value = "") => `${prefix}-${slugify(value)}-${Date.now().toString(36)}`;

function appTitle() {
  const titles = { dashboard: "Dashboard", matches: "Partidas", teams: "Equipes", team: "Equipe", scout: "Scouting", ranking: "Scouting Rating", compare: "Comparar Times", favorites: "Favoritos", stats: "Estatísticas", season: "Configuração da Temporada", admin: "Administração", settings: "Configurações" };
  return `${titles[view] || "FTC Scout Arena"} · FTC Scout Arena`;
}

function navLink([key, label, iconName], compact = false) {
  const selected = view === key || (key === "teams" && view === "team");
  return `<a href="#${key}" data-view="${key}" class="${selected ? "active" : ""}">${icon(iconName, compact ? 19 : 18)}<span>${escapeHtml(label)}</span></a>`;
}

function searchHeader() {
  return `<div class="desktop-topbar"><div class="search-box">${icon("search",18)}<input id="global-search" placeholder="Buscar equipe pelo número ou nome…" aria-label="Busca global de equipes" /></div><div class="desktop-actions"><div class="event-switcher">${icon("matches",16)}<div><span>Evento ativo</span><strong>${escapeHtml(activeEvent(state)?.name || "Sem evento")}</strong></div></div>${statusPill(syncStatus)}${avatar(currentScout(state))}</div></div>`;
}

function mobileHeader() {
  return `<header class="mobile-topbar"><a class="brand" href="#dashboard" data-view="dashboard"><span class="brand-mark">${icon("robot",21)}</span><span class="brand-text"><strong>FTC Scout Arena</strong><span>${escapeHtml(activeEvent(state)?.code || "Modo local")}</span></span></a><div style="display:flex;gap:7px;align-items:center">${statusPill(syncStatus)}<button class="icon-button" data-view="settings" aria-label="Configurações">${icon("settings",19)}</button></div></header>`;
}

function shell(content) {
  const scout = currentScout(state);
  return `<div class="app-shell"><aside class="sidebar"><a class="brand" href="#dashboard" data-view="dashboard"><span class="brand-mark">${icon("robot",22)}</span><span class="brand-text"><strong>FTC Scout Arena</strong><span>Scouting Mobile-first</span></span></a><nav class="side-nav" aria-label="Navegação principal">${primaryNav.map((item) => navLink(item)).join("")}<span class="side-nav__section">Administração</span>${managementNav.map((item) => navLink(item)).join("")}</nav><div class="side-footer"><div class="side-footer__scout">${avatar(scout)}<div><strong>${escapeHtml(scout?.name || "Sem scout definido")}</strong><span><i class="online-dot"></i>${syncStatus === "offline" ? "Offline" : "Dados protegidos"}</span></div></div></div></aside><main class="main">${mobileHeader()}${searchHeader()}${content}</main><nav class="mobile-nav" aria-label="Atalhos">${mobileNav.map((item) => navLink(item, true)).join("")}</nav></div>`;
}

function seasonActionDeleteConfirm(actionId) {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal__header"><div><span class="eyebrow">Confirmação necessária</span><h2>Remover ação da temporada?</h2><p>Ela deixará de aparecer em novos scouting. Registros existentes mantêm os seus dados.</p></div><button class="icon-button" data-action="close-modal" aria-label="Fechar">${icon("close")}</button></header><div class="modal__body"><div class="card inset pad"><span class="icon-text">${icon("alert",18)} A alteração vale para a interface de scouting atual.</span></div></div><footer class="modal__footer"><button class="button" data-action="close-modal">Cancelar</button><button class="button danger" data-action="confirm-delete-season-action" data-action-id="${escapeHtml(actionId)}">Remover ação</button></footer></section></div>`;
}

function renderModal() {
  if (!modal) return "";
  if (modal.type === "scout-review") return renderScoutReview({ state, draft: scoutDraft });
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
    case "season": return renderSeason({ state });
    case "admin": return renderAdmin({ state });
    case "settings": return renderSettings({ state, storageInfo, online: navigator.onLine });
    default: return renderDashboard({ state });
  }
}

function render() {
  if (!state) return;
  document.title = appTitle();
  root.innerHTML = `${shell(pageContent())}${renderModal()}`;
}

function announceUpdate() {
  if (channel) channel.postMessage({ type: "state-updated", at: Date.now() });
}

async function mutate(mutator, { repaint = true } = {}) {
  syncStatus = navigator.onLine ? "syncing" : "offline";
  if (repaint) render();
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

async function navigate(nextView, { teamId } = {}) {
  if (view === "scout" && nextView !== "scout" && scoutDraft) {
    if (draftDirty) {
      const leave = window.confirm("Existem dados de scouting que ainda não foram salvos. Deseja sair mesmo assim?");
      if (!leave) return;
    }
    await discardScoutDraft();
  }
  if (nextView === "teams") selectedTeamId = null;
  if (nextView === "team" && teamId) selectedTeamId = teamId;
  if (nextView !== "scout") modal = null;
  view = nextView;
  render();
}

async function saveDraft({ repaint = true } = {}) {
  if (!scoutDraft) return;
  scoutDraft = normalizeDraft(scoutDraft, activeSeason(state));
  await mutate((next) => {
    next.drafts = { ...(next.drafts || {}), [scoutDraft.id]: scoutDraft };
    return next;
  }, { repaint });
}

async function editDraft(change, { repaint = true } = {}) {
  if (!scoutDraft) return;
  change(scoutDraft);
  scoutDraft.updatedAt = new Date().toISOString();
  draftDirty = true;
  await saveDraft({ repaint });
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
    : completed > 0 ? "in_progress" : "not_started";
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
  draftDirty = false;
  modal = null;
}

async function enterScout(data) {
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
  const existingRecord = recordFor(state, match.id, team.id);
  if (existingRecord) {
    toast("Esse time já tem scouting salvo nesta partida. Abra o perfil para consultar.", "info");
    await navigate("team", { teamId: team.id });
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
    if (!live) return next;
    live.scoutAssignments = { ...(live.scoutAssignments || {}), [assignmentKey]: scout.id };
    return next;
  }, { repaint: false });
  const existingDraft = Object.values(state.drafts || {}).find((draft) => String(draft.matchId) === String(match.id) && String(draft.teamId) === String(team.id) && String(draft.scoutId) === String(scout.id));
  scoutDraft = existingDraft || createDraft({ eventId: event.id, matchId: match.id, teamId: team.id, scoutId: scout.id, seasonId: season.id, alliance: entry.alliance, position: Number(entry.position || 1) }, season);
  scoutPhase = "auto";
  draftDirty = Boolean(existingDraft);
  await saveDraft({ repaint: false });
  view = "scout";
  render();
}

async function saveScouting() {
  const season = activeSeason(state);
  if (!scoutDraft || !season) return;
  try {
    const saved = await submitRecord(scoutDraft, season);
    await mutate((next) => {
      if (next.drafts) delete next.drafts[scoutDraft.id];
      releaseScoutAssignment(next, scoutDraft);
      refreshMatchStatus(next, saved.matchId);
      return next;
    }, { repaint: false });
    modal = null;
    draftDirty = false;
    const teamId = scoutDraft.teamId;
    scoutDraft = null;
    view = "team";
    selectedTeamId = teamId;
    render();
    toast("Scouting salvo com sucesso. As estatísticas foram atualizadas.", "success");
  } catch (error) {
    toast(error?.code === "DUPLICATE_SCOUTING_RECORD" ? "Já existe um registro para este time nesta partida." : "Não foi possível salvar o scouting.", "error");
  }
}

async function toggleFavorite(teamId) {
  await mutate((next) => {
    const exists = (next.favorites || []).some((item) => String(item.teamId ?? item) === String(teamId));
    next.favorites = exists ? next.favorites.filter((item) => String(item.teamId ?? item) !== String(teamId)) : [...(next.favorites || []), { id: makeId("favorite", teamId), eventId: activeEvent(next)?.id, teamId, createdBy: currentScout(next)?.id, createdAt: new Date().toISOString() }];
    return next;
  });
  toast("Favoritos atualizados.", "success");
}

async function toggleWatchlist(teamId) {
  await mutate((next) => {
    const exists = (next.watchlist || []).some((item) => String(item.teamId ?? item) === String(teamId));
    next.watchlist = exists ? next.watchlist.filter((item) => String(item.teamId ?? item) !== String(teamId)) : [...(next.watchlist || []), { id: makeId("watch", teamId), eventId: activeEvent(next)?.id, teamId, category: "watch_again", priority: "medium", reason: "Equipe marcada para nova observação.", createdBy: currentScout(next)?.id, createdAt: new Date().toISOString() }];
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
  if ((state.scoutingRecords || []).length || Object.keys(state.drafts || {}).length) {
    toast("Para não reinterpretar registros ou rascunhos, aplique outro preset somente em um workspace sem scouting.", "error");
    return;
  }
  const buildPreset = preset === "decode" ? createDecodeArchiveConfig : createBiobuzzPreseasonConfig;
  const configured = buildPreset();
  configured.updatedAt = new Date().toISOString();
  await mutate((next) => {
    next.seasonConfigs = [configured];
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
  if (action === "open-scout") return enterScout(data);
  if (action === "open-team") return navigate("team", { teamId: data.teamId });
  if (action === "leave-scout") return navigate("matches");
  if (action === "set-scout-phase") { scoutPhase = data.phase; render(); return; }
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
  if (action === "set-action-option") return editDraft((draft) => { draft.actions[data.actionId] = data.value; draft.actionStatus[data.actionId] = data.value === "none" ? "not_attempted" : "success"; });
  if (action === "toggle-diagnostic") return editDraft((draft) => { draft.robot[data.key] = !draft.robot[data.key]; });
  if (action === "set-defense") return editDraft((draft) => { draft.robot.defense = data.value; });
  if (action === "review-scout") { modal = { type: "scout-review" }; render(); return; }
  if (action === "confirm-save-scout") return saveScouting();
  if (action === "close-modal") { modal = null; render(); return; }
  if (action === "match-status") { filters.matches.status = data.status; render(); return; }
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
    document.querySelectorAll("[data-season-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.seasonPanel !== data.phase));
    document.querySelectorAll("[data-action='season-tab']").forEach((item) => item.classList.toggle("active", item.dataset.phase === data.phase));
    return;
  }
  if (action === "request-delete-season-action") { modal = { type: "delete-season-action", actionId: data.actionId }; render(); return; }
  if (action === "confirm-delete-season-action") {
    await updateSeason((season) => { for (const phase of ["auto", "teleop", "endgame"]) season.actions[phase] = (season.actions?.[phase] || []).filter((item) => String(item.id) !== String(data.actionId)); });
    modal = null;
    render();
    toast("Ação removida da configuração da temporada.", "success");
    return;
  }
  if (action === "request-reset") { modal = { type: "reset" }; render(); return; }
  if (action === "confirm-reset") {
    state = await resetState(); storageInfo = getStorageInfo(); modal = null; scoutDraft = null; draftDirty = false; view = "dashboard"; announceUpdate(); render(); toast("Banco local limpo.", "success"); return;
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
  if (type === "current-scout") {
    if (!(state.scouts || []).some((scout) => String(scout.id) === String(values.scoutId))) {
      toast("Cadastre um scout antes de escolher a conta atual.", "error");
      return;
    }
    await mutate((next) => { next.settings.currentScoutId = values.scoutId; return next; });
    toast("Conta de scout atualizada.", "success"); return;
  }
  if (type === "season-identity") {
    await updateSeason((season) => { season.name = values.name.trim(); season.gameName = values.gameName.trim(); season.updatedAt = new Date().toISOString(); });
    toast("Identidade da temporada salva.", "success"); return;
  }
  if (type === "rating-weights") {
    await mutate((next) => { next.settings.ratingWeights = Object.fromEntries(Object.entries(values).map(([key,value]) => [key, Number(value)])); return next; });
    toast("Pesos do Scouting Rating salvos.", "success"); return;
  }
  if (type === "add-season-action") {
    const base = slugify(values.label).replace(/-/g, "_");
    await updateSeason((season) => {
      const ids = new Set(getSeasonActions(season).map((action) => action.id));
      let id = base; let index = 2; while (ids.has(id)) { id = `${base}_${index++}`; }
      const action = { id, phase: values.phase, label: values.label.trim(), shortLabel: values.label.trim(), inputType: values.inputType, points: Math.max(0, Number(values.points) || 0), max: Math.max(1, Number(values.max) || 1), countsTowardCycles: values.countsTowardCycles === "true" };
      if (action.inputType === "select") action.options = [{ value: "none", label: "Não tentou", points: 0 }, { value: "success", label: "Concluído", points: action.points }];
      season.actions[action.phase] = [...(season.actions[action.phase] || []), action];
    });
    toast("Ação adicionada à temporada.", "success"); return;
  }
  if (type === "add-team") {
    const number = values.number.trim();
    if ((state.teams || []).some((team) => String(team.number) === number)) { toast("Esse número FTC já está cadastrado.", "error"); return; }
    await mutate((next) => { const team = { id: `team-${number}`, number, name: values.name.trim(), robotName: values.robotName.trim(), city: values.city.trim(), createdAt: new Date().toISOString() }; next.teams.push(team); const event = activeEvent(next); if (event) event.teamIds = [...new Set([...(event.teamIds || []), team.id])]; return next; });
    toast("Equipe cadastrada.", "success"); return;
  }
  if (type === "add-scout") {
    const name = values.name.trim();
    await mutate((next) => {
      const scout = { id: makeId("scout", name), name, role: values.role, isActive: true, createdAt: new Date().toISOString() };
      next.scouts.push(scout);
      if (!next.settings.currentScoutId) next.settings.currentScoutId = scout.id;
      return next;
    });
    toast("Scout adicionado e definido como conta atual.", "success"); return;
  }
  if (type === "add-event") {
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
    const scheduledAt = new Date(values.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime())) { toast("Informe o horário da partida.", "error"); return; }
    if ((state.matches || []).some((match) => String(match.eventId) === String(event.id) && Number(match.number) === number)) { toast("Esse número de partida já existe no evento.", "error"); return; }
    await mutate((next) => {
      const id = `match-q-${String(number).padStart(2,"0")}-${Date.now().toString(36).slice(-3)}`;
      const active = activeEvent(next);
      const season = activeSeason(next);
      next.matches.push({ id, eventId: active?.id || event.id, seasonId: season?.id || null, seasonConfigId: season?.id || null, number, label: `Qualificação ${number}`, level: "qualification", status: "not_started", scheduledAt: scheduledAt.toISOString(), alliances: { red: { teamIds: [values.red1, values.red2] }, blue: { teamIds: [values.blue1, values.blue2] } }, scoutAssignments: {} });
      next.matchTeams = [...(next.matchTeams || []), ...[values.red1, values.red2].map((teamId, index) => ({ id: `${id}:${teamId}`, matchId: id, teamId, alliance: "red", station: index + 1 })), ...[values.blue1, values.blue2].map((teamId, index) => ({ id: `${id}:${teamId}`, matchId: id, teamId, alliance: "blue", station: index + 1 }))];
      return next;
    });
    toast("Partida cadastrada.", "success"); return;
  }
}

root.addEventListener("click", async (event) => {
  const viewNode = event.target.closest("[data-view]");
  if (viewNode) { event.preventDefault(); await navigate(viewNode.dataset.view); return; }
  const actionNode = event.target.closest("[data-action]");
  if (actionNode) { event.preventDefault(); try { await handleAction(actionNode); } catch (error) { console.error(error); toast("Não foi possível concluir esta ação.", "error"); } }
});

root.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  try { await handleForm(form); } catch (error) { console.error(error); toast("Confira os dados e tente novamente.", "error"); }
});

root.addEventListener("input", async (event) => {
  const target = event.target;
  if (target.dataset.filter === "match-search") { filters.matches.term = target.value; return; }
  if (target.dataset.filter === "team-search") { filters.teams.term = target.value; return; }
  if (target.dataset.action === "update-notes") { await editDraft((draft) => { draft.notes = target.value; }, { repaint: false }); return; }
  if (target.dataset.action === "rating-weight-input") { const output = root.querySelector(`[data-weight-output="${target.name}"]`); if (output) output.textContent = `${Number(target.value) > 0 ? "+" : ""}${target.value}`; }
});

root.addEventListener("change", async (event) => {
  const target = event.target;
  try {
    if (target.dataset.filter === "match-search" || target.dataset.filter === "team-search") { render(); return; }
    if (target.dataset.action === "set-stats-filter") { filters.stats[target.name] = target.value; render(); return; }
    if (target.dataset.action === "set-watch-category" || target.dataset.action === "set-watch-priority") {
      await mutate((next) => { const watch = (next.watchlist || []).find((item) => String(item.teamId) === String(target.dataset.teamId)); if (watch) watch[target.dataset.action === "set-watch-category" ? "category" : "priority"] = target.value; return next; }); return;
    }
    if (target.dataset.action === "change-season-action-label" || target.dataset.action === "change-season-action-points") {
      const value = target.dataset.action === "change-season-action-points" ? Math.max(0, Number(target.value) || 0) : target.value.trim();
      if (!value && typeof value === "string") { toast("O nome da ação não pode ficar vazio.", "error"); render(); return; }
      await updateSeason((season) => { const action = getSeasonActions(season).find((item) => String(item.id) === String(target.dataset.actionId)); if (action) action[target.dataset.action === "change-season-action-points" ? "points" : "label"] = value; });
      toast("Configuração atualizada.", "success"); return;
    }
  } catch (error) { console.error(error); toast("Não foi possível salvar essa alteração.", "error"); }
});

root.addEventListener("keydown", async (event) => {
  if ((event.target.dataset.filter === "match-search" || event.target.dataset.filter === "team-search") && event.key === "Enter") {
    event.preventDefault();
    render();
    return;
  }
  if (event.target.id === "global-search" && event.key === "Enter") {
    event.preventDefault();
    filters.teams.term = event.target.value;
    await navigate("teams");
  }
});

window.addEventListener("beforeunload", (event) => {
  if (scoutDraft && draftDirty) { event.preventDefault(); event.returnValue = "Existem dados de scouting que ainda não foram salvos."; }
});
window.addEventListener("online", () => { syncStatus = "synced"; render(); toast("Conexão detectada. Dados locais continuam protegidos.", "success"); });
window.addEventListener("offline", () => { syncStatus = "offline"; render(); toast("Você está offline. O rascunho continuará salvo neste dispositivo.", "info"); });

async function initialize() {
  state = await loadState();
  storageInfo = getStorageInfo();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel("ftc-scout-arena-state");
    channel.onmessage = async (message) => {
      if (message.data?.type !== "state-updated" || view === "scout") return;
      state = await loadState(); storageInfo = getStorageInfo(); render();
    };
  }
  render();
}

initialize().catch((error) => {
  console.error(error);
  root.innerHTML = `<main class="main"><section class="page"><div class="empty-state"><span class="empty-state__icon">${icon("alert",28)}</span><h3>Não foi possível abrir o Scout Arena</h3><p>Recarregue a página para tentar restaurar o banco local.</p></div></section></main>`;
});
