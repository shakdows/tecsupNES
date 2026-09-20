function openGroupForm() {
  state.groupFormOpen = true;
  state.newGroupName = "";
  state.newGroupPicks = [];
  render();
}

function closeGroupForm() {
  state.groupFormOpen = false;
  render();
}

function togglePick(id) {
  const i = state.newGroupPicks.indexOf(id);
  if (i > -1) state.newGroupPicks.splice(i, 1);
  else state.newGroupPicks.push(id);
  render();
}

async function createGroup() {
  const name = state.newGroupName.trim();
  if (!name) { toast("Ponle un nombre al grupo"); return; }
  if (state.newGroupPicks.length < 2) { render(); return; } // +yo = mínimo 3

  const { data: group, error } = await sb
    .from("groups")
    .insert({ name, owner_id: state.me.id })
    .select()
    .single();

  if (error) { showBanner(humanizeError(error)); return; }

  const memberRows = [state.me.id, ...state.newGroupPicks].map((uid) => ({
    group_id: group.id,
    user_id: uid,
  }));
  const { error: memErr } = await sb.from("group_members").insert(memberRows);
  if (memErr) { showBanner(humanizeError(memErr)); return; }

  group.members = [state.me.id, ...state.newGroupPicks];
  state.groups.push(group);
  state.groupFormOpen = false;
  toast("Grupo creado con " + memberRows.length + " integrantes");
  render();
}

async function loadMyGroups() {
  const { data: memberships, error } = await sb
    .from("group_members")
    .select("group_id, groups(id, name, owner_id, created_at)")
    .eq("user_id", state.me.id);

  if (error) { showBanner(humanizeError(error)); return; }

  const groups = (memberships || []).map((m) => m.groups).filter(Boolean);

  for (const g of groups) {
    const { data: members } = await sb.from("group_members").select("user_id").eq("group_id", g.id);
    g.members = (members || []).map((m) => m.user_id);
  }

  state.groups = groups;
  render();
}


function setScope(scope) {
  state.notifyScope = scope;
  render();
}

async function sendBroadcast(payload) {
  if (state.notifyScope === "todos") {
    payload.scope = "broadcast_all";
  } else {
    if (!state.coords) { toast("Activa tu ubicación para difundir a cercanos."); return; }
    payload.scope = "broadcast_near";
    payload.latitude = state.coords.lat;
    payload.longitude = state.coords.lng;
    payload.radius_m = state.radiusM;
  }

  const { error } = await sb.from("messages").insert(payload);
  if (error) { showBanner(humanizeError(error)); return; }

  if (payload.scope === "broadcast_all") {
    toast("Enviado a todos los usuarios de N.E.S.");
  } else {
    const count = nearbyUsers().length;
    toast(count ? `Enviado a ${count} persona(s) cercana(s)` : "Nadie está cerca de ti en este momento.");
  }
}

async function loadBroadcastHistory() {
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .in("scope", ["broadcast_all", "broadcast_near"])
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) { showBanner(humanizeError(error)); return; }
  state.broadcastAll = (data || []).filter((m) => m.scope === "broadcast_all");
  render();
}

// Mensaje del chat del mapa: se publica en las coordenadas donde estás en
// este momento y aparece como burbuja sobre tu propio punto.
async function sendMapMessage() {
  const text = (state.mapComposerText || "").trim();
  if (!text) return;
  if (!state.coords) { toast("Activa tu ubicación primero."); return; }

  const { error } = await sb.from("messages").insert({
    sender_id: state.me.id,
    scope: "geo",
    text,
    latitude: state.coords.lat,
    longitude: state.coords.lng,
    radius_m: state.radiusM,
    created_at: new Date().toISOString(),
  });

  if (error) { showBanner(humanizeError(error)); return; }

  state.mapComposerText = "";
  render();

  // Tu mensaje, anclado a tu marcador: si te mueves, la burbuja te sigue.
  showMapBubbleForMe(text);

  const count = nearbyUsers().length;
  toast(count ? `Visible para ${count} persona(s) cercana(s)` : "Nadie está cerca de ti en este momento.");
}

async function loadNearbyGeoHistory() {
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .eq("scope", "geo")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return;
  state.broadcastNear = data || [];
  render();
}
