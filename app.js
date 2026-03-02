// =====================
// CONFIG SUPABASE
// =====================
const SUPABASE_URL = "https://zapoxyrmeoqukshjzgki.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qYDfuLHeUz6Uy3Vy5t8mFA_QfXbMU9v";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

// =====================
// UI Helpers
// =====================
function showAlert(msg, type="info") {
  const el = $("alert");
  el.classList.remove("hidden");
  el.textContent = msg;

  el.className = "mb-4 p-3 rounded border text-sm";
  if (type === "error") el.classList.add("bg-red-950/40","border-red-800","text-red-100");
  else if (type === "ok") el.classList.add("bg-emerald-950/40","border-emerald-800","text-emerald-100");
  else el.classList.add("bg-zinc-900","border-zinc-700","text-zinc-100");
}

function hideAlert() {
  $("alert").classList.add("hidden");
  $("alert").textContent = "";
}

function setView(v) {
  ["viewLogin","viewProfile","viewDenied","viewDash"].forEach(id => $(id).classList.add("hidden"));
  $(v).classList.remove("hidden");
}

let __initRunning = false;
let __initQueued = false;

async function safeInit() {
  if (__initRunning) {
    __initQueued = true;
    return;
  }
  __initRunning = true;
  try {
    await init(); // tu init real
  } finally {
    __initRunning = false;
    if (__initQueued) {
      __initQueued = false;
      safeInit();
    }
  }
}

function setBusy(btn, busy, textBusy="Procesando…") {
  if (!btn) return;
  if (!btn.dataset.text) btn.dataset.text = btn.textContent;
  btn.disabled = busy;
  btn.classList.toggle("opacity-60", busy);
  btn.classList.toggle("cursor-not-allowed", busy);
  btn.textContent = busy ? textBusy : btn.dataset.text;
}

// =====================
// Fecha / Saludo
// =====================
function getMonterreyHour(date=new Date()) {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Monterrey",
    hour: "2-digit",
    hour12: false
  }).format(date);

  const h = Number(hourStr);
  return Number.isFinite(h) ? h : date.getHours();
}

function getGreetingByHour(h) {
  if (h >= 5 && h < 12) return "Buenos días";
  if (h >= 12 && h < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Formato: "Dom, 01 Marzo, 2026"
function formatMxHeader(date=new Date()) {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Monterrey",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  let formatted = formatter.format(date);

  // Capitalizar primera letra
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  // Convertir "02 marzo 2026" a "02 de Marzo 2026"
  formatted = formatted.replace(/(\d{2}) (\w+) (\d{4})/, "$1 de $2 $3");

  return formatted;
}

// =====================
// Supabase helpers
// =====================
async function isAdmin() {
  const { data, error } = await supabaseClient.rpc("is_admin");
  if (error) throw error;
  return !!data;
}

async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertProfile(userId, displayName) {
  const { error } = await supabaseClient
    .from("profiles")
    .upsert({ user_id: userId, display_name: displayName }, { onConflict: "user_id" });
  if (error) throw error;
}

async function loadParticipants() {
  const { data, error } = await supabaseClient
    .from("participants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return showAlert(error.message, "error");

  const rows = data || [];
  $("participantsList").innerHTML = rows.map(p => `
    <div class="p-2 bg-zinc-950 border border-zinc-800 rounded">
      <div class="font-semibold">${p.name}</div>
      <div class="text-zinc-400">${p.area || ""} • ${p.whatsapp || ""}</div>
    </div>
  `).join("");
}

async function loadPools() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, round, competition, season, price, commission_pct, created_at")
    .order("created_at", { ascending: false });

  if (error) return showAlert(error.message, "error");

  const rows = data || [];
  const active = rows.find(p => p.status === "open");
  $("activePoolName").textContent = active ? active.name : "—";

  $("poolsList").innerHTML = rows.map(p => {
    const badge =
      p.status === "open" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" :
      p.status === "closed" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" :
      "bg-zinc-700/20 border-zinc-600/30 text-zinc-200";

    const statusLabel =
      p.status === "open" ? "Abierta" :
      p.status === "closed" ? "Cerrada" : "Finalizada";

    return `
      <div class="p-3 bg-zinc-950 border border-zinc-800 rounded">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div class="font-semibold">${p.name}</div>
            <div class="text-xs text-zinc-400">
              $${Number(p.price).toFixed(0)} • Comisión ${Number(p.commission_pct).toFixed(0)}% • ${p.competition} • ${p.season}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-1 rounded-full border ${badge}">${statusLabel}</span>

            ${p.status !== "open" ? `
              <button data-open="${p.id}" class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">
                Marcar activa
              </button>
            ` : `
              <button data-close="${p.id}" class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">
                Cerrar
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // listeners botones
  document.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-open");
      await setPoolOpen(id);
    });
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-close");
      await setPoolClosed(id);
    });
  });
}

async function setPoolOpen(poolId) {
  hideAlert();

  // regla simple: solo 1 abierta
  const { error: closeErr } = await supabaseClient
    .from("pools")
    .update({ status: "closed" })
    .eq("status", "open");

  if (closeErr) return showAlert(closeErr.message, "error");

  const { error } = await supabaseClient
    .from("pools")
    .update({ status: "open" })
    .eq("id", poolId);

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada marcada como activa ✅", "ok");
  loadPools();
}

async function setPoolClosed(poolId) {
  hideAlert();

  const { error } = await supabaseClient
    .from("pools")
    .update({ status: "closed" })
    .eq("id", poolId);

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada cerrada ✅", "ok");
  loadPools();
}

// =====================
// Eventos
// =====================

// Ver / Ocultar contraseña
$("btnTogglePassword").addEventListener("click", () => {
  const inp = $("loginPassword");
  const isHidden = inp.type === "password";
  inp.type = isHidden ? "text" : "password";
  $("btnTogglePassword").textContent = isHidden ? "🙈 Ocultar" : "👁️ Ver";
  inp.focus();
});

// Login
$("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

 showAlert("Intentando login… " + location.href, "ok");
  showAlert("Intentando login…", "ok");

  const btn = $("btnLogin");
  setBusy(btn, true, "Entrando…");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setBusy(btn, false);
    if (error) return showAlert(error.message, "error");
    await safeInit();
  } catch (err) {
    setBusy(btn, false);
    showAlert("Catch: " + (err?.message || err), "error");
  }
});

// Signup temporal
$("toggleSignup").addEventListener("change", (e) => {
  $("btnSignup").classList.toggle("hidden", !e.target.checked);
});

$("btnSignup").addEventListener("click", async () => {
  hideAlert();
  const btn = $("btnSignup");
  setBusy(btn, true, "Creando…");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  try {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    setBusy(btn, false);
    if (error) return showAlert(error.message, "error");
    showAlert("Cuenta creada. Ahora inicia sesión.", "ok");
  } catch (err) {
    setBusy(btn, false);
    showAlert(err?.message || "Error de red/JS al crear cuenta.", "error");
  }
});

// Guardar nombre (profiles)
$("formProfile").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const btn = $("btnSaveProfile");
  setBusy(btn, true, "Guardando…");

  const { data } = await supabaseClient.auth.getUser();
  const userId = data?.user?.id;

  if (!userId) {
    setBusy(btn, false);
    return showAlert("No se detectó usuario. Re-inicia sesión.", "error");
  }

  const displayName = $("displayName").value.trim();

  try {
    await upsertProfile(userId, displayName);
    setBusy(btn, false);
    await safeInit();
  } catch (err) {
    setBusy(btn, false);
    showAlert(err?.message || "Error guardando nombre.", "error");
  }
});

// Participantes: insertar
$("formParticipant").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const name = $("pName").value.trim();
  const area = $("pArea").value.trim();
  const whatsapp = $("pWhatsapp").value.trim();

  const { error } = await supabaseClient
    .from("participants")
    .insert({ name, area, whatsapp });

  if (error) return showAlert(error.message, "error");

  $("pName").value = "";
  $("pArea").value = "";
  $("pWhatsapp").value = "";

  loadParticipants();
});

// Jornadas: insertar
$("formPool").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const round = Number($("poolRound").value);
  const competition = $("poolCompetition").value.trim() || "Liga MX";
  const season = $("poolSeason").value.trim() || "Clausura 2026";
  const price = Number($("poolPrice").value || 20);
  const commission_pct = Number($("poolCommission").value || 15);

  const name = `Jornada ${round} - ${competition} - ${season}`;

  const { error } = await supabaseClient.from("pools").insert({
    round, competition, season, name, price, commission_pct, status: "open"
  });

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada creada ✅", "ok");
  $("poolRound").value = "";
  loadPools();
});

// Logout
$("btnSignOut").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  $("btnSignOut").classList.add("hidden");
  setView("viewLogin");
});

$("btnDeniedSignOut").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  $("btnSignOut").classList.add("hidden");
  setView("viewLogin");
});

// =====================
// Init
// =====================
supabaseClient.auth.onAuthStateChange(() => safeInit());

async function init() {
  hideAlert();

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const session = sessionData.session;

  if (!session) {
    $("btnSignOut").classList.add("hidden");
    setView("viewLogin");
    return;
  }

  $("btnSignOut").classList.remove("hidden");

  // Admin
  let admin = false;
  try {
    admin = await isAdmin();
  } catch (e) {
    showAlert("No se pudo validar admin. Revisa la RPC is_admin().", "error");
    setView("viewDenied");
    return;
  }

  if (!admin) {
    setView("viewDenied");
    return;
  }

  // Profile display_name
  const userId = session.user.id;
  let profile = null;

  try {
    profile = await getProfile(userId);
  } catch (e) {
    showAlert("No pude leer tu perfil (profiles). Revisa RLS/tabla.", "error");
    setView("viewProfile");
    return;
  }

  if (!profile?.display_name) {
    setView("viewProfile");
    return;
  }

  const now = new Date();
  const saludo = getGreetingByHour(getMonterreyHour(now));
  const fecha = formatMxHeader(now);

  $("greetingMain").textContent = `👋 ${saludo}, ${profile.display_name}`;
$("greetingDate").textContent = fecha;

  setView("viewDash");
  loadParticipants();
}

// Arranque
setView("viewLogin");
safeInit();

// Errores globales visibles
window.addEventListener("error", (e) => showAlert("JS error: " + e.message, "error"));
window.addEventListener("unhandledrejection", (e) => showAlert("Promise error: " + (e.reason?.message || e.reason), "error"));