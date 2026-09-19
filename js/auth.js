function goAuth(mode) {
  state.screen = "auth";
  state.authMode = mode || "login";
  state.authError = "";
  render();
}

function switchAuthMode(mode) {
  state.authMode = mode;
  state.authError = "";
  render();
}

function togglePasswordVisibility() {
  state.showPassword = !state.showPassword;
  render();
}

async function attemptLogin() {
  const email = state.loginEmail.trim();
  const password = state.loginPassword;

  if (!email || !password) {
    state.authError = "Ingresa tu correo y tu contraseña.";
    render();
    return;
  }
  if (!isValidEmail(email)) {
    state.authError = "Ese correo no parece válido.";
    render();
    return;
  }

  state.authLoading = true;
  state.authError = "";
  render();

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  state.authLoading = false;

  if (error) {
    state.authError = humanizeError(error);
    render();
    return;
  }

  await onAuthenticated(data.session);
}

async function attemptRegister() {
  const name = state.registerName.trim();
  const email = state.registerEmail.trim();
  const password = state.registerPassword;
  const password2 = state.registerPassword2;

  if (!name) { state.authError = "Ingresa tu nombre."; render(); return; }
  if (!isValidEmail(email)) { state.authError = "Ese correo no parece válido."; render(); return; }
  if (password.length < 6) { state.authError = "La contraseña debe tener al menos 6 caracteres."; render(); return; }
  if (password !== password2) { state.authError = "Las contraseñas no coinciden."; render(); return; }

  state.authLoading = true;
  state.authError = "";
  render();

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  state.authLoading = false;

  if (error) {
    state.authError = humanizeError(error);
    render();
    return;
  }

  if (!data.session) {
    // Confirmación de correo activada
    state.authMode = "login";
    showBanner("Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.");
    render();
    return;
  }

  await onAuthenticated(data.session);
}

async function onAuthenticated(session) {
  state.session = session;

  
  let profile = null;
  for (let i = 0; i < 5 && !profile; i++) {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    if (data) profile = data;
    else await new Promise((r) => setTimeout(r, 400));
  }

  if (!profile) {
    state.authError = "No se pudo cargar tu perfil. Intenta de nuevo.";
    render();
    return;
  }

  state.me = profile;
  state.profiles[profile.id] = profile;

  await setMyStatus("online");
  state.screen = "gate";
  render();

  await initRealtimeSubscriptions();
  await loadInitialData();
}

async function setMyStatus(status) {
  if (!state.me) return;
  state.me.status = status;
  await sb.from("profiles").update({ status, last_seen: new Date().toISOString() }).eq("id", state.me.id);
}

function toggleMenu() {
  state.menuOpen = !state.menuOpen;
  state.menuConfirmLogout = false;
  render();
}

function askLogout() {
  state.menuConfirmLogout = true;
  render();
}

function cancelLogout() {
  state.menuConfirmLogout = false;
  render();
}

async function confirmLogout() {
  
  stopWatchingLocation();
  if (state.sharingEnabled) {
    await sb.from("locations").update({ sharing_enabled: false }).eq("user_id", state.me.id);
  }
  await setMyStatus("offline");
  await sb.removeAllChannels();
  await sb.auth.signOut();

  Object.assign(state, {
    screen: "logout",
    session: null,
    me: null,
    coords: null,
    locationStatus: "idle",
    sharingEnabled: false,
    profiles: {},
    locations: {},
    directChats: {},
    groups: [],
    groupMessages: {},
    broadcastAll: [],
    broadcastNear: [],
    openThread: null,
    menuOpen: false,
    menuConfirmLogout: false,
  });
  render();
}

function restartApp() {
  state.screen = "auth";
  state.authMode = "login";
  state.loginEmail = "";
  state.loginPassword = "";
  state.authError = "";
  state.activeTab = "mapa";
  render();
}

function goGate() {
  state.screen = "gate";
  render();
}

function enterApp() {
  state.screen = "app";
  render();
}

// Restaurar sesión al recargar la página.
// El splash NO se abandona solo: se queda hasta que el usuario pulse "Comenzar".
async function restoreSessionIfAny() {
  const onSplash = state.screen === "splash";

  let next = "auth";
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      await onAuthenticated(data.session);   // esto deja screen en "gate"
      next = state.coords ? "app" : "gate";
    }
  } catch (err) {
    // Sin conexión o sesión inválida: se entra por el login normal.
    console.warn("No se pudo restaurar la sesión:", err);
    next = "auth";
  }

  state.bootChecked = true;

  if (onSplash && !state.splashBusy) {
    state.pendingScreen = next;
    state.screen = "splash";
    render();
    return;
  }

  state.splashBusy = false;
  state.pendingScreen = null;
  state.screen = next;
  render();
}

// Botón "Comenzar" del splash: única salida de la pantalla de inicio.
function startFromSplash() {
  if (!state.bootChecked) {     // aún revisando la sesión: avanzamos al terminar
    state.splashBusy = true;
    render();
    return;
  }
  const next = state.pendingScreen || "auth";
  state.pendingScreen = null;
  state.splashBusy = false;
  if (next === "auth") { goAuth("login"); return; }
  state.screen = next;
  render();
}
