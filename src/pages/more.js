import { icon, sectionHeader } from "../components/ui.js";

export function renderMore() {
  const links = [["ranking", "Ranking de equipes", "Compare os resultados coletados no evento.", "ranking"], ["compare", "Comparar equipes", "Veja até quatro equipes lado a lado.", "compare"], ["favorites", "Favoritos e observações", "Acompanhe as equipes que precisam de atenção.", "star"], ["admin", "Gerenciar evento", "Eventos, equipes, scouts e agenda de partidas.", "matches"], ["season", "Temporada e regras", "Configure as métricas e os pesos do ranking.", "settings"], ["settings", "Configurações e backup", "Escolha seu scout, exporte ou restaure seus dados.", "download"]];
  return `<section class="page">${sectionHeader({ title: "Mais ferramentas", description: "Tudo o que você precisa para preparar o evento e decidir sua estratégia." })}<div class="tools-grid">${links.map(([view, title, description, glyph]) => `<a class="tool-card" href="#${view}" data-view="${view}"><span class="tool-icon">${icon(glyph, 23)}</span><span><strong>${title}</strong><small>${description}</small></span>${icon("chevron", 18)}</a>`).join("")}</div></section>`;
}
