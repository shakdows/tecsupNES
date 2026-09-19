let notifPermissionAsked = false;

async function ensureNotificationPermission() {
  if (!("Notification" in window) || notifPermissionAsked) return;
  notifPermissionAsked = true;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (e) { /* no-op */ }
  }
}

function notifyIncoming({ title, text, color, initialsTxt }) {
  showFloatingNotification({ title, text, color, initialsTxt });

  if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
    try {
      new Notification("N.E.S. · " + title, { body: text });
    } catch (e) { }
  }
}

function showFloatingNotification({ color, initialsTxt, title, text }) {
  const el = document.getElementById("floatingNotif");
  if (!el) return;
  el.innerHTML = `
    <div class="notif-card">
      <div class="avatar avatar-sm" style="background:${color};">${initialsTxt}</div>
      <div class="notif-body">
        <div class="notif-top"><b>${escapeAttr(title)}</b><span>${timeNow()}</span></div>
        <div class="notif-text">${escapeAttr(text)}</div>
      </div>
    </div>`;
  el.classList.add("show");
  clearTimeout(window.__notifT);
  window.__notifT = setTimeout(() => el.classList.remove("show"), 4200);
}

// Burbuja flotante temporal
function showMapBubbleForUser(userId, text) {
  const marker = userMarkers[userId];
  if (!marker || !leafletMap) return;
  const popup = L.popup({ closeButton: false, className: "map-chat-bubble-popup", offset: [0, -10] })
    .setLatLng(marker.getLatLng())
    .setContent(`<div style="font-size:12px; max-width:160px;">${escapeAttr(text)}</div>`)
    .openOn(leafletMap);
  setTimeout(() => leafletMap.closePopup(popup), 4200);
}
