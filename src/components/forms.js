import { escapeHtml, icon } from "./ui.js";
import { activeEvent, currentScout, getMatchTeams, matchLabel, recordFor } from "../utils/domain.js";

export function dialog({ title, description = "", eyebrow = "", body, footer = "", className = "" }) {
  return `<div class="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><header class="modal__header"><div>${eyebrow ? `<span class="eyebrow">${escapeHtml(eyebrow)}</span>` : ""}<h2 id="dialog-title">${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div><button class="icon-button" data-action="close-modal" aria-label="Fechar janela">${icon("close")}</button></header><div class="modal__body">${body}</div>${footer ? `<footer class="modal__footer">${footer}</footer>` : ""}</section></div>`;
}

export function teamForm() {
  return `<form data-form="add-team"><div class="field-grid two"><div class="field"><label for="team-number">Número FTC</label><input id="team-number" name="number" inputmode="numeric" placeholder="Ex.: 12345" pattern="[0-9]+" required maxlength="8" /></div><div class="field"><label for="team-name">Nome da equipe</label><input id="team-name" name="name" placeholder="Ex.: Robótica Brasil" required maxlength="60" /></div><div class="field"><label for="team-robot">Nome do robô <span>(opcional)</span></label><input id="team-robot" name="robotName" maxlength="40" /></div><div class="field"><label for="team-city">Cidade <span>(opcional)</span></label><input id="team-city" name="city" placeholder="Cidade, UF" maxlength="60" /></div></div><div class="form-actions"><button class="button primary" type="submit">${icon("plus", 17)} Adicionar equipe</button></div></form>`;
}

export function bulkTeamsForm({ setup = false } = {}) {
  return `<form data-form="add-teams" ${setup ? 'data-setup="true"' : ""}><div class="field"><label for="teams-list">Uma equipe por linha</label><textarea id="teams-list" name="teams" rows="6" required maxlength="20000" placeholder="12345; Robótica Brasil&#10;23456; Equipe Horizonte&#10;34567; Circuito Verde&#10;45678; Nova Geração"></textarea><span class="field-hint">Use número e nome separados por ponto e vírgula, vírgula ou tabulação. Você pode colar uma lista da planilha.</span></div><div class="form-actions"><button class="button primary" type="submit">${setup ? "Salvar equipes e continuar" : "Adicionar equipes"} ${icon("chevron", 16)}</button></div></form>`;
}

export function matchForm(state, { setup = false } = {}) {
  const event = activeEvent(state);
  const matches = (state.matches || []).filter((match) => String(match.eventId) === String(event?.id));
  const teams = state.teams || [];
  const choices = `<option value="">Selecione a equipe</option>${teams.slice().sort((a, b) => Number(a.number) - Number(b.number)).map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.number)} · ${escapeHtml(team.name)}</option>`).join("")}`;
  return `<form data-form="add-match" ${setup ? 'data-setup="true"' : ""}><div class="field-grid two"><div class="field"><label for="match-number">Número da partida</label><input id="match-number" name="number" type="number" min="1" max="999" required value="${Math.max(0, ...matches.map((match) => Number(match.number) || 0)) + 1}" /></div><div class="field"><label for="match-time">Data e horário <span>(opcional)</span></label><input id="match-time" name="scheduledAt" type="datetime-local" /></div></div><div class="match-form-alliances">${[["red", "Vermelha"], ["blue", "Azul"]].map(([key, label]) => `<fieldset class="alliance-fields ${key}"><legend><i></i> Aliança ${label.toLowerCase()}</legend>${[1, 2].map((position) => `<div class="field"><label for="match-${key}${position}">Equipe ${position}</label><select id="match-${key}${position}" name="${key}${position}" required data-match-team>${choices}</select></div>`).join("")}</fieldset>`).join("")}</div><p class="field-hint">Selecione quatro equipes diferentes. Depois, basta tocar na equipe que você vai observar.</p><div class="form-actions"><button class="button primary" type="submit">${icon("check", 17)} ${setup ? "Concluir e abrir partidas" : "Criar partida"}</button></div></form>`;
}

export function renderSetup(state, step = 1) {
  const event = activeEvent(state);
  const scout = currentScout(state);
  const titles = ["Vamos preparar seu evento", "Adicione as equipes", "Monte a primeira partida"];
  const descriptions = ["Comece pelo nome do evento e de quem vai observar as partidas.", "Cole sua lista para cadastrar várias equipes de uma vez.", "Duas equipes de cada lado. Sua primeira observação está quase pronta."];
  let body = `<ol class="setup-progress" aria-label="Etapas de preparação">${["Evento", "Equipes", "Partida"].map((label, index) => `<li class="${step === index + 1 ? "current" : step > index + 1 ? "done" : ""}" ${step === index + 1 ? 'aria-current="step"' : ""}><span>${step > index + 1 ? icon("check", 14) : index + 1}</span>${label}</li>`).join("")}</ol>`;
  if (step === 1) body += `<form data-form="setup-event">${event ? `<div class="notice success">${icon("check", 18)} Evento ativo: ${escapeHtml(event.name)}</div>` : `<div class="field"><label for="setup-event-name">Nome do evento</label><input id="setup-event-name" name="eventName" placeholder="Ex.: Regional de robótica 2026" required maxlength="70" /></div><div class="field"><label for="setup-event-type">Tipo do evento</label><select id="setup-event-type" name="eventType"><option value="Regional">Regional</option><option value="Practice">Treino</option><option value="Qualifier">Classificatória</option><option value="Championship">Campeonato</option></select></div>`}${scout ? `<div class="notice success">${icon("user", 18)} Scout: ${escapeHtml(scout.name)}</div>` : `<div class="field"><label for="setup-scout-name">Seu nome</label><input id="setup-scout-name" name="scoutName" placeholder="Como podemos te chamar?" required maxlength="60" /><span class="field-hint">Seu nome identifica as observações que você salvar.</span></div>`}<div class="form-actions"><button class="button primary" type="submit">Continuar ${icon("chevron", 16)}</button></div></form>`;
  if (step === 2) body += `${state.teams.length ? `<div class="notice success">${icon("teams", 18)} ${state.teams.length} equipe(s) já cadastrada(s).</div>` : ""}${bulkTeamsForm({ setup: true })}${state.teams.length >= 4 ? '<button class="button ghost wide" data-action="setup-next" data-step="3">Continuar com as equipes cadastradas</button>' : '<p class="subtle">São necessárias pelo menos 4 equipes para uma partida FTC.</p>'}`;
  if (step === 3) body += matchForm(state, { setup: true });
  return dialog({ title: titles[step - 1], description: descriptions[step - 1], eyebrow: `Primeiro evento · passo ${step} de 3`, body, className: "setup-modal" });
}

export function renderCreateModal(state, type) {
  if (type === "add-team") return dialog({ title: "Adicionar equipe", description: "Cadastre os dados básicos. As estatísticas vêm das partidas.", body: `${teamForm()}<div class="form-divider">Tem uma lista de equipes?</div><button class="button ghost wide" data-action="open-bulk-teams">${icon("clipboard", 17)} Adicionar várias de uma vez</button>` });
  if (type === "bulk-teams") return dialog({ title: "Adicionar várias equipes", description: "Cole a lista do evento. Vamos conferir os números antes de salvar.", body: bulkTeamsForm() });
  if (type === "add-match") return dialog({ title: "Nova partida", description: activeEvent(state)?.name || "Evento ativo", body: matchForm(state) });
  if (type === "start-scout") {
    const event = activeEvent(state);
    const matches = (state.matches || []).filter((match) => String(match.eventId) === String(event?.id));
    const pending = matches.filter((match) => getMatchTeams(state, match).some((entry) => !recordFor(state, match.id, entry.teamId)));
    return dialog({ title: "Qual equipe você vai observar?", description: "Escolha a partida e toque na equipe para começar ou retomar seu rascunho.", body: `<div class="scout-picker">${pending.map((match) => `<section><h3>${escapeHtml(matchLabel(match))}</h3><div class="picker-teams">${getMatchTeams(state, match).filter((entry) => !recordFor(state, match.id, entry.teamId)).map((entry) => `<button class="picker-team ${entry.alliance}" data-action="open-scout" data-match-id="${escapeHtml(match.id)}" data-team-id="${escapeHtml(entry.teamId)}"><span class="team-number-mark">${escapeHtml(entry.team?.number || "—")}</span><span><strong>${escapeHtml(entry.team?.name || "Equipe")}</strong><small>${entry.alliance === "blue" ? "Azul" : "Vermelha"} · posição ${entry.position}</small></span>${icon("chevron", 17)}</button>`).join("")}</div></section>`).join("") || `<div class="empty-state"><span class="empty-state__icon">${icon("check", 26)}</span><h3>${matches.length ? "Tudo observado por aqui!" : "Vamos criar sua primeira partida"}</h3><p>${matches.length ? "Crie outra partida para continuar o scouting." : "Adicione as equipes das duas alianças para começar."}</p><button class="button primary" data-action="open-add-match">${icon("plus", 17)} Nova partida</button></div>`}</div>` });
  }
  return "";
}
