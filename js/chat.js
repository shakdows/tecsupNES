function openThread(kind, id) {
  state.openThread = { type: kind, id };
  render();
  if (kind === "direct") loadDirectHistory(id);
  if (kind === "group") loadGroupHistory(id);
  markThreadRead(kind, id);
}

function closeThread() {
  state.openThread = null;
  render();
}

async function loadDirectHistory(otherId) {
  if (state.directChats[otherId]) { render(); return; }
  const me = state.me.id;
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .eq("scope", "direct")
    .or(`and(sender_id.eq.${me},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${me})`)
    .order("created_at", { ascending: true });

  if (error) { showBanner(humanizeError(error)); return; }
  state.directChats[otherId] = data || [];
  render();
}

async function loadGroupHistory(groupId) {
  if (state.groupMessages[groupId]) { render(); return; }
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .eq("scope", "group")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) { showBanner(humanizeError(error)); return; }
  state.groupMessages[groupId] = data || [];
  render();
}

async function markThreadRead(kind, id) {
  if (kind !== "direct" || !state.me) return;
  await sb
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("scope", "direct")
    .eq("sender_id", id)
    .eq("receiver_id", state.me.id)
    .is("read_at", null);
}

function toggleLocAttach() {
  if (state.locationStatus !== "ok") { toast("Activa tu ubicación para adjuntarla"); return; }
  state.composerLoc = !state.composerLoc;
  render();
}

async function sendMessage() {
  const thread = state.openThread;
  if (!thread) return;
  const text = state.composerText.trim();
  if (!text && !state.composerLoc) return;

  const payload = {
    sender_id: state.me.id,
    text: text || "📍 Ubicación compartida",
    created_at: new Date().toISOString(),
  };
  if (state.composerLoc && state.coords) {
    payload.latitude = state.coords.lat;
    payload.longitude = state.coords.lng;
  }

  if (thread === "broadcast" || thread.type === "broadcast") {
    await sendBroadcast(payload);
  } else if (thread.type === "group") {
    payload.scope = "group";
    payload.group_id = thread.id;
    const { error } = await sb.from("messages").insert(payload);
    if (error) { showBanner(humanizeError(error)); return; }
  } else {
    payload.scope = "direct";
    payload.receiver_id = thread.id;
    const { error } = await sb.from("messages").insert(payload);
    if (error) { showBanner(humanizeError(error)); return; }
  }

  state.composerText = "";
  state.composerLoc = false;
  render();
}


function ingestIncomingMessage(msg) {
  if (msg.scope === "direct") {
    const otherId = msg.sender_id === state.me.id ? msg.receiver_id : msg.sender_id;
    if (!state.directChats[otherId]) state.directChats[otherId] = [];
    if (!state.directChats[otherId].some((m) => m.id === msg.id)) {
      state.directChats[otherId].push(msg);
    }
    if (msg.sender_id !== state.me.id) {
      notifyIncoming({
        title: nameFor(msg.sender_id),
        text: msg.text,
        color: colorFor(msg.sender_id),
        initialsTxt: initials(nameFor(msg.sender_id)),
      });
    }
  } else if (msg.scope === "group") {
    if (!state.groupMessages[msg.group_id]) state.groupMessages[msg.group_id] = [];
    if (!state.groupMessages[msg.group_id].some((m) => m.id === msg.id)) {
      state.groupMessages[msg.group_id].push(msg);
    }
    if (msg.sender_id !== state.me.id) {
      const g = state.groups.find((g) => g.id === msg.group_id);
      notifyIncoming({
        title: (g ? g.name : "Grupo") + " · " + nameFor(msg.sender_id),
        text: msg.text,
        color: colorFor(msg.sender_id),
        initialsTxt: initials(nameFor(msg.sender_id)),
      });
    }
  } else if (msg.scope === "broadcast_all") {
    if (!state.broadcastAll.some((m) => m.id === msg.id)) state.broadcastAll.push(msg);
    if (msg.sender_id !== state.me.id) {
      notifyIncoming({ title: nameFor(msg.sender_id) + " · Difusión", text: msg.text, color: colorFor(msg.sender_id), initialsTxt: initials(nameFor(msg.sender_id)) });
    }
  } else if (msg.scope === "broadcast_near" || msg.scope === "geo") {
    if (!state.broadcastNear.some((m) => m.id === msg.id)) state.broadcastNear.unshift(msg);
    if (msg.sender_id !== state.me.id && msg.latitude != null && state.coords) {
      const km = distanceKm(state.coords, { lat: msg.latitude, lng: msg.longitude });
      if (km * 1000 <= state.radiusM) {
        notifyIncoming({
          title: nameFor(msg.sender_id) + " está a " + fmtDist(km),
          text: msg.text,
          color: colorFor(msg.sender_id),
          initialsTxt: initials(nameFor(msg.sender_id)),
        });
        showMapBubbleForUser(msg.sender_id, msg.text);
      }
    }
  }
  render();
}
