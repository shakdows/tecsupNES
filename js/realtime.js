let realtimeChannel = null;

async function loadInitialData() {
  await loadAllProfiles();
  await loadAllLocations();
  await loadMyGroups();
  await loadBroadcastHistory();
  await loadNearbyGeoHistory();
  render();
}

async function loadAllProfiles() {
  const { data, error } = await sb.from("profiles").select("*");
  if (error) { showBanner(humanizeError(error)); return; }
  (data || []).forEach((p) => { state.profiles[p.id] = p; });
}

async function loadAllLocations() {
  const { data, error } = await sb.from("locations").select("*");
  if (error) return; // RLS puede limitar esto legítimamente; no es un error fatal
  (data || []).forEach((l) => { state.locations[l.user_id] = l; });
}

async function initRealtimeSubscriptions() {
  if (realtimeChannel) await sb.removeChannel(realtimeChannel);

  realtimeChannel = sb
    .channel("nes-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, (payload) => {
      if (payload.eventType === "DELETE") {
        delete state.locations[payload.old.user_id];
      } else {
        state.locations[payload.new.user_id] = payload.new;
      }
      renderMapMarkers();
      if (state.activeTab === "chats" || state.activeTab === "mapa") render();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
      if (payload.new) state.profiles[payload.new.id] = payload.new;
      render();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      ingestIncomingMessage(payload.new);
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
      ingestIncomingMessage(payload.new);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        state.connStatus = "online";
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        state.connStatus = "offline";
      } else if (status === "CLOSED") {
        state.connStatus = "offline";
      }
      render();
    });
}

// Pérdida/recuperación de Internet 
window.addEventListener("online", async () => {
  state.connStatus = "connecting";
  render();
  if (state.me) {
    await initRealtimeSubscriptions();
    await loadAllLocations();
    render();
  }
});
window.addEventListener("offline", () => {
  state.connStatus = "offline";
  render();
});

window.addEventListener("beforeunload", () => {
  if (!state.me || !state.session) return;
  try {
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${state.me.id}`, {
      method: "PATCH",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${state.session.access_token}`,
      },
      body: JSON.stringify({ status: "offline" }),
    });
  } catch (e) { }
});
