// =====================================================================
// Ubicación en tiempo real. Usa watchPosition() (NO getCurrentPosition
// una sola vez), con throttling para no saturar la base de datos.
// =====================================================================

const LOCATION_UPDATE_MIN_INTERVAL_MS = 4000; // throttle: máx. ~1 update/4s
let lastLocationSentAt = 0;

function requestLocation() {
  state.locationStatus = "pending";
  render();

  if (!("geolocation" in navigator)) {
    state.locationStatus = "unsupported";
    showBanner("Tu navegador no soporta geolocalización.");
    render();
    return;
  }

  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
  }

  state.watchId = navigator.geolocation.watchPosition(
    onPositionUpdate,
    onPositionError,
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    }
  );
}

function stopWatchingLocation() {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
}

async function onPositionUpdate(pos) {
  const coords = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  };
  const hadCoords = !!state.coords;
  const wasOk = state.locationStatus === "ok";
  state.coords = coords;
  state.locationStatus = "ok";

  // Al conceder el permiso se empieza compartiendo: es lo que la pantalla
  // de permiso anuncia ("mostrarte en el mapa y conectarte con personas
  // cerca de ti"). Si el usuario apaga el interruptor del menú, se respeta
  // su decisión y no se vuelve a encender solo.
  if (!state.sharingChoiceMade && !state.sharingEnabled) {
    state.sharingEnabled = true;
  }

  // watchPosition dispara muy seguido. Un render() completo destruye el
  // campo de texto donde el usuario está escribiendo, así que mientras
  // escribe solo movemos los marcadores del mapa.
  const el = document.activeElement;
  const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  if (hadCoords && wasOk && typing && state.screen === "app") {
    if (state.activeTab === "mapa" && !state.openThread) renderMapMarkers();
  } else {
    render();
  }

  const now = Date.now();
  if (now - lastLocationSentAt < LOCATION_UPDATE_MIN_INTERVAL_MS) return;
  lastLocationSentAt = now;

  if (!state.me) return;

  await sb.from("locations").upsert({
    user_id: state.me.id,
    latitude: coords.lat,
    longitude: coords.lng,
    accuracy: coords.accuracy,
    sharing_enabled: state.sharingEnabled,
    radius_m: state.radiusM,
    updated_at: new Date().toISOString(),
  });
}

function onPositionError(err) {
  // Solo un rechazo EXPLÍCITO del usuario debe hacer que la app vuelva a
  // pedir el permiso. Un timeout o "posición no disponible" temporal
  // (típico en laptops sin GPS o con mala señal) es un error pasajero:
  // si lo tratáramos como "denegado", la ubicación parecería
  // "desactivarse sola" aunque el permiso del navegador siga concedido.
  if (err.code === err.PERMISSION_DENIED) {
    state.locationStatus = "denied";
    render();
    return;
  }
  if (err.code === err.TIMEOUT) {
    showBanner("No se pudo obtener tu ubicación (tiempo agotado). Verifica que el GPS esté activado.");
    return;
  }
  // POSITION_UNAVAILABLE u otro código: mantenemos la última ubicación
  // conocida (si ya la había) y solo avisamos, sin resetear el estado.
  showBanner("Señal de ubicación débil por un momento. Verifica que el GPS esté activado.");
}

async function toggleSharing() {
  if (state.locationStatus !== "ok") {
    toast("Activa tu ubicación primero.");
    return;
  }
  state.sharingEnabled = !state.sharingEnabled;
  state.sharingChoiceMade = true;
  render();
  await sb.from("locations").upsert({
    user_id: state.me.id,
    latitude: state.coords.lat,
    longitude: state.coords.lng,
    accuracy: state.coords.accuracy,
    sharing_enabled: state.sharingEnabled,
    radius_m: state.radiusM,
    updated_at: new Date().toISOString(),
  });
  toast(state.sharingEnabled ? "Ahora compartes tu ubicación." : "Dejaste de compartir tu ubicación.");
}

async function setRadius(m) {
  state.radiusM = m;
  render();
  if (state.me && state.coords) {
    await sb.from("locations").update({ radius_m: m }).eq("user_id", state.me.id);
  }
}

// Usuarios (con ubicación compartida) dentro de mi radio — distancia real
function nearbyUsers() {
  if (!state.coords) return [];
  return Object.values(state.locations)
    .filter((l) => l.user_id !== state.me?.id && l.sharing_enabled)
    .map((l) => ({ loc: l, km: distanceKm(state.coords, l) }))
    .filter((x) => x.km * 1000 <= state.radiusM)
    .map((x) => ({ ...state.profiles[x.loc.user_id], _loc: x.loc, _km: x.km }))
    .filter((u) => u.id);
}

function allSharedUsers() {
  return Object.values(state.locations)
    .filter((l) => l.user_id !== state.me?.id && l.sharing_enabled)
    .map((l) => ({ ...state.profiles[l.user_id], _loc: l }))
    .filter((u) => u.id);
}
