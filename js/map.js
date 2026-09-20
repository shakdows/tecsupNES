// =====================================================================
// Mapa real con Leaflet / OpenStreetMap. Sin SVG simulado: cada marcador
// se posiciona con lat/lng reales y se mueve cuando llegan updates por
// Supabase Realtime.
// =====================================================================

let leafletMap = null;
let meMarker = null;
const userMarkers = {}; // userId -> L.Marker
let mapMounted = false;

// -----------------------------------------------------------------------
// FIX "el mapa aparece y luego desaparece":
// render() hace root.innerHTML = "..." en cada actualización (llega tu
// ubicación, la de otro usuario, un mensaje, etc.). Eso DESTRUYE el
// <div id="leafletMap"> y crea uno nuevo vacío. Leaflet, en cambio, sigue
// apuntando al <div> viejo (ya eliminado del DOM), así que el mapa se
// queda "colgado" invisible.
//
// Solución: el contenedor real del mapa se crea UNA sola vez y vive fuera
// del innerHTML. En cada render simplemente lo "movemos" (appendChild) al
// hueco (#leafletMapSlot) que el HTML nuevo dejó para él. moveChild NO
// destruye el nodo ni lo que Leaflet tiene pintado adentro.
// -----------------------------------------------------------------------
const leafletContainerEl = document.createElement("div");
leafletContainerEl.id = "leafletMap";

function ensureMap() {
  const slot = document.getElementById("leafletMapSlot");
  if (!slot) { mapMounted = false; return null; }

  if (leafletContainerEl.parentElement !== slot) {
    slot.appendChild(leafletContainerEl);
  }

  if (!leafletMap) {
    const startCoords = state.coords || { lat: -12.0464, lng: -77.0428 };
    leafletMap = L.map(leafletContainerEl, { zoomControl: true, attributionControl: true }).setView(
      [startCoords.lat, startCoords.lng],
      15
    );
    addBaseLayer(leafletMap);
  } else {
    // Reasignar a un nuevo contenedor si el DOM fue re-renderizado
    leafletMap.invalidateSize();
  }
  mapMounted = true;
  return leafletMap;
}

// ---------------------------------------------------------------------
// CAPA BASE DEL MAPA
// CARTO dejó de servir su estilo oscuro sin clave: devuelve los tiles con
// la marca de agua "API KEY REQUIRED" encima de las calles. Se usa el
// mapa gris oscuro de Esri, que no pide clave y mantiene el tono oscuro
// de la app. Si ese servidor fallara, se cae a los tiles estándar de
// OpenStreetMap para no quedarse sin mapa.
// ---------------------------------------------------------------------
const BASE_LAYERS = [
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 16,
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    },
  },
  {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
];

let baseLayerIndex = 0;
let baseLayer = null;

function addBaseLayer(map) {
  const def = BASE_LAYERS[baseLayerIndex];
  if (!def) return;

  baseLayer = L.tileLayer(def.url, def.options);

  // Si el servidor de tiles falla varias veces seguidas, se pasa al
  // siguiente de la lista en lugar de dejar el mapa en negro.
  let fallos = 0;
  baseLayer.on("tileerror", () => {
    fallos++;
    if (fallos < 6 || baseLayerIndex >= BASE_LAYERS.length - 1) return;
    map.removeLayer(baseLayer);
    baseLayerIndex++;
    addBaseLayer(map);
  });

  baseLayer.addTo(map);
}

function meDivIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="map-you-marker"><div class="ring"></div><div class="dot"></div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function userDivIcon(user, online) {
  return L.divIcon({
    className: "",
    html: `
      <div class="map-user-marker ${online ? "" : "offline"}" style="background:${user.avatar_color || "#0072FF"};">
        ${online ? `<div class="ring" style="border-color:${user.avatar_color || "#0072FF"};"></div>` : ""}
        ${initials(user.name)}
      </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function renderMapMarkers() {
  const map = ensureMap();
  if (!map) return;

  // Mi marcador
  if (state.coords) {
    if (!meMarker) {
      meMarker = L.marker([state.coords.lat, state.coords.lng], { icon: meDivIcon(), zIndexOffset: 1000 }).addTo(map);
    } else {
      meMarker.setLatLng([state.coords.lat, state.coords.lng]);
    }
  }

  // Círculo de radio configurado
  if (state.coords) {
    if (!window.__radiusCircle) {
      window.__radiusCircle = L.circle([state.coords.lat, state.coords.lng], {
        radius: state.radiusM,
        color: "#00E5FF",
        weight: 1,
        fillOpacity: 0.05,
      }).addTo(map);
    } else {
      window.__radiusCircle.setLatLng([state.coords.lat, state.coords.lng]);
      window.__radiusCircle.setRadius(state.radiusM);
    }
  }

  // Marcadores de otros usuarios con ubicación compartida (reales, no inventados)
  const shared = allSharedUsers();
  const seen = new Set();
  shared.forEach((u) => {
    seen.add(u.id);
    const online = u.status === "online";
    const latlng = [u._loc.latitude, u._loc.longitude];
    if (!userMarkers[u.id]) {
      const marker = L.marker(latlng, { icon: userDivIcon(u, online) }).addTo(map);
      marker.on("click", () => openMapPopup(u.id));
      userMarkers[u.id] = marker;
    } else {
      userMarkers[u.id].setLatLng(latlng);
      userMarkers[u.id].setIcon(userDivIcon(u, online));
    }
  });

  // Quitar marcadores de usuarios que dejaron de compartir
  Object.keys(userMarkers).forEach((id) => {
    if (!seen.has(id)) {
      map.removeLayer(userMarkers[id]);
      delete userMarkers[id];
    }
  });
}

// =====================================================================
// BURBUJAS DE MENSAJE SOBRE EL MAPA
// El mensaje se muestra pegado al marcador de quien lo escribió, así que
// aparece justo en el punto donde esa persona está. Se usa un tooltip de
// Leaflet (no un popup suelto): el tooltip va ANCLADO al marcador, de
// modo que cuando la ubicación se actualiza en tiempo real la burbuja se
// mueve contigo, en vez de quedarse donde estabas al escribir.
// =====================================================================

const MAP_BUBBLE_MS = 12000;   // cuánto se queda la burbuja en pantalla
const bubbleTimers = {};       // clave -> timeout que la retira

function showMapBubble(key, marker, name, text, mine) {
  if (!marker || !leafletMap) return;

  const html = `
    <div class="map-bubble-name">${escapeAttr(name)}</div>
    <div class="map-bubble-text">${escapeAttr(text)}</div>`;

  marker.unbindTooltip();
  marker.bindTooltip(html, {
    permanent: true,
    direction: "top",
    offset: [0, mine ? -12 : -16],
    className: "map-chat-bubble" + (mine ? " mine" : ""),
    interactive: false,
  }).openTooltip();

  clearTimeout(bubbleTimers[key]);
  bubbleTimers[key] = setTimeout(() => {
    marker.unbindTooltip();
    delete bubbleTimers[key];
  }, MAP_BUBBLE_MS);
}

// Mi propio mensaje, sobre mi punto azul.
function showMapBubbleForMe(text) {
  ensureMap();
  renderMapMarkers();          // asegura que meMarker exista y esté al día
  showMapBubble("me", meMarker, "Tú", text, true);
}

// Mensaje de otra persona, sobre su marcador.
function showMapBubbleForUser(userId, text) {
  showMapBubble(userId, userMarkers[userId], nameFor(userId), text, false);
}

function openMapPopup(userId) {
  state.mapPopupUser = userId;
  render();
}

function closeMapPopup() {
  state.mapPopupUser = null;
  render();
}

function centerOnMe() {
  if (!state.coords) { toast("Activa tu ubicación primero."); return; }
  const map = ensureMap();
  if (map) map.setView([state.coords.lat, state.coords.lng], 16);
  toast("Ubicación actualizada");
}
