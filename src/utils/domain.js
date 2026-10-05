export function byId(items = [], id) {
  return items.find((item) => String(item?.id) === String(id));
}

export function findTeam(state, id) {
  return byId(state?.teams, id) || (state?.teams || []).find((team) => String(team?.number) === String(id));
}

export function findScout(state, id) {
  return byId(state?.scouts || state?.users, id);
}

export function activeEvent(state) {
  const id = state?.settings?.activeEventId || state?.activeEventId || state?.events?.[0]?.id;
  return byId(state?.events, id) || state?.events?.[0] || null;
}

export function activeSeason(state) {
  const event = activeEvent(state);
  const id = event?.seasonConfigId || event?.seasonId || state?.settings?.activeSeasonId;
  return byId(state?.seasonConfigs, id) || state?.seasonConfig || state?.seasonConfigs?.[0] || null;
}

export function currentScout(state) {
  return findScout(state, state?.settings?.currentScoutId) || state?.scouts?.[0] || state?.users?.[0] || null;
}

export function recordFor(state, matchId, teamId) {
  return (state?.scoutingRecords || []).find((record) => String(record.matchId) === String(matchId) && String(record.teamId) === String(teamId) && !["draft", "discarded"].includes(record.status));
}

export function getMatchTeams(state, match) {
  if (!match) return [];
  const direct = Array.isArray(match.matchTeams) ? match.matchTeams : Array.isArray(match.teams) ? match.teams : [];
  if (direct.length) return direct.map((entry, index) => ({
    ...entry,
    id: entry.id || `${match.id}-${entry.teamId || entry.id || index}`,
    teamId: entry.teamId || entry.team?.id || entry.id,
    team: entry.team || findTeam(state, entry.teamId || entry.id),
    alliance: entry.alliance || (index < Math.ceil(direct.length / 2) ? "red" : "blue"),
    position: entry.position || entry.station || (index % 2) + 1,
  }));
  if (match.alliances) {
    return ["red", "blue"].flatMap((alliance) => {
      const allianceData = match.alliances[alliance] || [];
      const entries = Array.isArray(allianceData) ? allianceData : allianceData.teamIds || allianceData.teams || [];
      return entries.map((entry, index) => {
      const id = typeof entry === "object" ? entry.teamId || entry.id : entry;
      return { id: `${match.id}-${alliance}-${index + 1}`, teamId: id, team: findTeam(state, id), alliance, position: index + 1, ...(typeof entry === "object" ? entry : {}) };
      });
    });
  }
  return (state?.matchTeams || []).filter((entry) => String(entry.matchId) === String(match.id)).map((entry, index) => ({
    ...entry,
    team: entry.team || findTeam(state, entry.teamId),
    alliance: entry.alliance || (index < 2 ? "red" : "blue"),
    position: entry.position || entry.station || (index % 2) + 1,
  }));
}

export function matchLabel(match) {
  if (!match) return "Partida";
  return match.label || `${match.level || "Qualificação"} ${match.number ?? ""}`.trim();
}

export function matchTime(match) {
  return match?.scheduledAt || match?.time || match?.startTime || null;
}

export function isFavorite(state, teamId) {
  return Boolean(favoriteMeta(state, teamId));
}

export function favoriteMeta(state, teamId) {
  return (state?.favorites || []).find((item) => String(item.teamId ?? item) === String(teamId) && (!item.eventId || String(item.eventId) === String(activeEvent(state)?.id))) || null;
}

export function watchMeta(state, teamId) {
  return (state?.watchlist || []).find((item) => String(item.teamId ?? item) === String(teamId) && (!item.eventId || String(item.eventId) === String(activeEvent(state)?.id))) || null;
}

export function normalizeAlliance(alliance) {
  return String(alliance || "").toLowerCase() === "blue" ? "blue" : "red";
}

export function unique(array) { return [...new Set(array)]; }
