import { escapeHtml, icon, sectionHeader, statusPill } from "../components/ui.js";
import { activeEvent, getMatchTeams, matchLabel, matchTime, recordFor } from "../utils/domain.js";

function matchesForEvent(state) {
  const event = activeEvent(state);
  return (state.matches || []).filter((match) => !event || !match.eventId || String(match.eventId) === String(event.id));
}

const statusLabels = { not_started: "Não iniciada", in_progress: "Em andamento", complete: "Completa", incomplete: "Incompleta" };

function teamTile(state, match, entry) {
  const team = entry.team;
  const record = recordFor(state, match.id, entry.teamId);
  const assignment = (state.scoutingAssignments || []).find((item) => String(item.matchId) === String(match.id) && String(item.teamId) === String(entry.teamId) && item.status !== "released");
  const assignedScoutId = assignment?.scoutId || match.scoutAssignments?.[`${entry.alliance}-${entry.position}`];
  const currentScoutId = state.settings?.currentScoutId;
  const suffix = record ? `<span class="status-pill good">${icon("check", 12)}${record.total ?? record.score?.total ?? 0}</span>` : assignedScoutId ? `<span class="status-pill ${String(assignedScoutId) === String(currentScoutId) ? "info" : "warn"}">${icon("user", 12)}${String(assignedScoutId) === String(currentScoutId) ? "sua vez" : "em uso"}</span>` : icon("chevron", 16);
  return `<button class="team-tile" data-action="open-scout" data-match-id="${escapeHtml(match.id)}" data-team-id="${escapeHtml(entry.teamId)}" data-alliance="${escapeHtml(entry.alliance)}" data-position="${escapeHtml(entry.position)}" aria-label="Registrar scouting para ${escapeHtml(team?.number || "time")}">
    <span><strong>${escapeHtml(team?.number || "—")}</strong><span>${escapeHtml(team?.name || "Equipe não cadastrada")}</span></span>${suffix}
  </button>`;
}

function matchCard(state, match) {
  const teams = getMatchTeams(state, match);
  const byAlliance = { red: teams.filter((entry) => entry.alliance === "red"), blue: teams.filter((entry) => entry.alliance === "blue") };
  const completed = teams.filter((entry) => recordFor(state, match.id, entry.teamId)).length;
  const matchStatus = completed === teams.length && teams.length ? "Completa" : completed ? "Incompleta" : statusLabels[match.status] || match.status || "Não iniciada";
  return `<article class="match-card">
    <header class="match-card__top">
      <div class="match-card__title">${icon("matches", 18)}<div><strong>${escapeHtml(matchLabel(match))}</strong><span>${matchTime(match) ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(matchTime(match))) : "Sem horário"} · ${completed}/${teams.length} scouts</span></div></div>
      ${statusPill(matchStatus)}
    </header>
    <div class="match-card__alliances">
      <section class="alliance red"><h4><i></i>Vermelha</h4>${byAlliance.red.map((entry) => teamTile(state, match, entry)).join("") || '<span class="subtle">Sem times</span>'}</section>
      <section class="alliance blue"><h4><i></i>Azul</h4>${byAlliance.blue.map((entry) => teamTile(state, match, entry)).join("") || '<span class="subtle">Sem times</span>'}</section>
    </div>
  </article>`;
}

export function renderMatches({ state, filters = {} }) {
  const all = matchesForEvent(state);
  const term = String(filters.term || "").trim().toLowerCase();
  const status = filters.status || "Todas";
  const matches = all.filter((match) => {
    const teams = getMatchTeams(state, match);
    const haystack = [matchLabel(match), ...teams.map((entry) => `${entry.team?.number || ""} ${entry.team?.name || ""}`)].join(" ").toLowerCase();
    if (term && !haystack.includes(term)) return false;
    if (status !== "Todas" && (statusLabels[match.status] || match.status || "Não iniciada") !== status) return false;
    return true;
  });
  const event = activeEvent(state);
  return `<section class="page fullwide">
    ${sectionHeader({ eyebrow: event?.name || "Evento ativo", title: "Partidas", description: "Toque em um time para reservar a observação e abrir o scouting." })}
    <div class="filterbar">
      <div class="search-box">${icon("search", 18)}<input data-filter="match-search" value="${escapeHtml(filters.term || "")}" placeholder="Buscar partida, número ou equipe" aria-label="Buscar partida ou equipe" /></div>
      <div class="filter-chips" role="tablist" aria-label="Status da partida">
        ${["Todas", "Não iniciada", "Em andamento", "Completa", "Incompleta"].map((item) => `<button class="chip ${status === item ? "active" : ""}" data-action="match-status" data-status="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
      </div>
    </div>
    ${matches.length ? `<div class="match-grid">${matches.map((match) => matchCard(state, match)).join("")}</div>` : `<div class="card pad"><div class="empty-state"><span class="empty-state__icon">${icon("matches",28)}</span><h3>Nenhuma partida encontrada</h3><p>Ajuste os filtros ou cadastre uma partida na área administrativa.</p></div></div>`}
  </section>`;
}
