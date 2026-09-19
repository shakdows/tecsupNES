// =====================================================================
// Renderizado principal — misma identidad visual de block.html,
// conectado por completo a datos reales.
// =====================================================================

function pinSVG(color) {
  return `<svg viewBox="0 0 24 24" fill="none">
    <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z" fill="${color || "#00E5FF"}"/>
    <circle cx="12" cy="10" r="3" fill="#0B1E36"/>
  </svg>`;
}

function switchTab(tab) {
  state.activeTab = tab;
  state.openThread = null;
  render();
  if (tab === "mapa") setTimeout(() => { ensureMap(); renderMapMarkers(); }, 0);
}

// ---------------- SPLASH ----------------
function renderSplash() {
  return `
    <div class="splash">
      <div class="splash-phrase">"Encuentra. Comunica. Reúne."</div>
      <div class="logo-frame">
        <div class="logo-fallback">N.E.S.</div>
      </div>
      <h1 class="brand">N.E.S.</h1>
      <p class="tagline">Mensajería geolocalizada en tiempo real. Encuentra a tu gente, exactamente donde está.</p>
      <button class="btn btn-primary btn-block" style="max-width:220px;" onclick="goAuth('login')">Comenzar</button>
    </div>`;
}

// ---------------- AUTH (login / registro real) ----------------
function renderAuth() {
  if (state.authMode === "register") return renderRegister();

  return `
    <div class="login">
      <h2 class="serif">Inicia sesión</h2>
      <p class="tagline">Ingresa con tu correo para coordinar tus puntos de encuentro.</p>
      ${state.authError ? `<div class="login-error">${escapeAttr(state.authError)}</div>` : ""}
      <div class="field-group">
        <label class="field-label">Correo electrónico</label>
        <div class="field-wrap">
          <input type="email" placeholder="nombre@correo.com" autocomplete="email"
            value="${escapeAttr(state.loginEmail)}"
            oninput="state.loginEmail=this.value"
            onkeydown="if(event.key==='Enter'){attemptLogin()}" />
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Contraseña</label>
        <div class="field-wrap has-toggle">
          <input type="${state.showPassword ? "text" : "password"}" placeholder="Tu contraseña" autocomplete="current-password"
            value="${escapeAttr(state.loginPassword)}"
            oninput="state.loginPassword=this.value"
            onkeydown="if(event.key==='Enter'){attemptLogin()}" />
          <button class="field-toggle" type="button" onclick="togglePasswordVisibility()">${state.showPassword ? "Ocultar" : "Ver"}</button>
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="attemptLogin()" ${state.authLoading ? "disabled" : ""} style="margin-top:6px;">
        ${state.authLoading ? "Ingresando…" : "Ingresar"}
      </button>
      <div class="auth-switch">¿No tienes cuenta? <a onclick="switchAuthMode('register')">Regístrate</a></div>
    </div>`;
}

function renderRegister() {
  return `
    <div class="login">
      <h2 class="serif">Crea tu cuenta</h2>
      <p class="tagline">Regístrate para empezar a coordinar puntos de encuentro reales.</p>
      ${state.authError ? `<div class="login-error">${escapeAttr(state.authError)}</div>` : ""}
      <div class="field-group">
        <label class="field-label">Nombre</label>
        <div class="field-wrap">
          <input type="text" placeholder="Tu nombre" value="${escapeAttr(state.registerName)}" oninput="state.registerName=this.value" />
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Correo electrónico</label>
        <div class="field-wrap">
          <input type="email" placeholder="nombre@correo.com" value="${escapeAttr(state.registerEmail)}" oninput="state.registerEmail=this.value" />
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Contraseña</label>
        <div class="field-wrap">
          <input type="password" placeholder="Mínimo 6 caracteres" value="${escapeAttr(state.registerPassword)}" oninput="state.registerPassword=this.value" />
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Confirmar contraseña</label>
        <div class="field-wrap">
          <input type="password" placeholder="Repite tu contraseña" value="${escapeAttr(state.registerPassword2)}" oninput="state.registerPassword2=this.value"
            onkeydown="if(event.key==='Enter'){attemptRegister()}" />
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="attemptRegister()" ${state.authLoading ? "disabled" : ""} style="margin-top:6px;">
        ${state.authLoading ? "Creando cuenta…" : "Registrarme"}
      </button>
      <div class="auth-switch">¿Ya tienes cuenta? <a onclick="switchAuthMode('login')">Inicia sesión</a></div>
    </div>`;
}

// ---------------- GATE (permiso de ubicación) ----------------
function renderGate() {
  const statusMap = {
    idle: "",
    pending: `<div class="gate-status status-pending">Solicitando acceso…</div>`,
    ok: `<div class="gate-status status-ok">Ubicación activa ✓</div>`,
    denied: `<div class="gate-status status-denied">Permiso denegado. Actívalo en la configuración del navegador.</div>`,
    unsupported: `<div class="gate-status status-denied">Tu navegador no soporta geolocalización.</div>`,
  };
  return `
    <div class="gate">
      <div class="pin-graphic">${pinSVG("#0072FF")}</div>
      <h2 class="serif">Activa tu ubicación</h2>
      <p>N.E.S. necesita tu ubicación real para mostrarte en el mapa y conectarte con personas cerca de ti. Se actualiza en tiempo real mientras usas la app.</p>
      ${statusMap[state.locationStatus] || ""}
      <button class="btn btn-primary btn-block" style="max-width:240px; margin-top:8px;" onclick="requestLocation()">
        Permitir ubicación
      </button>
      ${state.locationStatus === "ok" ? `<button class="btn btn-ghost btn-block" style="max-width:240px;" onclick="enterApp()">Continuar</button>` : ""}
      ${state.locationStatus === "denied" ? `<button class="btn btn-ghost btn-block" style="max-width:240px;" onclick="enterApp()">Continuar sin ubicación</button>` : ""}
    </div>`;
}

// ---------------- LOGOUT ----------------
function renderLogout() {
  return `
    <div class="splash">
      <div class="logo-frame"><div class="logo-fallback">N.E.S.</div></div>
      <h1 class="brand">Sesión cerrada</h1>
      <div class="splash-phrase">"Mantente humilde"</div>
      <p class="tagline">Gracias por usar N.E.S. Vuelve cuando quieras coordinar tu próximo punto de encuentro.</p>
      <button class="btn btn-primary btn-block" onclick="restartApp()" style="margin-top:12px; max-width:220px;">Volver a iniciar sesión</button>
    </div>`;
}

// ---------------- TOPBAR ----------------
function renderTopbar() {
  const me = state.me;
  const connLabel = { online: "Conectado", connecting: "Conectando…", offline: "Sin conexión" }[state.connStatus];
  return `
    <div class="conn-banner ${state.connStatus}">${connLabel}</div>
    <div class="topbar" style="position:relative;">
      <div class="brand serif">N.E.S.</div>
      <div class="me" style="position:relative; cursor:pointer;" onclick="toggleMenu()">
        <div style="position:relative;">
          <div class="avatar" style="background:${me.avatar_color};">${initials(me.name)}</div>
          <div class="me-status-dot" style="background:${me.status === "online" ? "var(--moss)" : "rgba(255,255,255,0.3)"};"></div>
        </div>
        ${renderProfileMenu()}
      </div>
    </div>
    ${state.banner ? `<div class="err-banner">${escapeAttr(state.banner)}</div>` : ""}
    <div class="tabs">
      <button class="tab ${state.activeTab === "mapa" ? "active" : ""}" onclick="switchTab('mapa')">Mapa</button>
      <button class="tab ${state.activeTab === "chats" ? "active" : ""}" onclick="switchTab('chats')">Chats</button>
      <button class="tab ${state.activeTab === "groups" ? "active" : ""}" onclick="switchTab('groups')">Grupos</button>
      <button class="tab ${state.activeTab === "broadcast" ? "active" : ""}" onclick="switchTab('broadcast')">Difusión</button>
    </div>`;
}

function renderProfileMenu() {
  if (!state.menuOpen) return "";
  if (state.menuConfirmLogout) {
    return `
      <div class="profile-menu" onclick="event.stopPropagation()">
        <p class="menu-confirm-text">¿Seguro que quieres cerrar sesión? Dejarás de compartir tu ubicación y de recibir mensajes hasta que vuelvas a entrar.</p>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="cancelLogout()">Cancelar</button>
          <button class="menu-logout" style="flex:1;" onclick="confirmLogout()">Cerrar sesión</button>
        </div>
      </div>`;
  }
  return `
    <div class="profile-menu" onclick="event.stopPropagation()">
      <div class="menu-title">${escapeAttr(state.me.name)}</div>
      <div style="font-size:11px; color:rgba(255,255,255,0.5); margin-bottom:10px;">${escapeAttr(state.me.email)}</div>
      <div class="menu-title">Compartir ubicación</div>
      <div class="menu-status-row" style="margin-bottom:10px;">
        <button class="tab ${state.sharingEnabled ? "active" : ""}" style="flex:1;" onclick="toggleSharing()">${state.sharingEnabled ? "Activada" : "Desactivada"}</button>
      </div>
      <div class="menu-title">Radio de visibilidad</div>
      <div class="radius-row" style="padding:0 0 10px 0;">
        ${RADIUS_OPTIONS_M.map((m) => `<button class="radius-pill ${state.radiusM === m ? "active" : ""}" onclick="setRadius(${m})">${fmtRadius(m)}</button>`).join("")}
      </div>
      <div class="menu-divider"></div>
      <button class="menu-logout" onclick="askLogout()">Cerrar sesión</button>
    </div>`;
}

// ---------------- MAPA ----------------
function renderMap() {
  const near = nearbyUsers();
  return `
    <div class="map-tab">
      <div class="map-wrap" onclick="closeMapPopup()">
        <div id="leafletMapSlot" style="position:absolute; inset:0;"></div>
        ${state.locationStatus !== "ok" ? `
          <div class="map-popup" style="left:50%; bottom:auto; top:50%; transform:translate(-50%,-50%);">
            <div>
              <div style="font-size:13px; font-weight:600;">Activa tu ubicación para aparecer en el mapa.</div>
              <button class="btn btn-primary" style="margin-top:8px; padding:7px 12px; font-size:11.5px;" onclick="requestLocation()">Permitir ubicación</button>
            </div>
          </div>` : `<div class="map-locate" onclick="event.stopPropagation(); centerOnMe()">◎</div>`}
      </div>
      <div class="nearby-banner"><span class="live-dot"></span>${near.length} persona${near.length === 1 ? "" : "s"} cercana${near.length === 1 ? "" : "s"} usando N.E.S. ahora (radio ${fmtRadius(state.radiusM)})</div>
      ${state.mapPopupUser ? renderMapPopupCard() : ""}

      <div class="map-chat-panel">
        <div class="map-chat-head">
          <span class="map-chat-title">Chat del mapa</span>
          <span class="map-chat-hint">Solo lo ven quienes están cerca de ti</span>
        </div>
        <div class="map-chat-msgs" id="mapChatMsgs">${renderMapChatRows()}</div>
        <div class="composer">
          <input type="text" id="mapComposerInput" placeholder="Mensaje para tus cercanos…"
            onkeydown="if(event.key==='Enter'){sendMapMessage(this.value); this.value='';}" />
          <button class="send-btn" onclick="const i=document.getElementById('mapComposerInput'); sendMapMessage(i.value); i.value='';" title="Enviar al mapa">➤</button>
        </div>
      </div>
    </div>`;
}

function renderMapPopupCard() {
  const u = state.profiles[state.mapPopupUser];
  if (!u) return "";
  const loc = state.locations[u.id];
  const dist = state.coords && loc ? fmtDist(distanceKm(state.coords, loc)) : "";
  return `
    <div class="map-popup" onclick="event.stopPropagation()">
      <div class="avatar" style="background:${u.avatar_color};">${initials(u.name)}</div>
      <div>
        <div style="font-size:13px; font-weight:600;">${escapeAttr(u.name)}</div>
        <div style="font-size:11px; color:rgba(255,255,255,0.7);">${u.status === "online" ? "En línea" + (dist ? " · " + dist : "") : "Últ. vez " + fmtTime(u.last_seen)}</div>
      </div>
      <button class="btn btn-primary" style="padding:7px 12px; font-size:11.5px;" onclick="openThread('direct','${u.id}')">Chat</button>
    </div>`;
}

function renderMapChatRows() {
  if (!state.broadcastNear.length) {
    return `<div class="map-chat-empty">Aún no hay mensajes en el mapa.<br/>Escribe algo abajo y lo verán quienes estén cerca de ti.</div>`;
  }
  const visible = state.broadcastNear.filter((m) => {
    if (m.sender_id === state.me.id) return true;
    if (!state.coords || m.latitude == null) return false;
    return (distanceKm(state.coords, { lat: m.latitude, lng: m.longitude }) * 1000) <= state.radiusM;
  });
  if (!visible.length) return `<div class="map-chat-empty">Nadie cerca de ti ha escrito todavía.</div>`;

  return visible.map((m) => {
    const isMine = m.sender_id === state.me.id;
    const dist = !isMine && state.coords && m.latitude != null ? fmtDist(distanceKm(state.coords, { lat: m.latitude, lng: m.longitude })) : "";
    return `
      <div class="map-msg-row">
        <div class="avatar avatar-sm" style="background:${colorFor(m.sender_id)};">${initials(nameFor(m.sender_id))}</div>
        <div class="map-msg-body">
          <div class="map-msg-top">
            <span class="map-msg-name">${isMine ? "Tú" : escapeAttr(nameFor(m.sender_id))}</span>
            ${dist ? `<span class="map-msg-dist">${dist}</span>` : ""}
            <span class="map-msg-time">${fmtTime(m.created_at)}</span>
          </div>
          <div class="map-msg-text">${escapeAttr(m.text)}</div>
        </div>
      </div>`;
  }).join("");
}

// ---------------- CHATS (lista) ----------------
function renderChatsList() {
  const near = nearbyUsers();
  const banner = state.coords
    ? `<div class="nearby-banner"><span class="live-dot"></span>${near.length} persona${near.length === 1 ? "" : "s"} cercana${near.length === 1 ? "" : "s"} usando N.E.S. ahora</div>`
    : "";

  const others = Object.values(state.profiles).filter((p) => p.id !== state.me.id);
  if (!others.length) {
    return `<div class="view">${banner}<div class="empty">Aún no hay otras personas registradas en N.E.S.<br/>Invita a alguien a crear una cuenta.</div></div>`;
  }

  const rows = others.map((u) => {
    const msgs = state.directChats[u.id] || [];
    const last = msgs[msgs.length - 1];
    const loc = state.locations[u.id];
    const dist = state.coords && loc && loc.sharing_enabled && u.status === "online" ? " · " + fmtDist(distanceKm(state.coords, loc)) : "";
    const online = u.status === "online";
    return `
      <div class="list-item" onclick="openThread('direct','${u.id}')">
        <div class="avatar-live">
          ${online ? '<div class="pulse-ring"></div>' : ""}
          <div class="avatar" style="background:${u.avatar_color};">${initials(u.name)}</div>
          ${online ? '<div class="live-badge"></div>' : ""}
        </div>
        <div>
          <div class="name">${escapeAttr(u.name)}</div>
          <div class="status-line ${online ? "on" : ""}">${online ? "● En línea" + dist : "Últ. vez " + fmtTime(u.last_seen)}</div>
          <div class="preview">${last ? (last.latitude != null ? "📍 " + (last.text || "Ubicación") : escapeAttr(last.text)) : "Sin mensajes aún"}</div>
        </div>
        <div class="list-meta">${last ? fmtTime(last.created_at) : ""}</div>
      </div>`;
  }).join("");

  return `<div class="view">${banner}${rows}</div>`;
}

// ---------------- GRUPOS ----------------
function renderGroupsList() {
  const cards = state.groups.map((g) => {
    const members = (g.members || []).map((id) => state.profiles[id]).filter(Boolean);
    return `
      <div class="card" onclick="openThread('group','${g.id}')" style="cursor:pointer;">
        <div style="font-weight:600; font-size:14px;">${escapeAttr(g.name)}</div>
        <div style="font-size:11.5px; color:rgba(255,255,255,0.6); margin-top:2px;">${members.length} integrantes</div>
        <div class="members-row">${members.map((m) => `<div class="avatar avatar-sm" style="background:${m.avatar_color};">${initials(m.name)}</div>`).join("")}</div>
      </div>`;
  }).join("");

  const others = Object.values(state.profiles).filter((p) => p.id !== state.me.id);

  const form = state.groupFormOpen ? `
    <div class="new-group-form">
      <input type="text" placeholder="Nombre del grupo" value="${escapeAttr(state.newGroupName)}" oninput="state.newGroupName=this.value" />
      <div>
        ${others.map((u) => `
          <div class="pick-row">
            <div class="avatar avatar-sm" style="background:${u.avatar_color};">${initials(u.name)}</div>
            <label>${escapeAttr(u.name)}</label>
            <input type="checkbox" ${state.newGroupPicks.includes(u.id) ? "checked" : ""} onchange="togglePick('${u.id}')" />
          </div>`).join("")}
      </div>
      <div class="form-hint ${state.newGroupPicks.length < 2 ? "err" : "ok"}">
        ${state.newGroupPicks.length + 1}/3 mínimo (incluyéndote) ${state.newGroupPicks.length < 2 ? "· elige al menos 2 personas más" : "· listo para crear"}
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="closeGroupForm()">Cancelar</button>
        <button class="btn btn-primary" style="flex:1;" onclick="createGroup()" ${state.newGroupPicks.length < 2 ? "disabled" : ""}>Crear grupo</button>
      </div>
    </div>` : `
    <div class="section-pad" style="padding:14px 18px;">
      <button class="btn btn-primary btn-block" onclick="openGroupForm()">+ Crear grupo (mínimo 3 personas)</button>
    </div>`;

  return `<div class="view">
      ${form}
      ${state.groups.length ? `<div class="section-title" style="padding:0 18px;">Tus grupos</div>${cards}` : (state.groupFormOpen ? "" : `<div class="empty">Aún no tienes grupos.<br/>Se necesitan mínimo 3 integrantes para crear uno.</div>`)}
    </div>`;
}

// ---------------- DIFUSIÓN ----------------
function renderBroadcastList() {
  const msgs = state.broadcastAll.map((m) => {
    const isMine = m.sender_id === state.me.id;
    return `
      <div class="bubble-row ${isMine ? "mine" : "theirs"}" style="align-self:flex-start; max-width:88%;">
        ${!isMine ? `<div class="bubble-sender">${escapeAttr(nameFor(m.sender_id))}</div>` : ""}
        <div class="bubble" style="background:${isMine ? "#0072FF" : "var(--surface-2)"}; color:#FFFFFF;">${escapeAttr(m.text)}</div>
        <div><span class="bubble-time">${fmtTime(m.created_at)}</span></div>
      </div>`;
  }).join("");

  return `
    <div class="view thread">
      <div class="broadcast-banner">Envía un mensaje aquí y llega como notificación a todos los usuarios o solo a las personas más cercanas a ti.</div>
      <div class="scope-row">
        <span class="scope-label">Notificar a:</span>
        <button class="scope-pill ${state.notifyScope === "todos" ? "active" : ""}" onclick="setScope('todos')">Todos</button>
        <button class="scope-pill ${state.notifyScope === "cercanos" ? "active" : ""}" onclick="setScope('cercanos')">Cercanos (&lt;${fmtRadius(state.radiusM)})</button>
      </div>
      <div class="thread-msgs">${msgs || `<div class="empty">Aún no hay mensajes de difusión.</div>`}</div>
      ${renderComposer()}
    </div>`;
}

// ---------------- HILO (chat directo / grupo) ----------------
function renderComposer() {
  return `
    <div class="composer">
      <button class="icon-btn ${state.composerLoc ? "on" : ""}" onclick="toggleLocAttach()" title="Adjuntar mi ubicación actual">
        ${pinSVG(state.composerLoc ? "#FFFFFF" : "#00E5FF")}
      </button>
      <input type="text" placeholder="Escribe un mensaje…" value="${escapeAttr(state.composerText)}"
        oninput="state.composerText=this.value"
        onkeydown="if(event.key==='Enter'){sendMessage()}" />
      <button class="send-btn" onclick="sendMessage()">➤</button>
    </div>`;
}

function renderPinCard(lat, lng) {
  return `
    <div class="pin-card">
      <div class="pin-map">${pinSVG("#00E5FF")}</div>
      <div class="pin-label"><b>Ubicación compartida</b>${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
    </div>`;
}

function renderThread() {
  const t = state.openThread;
  if (t === "broadcast" || t.type === "broadcast") return renderBroadcastList();

  let title, subtitle, msgs;
  if (t.type === "group") {
    const g = state.groups.find((g) => g.id === t.id);
    title = g ? g.name : "Grupo";
    subtitle = g ? (g.members || []).length + " integrantes" : "";
    msgs = state.groupMessages[t.id] || [];
  } else {
    const u = state.profiles[t.id];
    title = u ? u.name : "Usuario";
    subtitle = u ? (u.status === "online" ? "En línea" : "Últ. vez " + fmtTime(u.last_seen)) : "";
    msgs = state.directChats[t.id] || [];
  }

  const bubbles = msgs.map((m) => {
    const isMine = m.sender_id === state.me.id;
    return `
      <div class="bubble-row ${isMine ? "mine" : "theirs"}">
        ${!isMine && t.type === "group" ? `<div class="bubble-sender">${escapeAttr(nameFor(m.sender_id))}</div>` : ""}
        <div class="bubble">${escapeAttr(m.text)}</div>
        ${m.latitude != null ? renderPinCard(m.latitude, m.longitude) : ""}
        <div class="bubble-time">${fmtTime(m.created_at)}${isMine && m.read_at ? ` <span class="read-tick read">✓✓</span>` : isMine ? ` <span class="read-tick">✓</span>` : ""}</div>
      </div>`;
  }).join("");

  return `
    <div class="view thread">
      <div class="thread-head">
        <button class="back" onclick="closeThread()">←</button>
        <div>
          <div style="font-weight:600; font-size:14px;">${escapeAttr(title)}</div>
          <div class="thread-sub ${subtitle.startsWith("En línea") ? "on" : ""}">${escapeAttr(subtitle)}</div>
        </div>
      </div>
      <div class="thread-msgs">${bubbles || `<div class="empty">Aún no hay mensajes. Di algo o comparte tu punto de encuentro.</div>`}</div>
      ${renderComposer()}
    </div>`;
}

// ---------------- ROUTER PRINCIPAL ----------------
function render() {
  const root = document.getElementById("root");
  if (!root) return;

  if (state.screen === "splash") { root.innerHTML = renderSplash(); return; }
  if (state.screen === "auth") { root.innerHTML = renderAuth(); return; }
  if (state.screen === "gate") { root.innerHTML = renderGate(); return; }
  if (state.screen === "logout") { root.innerHTML = renderLogout(); return; }

  if (!state.me) { root.innerHTML = `<div class="loading-inline">Cargando…</div>`; return; }

  let body;
  if (state.openThread) {
    body = renderThread();
  } else if (state.activeTab === "mapa") {
    body = renderMap();
  } else if (state.activeTab === "chats") {
    body = renderChatsList();
  } else if (state.activeTab === "groups") {
    body = renderGroupsList();
  } else if (state.activeTab === "broadcast") {
    state.openThread = "broadcast";
    body = renderBroadcastList();
  }
  root.innerHTML = renderTopbar() + body;

  if (state.activeTab === "mapa" && !state.openThread) {
    setTimeout(() => { ensureMap(); renderMapMarkers(); }, 0);
  }
}

// ---------------- ARRANQUE ----------------
(async function boot() {
  render();
  await ensureNotificationPermission();
  await restoreSessionIfAny();
})();
