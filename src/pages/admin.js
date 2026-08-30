import { escapeHtml, icon, sectionHeader, statusPill } from "../components/ui.js";
import { activeEvent, activeSeason, getMatchTeams, matchLabel } from "../utils/domain.js";

function emptyList(message) {
  return `<span class="subtle">${escapeHtml(message)}</span>`;
}

function setupGuide({ state, event }) {
  const steps = [
    { done: (state.scouts || []).length > 0, label: "1. Adicione um scout" },
    { done: (state.teams || []).length >= 4, label: "2. Cadastre pelo menos quatro equipes" },
    { done: Boolean(event), label: "3. Crie e ative o evento" },
    { done: (state.matches || []).some((match) => String(match.eventId) === String(event?.id)), label: "4. Cadastre a primeira partida" },
  ];
  return `<section class="card pad" style="grid-column:1/-1"><div class="card-header"><div><span class="eyebrow">Fluxo recomendado</span><h2>Preparar o scouting</h2><span class="subtle">Os dados ficam neste navegador; exporte um backup antes de trocar de dispositivo.</span></div>${icon("clipboard", 20)}</div><div class="compact-list">${steps.map((step) => `<div class="compact-item"><div class="item-main">${icon(step.done ? "check" : "clock", 18)}<div><strong>${escapeHtml(step.label)}</strong><span>${step.done ? "Pronto" : "Pendente"}</span></div></div></div>`).join("")}</div></section>`;
}

function matchSetup({ teams, event, eventMatches }) {
  const canCreateMatch = Boolean(event) && teams.length >= 4;
  const disabled = canCreateMatch ? "" : " disabled";
  const teamOptions = `<option value="" selected disabled>Selecione a equipe</option>${teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.number)} · ${escapeHtml(team.name)}</option>`).join("")}`;
  const reason = !event
    ? "Crie e ative um evento antes de cadastrar partidas."
    : teams.length < 4
      ? `Faltam ${4 - teams.length} equipe(s) para montar uma partida.`
      : "Selecione quatro equipes diferentes, duas por aliança.";
  return `<section class="card pad" style="grid-column:1/-1"><div class="card-header"><div><h2>Agenda de partidas</h2><span class="subtle">Cadastre quatro posições — duas por aliança — para liberar o fluxo de scouting.</span></div>${icon("matches", 20)}</div><div class="admin-list">${eventMatches.map((match) => `<div class="admin-list__item"><div><strong>${escapeHtml(matchLabel(match))}</strong><span>${getMatchTeams({ teams }, match).map((entry) => entry.team?.number || "—").join(" · ")}</span></div>${statusPill(match.status === "complete" ? "Completa" : match.status === "in_progress" ? "Em andamento" : "Não iniciada")}</div>`).join("") || emptyList(event ? "Nenhuma partida cadastrada para este evento." : "A agenda aparecerá após ativar um evento.")}</div><p class="subtle" style="margin:14px 0 0">${escapeHtml(reason)}</p><form data-form="add-match" style="margin-top:14px"><div class="field-grid three"><div class="field"><label>Número</label><input name="number" type="number" min="1" max="999" value="${Math.max(0, ...eventMatches.map((match) => Number(match.number) || 0)) + 1}" required${disabled} /></div><div class="field"><label>Vermelha 1</label><select name="red1" required${disabled}>${teamOptions}</select></div><div class="field"><label>Vermelha 2</label><select name="red2" required${disabled}>${teamOptions}</select></div><div class="field"><label>Azul 1</label><select name="blue1" required${disabled}>${teamOptions}</select></div><div class="field"><label>Azul 2</label><select name="blue2" required${disabled}>${teamOptions}</select></div><div class="field"><label>Horário</label><input name="scheduledAt" type="datetime-local" required${disabled} /></div></div><div class="form-actions"><button class="button" type="submit"${disabled}>${icon("plus", 16)} Cadastrar partida</button></div></form></section>`;
}

export function renderAdmin({ state }) {
  const event = activeEvent(state);
  const season = activeSeason(state);
  const teams = state.teams || [];
  const scouts = state.scouts || [];
  const records = state.scoutingRecords || [];
  const eventMatches = event ? (state.matches || []).filter((match) => String(match.eventId) === String(event.id)) : [];
  const observationsOnly = season?.scoringScope === "observations_only";
  return `<section class="page fullwide">
    ${sectionHeader({ eyebrow: "Área do administrador", title: "Administração", description: "Cadastre entidades reais do evento, corrija dados e mantenha a agenda pronta para o scouting." })}
    <div class="admin-grid">
      ${setupGuide({ state, event })}
      <section class="card pad"><div class="card-header"><div><h2>Eventos</h2><span class="subtle">O evento ativo separa partidas, ranking e estatísticas.</span></div>${icon("matches", 20)}</div><div class="admin-list">${(state.events || []).map((item) => `<div class="admin-list__item"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.type || "Evento")}</span></div>${String(item.id) === String(event?.id) ? '<span class="status-pill good">Ativo</span>' : `<button class="button small" data-action="set-active-event" data-event-id="${escapeHtml(item.id)}">Ativar</button>`}</div>`).join("") || emptyList("Nenhum evento cadastrado.")}</div><form data-form="add-event" style="margin-top:14px"><div class="field-grid two"><div class="field"><label>Nome</label><input name="name" placeholder="Ex.: Regional Sul" required maxlength="70" /></div><div class="field"><label>Tipo</label><select name="type"><option>Qualifier</option><option>League Tournament</option><option>Regional</option><option>Championship</option><option>Practice</option></select></div></div><div class="form-actions"><button class="button" type="submit">${icon("plus", 16)} Criar evento</button></div></form></section>
      <section class="card pad"><div class="card-header"><div><h2>Equipes</h2><span class="subtle">${teams.length} cadastrada(s) neste banco local.</span></div>${icon("teams", 20)}</div><div class="admin-list">${teams.slice(0, 6).map((team) => `<div class="admin-list__item"><div><strong>${escapeHtml(team.number)} · ${escapeHtml(team.name)}</strong><span>${escapeHtml(team.robotName || "Sem nome de robô")}${team.city ? ` · ${escapeHtml(team.city)}` : ""}</span></div><button class="button small" data-action="open-team" data-team-id="${escapeHtml(team.id)}">Abrir</button></div>`).join("") || emptyList("Nenhuma equipe cadastrada.")}</div><form data-form="add-team" style="margin-top:14px"><div class="field-grid two"><div class="field"><label>Número FTC</label><input name="number" inputmode="numeric" placeholder="12345" required pattern="[0-9]+" maxlength="8" /></div><div class="field"><label>Nome da equipe</label><input name="name" placeholder="Nome da equipe" required maxlength="60" /></div><div class="field"><label>Robô (opcional)</label><input name="robotName" placeholder="Nome do robô" maxlength="40" /></div><div class="field"><label>Cidade (opcional)</label><input name="city" placeholder="Cidade, UF" maxlength="60" /></div></div><div class="form-actions"><button class="button" type="submit">${icon("plus", 16)} Cadastrar equipe</button></div></form></section>
      <section class="card pad"><div class="card-header"><div><h2>Scouts</h2><span class="subtle">O primeiro scout cadastrado vira a conta atual deste navegador.</span></div>${icon("user", 20)}</div><div class="admin-list">${scouts.map((scout) => `<div class="admin-list__item"><div><strong>${escapeHtml(scout.name)}</strong><span>${escapeHtml(scout.role || "Scout")} · ${records.filter((record) => String(record.scoutId) === String(scout.id)).length} partida(s) analisada(s)</span></div><span class="status-pill ${scout.isActive === false ? "muted" : "good"}">${scout.isActive === false ? "Inativo" : "Ativo"}</span></div>`).join("") || emptyList("Nenhum scout cadastrado.")}</div><form data-form="add-scout" style="margin-top:14px"><div class="field-grid two"><div class="field"><label>Nome</label><input name="name" placeholder="Nome do scout" required maxlength="60" /></div><div class="field"><label>Função</label><select name="role"><option>Scout</option><option>Estratégia</option><option>Administrador</option></select></div></div><div class="form-actions"><button class="button" type="submit">${icon("plus", 16)} Adicionar scout</button></div></form></section>
      ${matchSetup({ teams, event, eventMatches })}
      <section class="card pad" style="grid-column:1/-1"><div class="card-header"><div><h2>Registros enviados</h2><span class="subtle">Correções de dados exigem confirmação antes de apagar.</span></div>${icon("clipboard", 20)}</div><div class="admin-list">${records.slice().sort((a, b) => new Date(b.savedAt || b.createdAt || 0) - new Date(a.savedAt || a.createdAt || 0)).slice(0, 9).map((record) => { const team = teams.find((item) => String(item.id) === String(record.teamId)); const match = state.matches?.find((item) => String(item.id) === String(record.matchId)); const summary = observationsOnly ? "observação salva" : `${Number(record.total ?? record.score?.total ?? 0)} pontos`; return `<div class="admin-list__item"><div><strong>${escapeHtml(team?.number || "—")} · ${escapeHtml(matchLabel(match))}</strong><span>${escapeHtml(record.status || "salvo")} · ${escapeHtml(summary)}</span></div><button class="icon-button" data-action="request-delete-record" data-record-id="${escapeHtml(record.id)}" aria-label="Excluir registro">${icon("close", 16)}</button></div>`; }).join("") || emptyList("Nenhum registro enviado.")}</div></section>
    </div>
  </section>`;
}

export function renderDeleteRecordConfirm(recordId) {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal__header"><div><span class="eyebrow">Confirmação necessária</span><h2>Excluir registro?</h2><p>Essa ação remove o scouting e atualiza as estatísticas do evento.</p></div><button class="icon-button" data-action="close-modal" aria-label="Fechar">${icon("close")}</button></header><div class="modal__body"><div class="card inset pad"><span class="icon-text">${icon("alert", 18)} A exclusão é permanente no banco local.</span></div></div><footer class="modal__footer"><button class="button" data-action="close-modal">Cancelar</button><button class="button danger" data-action="confirm-delete-record" data-record-id="${escapeHtml(recordId)}">Excluir registro</button></footer></section></div>`;
}
