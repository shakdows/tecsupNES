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
    // Usamos CARTO en vez del tile server "crudo" de OpenStreetMap: el de
    // OSM está pensado para uso muy bajo/no comercial y bloquea apps como
    // esta ("Access blocked"). CARTO usa los mismos datos de OpenStreetMap
    // pero sirve los tiles de forma pensada para producción, sin API key.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(leafletMap);
  } else {
    // Reasignar a un nuevo contenedor si el DOM fue re-renderizado
    leafletMap.invalidateSize();
  }
  mapMounted = true;
  return leafletMap;
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
