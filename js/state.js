const DEFAULT_RADIUS_M = 1000; 
const RADIUS_OPTIONS_M = [100, 500, 1000, 2000, 5000];

const state = {
  screen: "splash",        
  bootChecked: false,      // ya se revisó si había sesión guardada
  pendingScreen: null,     // pantalla destino al pulsar "Comenzar"
  splashBusy: false,       // se pulsó "Comenzar" antes de terminar la revisión

  authMode: "login",       
  session: null,           
  me: null,                

  connStatus: "connecting", 

  locationStatus: "idle",  // idle | pending | ok | denied | unsupported
  coords: null,             // {lat,lng,accuracy} reales de watchPosition
  sharingEnabled: false,
  sharingChoiceMade: false, // true si el usuario tocó el interruptor a mano
  radiusM: DEFAULT_RADIUS_M,
  watchId: null,

  activeTab: "mapa",        // mapa | chats | groups | broadcast
  openThread: null,         // {type:'direct',id} | {type:'group',id} | 'broadcast'
  mapPopupUser: null,

  profiles: {},              // id -> profile (todos los perfiles conocidos)
  locations: {},              // user_id -> {latitude, longitude, accuracy, sharing_enabled, updated_at}
  directChats: {},            // otherUserId -> [messages] (orden asc)
  groups: [],                 // [{id,name,owner_id,members:[...]}]
  groupMessages: {},          // groupId -> [messages]
  broadcastAll: [],
  broadcastNear: [],          // también usados como chat del mapa (scope 'geo')

  composerText: "",
  mapComposerText: "",       // texto del chat del mapa
  composerLoc: false,
  notifyScope: "todos",       // todos | cercanos

  newGroupName: "",
  newGroupPicks: [],
  groupFormOpen: false,

  menuOpen: false,
  menuConfirmLogout: false,

  loginEmail: "",
  loginPassword: "",
  registerName: "",
  registerEmail: "",
  registerPassword: "",
  registerPassword2: "",
  authError: "",
  authLoading: false,
  showPassword: false,

  banner: "", // error no técnico visible temporalmente
};

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function timeNow() {
  const d = new Date();
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

// Distancia real por fórmula de Haversine — nunca offsets inventados.
function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat ?? b.latitude) - (a.lat ?? a.latitude)) * Math.PI / 180;
  const dLng = ((b.lng ?? b.longitude) - (a.lng ?? a.longitude)) * Math.PI / 180;
  const lat1 = (a.lat ?? a.latitude) * Math.PI / 180;
  const lat2 = (b.lat ?? b.latitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtDist(km) {
  if (!isFinite(km)) return "";
  return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km";
}

function fmtRadius(m) {
  return m < 1000 ? m + " m" : (m / 1000) + " km";
}

function escapeAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function colorFor(userId) {
  const p = state.profiles[userId];
  return (p && p.avatar_color) || "#0072FF";
}

function nameFor(userId) {
  const p = state.profiles[userId];
  return (p && p.name) || "Usuario";
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.classList.remove("show"), 2600);
}

function showBanner(msg) {
  state.banner = msg;
  render();
  clearTimeout(window.__bannerT);
  window.__bannerT = setTimeout(() => { state.banner = ""; render(); }, 4000);
}

// Traduce errores técnicos de Supabase a mensajes claros para el usuario (req. #27)
function humanizeError(err) {
  const msg = (err && err.message) || String(err || "");
  if (/Invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/User already registered/i.test(msg)) return "Ya existe una cuenta con ese correo.";
  if (/Email not confirmed/i.test(msg)) return "Confirma tu correo antes de ingresar (revisa tu bandeja de entrada).";
  if (/network|fetch/i.test(msg)) return "No hay conexión con el servidor. Verifica tu Internet.";
  if (/JWT|permission|RLS|policy/i.test(msg)) return "No tienes permiso para realizar esta acción.";
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  return "Ocurrió un problema. Inténtalo de nuevo.";
}
