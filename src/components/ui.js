export const icon = (name, size = 20) => {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    matches: '<path d="M4 5h16v15H4z"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    teams: '<path d="M8 21v-2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a4 4 0 0 1 2-3.66M20 15.34A4 4 0 0 1 22 19v2M5 4.35a4 4 0 0 0 0 5.3M19 4.35a4 4 0 0 1 0 5.3"/>',
    ranking: '<path d="M5 21V10M12 21V3M19 21v-6"/><path d="M3 21h18"/>',
    compare: '<path d="M4 6h7v12H4zM13 3h7v15h-7z"/><path d="M6 10h3M15 8h3M6 14h3M15 12h3"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    chart: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20.3h-3v-.08A1.7 1.7 0 0 0 10.66 18.66a1.7 1.7 0 0 0-1.88.34l-.06.06L6.6 16.94l.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.56-1.04H5.3v-3h.14A1.7 1.7 0 0 0 7 9.92a1.7 1.7 0 0 0-.34-1.88L6.6 7.98 8.72 5.86l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.04-1.56V4.62h3v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
    bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M10.3 4.4 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    offline: '<path d="M5 12.5a10 10 0 0 1 14 0M8 16a6 6 0 0 1 8 0M11.2 19.4a1.2 1.2 0 1 1 1.6 0"/><path d="M3 3l18 18"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.9-4M4 5v4h4M4 13a8 8 0 0 0 14.9 4M20 19v-4h-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    robot: '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/>',
    filter: '<path d="M4 5h16l-6 7v5l-4 2v-7z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    save: '<path d="M5 4h12l3 3v13H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v5M8 21h8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    clipboard: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h4"/>'
  };
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.dashboard}</svg>`;
};

export const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export const number = (value, digits = 0) => new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits
}).format(Number(value || 0));

export const dateTime = (value) => value ? new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
}).format(new Date(value)) : "—";

export const initials = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "SC";

export const metricCard = ({ label, value, detail = "", tone = "cyan", iconName = "chart", trend = "" }) => `
  <article class="metric-card ${tone}">
    <div class="metric-card__icon">${icon(iconName)}</div>
    <div class="metric-card__body">
      <span class="eyebrow">${escapeHtml(label)}</span>
      <strong>${value}</strong>
      ${detail ? `<span class="metric-card__detail">${trend ? `<b>${escapeHtml(trend)}</b> ` : ""}${escapeHtml(detail)}</span>` : ""}
    </div>
  </article>`;

export const statusPill = (status) => {
  const map = {
    online: ["Online", "good", "check"],
    offline: ["Offline", "warn", "offline"],
    syncing: ["Sincronizando", "info", "sync"],
    synced: ["Sincronizado", "good", "check"],
    "Não iniciada": ["Não iniciada", "muted", "clock"],
    "Em andamento": ["Em andamento", "info", "clock"],
    Completa: ["Completa", "good", "check"],
    Incompleta: ["Incompleta", "warn", "alert"]
  };
  const [label, tone, iconName] = map[status] || [status, "muted", "clock"];
  return `<span class="status-pill ${tone}">${icon(iconName, 14)}${escapeHtml(label)}</span>`;
};

export const avatar = (person, className = "") => `<span class="avatar ${className}" title="${escapeHtml(person?.name || "Scout")}">${initials(person?.name)}</span>`;

export const progressBar = (value, { max = 100, tone = "cyan", label = "" } = {}) => {
  const percent = Math.max(0, Math.min(100, (Number(value || 0) / Math.max(1, max)) * 100));
  return `<div class="progress-wrap" ${label ? `aria-label="${escapeHtml(label)}"` : ""}><span class="progress ${tone}" style="--progress:${percent}%"></span></div>`;
};

export const emptyState = ({ iconName = "clipboard", title, description, action = "" }) => `
  <section class="empty-state">
    <span class="empty-state__icon">${icon(iconName, 28)}</span>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)}</p>
    ${action}
  </section>`;

export const sectionHeader = ({ eyebrow = "", title, description = "", action = "" }) => `
  <header class="section-header">
    <div>${eyebrow ? `<span class="eyebrow">${escapeHtml(eyebrow)}</span>` : ""}<h1>${escapeHtml(title)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>
    ${action}
  </header>`;

export const teamLabel = (team) => `<span class="team-label"><b>${escapeHtml(team?.number || "—")}</b><span>${escapeHtml(team?.name || "Equipe")}</span></span>`;

export const toast = (message, type = "info") => {
  const host = document.querySelector(".toast-host") || document.body.appendChild(Object.assign(document.createElement("div"), { className: "toast-host" }));
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.innerHTML = `${icon(type === "error" ? "alert" : type === "success" ? "check" : "sync", 18)}<span>${escapeHtml(message)}</span>`;
  host.appendChild(element);
  requestAnimationFrame(() => element.classList.add("show"));
  setTimeout(() => {
    element.classList.remove("show");
    setTimeout(() => element.remove(), 240);
  }, 3200);
};
