window.addEventListener("error", (e) => {
  const msg = (e && e.message) ? e.message : "Error JS";
  showFatal(msg);
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = (e && e.reason && e.reason.message) ? e.reason.message : ("" + (e.reason || "Promise error"));
  showFatal(msg);
});

function showFatal(msg) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;top:12px;left:12px;right:12px;z-index:99999;padding:10px;border-radius:12px;background:#4b0000;color:#fff;font:13px system-ui;";
  el.textContent = "ERROR: " + msg;
  document.body.appendChild(el);
}

// =====================
// CONFIG SUPABASE
// =====================

const SUPABASE_URL = "https://zapoxyrmeoqukshjzgki.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qYDfuLHeUz6Uy3Vy5t8mFA_QfXbMU9v";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

// Auto-refresh sesion cada 10 min para evitar token expirado
// Usamos getSession primero para verificar si hay sesión activa
setInterval(async function() {
  try {
    var sess = await supabaseClient.auth.getSession();
    if (sess && sess.data && sess.data.session) {
      // Marcar que este refresh no debe reiniciar la app
      var currentId = sess.data.session.user ? sess.data.session.user.id : null;
      lastAuthUserId = currentId; // sincronizar para que onAuthStateChange no lo trate como nuevo login
      await supabaseClient.auth.refreshSession();
    }
  } catch(e) { console.warn("session refresh error", e); }
}, 10 * 60 * 1000);

// =================
// Variables Globales

const QUINIELA_LOGO_URL = "./img/logo-arcangel-quiniela.png";
let showArchivedParticipants = false;
let currentPickEntryId = null;
let currentPickPoolId = null;
let currentPickParticipantId = null;
let currentPickStatusFilter = "all";
let currentPickStatusSearch = "";
let currentParticipantFilter = "all";
let currentParticipantSearch = "";
let currentEntriesFilter = "all";
let currentEntriesSearch = "";

// ── Control de inicialización ──
let appInitialized = false;  // true después del primer init completo
let lastAuthUserId  = null;  // para detectar cambios reales de usuario

// =================
// Logos Equipos

const TEAM_LOGOS = {
  "AMÉRICA": "./assets/logos/america.png",
  "CHIVAS": "./assets/logos/chivas.png",
  "CRUZ AZUL": "./assets/logos/cruz-azul.png",
  "PUMAS": "./assets/logos/pumas.png",
  "TIGRES": "./assets/logos/tigres.png",
  "MONTERREY": "./assets/logos/monterrey.png",
  "TOLUCA": "./assets/logos/toluca.png",
  "LEÓN": "./assets/logos/leon.png",
  "SANTOS": "./assets/logos/santos.png",
  "MAZATLÁN": "./assets/logos/mazatlan.png",
  "NECAXA": "./assets/logos/necaxa.png",
  "PACHUCA": "./assets/logos/pachuca.png",
  "PUEBLA": "./assets/logos/puebla.png",
  "QUERÉTARO": "./assets/logos/queretaro.png",
  "ATLAS": "./assets/logos/atlas.png",
  "JUÁREZ": "./assets/logos/juarez.png",
  "TIJUANA": "./assets/logos/tijuana.png",
  "SAN LUIS": "./assets/logos/san-luis.png"
};

function normalizeTeamName(name) {
  return String(name || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function getTeamLogo(teamName) {
  return TEAM_LOGOS[normalizeTeamName(teamName)] || "";
}

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

let bottomNavInitialized = false;

function initBottomNav() {
  if (bottomNavInitialized) return;
  bottomNavInitialized = true;

  document.querySelectorAll(".bottom-nav-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tabId = btn.getAttribute("data-tab");
      await showAppTab(tabId);
    });
  });
}

function setBusy(btn, busy, textBusy="Procesando…") {
  if (!btn) return;
  if (!btn.dataset.text) btn.dataset.text = btn.textContent;
  btn.disabled = busy;
  btn.classList.toggle("opacity-60", busy);
  btn.classList.toggle("cursor-not-allowed", busy);
  btn.textContent = busy ? textBusy : btn.dataset.text;
}

function pickLabel(code) {
  if (code === "H") return "L";
  if (code === "D") return "E";
  if (code === "A") return "V";
  return "";
}

function renderPickRow({ match_no, home_team, away_team, match_id, selected }) {
  // Botones grandes para celular
  return `
  <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="text-xs text-zinc-400">#${match_no}</div>
      <div class="text-sm font-semibold">${home_team} vs ${away_team}</div>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <button data-pickbtn="H" data-mid="${match_id}" class="pickbtn ${selected === "H" ? "pickbtn-on" : ""}">
        L
      </button>
      <button data-pickbtn="D" data-mid="${match_id}" class="pickbtn ${selected === "D" ? "pickbtn-on" : ""}">
        E
      </button>
      <button data-pickbtn="A" data-mid="${match_id}" class="pickbtn ${selected === "A" ? "pickbtn-on" : ""}">
        V
      </button>
    </div>
  </div>`;
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

// Botón Mas
function openMoreMenu() {
  $("moreMenuSheet").classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeMoreMenu() {
  $("moreMenuSheet").classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

// Badges
function setBadge(elId, count) {
  const el = $(elId);
  if (!el) return;

  const n = Number(count || 0);

  if (n > 0) {
    el.textContent = n > 99 ? "99+" : String(n);
    el.classList.remove("hidden");
  } else {
    el.textContent = "0";
    el.classList.add("hidden");
  }
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

// =========================
// ShowAppTab

async function showAppTab(tabId) {

  // Oculta todas las pestañas
  document.querySelectorAll(".app-tab").forEach(tab => {
    tab.classList.add("hidden");
  });

  // Muestra la pestaña seleccionada
  const target = document.getElementById(tabId);
  if (target) {
    target.classList.remove("hidden");
  } else {
    showAlert("No existe la sección: " + tabId, "error");
    return;
  }

  // Actualiza botones del menú inferior
  document.querySelectorAll(".bottom-nav-btn").forEach(btn => {
    const btnTab = btn.getAttribute("data-tab");
    const isActive = btnTab === tabId;

    btn.classList.toggle("active", isActive);
    btn.classList.toggle("bg-emerald-600/20", isActive);
    btn.classList.toggle("text-emerald-300", isActive);
  });

  // Si viene desde menú "Más", limpia activos del menú principal
  const mainTabs = [
    "tab-home",
    "tab-participants",
    "tab-pools",
    "tab-picks"
  ];

  if (!mainTabs.includes(tabId)) {
    document.querySelectorAll(".bottom-nav-btn").forEach(btn => {
      btn.classList.remove("active");
      btn.classList.remove("bg-emerald-600/20");
      btn.classList.remove("text-emerald-300");
    });
  }

  // Cierra menú "Más" si existe
  if ($("moreMenuSheet")) {
    $("moreMenuSheet").classList.add("hidden");
  }

  try {

    // INICIO
    if (tabId === "tab-home") {
      await loadDashboardSummary();
      await loadHistoricalStandings();
    }

    // PARTICIPANTES
    if (tabId === "tab-participants") {
      await loadParticipants();
    }

    // JORNADAS
    if (tabId === "tab-pools") {
      await loadPools();
    }

    // PLANTILLAS
    if (tabId === "tab-templates") {
      await fillTplPools();
    }

    // PAGOS
    if (tabId === "tab-payments") {
      await fillEntryPoolsSelect();
      await fillEntryParticipantsSelect();
      await loadEntriesAndStats();
    }

    // PICKS
    if (tabId === "tab-picks") {
      await fillPickPoolsSelect();
      await fillPickParticipantsSelect();
      await loadPickStatusList();
    }

    // RESULTADOS
    if (tabId === "tab-results") {
      await fillResultsPoolsSelect();
    }

    // ACIERTOS
    if (tabId === "tab-standings") {
      await fillStandingsPoolsSelect();
    }

  } catch (err) {
    showAlert("Error cargando sección: " + (err?.message || err), "error");
  }

  await updateNavBadges();
window.scrollTo({
  top: 0,
  behavior: "smooth"
});

}

// =================
// Actualizar Badges
async function updateNavBadges() {
  try {
    // 1) Buscar jornada activa
    const { data: activePool, error: poolErr } = await supabaseClient
      .from("pools")
      .select("id, name, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (poolErr) {
      console.warn("Badges pools:", poolErr.message);
      setBadge("navBadgePicks", 0);
      setBadge("navBadgeMore", 0);
      setBadge("moreBadgePayments", 0);
      setBadge("moreBadgeResults", 0);
      setBadge("moreBadgeStandings", 0);
      return;
    }

    if (!activePool?.id) {
      setBadge("navBadgePicks", 0);
      setBadge("navBadgeMore", 0);
      setBadge("moreBadgePayments", 0);
      setBadge("moreBadgeResults", 0);
      setBadge("moreBadgeStandings", 0);
      return;
    }

    const poolId = activePool.id;

    // 2) Participantes activos
    const { data: participants, error: pErr } = await supabaseClient
      .from("participants")
      .select("id")
      .eq("is_active", true);

    if (pErr) {
      console.warn("Badges participants:", pErr.message);
      return;
    }

    // 3) Entries de la jornada activa
    const { data: entries, error: eErr } = await supabaseClient
      .from("entries")
      .select("id, participant_id, paid")
      .eq("pool_id", poolId);

    if (eErr) {
      console.warn("Badges entries:", eErr.message);
      return;
    }

    // 4) Matches de la jornada activa
    const { data: matches, error: mErr } = await supabaseClient
      .from("matches")
      .select("id, home_goals, away_goals")
      .eq("pool_id", poolId);

    if (mErr) {
      console.warn("Badges matches:", mErr.message);
      return;
    }

    const totalMatches = (matches || []).length;

    // 5) Picks capturados
    const entryIds = (entries || []).map(function(e) { return e.id; });

    let picks = [];
    if (entryIds.length) {
      const { data: picksData, error: picksErr } = await supabaseClient
        .from("predictions_1x2")
        .select("entry_id, match_id");

      if (!picksErr) {
        picks = (picksData || []).filter(function(p) {
          return entryIds.indexOf(p.entry_id) !== -1;
        });
      }
    }

    const picksCountByEntry = new Map();
    picks.forEach(function(p) {
      picksCountByEntry.set(
        p.entry_id,
        (picksCountByEntry.get(p.entry_id) || 0) + 1
      );
    });

    // 6) Badge Picks: boletos con picks pendientes o incompletos
    let picksPendingCount = 0;
    (entries || []).forEach(function(entry) {
      const pickCount = picksCountByEntry.get(entry.id) || 0;
      if (pickCount < totalMatches) {
        picksPendingCount++;
      }
    });

    // 7) Badge Pagos: boletos registrados pero NO pagados en la jornada activa
    const paymentsPendingCount = (entries || []).filter(function(e) {
      return e.paid !== true;
    }).length;

    // 8) Badge Resultados: partidos sin goles capturados
    const resultsPendingCount = (matches || []).filter(function(m) {
      return m.home_goals === null || m.away_goals === null;
    }).length;

    // 9) Badge Aciertos: listo cuando ya no hay resultados pendientes
    const standingsReadyCount =
      resultsPendingCount === 0 && totalMatches > 0 ? 1 : 0;

    // 10) Badge Más
    const moreCount =
      paymentsPendingCount +
      resultsPendingCount +
      standingsReadyCount;

    setBadge("navBadgePicks", picksPendingCount);
    setBadge("navBadgeMore", moreCount);
    setBadge("moreBadgePayments", paymentsPendingCount);
    setBadge("moreBadgeResults", resultsPendingCount);
    setBadge("moreBadgeStandings", standingsReadyCount);

  } catch (err) {
    console.warn("updateNavBadges:", err?.message || err);
  }
}

// ===============
// Crear Jornadas: Modos Juego

function formatModeLabel(mode) {
  switch (mode) {
    case "SENCILLA":
      return "Quiniela Sencilla";
    case "ACUMULADA":
      return "Quiniela Acumulada";
    case "GOLEO":
      return "Campeón de Goleo";
    case "CAMPEON_CAMPEONES":
      return "Campeón de Campeones";
    default:
      return mode || "—";
  }
}

// Cargar Dashboard
async function loadDashboardSummary() {
  // jornada activa
  const { data: activePool, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, name, mode_code, carryover_amount")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (poolErr) {
    showAlert(poolErr.message, "error");
    return;
  }

  $("dashActivePool").textContent = activePool?.name || "Sin activa";
  $("dashMode").textContent = formatModeLabel(activePool?.mode_code);
  $("dashCarryover").textContent = money(activePool?.carryover_amount || 0);

  // participantes activos
  const { count: participantsCount, error: partErr } = await supabaseClient
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  if (partErr) {
    showAlert(partErr.message, "error");
    return;
  }

  $("dashParticipants").textContent = participantsCount || 0;

  // stats de la jornada activa
  if (activePool?.id) {
    const { data: stats, error: statsErr } = await supabaseClient
      .from("pool_stats")
      .select("paid_count, prize_pool")
      .eq("pool_id", activePool.id)
      .maybeSingle();

    if (statsErr) {
      showAlert(statsErr.message, "error");
      return;
    }

    $("dashPaidEntries").textContent = stats?.paid_count || 0;
    $("dashPrize").textContent = money(stats?.prize_pool || 0);

    // Participantes jugando esta jornada (con boleto registrado)
    const { count: jugandoCount, error: jugandoErr } = await supabaseClient
      .from("entries")
      .select("participant_id", { count: "exact", head: true })
      .eq("pool_id", activePool.id);

    if (!jugandoErr) {
      const elJ = $("dashJugandoJornada");
      if (elJ) elJ.textContent = jugandoCount || 0;
    }
  } else {
    $("dashPaidEntries").textContent = "0";
    $("dashPrize").textContent = "$0";
    const elJ = $("dashJugandoJornada");
    if (elJ) elJ.textContent = "0";
  }

  // Dashboard mejorado (stats historicos)
  loadDashboardEnhanced();
  // Historial de ganadores
  loadWinnersHistory();
}

// Guardar Participantes 
async function loadParticipants() {
  hideAlert();

  const { data, error } = await supabaseClient
    .from("participants")
    .select("id, name, area, whatsapp, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return showAlert(error.message, "error");

  const rows = data || [];

  $("participantsList").innerHTML = rows.map(function(p) {
    const isActive = p.is_active !== false;
    const statusKey = isActive ? "active" : "archived";
    const cardClass = isActive
      ? "bg-emerald-500/5 border-emerald-500/20"
      : "bg-zinc-950 border-zinc-800";
    const statusEmoji = isActive ? "🟢" : "⚫";
    const whatsapp = p.whatsapp ? p.whatsapp : "—";
const hasWhatsapp = !!p.whatsapp;
const whatsappBadge = hasWhatsapp
  ? '<span class="text-sky-300 text-xs ml-1">📱</span>'
  : '<span class="text-amber-300 text-xs ml-1">⚠️</span>';
    const area = p.area ? p.area : "Sin área";

    return `
  <div
  class="participant-card p-3 border rounded-xl flex items-center gap-2 ${cardClass}"
  data-status="${statusKey}"
  data-name="${String(p.name || "").toLowerCase()}"
  data-area="${String(area || "").toLowerCase()}"
  data-whatsapp="${String(whatsapp || "").toLowerCase()}"
  data-has-whatsapp="${p.whatsapp ? "1" : "0"}">

    <div class="min-w-0 flex-1">
      <div class="font-semibold text-sm leading-tight truncate flex items-center gap-1">
        ${p.name || "—"} ${whatsappBadge}
      </div>
      <div class="text-xs text-zinc-400 mt-0.5 truncate">${area}</div>
      <div class="text-xs text-zinc-500 truncate">${whatsapp !== "—" ? whatsapp : ""}</div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <div class="w-8 h-8 rounded-lg border flex items-center justify-center text-base ${isActive ? "border-emerald-500/30 bg-emerald-500/10" : "border-zinc-700 bg-zinc-900"}"
           title="${isActive ? "Activo" : "Archivado"}">
        ${statusEmoji}
      </div>
      <button type="button"
        class="participant-wa-btn w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-base flex items-center justify-center"
        onclick="openWhatsApp('${p.whatsapp || ""}')"
        title="Abrir WhatsApp">💬</button>
      <button type="button"
        class="participant-edit-btn w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-base flex items-center justify-center"
        data-id="${p.id}"
        data-name="${p.name || ""}"
        data-area="${p.area || ""}"
        data-whatsapp="${p.whatsapp || ""}"
        title="Editar">✏️</button>
      <button type="button"
        class="participant-history-btn w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-base flex items-center justify-center"
        data-id="${p.id}"
        data-name="${p.name || ""}"
        title="Ver historial">📋</button>
      <button type="button"
        class="participant-toggle-btn w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-base flex items-center justify-center"
        data-id="${p.id}"
        data-active="${isActive ? "1" : "0"}"
        data-name="${p.name || ""}"
        title="${isActive ? "Archivar" : "Restaurar"}">${isActive ? "📦" : "♻️"}</button>
    </div>
  </div>
`;
  }).join("");

  attachParticipantEditEvents();
attachParticipantHistoryEvents();
attachParticipantToggleEvents();
attachParticipantFilterEvents();
attachParticipantSearchEvent();
applyParticipantFilter(currentParticipantFilter);
updateParticipantFilterCounts();
updateParticipantKpis();

}

// Abrir WhatsApp
function openWhatsApp(number) {
  if (!number) {
    return showAlert("Este participante no tiene WhatsApp.", "error");
  }

  // limpiar número
  const clean = String(number).replace(/\D/g, "");

  if (clean.length < 10) {
    return showAlert("Número inválido.", "error");
  }

  const url = `https://wa.me/52${clean}`;
  window.open(url, "_blank");
}

// KPIs Participantes
function updateParticipantKpis() {
  const cards = Array.from(document.querySelectorAll(".participant-card"));

  const total = cards.length;
  const active = cards.filter(c => c.getAttribute("data-status") === "active").length;
  const archived = cards.filter(c => c.getAttribute("data-status") === "archived").length;
  const whatsappYes = cards.filter(c => c.getAttribute("data-has-whatsapp") === "1").length;
  const whatsappNo = cards.filter(c => c.getAttribute("data-has-whatsapp") !== "1").length;

  if ($("participantKpiTotal")) $("participantKpiTotal").textContent = total;
  if ($("participantKpiActive")) $("participantKpiActive").textContent = active;
  if ($("participantKpiArchived")) $("participantKpiArchived").textContent = archived;
  if ($("participantKpiWhatsappYes")) $("participantKpiWhatsappYes").textContent = whatsappYes;
  if ($("participantKpiWhatsappNo")) $("participantKpiWhatsappNo").textContent = whatsappNo;
}

// Función Modal Participantes
function openParticipantEditModal(data) {
  $("editParticipantId").value = data.id || "";
  $("editParticipantName").value = data.name || "";
  $("editParticipantArea").value = data.area || "";
  $("editParticipantWhatsapp").value = data.whatsapp || "";

  $("participantEditModal").classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeParticipantEditModal() {
  $("participantEditModal").classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

// Editar Participantes
async function updateParticipant() {
  hideAlert();

  const id = $("editParticipantId").value;
  const name = $("editParticipantName").value.trim();
  const area = $("editParticipantArea").value.trim();
  const whatsapp = $("editParticipantWhatsapp").value.trim();

  if (!id || !name) {
    return showAlert("Falta ID o nombre del participante.", "error");
  }

  const { error } = await supabaseClient
    .from("participants")
    .update({
      name,
      area,
      whatsapp
    })
    .eq("id", id);

  if (error) return showAlert(error.message, "error");

  closeParticipantEditModal();
  showAlert("Participante actualizado ✅", "ok");

  await loadParticipants();
  await fillEntryParticipantsSelect();
  await fillPickParticipantsSelect();
  await loadDashboardSummary();
}

// Función Archivar Restaurar
async function toggleParticipantActive(id, isCurrentlyActive, participantName) {
  hideAlert();

  const nextValue = !isCurrentlyActive;
  const actionText = isCurrentlyActive ? "archivar" : "restaurar";

  const ok = confirm(`¿Seguro que quieres ${actionText} a ${participantName}?`);
  if (!ok) return;

  const { error } = await supabaseClient
    .from("participants")
    .update({ is_active: nextValue })
    .eq("id", id);

  if (error) return showAlert(error.message, "error");

  showAlert(
    isCurrentlyActive ? "Participante archivado ✅" : "Participante restaurado ✅",
    "ok"
  );

  await loadParticipants();
  await fillEntryParticipantsSelect();
  await fillPickParticipantsSelect();
  await loadDashboardSummary();
  await updateNavBadges();
}

// Listeneres Dinámicos Modal
function attachParticipantEditEvents() {
  document.querySelectorAll(".participant-edit-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      openParticipantEditModal({
        id: btn.getAttribute("data-id"),
        name: btn.getAttribute("data-name"),
        area: btn.getAttribute("data-area"),
        whatsapp: btn.getAttribute("data-whatsapp")
      });
    });
  });
}

function attachParticipantHistoryEvents() {
  document.querySelectorAll(".participant-history-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var id   = btn.getAttribute("data-id");
      var name = btn.getAttribute("data-name") || "Participante";
      showParticipantHistory(id, name);
    });
  });
}

function attachParticipantToggleEvents() {
  document.querySelectorAll(".participant-toggle-btn").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      const id = btn.getAttribute("data-id");
      const isCurrentlyActive = btn.getAttribute("data-active") === "1";
      const participantName = btn.getAttribute("data-name") || "este participante";

      await toggleParticipantActive(id, isCurrentlyActive, participantName);
    });
  });
}

// Función Filtro Visual Participantes
function applyParticipantFilter(filterKey) {
  currentParticipantFilter = filterKey;

  const searchText = (currentParticipantSearch || "").trim().toLowerCase();

  document.querySelectorAll(".participant-filter-btn").forEach(function(btn) {
    const isActive = btn.getAttribute("data-filter") === filterKey;

    btn.classList.toggle("bg-emerald-600", isActive);
    btn.classList.toggle("text-white", isActive);

    btn.classList.toggle("bg-zinc-800", !isActive);
    btn.classList.toggle("hover:bg-zinc-700", !isActive);
  });

  document.querySelectorAll(".participant-card").forEach(function(card) {
    const status = card.getAttribute("data-status");
    const name = card.getAttribute("data-name") || "";
    const area = card.getAttribute("data-area") || "";
    const whatsapp = card.getAttribute("data-whatsapp") || "";

    const matchStatus = filterKey === "all" || status === filterKey;
    const matchSearch =
      !searchText ||
      name.includes(searchText) ||
      area.includes(searchText) ||
      whatsapp.includes(searchText);

    card.classList.toggle("hidden", !(matchStatus && matchSearch));
  });
}

function attachParticipantFilterEvents() {
  document.querySelectorAll(".participant-filter-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      const filterKey = btn.getAttribute("data-filter");
      applyParticipantFilter(filterKey);
    });
  });
}

// Buscador Participantes
function attachParticipantSearchEvent() {
  const input = $("participantSearch");
  if (!input) return;

  input.removeEventListener("input", handleParticipantSearchInput);
  input.addEventListener("input", handleParticipantSearchInput);
}

function handleParticipantSearchInput(e) {
  currentParticipantSearch = e.target.value || "";
  applyParticipantFilter(currentParticipantFilter);
}

// Contador Buscador Filtro
function updateParticipantFilterCounts() {
  const cards = Array.from(document.querySelectorAll(".participant-card"));

  const counts = {
    all: cards.length,
    active: cards.filter(c => c.getAttribute("data-status") === "active").length,
    archived: cards.filter(c => c.getAttribute("data-status") === "archived").length
  };

  if ($("participantCountAll")) $("participantCountAll").textContent = counts.all;
  if ($("participantCountActive")) $("participantCountActive").textContent = counts.active;
  if ($("participantCountArchived")) $("participantCountArchived").textContent = counts.archived;
}

// =======================
// Crear y Guardar Jornadas

async function loadPools() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, round, competition, season, price, commission_pct, date_label, mode_code, carryover_enabled, created_at")
    .order("created_at", { ascending: false });

  if (error) return showAlert(error.message, "error");

  const rows = data || [];
  const active = rows.find(p => p.status === "open");
  $("activePoolName").textContent = active ? active.name : "—";

  $("poolsList").innerHTML = rows.map(p => {
    const badge =
      p.status === "open"
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
        : p.status === "draft"
        ? "bg-sky-500/10 border-sky-500/20 text-sky-300"
        : "bg-amber-500/10 border-amber-500/20 text-amber-300";

    const statusLabel =
      p.status === "open"
        ? "Activa"
        : p.status === "draft"
        ? "Borrador"
        : "Cerrada";

    const actionBtn =
      p.status === "draft"
        ? `
          <button data-open="${p.id}" class="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-xs">
            Activar
          </button>
        `
        : p.status === "open"
        ? `
          <button data-close="${p.id}" class="px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 text-xs">
            Cerrar
          </button>
        `
        : `
          <button data-draft="${p.id}" class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">
            Reabrir a borrador
          </button>
        `;

    return `
      <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div class="font-semibold">${p.name}</div>

            <div class="text-xs text-zinc-400 mt-1">
              $${Number(p.price || 0).toFixed(0)} • Comisión ${Number(p.commission_pct || 0).toFixed(0)}% • ${p.competition || "—"} • ${p.season || "—"}
            </div>

            <div class="text-xs text-emerald-300 mt-1">
              Modo: ${p.mode_code || "—"}
            </div>

            ${p.date_label ? `<div class="text-xs text-emerald-300/90 mt-1">Fechas: ${p.date_label}</div>` : ""}

            ${p.carryover_enabled ? `<div class="text-xs text-sky-300/90 mt-1">Acumulado habilitado</div>` : ""}
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs px-2 py-1 rounded-full border ${badge}">
              ${statusLabel}
            </span>

            <button
              data-dates="${p.id}"
              data-curdates="${(p.date_label || "").replace(/"/g, "&quot;")}"
              class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">
              Editar fechas
            </button>

            ${(p.status === "open" || p.status === "draft") ? `
            <button
              data-editprice="${p.id}"
              data-curprice="${p.price || 20}"
              data-curcomm="${p.commission_pct || 15}"
              class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">
              💲 Precio/Comisión
            </button>` : ""}

            ${actionBtn}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Activar jornada
  document.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-open");
      await setPoolOpen(id);
    });
  });

  // Cerrar jornada
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-close");
      await setPoolClosed(id);
    });
  });

  // Reabrir a borrador
  document.querySelectorAll("[data-draft]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-draft");
      await setPoolDraft(id);
    });
  });

  // Editar fechas
  document.querySelectorAll("[data-dates]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-dates");
      const cur = btn.getAttribute("data-curdates") || "";
      await editPoolDates(id, cur);
    });
  });

  // Editar precio y comisión
  document.querySelectorAll("[data-editprice]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id   = btn.getAttribute("data-editprice");
      const price = btn.getAttribute("data-curprice") || "20";
      const comm  = btn.getAttribute("data-curcomm")  || "15";
      await editPoolPrice(id, price, comm);
    });
  });
}

async function editPoolDates(poolId, currentDates) {
  hideAlert();

  const next = prompt(
    "Editar FECHAS (Ej: 06/07/08 Marzo)\n\nDeja vacío para borrar.",
    currentDates || ""
  );

  if (next === null) return; // cancelado

  const date_label = next.trim() ? next.trim() : null;

  // (Opcional) Validador si ya lo tienes
  if (date_label && typeof validateDateLabel === "function" && !validateDateLabel(date_label)) {
    return showAlert("Formato inválido. Ejemplo: 06/07/08 Marzo", "error");
  }

  const { error } = await supabaseClient
    .from("pools")
    .update({ date_label })
    .eq("id", poolId);

  if (error) return showAlert(error.message, "error");

  showAlert("Fechas actualizadas ✅", "ok");
  await loadPools();
  await fillTplPools();
  await renderPreview();
}

async function editPoolPrice(poolId, currentPrice, currentComm) {
  hideAlert();
  var newPrice = prompt("Precio del boleto (actual: $" + currentPrice + "):", currentPrice);
  if (newPrice === null) return;
  newPrice = Number(newPrice);
  if (isNaN(newPrice) || newPrice < 1) return showAlert("Precio inválido.", "error");

  var newComm = prompt("% comisión (actual: " + currentComm + "%):", currentComm);
  if (newComm === null) return;
  newComm = Number(newComm);
  if (isNaN(newComm) || newComm < 0) return showAlert("Comisión inválida.", "error");

  const { error } = await supabaseClient.from("pools")
    .update({ price: newPrice, commission_pct: newComm })
    .eq("id", poolId);

  if (error) return showAlert(error.message, "error");
  showAlert("Precio y comisión actualizados ✅", "ok");
  await loadPools();
  await loadDashboardSummary();
}

// Abrir Jornada Activa

async function setPoolOpen(poolId) {
  hideAlert();

  const ok = confirm("¿Activar esta jornada? La jornada activa actual se cerrará.");
  if (!ok) return;

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

  showAlert("Jornada activada ✅", "ok");

  await loadPools();
  await fillTplPools();
  await fillEntryPoolsSelect();
  await fillPickPoolsSelect();
  await loadDashboardSummary();
}

// Cerrar Jornada Activa
async function setPoolClosed(poolId) {
  hideAlert();

  const ok = confirm("¿Cerrar esta jornada?");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("pools")
    .update({ status: "closed" })
    .eq("id", poolId);

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada cerrada ✅", "ok");

  await loadPools();
  await fillTplPools();
  await fillEntryPoolsSelect();
  await fillPickPoolsSelect();
  await loadDashboardSummary();
}

// Regresar Jornada Cerrada a Borrador
async function setPoolDraft(poolId) {
  hideAlert();

  const ok = confirm("¿Mandar esta jornada a borrador?");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("pools")
    .update({ status: "draft" })
    .eq("id", poolId);

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada enviada a borrador ✅", "ok");

  await loadPools();
  await fillTplPools();
  await fillEntryPoolsSelect();
  await fillPickPoolsSelect();
  await loadDashboardSummary();
}

function money(n) {
  const x = Number(n || 0);
  return "$" + x.toFixed(0);
}

// Selector Pagos Jornadas Activa
async function fillEntryPoolsSelect() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, price, commission_pct, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return showAlert(error.message, "error");

  const sel = $("entryPool");
  sel.innerHTML = (data || []).map(p =>
    `<option value="${p.id}">${p.name} (Activa)</option>`
  ).join("");

  if ((data || [])[0]) sel.value = data[0].id;
}

async function fillEntryParticipantsSelect() {
  const { data, error } = await supabaseClient
    .from("participants")
    .select("id, name, area")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return showAlert(error.message, "error");

  const sel = $("entryParticipant");
  sel.innerHTML = (data || []).map(p => {
    const area = p.area ? ` • ${p.area}` : "";
    return `<option value="${p.id}">${p.name}${area}</option>`;
  }).join("");
}

async function fillPickPoolsSelect() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return showAlert(error.message, "error");

  const sel = $("pickPool");

  // Build options: label by status
  sel.innerHTML = (data || []).map(p => {
    const label =
      p.status === "open"   ? " ✅ Activa"  :
      p.status === "draft"  ? " 📝 Borrador" :
                              " 🔒 Cerrada";
    return `<option value="${p.id}">${p.name}${label}</option>`;
  }).join("");

  // Auto-select the active (open) pool if present, otherwise first
  const openPool = (data || []).find(p => p.status === "open");
  const defaultPool = openPool || (data || [])[0];
  if (defaultPool) sel.value = defaultPool.id;
}

async function fillPickParticipantsSelect() {
  const pool_id = $("pickPool").value;

  // Si hay jornada seleccionada, solo participantes con boleto en ella
  if (pool_id) {
    const { data: entries, error: entErr } = await supabaseClient
      .from("entries")
      .select("participant_id")
      .eq("pool_id", pool_id);

    if (entErr) return showAlert(entErr.message, "error");

    const partIds = [...new Set((entries || []).map(function(e) {
      return e.participant_id;
    }))];

    if (!partIds.length) {
      $("pickParticipant").innerHTML =
        '<option value="">Sin boletos en esta jornada</option>';
      return;
    }

    const { data, error } = await supabaseClient
      .from("participants")
      .select("id, name, area")
      .in("id", partIds)
      .order("name", { ascending: true });

    if (error) return showAlert(error.message, "error");

    const sel = $("pickParticipant");
    sel.innerHTML = (data || []).map(function(p) {
      const area = p.area ? " • " + p.area : "";
      return `<option value="${p.id}">${p.name}${area}</option>`;
    }).join("");
    return;
  }

  // Fallback: todos los activos si no hay jornada seleccionada
  const { data, error } = await supabaseClient
    .from("participants")
    .select("id, name, area, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(200);

  if (error) return showAlert(error.message, "error");

  const sel = $("pickParticipant");
  sel.innerHTML = (data || []).map(function(p) {
    const area = p.area ? " • " + p.area : "";
    return `<option value="${p.id}">${p.name}${area}</option>`;
  }).join("");
}


function renderPickRow(match, selectedPick) {
  const isH = selectedPick === "H";
  const isD = selectedPick === "D";
  const isA = selectedPick === "A";

  return `
    <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
      <div class="text-xs text-zinc-400 mb-2">Partido #${match.match_no}</div>

      <div class="text-sm font-semibold mb-3 text-center">
        ${match.home_team} vs ${match.away_team}
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button type="button"
          data-match-id="${match.id}"
          data-pick="H"
          class="pick-btn py-3 rounded-xl border font-bold ${isH ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-200'}">
          L
        </button>

        <button type="button"
          data-match-id="${match.id}"
          data-pick="D"
          class="pick-btn py-3 rounded-xl border font-bold ${isD ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-200'}">
          E
        </button>

        <button type="button"
          data-match-id="${match.id}"
          data-pick="A"
          class="pick-btn py-3 rounded-xl border font-bold ${isA ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-200'}">
          V
        </button>
      </div>
    </div>
  `;
}

async function loadEntryForPick(poolId, partId) {
  hideAlert();

  const pool_id = poolId || $("pickPool").value;
  const participant_id = partId || $("pickParticipant").value;

  if (!pool_id || !participant_id) {
    return showAlert("Selecciona jornada y participante.", "error");
  }

  const { data: entry, error: entryError } = await supabaseClient
    .from("entries")
    .select("id, paid, created_at, pool_id, participant_id")
    .eq("pool_id", pool_id)
    .eq("participant_id", participant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (entryError) return showAlert(entryError.message, "error");

  if (!entry) {
    currentPickEntryId = null;
    currentPickPoolId = null;
    currentPickParticipantId = null;

    $("pickEntryLabel").textContent = "Sin boleto";
    $("pickMatches").innerHTML = "";

    $("btnSavePicks").disabled = true;
    $("btnSavePicks").classList.add("opacity-50", "cursor-not-allowed");

    return showAlert("Ese participante no tiene boleto registrado en esta jornada.", "error");
  }

  currentPickEntryId = entry.id;
  currentPickPoolId = pool_id;
  currentPickParticipantId = participant_id;

  const { data: poolInfo, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", pool_id)
    .maybeSingle();

  if (poolErr) return showAlert(poolErr.message, "error");

  if (poolInfo && poolInfo.status === "closed") {
    $("pickEntryLabel").textContent =
      (entry.paid ? "Pagado ✅" : "Pendiente ⏳") + " • Jornada cerrada 🔒";

    $("btnSavePicks").disabled = true;
    // Disable individual pick buttons visually
    setTimeout(function() {
      document.querySelectorAll(".pickbtn").forEach(function(b) {
        b.disabled = true;
        b.style.opacity = "0.4";
        b.style.cursor = "not-allowed";
      });
    }, 300);
    $("btnSavePicks").classList.add("opacity-50", "cursor-not-allowed");
  } else {
    $("pickEntryLabel").textContent =
      entry.paid ? "Pagado ✅" : "Pendiente ⏳";

    $("btnSavePicks").disabled = false;
    $("btnSavePicks").classList.remove("opacity-50", "cursor-not-allowed");
  }

  const { data: matches, error: matchError } = await supabaseClient
    .from("matches")
    .select("id, match_no, home_team, away_team")
    .eq("pool_id", pool_id)
    .order("match_no", { ascending: true });

  if (matchError) return showAlert(matchError.message, "error");

  const { data: existingPicks, error: picksError } = await supabaseClient
    .from("predictions_1x2")
    .select("match_id, pick")
    .eq("entry_id", entry.id);

  if (picksError) return showAlert(picksError.message, "error");

  const picksMap = new Map(
    (existingPicks || []).map(function(p) {
      return [p.match_id, p.pick];
    })
  );

  $("pickMatches").innerHTML = (matches || []).map(function(match) {
    return renderPickRow(match, picksMap.get(match.id) || null);
  }).join("");

  attachPickButtonsEvents();
  showAlert("Boleto cargado ✅", "ok");
}

// Marcar Pagos Pendientes
async function markEntryPaid(entryId) {
  hideAlert();

  if (!entryId) return showAlert("No se encontró el boleto.", "error");

  // Buscar el entry para validar su jornada
  const { data: entry, error: entryErr } = await supabaseClient
    .from("entries")
    .select("id, pool_id, paid")
    .eq("id", entryId)
    .maybeSingle();

  if (entryErr) return showAlert(entryErr.message, "error");
  if (!entry) return showAlert("Boleto no encontrado.", "error");

  // Validar estado de la jornada
  const { data: poolInfo, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", entry.pool_id)
    .maybeSingle();

  if (poolErr) return showAlert(poolErr.message, "error");

  if (!poolInfo || poolInfo.status !== "open") {
    return showAlert("Esta jornada ya está cerrada. No se puede registrar el pago.", "error");
  }

  var cfmPaid = await showConfirmModal({
    icon: "💰", title: "Registrar pago",
    message: "Confirmas que este boleto fue pagado?",
    confirmLabel: "Registrar pago",
    confirmStyle: "background:linear-gradient(135deg,#059669,#10b981);"
  });
  if (!cfmPaid) return;

  const { error } = await supabaseClient
    .from("entries")
    .update({
      paid: true,
      paid_at: new Date().toISOString()
    })
    .eq("id", entryId);

  if (error) return showAlert(error.message, "error");

  showAlert("Pago registrado ✅", "ok");

  await loadEntriesAndStats();
  await loadDashboardSummary();
  await loadPickStatusList();
  await updateNavBadges();
}

async function markEntryPending(entryId) {
  hideAlert();

  if (!entryId) return showAlert("No se encontró el boleto.", "error");

  const { data: entry, error: entryErr } = await supabaseClient
    .from("entries")
    .select("id, pool_id, paid")
    .eq("id", entryId)
    .maybeSingle();

  if (entryErr) return showAlert(entryErr.message, "error");
  if (!entry) return showAlert("Boleto no encontrado.", "error");

  const { data: poolInfo, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", entry.pool_id)
    .maybeSingle();

  if (poolErr) return showAlert(poolErr.message, "error");

  if (!poolInfo || poolInfo.status !== "open") {
    return showAlert("Esta jornada ya está cerrada. No se puede cambiar el pago.", "error");
  }

  var cfmPending = await showConfirmModal({
    icon: "?", title: "Marcar pendiente",
    message: "Revertir el pago de este boleto?",
    confirmLabel: "Marcar pendiente",
    confirmStyle: "background:linear-gradient(135deg,#b45309,#d97706);"
  });
  if (!cfmPending) return;

  const { error } = await supabaseClient
    .from("entries")
    .update({
      paid: false,
      paid_at: null
    })
    .eq("id", entryId);

  if (error) return showAlert(error.message, "error");

  showAlert("Boleto marcado como pendiente ⏳", "ok");

  await loadEntriesAndStats();
  await loadDashboardSummary();
  await loadPickStatusList();
  await updateNavBadges();
}

// Confirm modal premium
function showConfirmModal(opts) {
  return new Promise(function(resolve) {
    var existing = document.getElementById("confirmModal");
    if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "confirmModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;";
    var confirmStyle = opts.confirmStyle || "background:linear-gradient(135deg,#059669,#10b981);";
    modal.innerHTML = [
      '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="confirmModalBg"></div>',
      '<div style="position:relative;width:100%;max-width:340px;background:#0c1018;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:24px;box-shadow:0 32px 80px rgba(0,0,0,.8);">',
        '<div style="text-align:center;margin-bottom:20px;">',
          '<div style="font-size:40px;line-height:1;margin-bottom:10px;">' + (opts.icon||"?") + '</div>',
          '<div style="font-size:17px;font-weight:800;color:#f0f4f8;">' + (opts.title||"Confirmar") + '</div>',
          '<div style="font-size:13px;color:#8a94a6;margin-top:6px;line-height:1.5;">' + (opts.message||"") + '</div>',
        '</div>',
        '<div style="display:grid;gap:10px;">',
          '<button id="confirmModalYes" style="width:100%;padding:14px;border-radius:14px;border:none;' + confirmStyle + 'color:#fff;font-size:15px;font-weight:700;cursor:pointer;">' + (opts.confirmLabel||"Confirmar") + '</button>',
          '<button id="confirmModalNo" style="width:100%;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#8a94a6;font-size:14px;cursor:pointer;">Cancelar</button>',
        '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(modal);
    function close(r) { modal.remove(); resolve(r); }
    document.getElementById("confirmModalYes").addEventListener("click", function(){ close(true); });
    document.getElementById("confirmModalNo").addEventListener("click", function(){ close(false); });
    document.getElementById("confirmModalBg").addEventListener("click", function(){ close(false); });
  });
}

// Activar Botones Pagos Pendientes
function attachEntryPaymentEvents() {
  document.querySelectorAll(".entry-mark-paid").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      const entryId = btn.getAttribute("data-entry-id");
      await markEntryPaid(entryId);
    });
  });

  document.querySelectorAll(".entry-mark-pending").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      const entryId = btn.getAttribute("data-entry-id");
      await markEntryPending(entryId);
    });
  });
}

function attachPickButtonsEvents() {
  document.querySelectorAll(".pick-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      const matchId = btn.getAttribute("data-match-id");

      document.querySelectorAll(`.pick-btn[data-match-id="${matchId}"]`).forEach(function(b) {
        b.classList.remove("bg-emerald-600", "border-emerald-500", "text-white");
        b.classList.add("bg-zinc-900", "border-zinc-700", "text-zinc-200");
        b.dataset.selected = "";
      });

      btn.classList.remove("bg-zinc-900", "border-zinc-700", "text-zinc-200");
      btn.classList.add("bg-emerald-600", "border-emerald-500", "text-white");
      btn.dataset.selected = "1";
    });
  });
}

// ====================
// Guardar Pronosticos
async function savePicks() {
  hideAlert();

  if (!currentPickEntryId) {
    return showAlert("Primero carga un boleto.", "error");
  }

  const pool_id = currentPickPoolId || $("pickPool").value;

  // 🔒 Bloquear si la jornada ya está cerrada
  const { data: poolInfo, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", pool_id)
    .maybeSingle();

  if (poolErr) return showAlert(poolErr.message, "error");

  if (!poolInfo || poolInfo.status !== "open") {
    return showAlert("Esta jornada ya está cerrada. No se pueden guardar pronósticos.", "error");
  }

  const selected = {};

  document.querySelectorAll(".pick-btn[data-selected='1'], .pick-btn.bg-emerald-600").forEach(function(btn) {
    const matchId = btn.getAttribute("data-match-id");
    const pick = btn.getAttribute("data-pick");
    selected[matchId] = pick;
  });

  const rows = Object.keys(selected).map(function(match_id) {
    return {
      entry_id: currentPickEntryId,
      match_id: match_id,
      pick: selected[match_id]
    };
  });

  if (!rows.length) {
    return showAlert("No seleccionaste pronósticos.", "error");
  }

  const { error } = await supabaseClient
    .from("predictions_1x2")
    .upsert(rows, { onConflict: "entry_id,match_id" });

  if (error) return showAlert(error.message, "error");

  showAlert("Pronósticos guardados ✅", "ok");
  await loadPickStatusList();
  await updateNavBadges();
}

// Limpiar Selección de Pronosticos
function clearPicksSelection() {
  document.querySelectorAll(".pick-btn").forEach(function(btn) {
    btn.classList.remove("bg-emerald-600", "border-emerald-500", "text-white");
    btn.classList.add("bg-zinc-900", "border-zinc-700", "text-zinc-200");
    btn.dataset.selected = "";
  });
}

// Lista Pronosticos Guardados

async function loadPickStatusList() {
  hideAlert();

  const pool_id = $("pickPool").value;
  if (!pool_id) {
    $("pickStatusList").innerHTML = `
      <div class="text-sm text-zinc-400 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
        Selecciona una jornada para ver el estado de captura.
      </div>`;
    return;
  }

  // Boletos de esa jornada (fuente de verdad)
  const { data: entries, error: eErr } = await supabaseClient
    .from("entries")
    .select("id, participant_id, paid")
    .eq("pool_id", pool_id);

  if (eErr) return showAlert(eErr.message, "error");

  // Solo participantes con boleto en esta jornada
  const participantIdsInPool = [...new Set((entries || []).map(function(e) {
    return e.participant_id;
  }))];

  if (!participantIdsInPool.length) {
    $("pickStatusList").innerHTML = `
      <div class="text-sm text-zinc-400 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
        No hay boletos registrados en esta jornada todavía.
      </div>`;
    updatePickStatusFilterCounts();
    return;
  }

  const { data: participants, error: pErr } = await supabaseClient
    .from("participants")
    .select("id, name, area")
    .in("id", participantIdsInPool)
    .order("name", { ascending: true });

  if (pErr) return showAlert(pErr.message, "error");

  const entryByParticipant = new Map();
  (entries || []).forEach(function(entry) {
    entryByParticipant.set(entry.participant_id, entry);
  });

  // Picks existentes para esos boletos
  const entryIds = (entries || []).map(function(e) { return e.id; });

  let picks = [];
  if (entryIds.length) {
    const { data: picksData, error: picksErr } = await supabaseClient
      .from("predictions_1x2")
      .select("entry_id");

    if (picksErr) return showAlert(picksErr.message, "error");

    picks = (picksData || []).filter(function(p) {
      return entryIds.indexOf(p.entry_id) !== -1;
    });
  }

  const picksCountByEntry = new Map();
  picks.forEach(function(p) {
    picksCountByEntry.set(p.entry_id, (picksCountByEntry.get(p.entry_id) || 0) + 1);
  });

  const totalMatchesInPool = await (async function() {
  const { count, error } = await supabaseClient
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("pool_id", pool_id);

  if (error) {
    showAlert(error.message, "error");
    return 0;
  }

  return Number(count || 0);
})();

const rowsHtml = (participants || []).map(function(participant) {
  const entry = entryByParticipant.get(participant.id);
  const area = participant.area ? participant.area : "Sin área";
  const pEntries = (entries || []).filter(function(e) { return e.participant_id === participant.id; });

  let statusEmoji = "🚫";
  let statusTitle = "Sin boleto";
  let statusKey = "noboleto";
  let actionBtn = "";
  let cardClass = "bg-zinc-950 border-zinc-800";
  let iconWrapClass = "border-zinc-700 bg-zinc-900";
  let progressHtml = `<div class="text-xs text-zinc-500 mt-1">0/${totalMatchesInPool || 0}</div>`;

  if (entry) {
    const pickCount = picksCountByEntry.get(entry.id) || 0;

    const numBoletas = pEntries.length;
    const boletaBadge = numBoletas > 1
      ? `<span style="font-size:10px;padding:1px 6px;border-radius:99px;background:rgba(6,182,212,.15);color:#67e8f9;border:1px solid rgba(6,182,212,.3);font-weight:700;margin-left:4px;">${numBoletas} boletas</span>`
      : "";

    progressHtml = `
      <div class="text-xs mt-1 flex items-center gap-1 flex-wrap">
        <span class="${pickCount > 0 ? "text-zinc-300" : "text-zinc-500"}">
          ${pickCount}/${totalMatchesInPool || 0} picks
        </span>
        ${boletaBadge}
      </div>
    `;

    if (pickCount > 0) {
      if (totalMatchesInPool > 0 && pickCount >= totalMatchesInPool) {
        statusEmoji = "✅";
        statusTitle = "Capturado completo";
        statusKey = "complete";
        cardClass = "bg-emerald-500/5 border-emerald-500/20";
        iconWrapClass = "border-emerald-500/30 bg-emerald-500/10";
      } else {
        statusEmoji = "🟡";
        statusTitle = "Captura incompleta";
        statusKey = "partial";
        cardClass = "bg-yellow-500/5 border-yellow-500/20";
        iconWrapClass = "border-yellow-500/30 bg-yellow-500/10";
      }
    } else {
      statusEmoji = "⏳";
      statusTitle = "Pendiente";
      statusKey = "pending";
      cardClass = "bg-amber-500/5 border-amber-500/20";
      iconWrapClass = "border-amber-500/30 bg-amber-500/10";
    }

    // Generar botones por cada boleta del participante
    const multiEntry = pEntries.length > 1;

    if (pEntries.length > 0) {
      const btns = pEntries.map(function(e, idx) {
        const label = multiEntry ? (idx + 1) : "";
        const pickCountE = picksCountByEntry.get(e.id) || 0;
        const isComplete = totalMatchesInPool > 0 && pickCountE >= totalMatchesInPool;
        const btnColor = isComplete
          ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-300"
          : "bg-zinc-800 hover:bg-zinc-700";
        const boletaLabel = multiEntry
          ? `<span style="font-size:10px;font-weight:700;margin-left:3px;opacity:.85;">#${idx+1}</span>`
          : "";
        const openBtnClass = isComplete
          ? "pick-status-open flex items-center gap-1 px-3 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold"
          : "pick-status-open flex items-center gap-1 px-3 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold";
        return `
          <button type="button"
            class="${openBtnClass}"
            data-participant-id="${participant.id}"
            data-entry-id="${e.id}"
            title="Abrir boleta ${multiEntry ? (idx+1) : ""}">
            👁️${boletaLabel}
          </button>
          ${pickCountE > 0 ? `
          <button type="button"
            class="pick-status-export flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700"
            data-participant-id="${participant.id}"
            data-entry-id="${e.id}"
            title="Descargar boleta ${multiEntry ? (idx+1) : ""}">
            🖼️
          </button>
          <button type="button" class="pick-status-wa flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700" data-participant-id="${participant.id}" data-entry-id="${e.id}" title="Enviar por WhatsApp">\u{1F4F2}</button>` : ""}
        `;
      }).join("");
      actionBtn = btns;
    } else {
      actionBtn = "";
    }
  }

  const hiddenByFilter =
    currentPickStatusFilter !== "all" && currentPickStatusFilter !== statusKey
      ? "hidden"
      : "";

  const isMulti = pEntries.length > 1;

  return `
    <div
  class="pick-status-card p-3 border rounded-xl ${cardClass} ${hiddenByFilter}"
  data-status="${statusKey}"
  data-name="${String(participant.name || "").toLowerCase()}"
  data-area="${String(area || "").toLowerCase()}">

      <div class="flex items-center justify-between gap-2 mb-${isMulti ? "2" : "0"}">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-sm leading-tight truncate">${participant.name}</div>
          <div class="text-xs text-zinc-400 mt-1 truncate">${area}</div>
          ${progressHtml}
        </div>
        <div class="w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 ${iconWrapClass}"
          title="${statusTitle}">
          ${statusEmoji}
        </div>
      </div>

      ${actionBtn ? `<div class="flex items-center gap-1 flex-wrap mt-1">${actionBtn}</div>` : ""}
    </div>
  `;
}).join("");

  $("pickStatusList").innerHTML = rowsHtml || `
    <div class="text-sm text-zinc-400 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
      No hay participantes activos.
    </div>
  `;

  attachPickStatusOpenEvents();
attachPickStatusExportEvents();
attachPickStatusWaEvents();
attachPickStatusFilterEvents();
attachPickStatusSearchEvent();
applyPickStatusFilter(currentPickStatusFilter);
updatePickStatusFilterCounts();
}

// ===================
// Aplicar Filtró sin recargar todo

function applyPickStatusFilter(filterKey) {
  currentPickStatusFilter = filterKey;

  const searchText = (currentPickStatusSearch || "").trim().toLowerCase();

  document.querySelectorAll(".pick-filter-btn").forEach(function(btn) {
    const isActive = btn.getAttribute("data-filter") === filterKey;

    btn.classList.toggle("bg-emerald-600", isActive);
    btn.classList.toggle("text-white", isActive);

    btn.classList.toggle("bg-zinc-800", !isActive);
    btn.classList.toggle("hover:bg-zinc-700", !isActive);
  });

  document.querySelectorAll(".pick-status-card").forEach(function(card) {
    const status = card.getAttribute("data-status");
    const name = card.getAttribute("data-name") || "";
    const area = card.getAttribute("data-area") || "";

    const matchStatus = filterKey === "all" || status === filterKey;
    const matchSearch =
      !searchText ||
      name.includes(searchText) ||
      area.includes(searchText);

    card.classList.toggle("hidden", !(matchStatus && matchSearch));
  });
}

// ================
// Activar Buscador

function attachPickStatusSearchEvent() {
  const input = $("pickStatusSearch");
  if (!input) return;

  input.removeEventListener("input", handlePickStatusSearchInput);
  input.addEventListener("input", handlePickStatusSearchInput);
}

function handlePickStatusSearchInput(e) {
  currentPickStatusSearch = e.target.value || "";
  applyPickStatusFilter(currentPickStatusFilter);
}

// ====================
// Activar Funciones Botón Filtro

function attachPickStatusFilterEvents() {
  document.querySelectorAll(".pick-filter-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      const filterKey = btn.getAttribute("data-filter");
      applyPickStatusFilter(filterKey);
    });
  });
}

//Contador Automático Filtros
function updatePickStatusFilterCounts() {
  const cards = Array.from(document.querySelectorAll(".pick-status-card"));

  const counts = {
    all: cards.length,
    complete: cards.filter(c => c.getAttribute("data-status") === "complete").length,
    partial: cards.filter(c => c.getAttribute("data-status") === "partial").length,
    pending: cards.filter(c => c.getAttribute("data-status") === "pending").length,
    noboleto: cards.filter(c => c.getAttribute("data-status") === "noboleto").length
  };

  if ($("pickCountAll")) $("pickCountAll").textContent = counts.all;
  if ($("pickCountComplete")) $("pickCountComplete").textContent = counts.complete;
  if ($("pickCountPartial")) $("pickCountPartial").textContent = counts.partial;
  if ($("pickCountPending")) $("pickCountPending").textContent = counts.pending;
  if ($("pickCountNoBoleto")) $("pickCountNoBoleto").textContent = counts.noboleto;
}

function attachPickStatusOpenEvents() {
  document.querySelectorAll(".pick-status-open").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      const participantId = btn.getAttribute("data-participant-id");
      $("pickParticipant").value = participantId;
      await loadEntryForPick($("pickPool").value, participantId);
    });
  });
}

function attachPickStatusExportEvents() {
  document.querySelectorAll(".pick-status-export").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      const participantId = btn.getAttribute("data-participant-id");
      await exportParticipantPickImage($("pickPool").value, participantId);

document.getElementById("pickMatches")?.scrollIntoView({
  behavior: "smooth",
  block: "start"
});
    });
  });
}

function attachPickStatusWaEvents() {
  document.querySelectorAll(".pick-status-wa").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      var participantId = btn.getAttribute("data-participant-id");
      var entryId = btn.getAttribute("data-entry-id");
      var poolId = $("pickPool").value;
      await sendPicksViaWhatsApp(poolId, participantId, entryId);
    });
  });
}

async function exportParticipantPickImage(poolId, participantId) {
  hideAlert();

  if (!poolId || !participantId) {
    return showAlert("Falta jornada o participante.", "error");
  }

  try {
    // pool
    const pool = await getPoolInfo(poolId);

    // participante
    const { data: participant, error: pErr } = await supabaseClient
      .from("participants")
      .select("id, name, area, whatsapp")
      .eq("id", participantId)
      .maybeSingle();

    if (pErr) return showAlert(pErr.message, "error");
    if (!participant) return showAlert("Participante no encontrado.", "error");

    // boleto
    const { data: entry, error: eErr } = await supabaseClient
      .from("entries")
      .select("id, participant_id, pool_id")
      .eq("pool_id", poolId)
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (eErr) return showAlert(eErr.message, "error");
    if (!entry) return showAlert("Ese participante no tiene boleto en esta jornada.", "error");

    // partidos
    const { data: matches, error: mErr } = await supabaseClient
      .from("matches")
      .select("id, match_no, home_team, away_team")
      .eq("pool_id", poolId)
      .order("match_no", { ascending: true });

    if (mErr) return showAlert(mErr.message, "error");

    // picks
    const { data: picks, error: pkErr } = await supabaseClient
      .from("predictions_1x2")
      .select("match_id, pick")
      .eq("entry_id", entry.id);

    if (pkErr) return showAlert(pkErr.message, "error");

    const pickMap = new Map(
      (picks || []).map(function(p) {
        return [p.match_id, p.pick];
      })
    );

    const printArea = $("printArea");
    printArea.classList.remove("hidden");
    printArea.innerHTML = "";

    const card = makePickedTicketCard({
      pool: pool,
      participant: participant,
      matches: matches || [],
      pickMap: pickMap
    });

    printArea.appendChild(card);

    const canvas = await html2canvas(card, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });

    const a = document.createElement("a");
    const safeName = (participant.name || "boleto")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    a.download = `Boleto-${safeName}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();

    printArea.innerHTML = "";
    printArea.classList.add("hidden");

    showAlert("Imagen del boleto generada ✅", "ok");
  } catch (err) {
    showAlert("Error generando boleto: " + (err?.message || err), "error");
  }
}

function makePickedTicketCard(opts) {
  var pool        = opts.pool;
  var participant = opts.participant;
  var matches     = opts.matches || [];
  var pickMap     = opts.pickMap || new Map();

  var bg      = "#ffffff";
  var text    = "#111111";
  var sub     = "#555555";
  var border  = "#e4e4e7";
  var innerBg = "#f9f9fb";
  var softBg  = "#f0f0f2";
  var accent  = "#059669";
  var selFill = "#111111";

  var card = document.createElement("div");
  card.style.cssText = "width:860px;box-sizing:border-box;background:" + bg + ";color:" + text +
    ";border:1.5px solid " + border + ";border-radius:18px;padding:32px 28px;font-family:Arial,sans-serif;";

  var logoUrl     = (typeof QUINIELA_LOGO_URL !== "undefined") ? QUINIELA_LOGO_URL : "";
  var jornadaText = pool && pool.round ? ("Jornada " + pool.round) : (pool && pool.name ? pool.name : "Jornada");
  var dateText    = (pool && pool.date_label) ? pool.date_label : "—";
  var priceText   = "$" + Number((pool && pool.price) ? pool.price : 20);
  var season      = (pool && pool.season) ? pool.season : "";
  var partName    = (participant && participant.name) ? participant.name : "";
  var partArea    = (participant && participant.area) ? participant.area : "Sin área";
  var firstName   = partName.split(" ")[0] || "";

  card.innerHTML =
    "<div style='display:flex;align-items:center;gap:16px;margin-bottom:18px;'>" +
      "<img src='" + logoUrl + "' crossorigin='anonymous'" +
        " style='width:72px;height:72px;object-fit:contain;flex:0 0 auto;border-radius:10px;'/>" +
      "<div>" +
        "<div style='font-weight:900;font-size:26px;color:" + text + ";line-height:1.1;'>Quiniela Arc\u00e1ngel</div>" +
        "<div style='font-size:13px;color:" + sub + ";margin-top:4px;'>\"Pasi\u00f3n X Ganar\" \u26bd " + season + "</div>" +
      "</div>" +
    "</div>" +
    "<div style='display:grid;grid-template-columns:1fr 1fr 100px;gap:10px;margin-bottom:16px;'>" +
      "<div style='border:1px solid " + border + ";border-radius:10px;padding:10px 8px;text-align:center;background:" + innerBg + ";'>" +
        "<div style='font-size:10px;color:" + sub + ";text-transform:uppercase;letter-spacing:.6px;'>Jornada</div>" +
        "<div style='font-weight:800;font-size:15px;color:" + text + ";margin-top:4px;'>" + jornadaText + "</div>" +
      "</div>" +
      "<div style='border:1px solid " + border + ";border-radius:10px;padding:10px 8px;text-align:center;background:" + innerBg + ";'>" +
        "<div style='font-size:10px;color:" + sub + ";text-transform:uppercase;letter-spacing:.6px;'>Fechas</div>" +
        "<div style='font-weight:800;font-size:15px;color:" + text + ";margin-top:4px;'>" + dateText + "</div>" +
      "</div>" +
      "<div style='border:1px solid " + border + ";border-radius:10px;padding:10px 8px;text-align:center;background:" + innerBg + ";'>" +
        "<div style='font-size:10px;color:" + sub + ";text-transform:uppercase;letter-spacing:.6px;'>Costo</div>" +
        "<div style='font-weight:900;font-size:16px;color:" + accent + ";margin-top:4px;'>" + priceText + "</div>" +
      "</div>" +
    "</div>" +
    "<div style='margin-bottom:16px;padding:14px 16px;border-radius:12px;background:" + softBg + ";border:1px solid " + border + ";'>" +
      "<div style='font-size:19px;font-weight:800;color:" + text + ";'>" + partName + "</div>" +
      "<div style='font-size:13px;color:" + sub + ";margin-top:3px;'>" + partArea + "</div>" +
      "<div style='font-size:12px;color:" + accent + ";font-weight:700;margin-top:8px;'>Pron\u00f3stico registrado \u2705</div>" +
    "</div>" +
    "<div style='display:grid;grid-template-columns:80px 1fr 80px 1fr 80px;gap:10px;" +
      "margin-bottom:10px;font-size:11px;font-weight:800;color:" + sub + ";text-transform:uppercase;letter-spacing:.5px;'>" +
      "<div style='text-align:center;padding:7px;border-radius:8px;background:" + softBg + ";'>LOCAL</div>" +
      "<div></div>" +
      "<div style='text-align:center;padding:7px;border-radius:8px;background:" + softBg + ";'>EMPATE</div>" +
      "<div></div>" +
      "<div style='text-align:center;padding:7px;border-radius:8px;background:" + softBg + ";'>VISITA</div>" +
    "</div>";

  var table = document.createElement("div");
  table.style.cssText = "display:grid;gap:10px;";

  var boxW = 80, boxH = 48, logoSz = 28, teamFont = "14px";

  matches.forEach(function(m) {
    var pick     = pickMap.get(m.id) || "";
    var homeLogo = getTeamLogo(m.home_team);
    var awayLogo = getTeamLogo(m.away_team);

    function box(selected) {
      var bg2 = selected ? selFill : bg;
      var bd2 = selected ? selFill : border;
      return "<div style='width:" + boxW + "px;height:" + boxH + "px;" +
        "border:1.5px solid " + bd2 + ";border-radius:8px;background:" + bg2 + ";'></div>";
    }

    var row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:" + boxW + "px 1fr " + boxW + "px 1fr " + boxW + "px;" +
      "align-items:center;gap:10px;min-height:52px;";

    row.innerHTML =
      "<div style='display:flex;justify-content:center;align-items:center;'>" + box(pick === "H") + "</div>" +
      "<div style='display:flex;align-items:center;gap:8px;min-width:0;'>" +
        (homeLogo ? "<img src='" + homeLogo + "' crossorigin='anonymous'" +
          " style='width:" + logoSz + "px;height:" + logoSz + "px;object-fit:contain;flex:0 0 auto;'>" : "") +
        "<span style='font-weight:800;font-size:" + teamFont + ";color:" + text + ";line-height:1.4;white-space:nowrap;'>" +
          m.home_team + "</span>" +
      "</div>" +
      "<div style='display:flex;justify-content:center;align-items:center;'>" + box(pick === "D") + "</div>" +
      "<div style='display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;'>" +
        "<span style='font-weight:800;font-size:" + teamFont + ";color:" + text + ";line-height:1.4;white-space:nowrap;'>" +
          m.away_team + "</span>" +
        (awayLogo ? "<img src='" + awayLogo + "' crossorigin='anonymous'" +
          " style='width:" + logoSz + "px;height:" + logoSz + "px;object-fit:contain;flex:0 0 auto;'>" : "") +
      "</div>" +
      "<div style='display:flex;justify-content:center;align-items:center;'>" + box(pick === "A") + "</div>";

    table.appendChild(row);
  });

  card.appendChild(table);

  var footer = document.createElement("div");
  footer.style.cssText = "margin-top:22px;padding:14px 16px;border-radius:12px;" +
    "background:" + softBg + ";border:1px solid " + border + ";font-size:12px;line-height:1.7;color:" + text + ";";
  footer.innerHTML =
    "<div style='font-weight:800;font-size:14px;'>\u00a1Gracias por participar, " + firstName + "!</div>" +
    "<div style='margin-top:4px;color:" + sub + ";'>Recuerda: <strong>boleto pagado, boleto jugado.</strong></div>" +
    "<div style='margin-top:4px;color:" + sub + ";'>WhatsApp: <strong>8715118046</strong> &nbsp;\u2022&nbsp; \u00a1Mucha suerte!</div>";

  card.appendChild(footer);

  return card;
}


// ==============
// Boletos
// ==============

// Función Bloqueo Cierre Quiniela
async function closeActivePool() {
  hideAlert();

  const { data: activePool, error: findErr } = await supabaseClient
    .from("pools")
    .select("id, name, status")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) return showAlert(findErr.message, "error");

  if (!activePool) {
    return showAlert("No hay jornada activa para cerrar.", "error");
  }

  const ok = confirm(`¿Seguro que quieres cerrar la jornada activa?\n\n${activePool.name}\n\nDespués ya no se podrán registrar boletos ni guardar pronósticos.`);
  if (!ok) return;

  const { error } = await supabaseClient
    .from("pools")
    .update({ status: "closed" })
    .eq("id", activePool.id);

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada cerrada ✅", "ok");

  await loadPools();
  await loadDashboardSummary();
  await fillEntryPoolsSelect();
  await fillPickPoolsSelect();
  await fillStandingsPoolsSelect();
  await fillResultsPoolsSelect();
  await updateNavBadges();
}

// Función Reabrir Quiniela
async function openLatestClosedPool() {
  hideAlert();

  const { data: closedPool, error: findErr } = await supabaseClient
    .from("pools")
    .select("id, name, status")
    .eq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) return showAlert(findErr.message, "error");

  if (!closedPool) {
    return showAlert("No hay jornada cerrada para reabrir.", "error");
  }

  const ok = confirm(`¿Seguro que quieres reabrir esta jornada?\n\n${closedPool.name}`);
  if (!ok) return;

  // opcional: cerrar otras abiertas antes
  await supabaseClient
    .from("pools")
    .update({ status: "closed" })
    .eq("status", "open");

  const { error } = await supabaseClient
    .from("pools")
    .update({ status: "open" })
    .eq("id", closedPool.id);

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada reabierta ✅", "ok");

  await loadPools();
  await loadDashboardSummary();
  await fillEntryPoolsSelect();
  await fillPickPoolsSelect();
  await fillStandingsPoolsSelect();
  await fillResultsPoolsSelect();
  await updateNavBadges();
}

// Agregar Boleto
async function addEntry() {
  hideAlert();

  const pool_id = $("entryPool").value;
  const participant_id = $("entryParticipant").value;
  const paid = $("entryPaid").checked;

  if (!pool_id || !participant_id) {
    return showAlert("Falta seleccionar pool/participante.", "error");
  }

  // 🔒 Bloquear si la jornada ya está cerrada
  const { data: poolInfo, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", pool_id)
    .maybeSingle();

  if (poolErr) return showAlert(poolErr.message, "error");

  if (!poolInfo || poolInfo.status !== "open") {
    return showAlert("Esta jornada ya está cerrada. No se pueden registrar más boletos.", "error");
  }

  const payload = {
    pool_id,
    participant_id,
    paid,
    paid_at: paid ? new Date().toISOString() : null
  };

  const { error } = await supabaseClient
    .from("entries")
    .insert(payload);

  if (error) return showAlert(error.message, "error");

  showAlert("Boleto registrado ✅", "ok");
  $("entryPaid").checked = false;

  await loadEntriesAndStats();

  // Refrescar módulo Picks y dejar misma jornada / participante seleccionados
  await fillPickPoolsSelect();
  $("pickPool").value = pool_id;

  await fillPickParticipantsSelect();
  $("pickParticipant").value = participant_id;

  await loadPickStatusList();
  await loadDashboardSummary();
  await updateNavBadges();
}

//Lista Boletos Pagados
async function loadEntriesAndStats() {
  const pool_id = $("entryPool").value;
  if (!pool_id) return;

  // Stats desde vista pool_stats
  const { data: stats, error: stErr } = await supabaseClient
    .from("pool_stats")
    .select("paid_count, total_collected, commission_amount, prize_pool")
    .eq("pool_id", pool_id)
    .maybeSingle();

  if (stErr) {
    showAlert(stErr.message, "error");
  } else {
    const paidCount = Number(stats?.paid_count || 0);
    const total = Number(stats?.total_collected || 0);
    const comm = Number(stats?.commission_amount || 0);
    const prize = Number(stats?.prize_pool || 0);

    $("kpiPaid").textContent = paidCount;
    $("kpiTotal").textContent = money(total);
    $("kpiCommission").textContent = money(comm);
    $("kpiPrize").textContent = money(prize);
    $("kpiPrize2").textContent = money(prize);
  }

  // Estado de la jornada
  const { data: poolInfo, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", pool_id)
    .maybeSingle();

  if (poolErr) return showAlert(poolErr.message, "error");

  // Total de partidos en la jornada
  const { count: totalMatches, error: matchesCountErr } = await supabaseClient
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("pool_id", pool_id);

  if (matchesCountErr) return showAlert(matchesCountErr.message, "error");

  // Lista de entries
  const { data: rows, error } = await supabaseClient
    .from("entries")
    .select("id, paid, paid_at, created_at, participant_id, participants(name), pools(name)")
    .eq("pool_id", pool_id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return showAlert(error.message, "error");

  const entryIds = (rows || []).map(function(r) { return r.id; });

  // Picks para esos entries
  let picks = [];
  if (entryIds.length) {
    const { data: picksData, error: picksErr } = await supabaseClient
      .from("predictions_1x2")
      .select("entry_id, match_id");

    if (picksErr) return showAlert(picksErr.message, "error");

    picks = (picksData || []).filter(function(p) {
      return entryIds.indexOf(p.entry_id) !== -1;
    });
  }

  const picksCountByEntry = new Map();
  picks.forEach(function(p) {
    picksCountByEntry.set(
      p.entry_id,
      (picksCountByEntry.get(p.entry_id) || 0) + 1
    );
  });

  const isClosed = poolInfo?.status === "closed";
  const matchesTotal = Number(totalMatches || 0);

  // Calcular número de boleta por participante (orden cronológico)

  // Calcular número de boleta por participante
  const ticketTotalMap = new Map();
  (rows || []).slice().reverse().forEach(function(r) {
    ticketTotalMap.set(r.participant_id, (ticketTotalMap.get(r.participant_id) || 0) + 1);
  });
  const ticketNumberMap = new Map();
  const ticketSeenMap = new Map();
  (rows || []).slice().reverse().forEach(function(r) {
    const pid = r.participant_id;
    const seq = (ticketSeenMap.get(pid) || 0) + 1;
    ticketSeenMap.set(pid, seq);
    ticketNumberMap.set(r.id, { num: seq, total: ticketTotalMap.get(pid) });
  });

  $("entriesList").innerHTML = (rows || []).map(function(r) {
    const paidStatus = r.paid ? "paid" : "pending";
    const pickCount = Number(picksCountByEntry.get(r.id) || 0);
    const tInfo = ticketNumberMap.get(r.id);
    const boleta = tInfo && tInfo.total > 1
      ? ` <span style="font-size:10px;padding:2px 7px;border-radius:99px;background:rgba(6,182,212,.15);color:#67e8f9;border:1px solid rgba(6,182,212,.3);font-weight:700;">Boleta #${tInfo.num}</span>`
      : "";

    let picksEmoji = "⏳";
    let picksTextClass = "text-zinc-400";
    let picksStatus = "nopicks";

    if (pickCount > 0) {
      if (matchesTotal > 0 && pickCount >= matchesTotal) {
        picksEmoji = "✅";
        picksTextClass = "text-emerald-300";
        picksStatus = "complete";
      } else {
        picksEmoji = "🟡";
        picksTextClass = "text-yellow-300";
        picksStatus = "partial";
      }
    }

    const badge = r.paid
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
      : "bg-zinc-700/20 border-zinc-600/30 text-zinc-200";

    const actionBtn = isClosed
      ? `
        <button
          type="button"
          class="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-500 text-sm cursor-not-allowed"
          disabled>
          🔒
        </button>
      `
      : r.paid
        ? `
          <button
            type="button"
            class="entry-mark-pending px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
            data-entry-id="${r.id}">
            ↩️ Pendiente
          </button>
        `
        : `
          <button
            type="button"
            class="entry-mark-paid px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm"
            data-entry-id="${r.id}">
            ✅ Pagar
          </button>
        `;

    return `
      <div
  class="entry-card p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3"
  data-paid-status="${paidStatus}"
  data-picks-status="${picksStatus}"
  data-name="${String(r.participants?.name || "").toLowerCase()}">

        <div class="min-w-0">
          <div class="font-semibold flex items-center gap-2 flex-wrap">${r.participants?.name || "—"}${boleta}</div>

          <div class="text-xs text-zinc-400 mt-1">
            ${new Date(r.created_at).toLocaleString("es-MX")}
            ${r.paid && r.paid_at ? " • Pagó: " + new Date(r.paid_at).toLocaleString("es-MX") : ""}
          </div>

          <div class="text-xs mt-1 ${picksTextClass}">
            ${picksEmoji} Picks ${pickCount}/${matchesTotal}
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs px-2 py-1 rounded-full border ${badge}">
            ${r.paid ? "Pagado" : "Pendiente"}
          </span>
          ${actionBtn}
        </div>
      </div>
    `;
  }).join("");

  attachEntryPaymentEvents();
attachEntriesFilterEvents();
attachEntriesSearchEvent();
applyEntriesFilter(currentEntriesFilter);
updateEntriesFilterCounts();

}

// Agregar Filtros Pagos
function applyEntriesFilter(filterKey) {
  currentEntriesFilter = filterKey;

  const searchText = (currentEntriesSearch || "").trim().toLowerCase();

  document.querySelectorAll(".entries-filter-btn").forEach(function(btn) {
    const isActive = btn.getAttribute("data-filter") === filterKey;

    btn.classList.toggle("bg-emerald-600", isActive);
    btn.classList.toggle("text-white", isActive);

    btn.classList.toggle("bg-zinc-800", !isActive);
    btn.classList.toggle("hover:bg-zinc-700", !isActive);
  });

  document.querySelectorAll(".entry-card").forEach(function(card) {
    const paidStatus = card.getAttribute("data-paid-status");
    const picksStatus = card.getAttribute("data-picks-status");
    const name = card.getAttribute("data-name") || "";

    let matchFilter = true;

    if (filterKey === "paid") matchFilter = paidStatus === "paid";
    else if (filterKey === "pending") matchFilter = paidStatus === "pending";
    else if (filterKey === "complete") matchFilter = picksStatus === "complete";
    else if (filterKey === "partial") matchFilter = picksStatus === "partial";
    else if (filterKey === "nopicks") matchFilter = picksStatus === "nopicks";

    const matchSearch = !searchText || name.includes(searchText);

    card.classList.toggle("hidden", !(matchFilter && matchSearch));
  });
}

// Función Buscador Lista Pagos
function attachEntriesSearchEvent() {
  const input = $("entriesSearch");
  if (!input) return;

  input.removeEventListener("input", handleEntriesSearchInput);
  input.addEventListener("input", handleEntriesSearchInput);
}

function handleEntriesSearchInput(e) {
  currentEntriesSearch = e.target.value || "";
  applyEntriesFilter(currentEntriesFilter);
}


function attachEntriesFilterEvents() {
  document.querySelectorAll(".entries-filter-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      const filterKey = btn.getAttribute("data-filter");
      applyEntriesFilter(filterKey);
    });
  });
}

// Agregar Contadores Filtros Pagos
function updateEntriesFilterCounts() {
  const cards = Array.from(document.querySelectorAll(".entry-card"));

  const counts = {
    all: cards.length,
    paid: cards.filter(c => c.getAttribute("data-paid-status") === "paid").length,
    pending: cards.filter(c => c.getAttribute("data-paid-status") === "pending").length,
    complete: cards.filter(c => c.getAttribute("data-picks-status") === "complete").length,
    partial: cards.filter(c => c.getAttribute("data-picks-status") === "partial").length,
    nopicks: cards.filter(c => c.getAttribute("data-picks-status") === "nopicks").length
  };

  if ($("entriesCountAll")) $("entriesCountAll").textContent = counts.all;
  if ($("entriesCountPaid")) $("entriesCountPaid").textContent = counts.paid;
  if ($("entriesCountPending")) $("entriesCountPending").textContent = counts.pending;
  if ($("entriesCountComplete")) $("entriesCountComplete").textContent = counts.complete;
  if ($("entriesCountPartial")) $("entriesCountPartial").textContent = counts.partial;
  if ($("entriesCountNoPicks")) $("entriesCountNoPicks").textContent = counts.nopicks;
}

// ========================
// Selector Global Jornadas

async function fillTplPools() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, round, competition, season, price")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return showAlert(error.message, "error");

  const sel = $("tplPool");
  sel.innerHTML = (data || []).map(p => {
    const tag =
      p.status === "open" ? " (Activa)" :
      p.status === "draft" ? " (Borrador)" :
      " (Cerrada)";
    return `<option value="${p.id}">${p.name}${tag}</option>`;
  }).join("");
}


function buildTplRowsUI(n) {
  const wrap = $("tplRows");
  wrap.innerHTML = "";

  for (let i = 1; i <= n; i++) {
    const row = document.createElement("div");
    row.className = "tpl-row";
    row.innerHTML = `
      <div class="tpl-no">#${i}</div>
      <input data-home="${i}" class="tpl-in" placeholder="Local">
      <input data-away="${i}" class="tpl-in" placeholder="Visita">
    `;
    wrap.appendChild(row);
  }
}

async function saveTemplateMatches() {
  hideAlert();

  const pool_id = $("tplPool").value;
  const n = Number($("tplNumMatches").value || 9);

  if (!pool_id) {
    $("tplSavedStatus").textContent = "Selecciona una jornada.";
    showAlert("Selecciona una jornada.", "error");
    $("alert").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const rows = [];

  for (let i = 1; i <= n; i++) {
    const home = document.querySelector(`[data-home="${i}"]`)?.value?.trim();
    const away = document.querySelector(`[data-away="${i}"]`)?.value?.trim();

    if (!home || !away) {
      $("tplSavedStatus").textContent = `Falta capturar Local/Visita en partido #${i}`;
      showAlert(`Falta Local o Visita en partido #${i}`, "error");
      $("alert").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    rows.push({
      pool_id,
      match_no: i,
      home_team: home.toUpperCase(),
      away_team: away.toUpperCase()
    });
  }

  // Deshabilitar botón mientras guarda
  const btn = $("btnSaveTemplate");
  setBusy(btn, true, "Guardando...");
  $("tplSavedStatus").textContent = `Guardando plantilla (${rows.length} partidos)...`;

  // Helper: timeout para detectar Supabase colgado
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
          "⏱ Tiempo agotado en: " + label + ". Revisa RLS en Supabase → tabla matches → políticas DELETE e INSERT."
        )), ms)
      )
    ]);
  }

  // Mensaje de error siempre visible (fijo en pantalla, sin depender del scroll)
  function showFixedError(msg) {
    let el = document.getElementById("tplFixedError");
    if (!el) {
      el = document.createElement("div");
      el.id = "tplFixedError";
      el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;" +
        "background:#7f1d1d;color:#fef2f2;padding:14px 16px;font:13px system-ui;" +
        "line-height:1.5;border-bottom:2px solid #ef4444;";
      document.body.appendChild(el);
    }
    el.innerHTML = msg + "<br><small style='opacity:.8'>Toca aquí para cerrar</small>";
    el.style.display = "block";
    el.onclick = () => { el.style.display = "none"; };
  }

  try {
    // Estrategia fila por fila: UPDATE si existe, INSERT si no.
    // Evita locks de transacciones anteriores y no requiere unique constraint.
    for (const row of rows) {
      // 1) Intentar UPDATE
      const { data: updated, error: updErr } = await withTimeout(
        supabaseClient
          .from("matches")
          .update({ home_team: row.home_team, away_team: row.away_team })
          .eq("pool_id", row.pool_id)
          .eq("match_no", row.match_no)
          .select("id"),
        8000,
        `UPDATE partido #${row.match_no}`
      );
      if (updErr) throw new Error(`UPDATE partido #${row.match_no}: ${updErr.message}`);

      // 2) Si no actualizó ninguna fila, hacer INSERT
      if (!updated || updated.length === 0) {
        const { error: insErr } = await withTimeout(
          supabaseClient.from("matches").insert(row),
          8000,
          `INSERT partido #${row.match_no}`
        );
        if (insErr) throw new Error(`INSERT partido #${row.match_no}: ${insErr.message}`);
      }
    }

    $("tplSavedStatus").textContent = `Plantilla guardada: ${rows.length} partidos ✅`;
    showAlert(`Plantilla de ${rows.length} partidos guardada ✅`, "ok");
    $("alert").scrollIntoView({ behavior: "smooth", block: "center" });

    // Quitar error fijo si estaba visible
    const fixedErr = document.getElementById("tplFixedError");
    if (fixedErr) fixedErr.style.display = "none";

    await renderPreview();

  } catch (err) {
    const msg = err?.message || String(err);
    $("tplSavedStatus").textContent = "Error al guardar.";
    showAlert("❌ " + msg, "error");
    showFixedError("❌ ERROR GUARDANDO PLANTILLA:<br>" + msg);
  } finally {
    setBusy(btn, false);
  }
}

async function deleteCurrentTemplate() {
  hideAlert();

  const pool_id = $("tplPool").value;
  if (!pool_id) {
    $("tplSavedStatus").textContent = "Selecciona una jornada.";
    return showAlert("Selecciona una jornada.", "error");
  }

  const ok = confirm("¿Seguro que quieres borrar la plantilla de esta jornada?");
  if (!ok) return;

  $("tplSavedStatus").textContent = "Borrando plantilla...";
  showAlert("Borrando plantilla...", "ok");

  try {
    const { error } = await supabaseClient
      .from("matches")
      .delete()
      .eq("pool_id", pool_id);

    if (error) {
      $("tplSavedStatus").textContent = "Error borrando plantilla.";
      return showAlert("Error borrando plantilla: " + error.message, "error");
    }

    $("tplSavedStatus").textContent = "Plantilla borrada ✅";
    showAlert("Plantilla borrada ✅", "ok");

    $("tplPreviewWrap").innerHTML = `
      <div class="text-sm text-zinc-400 p-4">
        No hay partidos guardados para esta jornada todavía.
      </div>
    `;

    setTimeout(async () => {
      try {
        await loadTemplateIntoEditor();
        await renderPreview();
      } catch (e) {
        console.warn("No se pudo refrescar después de borrar plantilla:", e);
      }
    }, 300);

  } catch (err) {
    $("tplSavedStatus").textContent = "Error inesperado al borrar.";
    showAlert("Error inesperado: " + (err?.message || err), "error");
  }
}

async function getPoolInfo(pool_id){
  const { data, error } = await supabaseClient
    .from("pools")
    .select("name, round, competition, season, price, date_label")
    .eq("id", pool_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function clearTemplateEditor() {
  const n = Number($("tplNumMatches").value || 9);

  for (let i = 1; i <= n; i++) {
    const homeInput = document.querySelector(`[data-home="${i}"]`);
    const awayInput = document.querySelector(`[data-away="${i}"]`);

    if (homeInput) homeInput.value = "";
    if (awayInput) awayInput.value = "";
  }

  $("tplPreviewWrap").innerHTML = "";
  $("tplSavedStatus").textContent = "Editor limpio.";
  showAlert("Editor limpiado ✅", "ok");
}

async function getMatches(pool_id){
  const { data, error } = await supabaseClient
    .from("matches")
    .select("match_no, home_team, away_team")
    .eq("pool_id", pool_id)
    .order("match_no", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ===================
// Construcción Quiniela Arcángel

function makeTemplateCard(opts) {
  const title       = opts.title;
  const subtitle    = opts.subtitle;
  const jornadaText = opts.jornadaText;
  const dateText    = opts.dateText;
  const priceText   = opts.priceText;
  const matches     = opts.matches || [];
  const exportMode  = opts.exportMode === true;
  const showFooterInfo = opts.showFooterInfo !== false;

  // ── Paleta ──
  const bg       = exportMode ? "#ffffff"  : "#0b0f14";
  const text      = exportMode ? "#111111"  : "#e5e7eb";
  const sub       = exportMode ? "#555555"  : "#8a94a6";
  const border    = exportMode ? "#e4e4e7"  : "#1f2937";
  const innerBg   = exportMode ? "#f9f9fb"  : "#0a0e13";
  const softBg    = exportMode ? "#f0f0f2"  : "#111827";
  const accentClr = exportMode ? "#059669"  : "#34d399";

  const card = document.createElement("div");
  card.style.cssText = [
    "box-sizing:border-box",
    "font-family:Arial,sans-serif",
    "border-radius:" + (exportMode ? "18px" : "14px"),
    "border:1.5px solid " + border,
    "background:" + bg,
    "color:" + text,
    "padding:" + (exportMode ? "32px 28px" : "14px"),
    "width:" + (exportMode ? "860px" : "360px"),
    "max-width:100%"
  ].join(";");

  // ── HEADER: logo + título ──
  const logoSize = exportMode ? 72 : 50;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:${exportMode?"16px":"10px"};margin-bottom:${exportMode?"18px":"10px"};">
      <img src="${typeof QUINIELA_LOGO_URL!=="undefined"?QUINIELA_LOGO_URL:""}"
           alt="" crossorigin="anonymous"
           style="width:${logoSize}px;height:${logoSize}px;object-fit:contain;flex:0 0 auto;border-radius:10px;"/>
      <div>
        <div style="font-weight:900;font-size:${exportMode?"26px":"15px"};color:${text};line-height:1.1;">${title}</div>
        <div style="font-size:${exportMode?"13px":"10px"};color:${sub};margin-top:4px;">${subtitle}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 100px;gap:10px;margin-bottom:${exportMode?"18px":"10px"};">
      <div style="border:1px solid ${border};border-radius:10px;padding:${exportMode?"10px 8px":"7px"};text-align:center;background:${innerBg};">
        <div style="font-size:${exportMode?"10px":"9px"};color:${sub};text-transform:uppercase;letter-spacing:.6px;">Jornada</div>
        <div style="font-weight:800;font-size:${exportMode?"15px":"12px"};color:${text};margin-top:4px;">${jornadaText}</div>
      </div>
      <div style="border:1px solid ${border};border-radius:10px;padding:${exportMode?"10px 8px":"7px"};text-align:center;background:${innerBg};">
        <div style="font-size:${exportMode?"10px":"9px"};color:${sub};text-transform:uppercase;letter-spacing:.6px;">Fechas</div>
        <div style="font-weight:800;font-size:${exportMode?"15px":"12px"};color:${text};margin-top:4px;">${dateText}</div>
      </div>
      <div style="border:1px solid ${border};border-radius:10px;padding:${exportMode?"10px 8px":"7px"};text-align:center;background:${innerBg};">
        <div style="font-size:${exportMode?"10px":"9px"};color:${sub};text-transform:uppercase;letter-spacing:.6px;">Costo</div>
        <div style="font-weight:900;font-size:${exportMode?"16px":"13px"};color:${accentClr};margin-top:4px;">$${Number(priceText||0)}</div>
      </div>
    </div>

    <div style="text-align:center;font-size:${exportMode?"11px":"9px"};color:${sub};margin-bottom:${exportMode?"10px":"6px"};">
      Marca una sola opción por partido
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:${exportMode?"14px":"8px"};margin-bottom:${exportMode?"12px":"8px"};">
      <div style="text-align:center;font-size:${exportMode?"11px":"9px"};font-weight:800;color:${sub};background:${softBg};padding:${exportMode?"7px":"5px"};border-radius:8px;letter-spacing:.5px;">LOCAL</div>
      <div style="text-align:center;font-size:${exportMode?"11px":"9px"};font-weight:800;color:${sub};background:${softBg};padding:${exportMode?"7px":"5px"};border-radius:8px;letter-spacing:.5px;">EMPATE</div>
      <div style="text-align:center;font-size:${exportMode?"11px":"9px"};font-weight:800;color:${sub};background:${softBg};padding:${exportMode?"7px":"5px"};border-radius:8px;letter-spacing:.5px;">VISITA</div>
    </div>

    <div class="qh-table" style="display:grid;gap:${exportMode?"10px":"7px"};"></div>

    ${showFooterInfo ? `
    <div style="margin-top:${exportMode?"20px":"12px"};padding:${exportMode?"14px 16px":"9px 10px"};border:1px solid ${border};border-radius:12px;background:${softBg};font-size:${exportMode?"12px":"9px"};line-height:1.6;color:${text};">
      <div style="font-weight:700;">Devolver con tu pronóstico rellenado, tu nombre y tu área al WhatsApp: <strong>8715118046</strong></div>
      <div style="margin-top:4px;"><strong>Fecha límite de registro de pronósticos:</strong> Viernes 05:00 PM</div>
      <div style="margin-top:4px;font-weight:800;">Boleto pagado, boleto jugado. &nbsp;¡Suerte!</div>
    </div>` : ""}
  `;

  const table = card.querySelector(".qh-table");

  // ── Dimensiones de casilla y logo según modo ──
  const boxW      = exportMode ? 80 : 50;
  const boxH      = exportMode ? 48 : 32;
  const logoSzRow = exportMode ? 28 : 17;
  const teamFont  = exportMode ? "14px" : "11px";
  const colGap    = exportMode ? "10px" : "6px";

  matches.forEach(function(m) {
    const homeLogo = getTeamLogo(m.home_team);
    const awayLogo = getTeamLogo(m.away_team);

    const boxStyle = `width:${boxW}px;height:${boxH}px;border:1.5px solid ${border};border-radius:8px;background:${innerBg};flex:0 0 auto;`;

    const row = document.createElement("div");
    row.style.cssText = `display:grid;grid-template-columns:${boxW}px 1fr ${boxW}px 1fr ${boxW}px;align-items:center;column-gap:${colGap};min-height:${exportMode?52:36}px;`;

    row.innerHTML = `
      <div style="display:flex;justify-content:center;align-items:center;">
        <div style="${boxStyle}"></div>
      </div>

      <div style="display:flex;align-items:center;gap:${exportMode?"8px":"5px"};min-width:0;overflow:hidden;">
        ${homeLogo?`<img src="${homeLogo}" crossorigin="anonymous" style="width:${logoSzRow}px;height:${logoSzRow}px;object-fit:contain;flex:0 0 auto;">`:""}
        <span style="font-weight:800;font-size:${teamFont};color:${text};white-space:nowrap;overflow:visible;letter-spacing:.2px;line-height:1.4;padding-bottom:2px;">${m.home_team}</span>
      </div>

      <div style="display:flex;justify-content:center;align-items:center;">
        <div style="${boxStyle}"></div>
      </div>

      <div style="display:flex;align-items:center;justify-content:flex-end;gap:${exportMode?"8px":"5px"};min-width:0;overflow:hidden;">
        <span style="font-weight:800;font-size:${teamFont};color:${text};white-space:nowrap;overflow:visible;letter-spacing:.2px;line-height:1.4;padding-bottom:2px;">${m.away_team}</span>
        ${awayLogo?`<img src="${awayLogo}" crossorigin="anonymous" style="width:${logoSzRow}px;height:${logoSzRow}px;object-fit:contain;flex:0 0 auto;">`:""}
      </div>

      <div style="display:flex;justify-content:center;align-items:center;">
        <div style="${boxStyle}"></div>
      </div>
    `;

    table.appendChild(row);
  });

  return card;
}


async function loadTemplateIntoEditor() {
  hideAlert();

  const pool_id = $("tplPool").value;
  if (!pool_id) return;

  const { data: matches, error } = await supabaseClient
    .from("matches")
    .select("match_no, home_team, away_team")
    .eq("pool_id", pool_id)
    .order("match_no", { ascending: true });

  if (error) {
    $("tplSavedStatus").textContent = "Error cargando plantilla.";
    return showAlert(error.message, "error");
  }

  const rows = matches || [];

  // Si no hay plantilla guardada, deja el editor limpio con el número actual
  if (rows.length === 0) {
    buildTplRowsUI(Number($("tplNumMatches").value || 9));
    $("tplSavedStatus").textContent = "Sin plantilla guardada.";
    return;
  }

  // Ajustar cantidad de filas al número guardado
  $("tplNumMatches").value = rows.length;
  buildTplRowsUI(rows.length);

  // Rellenar inputs con lo ya guardado
  rows.forEach(m => {
    const homeInput = document.querySelector(`[data-home="${m.match_no}"]`);
    const awayInput = document.querySelector(`[data-away="${m.match_no}"]`);

    if (homeInput) homeInput.value = m.home_team || "";
    if (awayInput) awayInput.value = m.away_team || "";
  });

  $("tplSavedStatus").textContent = `Plantilla cargada en editor: ${rows.length} partidos`;
}

async function renderPreview() {
  const pool_id = $("tplPool").value;
  if (!pool_id) {
    $("tplPreviewWrap").innerHTML = "";
    $("tplSavedStatus").textContent = "Sin jornada seleccionada.";
    return;
  }

  const wrap = $("tplPreviewWrap");
  wrap.innerHTML = "";

  let pool, matches;
  try {
    pool = await getPoolInfo(pool_id);
    matches = await getMatches(pool_id);
  } catch (e) {
    $("tplSavedStatus").textContent = "Error cargando vista previa.";
    return showAlert(e.message, "error");
  }

  if (!matches || matches.length === 0) {
    $("tplSavedStatus").textContent = "Sin plantilla guardada.";
    wrap.innerHTML = `
      <div class="text-sm text-zinc-400 p-4">
        No hay partidos guardados para esta jornada todavía.
      </div>
    `;
    return;
  }

  const card = makeTemplateCard({
  title: "Quiniela Arcángel",
  subtitle: `"Pasión X Ganar" ⚽ ${pool?.season || ""}`.trim(),
  jornadaText: pool?.round ? `Jornada ${pool.round}` : (pool?.name || "Jornada"),
  dateText: (pool?.date_label || "FECHAS"),
  priceText: Number(pool?.price || 20),
  matches,
  exportMode: false
});

  wrap.appendChild(card);
  $("tplSavedStatus").textContent = `Plantilla guardada: ${matches.length} partidos`;
}

async function exportAllToPDF() {
  hideAlert();

  // trae pools que tengan plantilla
  const { data: pools, error } = await supabaseClient
    .from("pools")
    .select("id, name, round, season, price, date_label, created_at")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return showAlert(error.message, "error");

  // filtra solo pools con matches
  const cards = [];
  for (const p of (pools || [])) {
    const ms = await getMatches(p.id);
    if (!ms.length) continue;

    cards.push(makeTemplateCard({
      title: "Quiniela Arcángel",
      subtitle: `"Pasión X Ganar" ⚽ ${p.season || ""}`.trim(),
      jornadaText: p.round ? `Jornada ${p.round}` : p.name,
      dateText: (p.date_label || "FECHAS"),
      priceText: Number(p.price || 20),
      matches: ms,
exportMode: true
    }));
  }

  if (!cards.length) return showAlert("No hay plantillas guardadas aún.", "error");

  const printArea = $("printArea");
  printArea.classList.remove("hidden");
  printArea.innerHTML = "";

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const perPage = 9; // 5 + 4 (idéntico a tu Excel)
  let pageIndex = 0;

  for (let i = 0; i < cards.length; i += perPage) {
    const chunk = cards.slice(i, i + perPage);

    const sheet = document.createElement("div");
    sheet.className = "sheet";

    const row1 = document.createElement("div");
    row1.className = "sheet-row";
    chunk.slice(0,5).forEach(c => row1.appendChild(c));
    sheet.appendChild(row1);

    const row2 = document.createElement("div");
    row2.className = "sheet-row second";
    chunk.slice(5,9).forEach(c => row2.appendChild(c));
    sheet.appendChild(row2);

    printArea.appendChild(sheet);

    const canvas = await html2canvas(sheet, {
  scale: 2,
  backgroundColor: "#ffffff",
  useCORS: true
});
    const imgData = canvas.toDataURL("image/png");

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 10, 10, 822, 575); // A4 landscape aprox (pt)
    pageIndex++;

    printArea.innerHTML = "";
  }

  printArea.classList.add("hidden");
  pdf.save("Plantillas-Quiniela-Arcangel.pdf");
  showAlert("PDF generado ✅", "ok");
}

async function exportCurrentTemplatePNG() {
  hideAlert();

  const pool_id = $("tplPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada.", "error");

  let pool, matches;

  try {
    pool = await getPoolInfo(pool_id);
    matches = await getMatches(pool_id);
  } catch (e) {
    return showAlert(e.message, "error");
  }

  if (!matches || matches.length === 0) {
    return showAlert("Esta jornada no tiene plantilla guardada.", "error");
  }

  const printArea = $("printArea");
  printArea.classList.remove("hidden");
  printArea.innerHTML = "";

  // hoja blanca
  const sheet = document.createElement("div");
  sheet.style.background = "#ffffff";
  sheet.style.padding = "20px";
  sheet.style.width = "800px";
  sheet.style.boxSizing = "border-box";

  const card = makeTemplateCard({
    title: "Quiniela Arcángel",
    subtitle: `"Pasión X Ganar" ⚽ ${pool?.season || ""}`.trim(),
    jornadaText: pool?.round ? `Jornada ${pool.round}` : (pool?.name || "Jornada"),
    dateText: (pool?.date_label || "FECHAS"),
    priceText: Number(pool?.price || 20),
    matches,
    exportMode: true
  });

  sheet.appendChild(card);
  printArea.appendChild(sheet);

  try {
    const canvas = await html2canvas(sheet, {
  scale: 2,
  backgroundColor: "#ffffff",
  useCORS: true
});

    const a = document.createElement("a");
    const safeName = (pool?.name || "Plantilla")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    a.download = `${safeName}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();

    showAlert("Imagen generada ✅", "ok");
  } catch (err) {
    showAlert("Error generando imagen: " + (err?.message || err), "error");
  } finally {
    printArea.innerHTML = "";
    printArea.classList.add("hidden");
  }
}

async function exportStoryTemplatePNG() {
  hideAlert();

  const pool_id = $("tplPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada.", "error");

  let pool, matches;
  try {
    pool    = await getPoolInfo(pool_id);
    matches = await getMatches(pool_id);
  } catch(e) { return showAlert(e.message, "error"); }

  if (!matches || !matches.length) return showAlert("Esta jornada no tiene plantilla guardada.", "error");

  const printArea = $("printArea");
  printArea.classList.remove("hidden");
  printArea.innerHTML = "";

  // ── Canvas 1080 × 1920 ──
  const W = 1080, H = 1920;

  const story = document.createElement("div");
  story.style.cssText = `
    width:${W}px;height:${H}px;box-sizing:border-box;
    background:linear-gradient(160deg,#050810 0%,#071220 45%,#040c10 100%);
    display:flex;flex-direction:column;align-items:center;
    padding:80px 64px 70px;gap:0;font-family:Arial,sans-serif;
    position:relative;overflow:hidden;
  `;

  // Decorative glow blobs
  story.innerHTML = `
    <div style="position:absolute;top:-120px;left:-120px;width:500px;height:500px;
      border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.18) 0%,transparent 70%);
      pointer-events:none;"></div>
    <div style="position:absolute;bottom:-80px;right:-80px;width:420px;height:420px;
      border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,.12) 0%,transparent 70%);
      pointer-events:none;"></div>
  `;

  // ── TOP BRANDING ──
  const brand = document.createElement("div");
  brand.style.cssText = "display:flex;align-items:center;gap:18px;margin-bottom:40px;";
  brand.innerHTML = `
    <img src="${typeof QUINIELA_LOGO_URL!=="undefined"?QUINIELA_LOGO_URL:""}"
         crossorigin="anonymous"
         style="width:90px;height:90px;object-fit:contain;border-radius:16px;
                box-shadow:0 0 32px rgba(16,185,129,.4);"/>
    <div>
      <div style="font-size:38px;font-weight:900;color:#ffffff;line-height:1;">Quiniela Arcángel</div>
      <div style="font-size:20px;color:#34d399;margin-top:6px;font-weight:600;">"Pasión X Ganar" ⚽ ${pool?.season||""}</div>
    </div>
  `;
  story.appendChild(brand);

  // ── JORNADA HEADING ──
  const heading = document.createElement("div");
  heading.style.cssText = "text-align:center;margin-bottom:28px;";
  heading.innerHTML = `
    <div style="font-size:72px;font-weight:900;color:#ffffff;line-height:1;letter-spacing:-1px;">
      Jornada ${pool?.round||""}
    </div>
    <div style="font-size:26px;color:#8a94a6;margin-top:10px;">${pool?.competition||"Liga MX"}</div>
  `;
  story.appendChild(heading);

  // ── CHIPS: fechas + costo ──
  const chips = document.createElement("div");
  chips.style.cssText = "display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:40px;";
  chips.innerHTML = `
    <div style="padding:12px 26px;border-radius:999px;background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.14);font-size:22px;font-weight:800;color:#e5e7eb;">
      📅 ${pool?.date_label||"—"}
    </div>
    <div style="padding:12px 26px;border-radius:999px;
      background:linear-gradient(135deg,#059669,#10b981);
      font-size:22px;font-weight:900;color:#ffffff;
      box-shadow:0 4px 20px rgba(16,185,129,.45);">
      $${Number(pool?.price||20)} por boleto
    </div>
  `;
  story.appendChild(chips);

  // ── DIVIDER ──
  const div1 = document.createElement("div");
  div1.style.cssText = "width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);margin-bottom:32px;";
  story.appendChild(div1);

  // ── MATCHES TABLE (no boxes — informativo) ──
  const tbl = document.createElement("div");
  tbl.style.cssText = "width:100%;display:grid;gap:14px;";

  // Header row
  const hdr = document.createElement("div");
  hdr.style.cssText = "display:grid;grid-template-columns:1fr 60px 1fr;gap:10px;margin-bottom:4px;";
  hdr.innerHTML = `
    <div style="text-align:left;font-size:17px;font-weight:800;color:#34d399;letter-spacing:.8px;text-transform:uppercase;padding-left:4px;">LOCAL</div>
    <div></div>
    <div style="text-align:right;font-size:17px;font-weight:800;color:#34d399;letter-spacing:.8px;text-transform:uppercase;padding-right:4px;">VISITA</div>
  `;
  tbl.appendChild(hdr);

  matches.forEach(function(m, i) {
    const homeLogo = getTeamLogo(m.home_team);
    const awayLogo = getTeamLogo(m.away_team);
    const isEven = i % 2 === 0;

    const row = document.createElement("div");
    row.style.cssText = `
      display:grid;grid-template-columns:1fr 60px 1fr;gap:10px;align-items:center;
      padding:14px 16px;border-radius:16px;
      background:${isEven?"rgba(255,255,255,.05)":"rgba(255,255,255,.03)"};
      border:1px solid rgba(255,255,255,.07);
    `;
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        ${homeLogo?`<img src="${homeLogo}" crossorigin="anonymous" style="width:36px;height:36px;object-fit:contain;flex:0 0 auto;">`:""}
        <span style="font-weight:800;font-size:19px;color:#f0f4f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.home_team}</span>
      </div>
      <div style="text-align:center;font-size:16px;font-weight:700;color:#4a5568;">VS</div>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0;">
        <span style="font-weight:800;font-size:19px;color:#f0f4f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.away_team}</span>
        ${awayLogo?`<img src="${awayLogo}" crossorigin="anonymous" style="width:36px;height:36px;object-fit:contain;flex:0 0 auto;">`:""}
      </div>
    `;
    tbl.appendChild(row);
  });

  story.appendChild(tbl);

  // ── DIVIDER ──
  const div2 = document.createElement("div");
  div2.style.cssText = "width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);margin-top:32px;margin-bottom:30px;";
  story.appendChild(div2);

  // ── FOOTER CTA ──
  const footer = document.createElement("div");
  footer.style.cssText = "text-align:center;margin-top:auto;";
  footer.innerHTML = `
    <div style="font-size:22px;color:#8a94a6;line-height:1.7;">
      Envía tu pronóstico al WhatsApp:
    </div>
    <div style="font-size:34px;font-weight:900;color:#34d399;margin-top:6px;">8715118046</div>
    <div style="font-size:20px;color:#8a94a6;margin-top:10px;">Fecha límite: Viernes 05:00 PM</div>
    <div style="font-size:28px;font-weight:900;color:#ffffff;margin-top:18px;">¡Suerte a todos! 🏆</div>
  `;
  story.appendChild(footer);

  printArea.appendChild(story);

  try {
    const canvas = await html2canvas(story, { scale:1, backgroundColor:"#050810", useCORS:true });

    const a = document.createElement("a");
    const safeName = (pool?.name||"Plantilla-Historia").replace(/[^\w\s-]/g,"").replace(/\s+/g,"-");
    a.download = `${safeName}-story-9x16.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();

    showAlert("Historia premium 9:16 generada ✅", "ok");
  } catch(err) {
    showAlert("Error generando historia: " + (err?.message||err), "error");
  } finally {
    printArea.innerHTML = "";
    printArea.classList.add("hidden");
  }
}

async function exportAllToPNGs() {
  hideAlert();

  const { data: pools, error } = await supabaseClient
    .from("pools")
    .select("id, name, round, season, price, date_label, created_at")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return showAlert(error.message, "error");

  const printArea = $("printArea");
  printArea.classList.remove("hidden");
  printArea.innerHTML = "";

  let count = 0;

  for (const p of (pools || [])) {
    const ms = await getMatches(p.id);
    if (!ms.length) continue;

    const card = makeTemplateCard({
      title: "Quiniela Arcángel",
      subtitle: `"Pasión X Ganar" ⚽ ${p.season || ""}`.trim(),
      jornadaText: p.round ? `Jornada ${p.round}` : p.name,
      dateText: (p.date_label || "FECHAS"),
      priceText: Number(p.price || 20),
      matches: ms,
exportMode: true
    });

    printArea.appendChild(card);

    const canvas = await html2canvas(card, { scale: 2, backgroundColor: "#0b0f14" });
    const a = document.createElement("a");
    a.download = `Plantilla-${(p.round ?? p.name ?? "Jornada")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();

    printArea.innerHTML = "";
    count++;
  }

  printArea.classList.add("hidden");
  showAlert(`Imágenes generadas: ${count} ✅`, "ok");
}

async function fillPickSelectors() {
  // reutiliza tus pools/participants si ya tienes funciones; si no:
  const poolsRes = await supabaseClient
    .from("pools")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (poolsRes.error) return showAlert(poolsRes.error.message, "error");

  $("pickPool").innerHTML = (poolsRes.data || []).map(p =>
    `<option value="${p.id}">${p.name}${p.status === "open" ? " (Activa)" : ""}</option>`
  ).join("");

  const partsRes = await supabaseClient
    .from("participants")
    .select("id, name, area, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (partsRes.error) return showAlert(partsRes.error.message, "error");

  $("pickParticipant").innerHTML = (partsRes.data || []).map(p =>
    `<option value="${p.id}">${p.name}${p.area ? " • " + p.area : ""}</option>`
  ).join("");
}

// =====================
// Funciones Resultados 
// =====================

// Selector de Jornadas por Plantillas
async function fillResultsPoolsSelect() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return showAlert(error.message, "error");

  const sel = $("resultsPool");
  sel.innerHTML = (data || []).map(function(p) {
    const tag = p.status === "open" ? " ✅ Activa" : "";
    return `<option value="${p.id}">${p.name}${tag}</option>`;
  }).join("");

  // Auto-seleccionar jornada activa, si no la primera
  const active = (data || []).find(function(p) { return p.status === "open"; });
  if (active) sel.value = active.id;
  else if ((data || []).length) sel.value = data[0].id;
}

// Renders de Partidos
function renderResultRow(match) {
  const hg = match.home_goals ?? "";
  const ag = match.away_goals ?? "";

  let outcome = "Pendiente";
  let totalGoals = 0;

  if (hg !== "" && ag !== "") {
    const homeGoals = Number(hg);
    const awayGoals = Number(ag);
    totalGoals = homeGoals + awayGoals;

    if (homeGoals > awayGoals) outcome = "Local";
    else if (homeGoals === awayGoals) outcome = "Empate";
    else outcome = "Visita";
  }

  return `
    <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
      <div class="text-xs text-zinc-400 mb-2">Partido #${match.match_no}</div>
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0 text-right">
          <div class="text-xs text-zinc-400 mb-0.5">Local</div>
          <div class="text-sm font-bold truncate">${match.home_team}</div>
        </div>
        <input type="number" min="0" inputmode="numeric"
          data-result-home="${match.id}" value="${hg}"
          class="w-14 shrink-0 p-2 bg-zinc-900 border border-zinc-700 rounded-xl text-center text-lg font-black" />
        <div class="text-zinc-500 font-bold text-xs shrink-0">vs</div>
        <input type="number" min="0" inputmode="numeric"
          data-result-away="${match.id}" value="${ag}"
          class="w-14 shrink-0 p-2 bg-zinc-900 border border-zinc-700 rounded-xl text-center text-lg font-black" />
        <div class="flex-1 min-w-0">
          <div class="text-xs text-zinc-400 mb-0.5">Visita</div>
          <div class="text-sm font-bold truncate">${match.away_team}</div>
        </div>
      </div>
      <div class="mt-2 flex items-center justify-between text-xs">
        <div class="text-zinc-400">Resultado: <span data-result-outcome="${match.id}" class="font-semibold text-zinc-200">${outcome}</span></div>
        <div class="text-zinc-400">Goles: <span data-result-total="${match.id}" class="font-semibold text-zinc-200">${totalGoals}</span></div>
      </div>
    </div>
  `;
}

// Cargar partidos Jornada con Goles Actuales
async function loadResultsMatches() {
  hideAlert();

  const pool_id = $("resultsPool").value;
  if (!pool_id) {
    $("resultsMatchesList").innerHTML = "";
    $("resultsGoalsTotal").textContent = "0";
    return showAlert("Selecciona una jornada.", "error");
  }

  const { data: matches, error } = await supabaseClient
    .from("matches")
    .select("id, match_no, home_team, away_team, home_goals, away_goals")
    .eq("pool_id", pool_id)
    .order("match_no", { ascending: true });

  if (error) return showAlert(error.message, "error");

  const rows = matches || [];

  if (!rows.length) {
    $("resultsMatchesList").innerHTML = `
      <div class="text-sm text-zinc-400 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
        Esta jornada no tiene plantilla guardada todavía.
      </div>
    `;
    $("resultsGoalsTotal").textContent = "0";
    return;
  }

  $("resultsMatchesList").innerHTML = rows.map(renderResultRow).join("");

  attachResultsInputsEvents();
  updateResultsGoalsSummary();
}

// Actualizar Cálculo Visual Automático
function attachResultsInputsEvents() {
  document.querySelectorAll("[data-result-home], [data-result-away]").forEach(function(inp) {
    inp.addEventListener("input", function() {
      const matchId = inp.hasAttribute("data-result-home")
        ? inp.getAttribute("data-result-home")
        : inp.getAttribute("data-result-away");

      const homeVal = document.querySelector(`[data-result-home="${matchId}"]`)?.value;
      const awayVal = document.querySelector(`[data-result-away="${matchId}"]`)?.value;

      let outcome = "Pendiente";
      let totalGoals = 0;

      if (homeVal !== "" && awayVal !== "") {
        const hg = Number(homeVal);
        const ag = Number(awayVal);
        totalGoals = hg + ag;

        if (hg > ag) outcome = "Local";
        else if (hg === ag) outcome = "Empate";
        else outcome = "Visita";
      }

      const outEl = document.querySelector(`[data-result-outcome="${matchId}"]`);
      const totalEl = document.querySelector(`[data-result-total="${matchId}"]`);

      if (outEl) outEl.textContent = outcome;
      if (totalEl) totalEl.textContent = totalGoals;

      updateResultsGoalsSummary();
    });
  });
}

function updateResultsGoalsSummary() {
  let total = 0;

  document.querySelectorAll("[data-result-total]").forEach(function(el) {
    total += Number(el.textContent || 0);
  });

  $("resultsGoalsTotal").textContent = String(total);
}

// Guardar Resultados
async function saveResultsMatches() {
  hideAlert();

  const pool_id = $("resultsPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada.", "error");

  const { data: matches, error: loadErr } = await supabaseClient
    .from("matches")
    .select("id")
    .eq("pool_id", pool_id)
    .order("match_no", { ascending: true });

  if (loadErr) return showAlert(loadErr.message, "error");

  const rows = matches || [];

  if (!rows.length) {
    return showAlert("Esta jornada no tiene partidos cargados.", "error");
  }

  for (let i = 0; i < rows.length; i++) {
    const matchId = rows[i].id;
    const homeVal = document.querySelector(`[data-result-home="${matchId}"]`)?.value;
    const awayVal = document.querySelector(`[data-result-away="${matchId}"]`)?.value;

    const home_goals = homeVal === "" ? null : Number(homeVal);
    const away_goals = awayVal === "" ? null : Number(awayVal);

    const { error } = await supabaseClient
      .from("matches")
      .update({ home_goals, away_goals })
      .eq("id", matchId);

    if (error) {
      return showAlert("Error guardando partido: " + error.message, "error");
    }
  }

  showAlert("Resultados guardados ✅", "ok");
}

// =====================
// Funciones Aciertos
// =====================

// Selector Jornadas para Aciertos
async function fillStandingsPoolsSelect() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return showAlert(error.message, "error");

  const sel = $("standingsPool");
  sel.innerHTML = (data || []).map(function(p) {
    const tag = p.status === "open" ? " (Activa)" : "";
    return `<option value="${p.id}">${p.name}${tag}</option>`;
  }).join("");

  const active = (data || []).find(function(p) {
    return p.status === "open";
  });

  if (active) sel.value = active.id;
}

// Preview Podio Ganadores
function renderStandingsPodium(rows) {
  if (!rows || !rows.length) return "";

  const top = rows.slice(0, 3);

  const first = top[0] || null;
  const second = top[1] || null;
  const third = top[2] || null;

  function makeCard(item, place) {
    if (!item) {
      return `
        <div class="p-3 rounded-xl border bg-zinc-950 border-zinc-800 text-center opacity-50">
          <div class="text-2xl mb-1">—</div>
          <div class="text-sm text-zinc-500">Sin dato</div>
        </div>
      `;
    }

    let emoji = "🏅";
    let title = "Lugar";
    let boxClass = "bg-zinc-950 border-zinc-800";
    let pointsClass = "text-white";

    if (place === 1) {
      emoji = "🥇";
      title = "1er lugar";
      boxClass = "bg-yellow-500/10 border-yellow-500/20";
      pointsClass = "text-yellow-300";
    } else if (place === 2) {
      emoji = "🥈";
      title = "2do lugar";
      boxClass = "bg-slate-400/10 border-slate-400/20";
      pointsClass = "text-slate-200";
    } else if (place === 3) {
      emoji = "🥉";
      title = "3er lugar";
      boxClass = "bg-amber-700/10 border-amber-700/20";
      pointsClass = "text-amber-300";
    }

    return `
      <div class="p-3 rounded-xl border ${boxClass} text-center">
        <div class="text-3xl mb-1">${emoji}</div>
        <div class="text-xs uppercase tracking-wide text-zinc-400">${title}</div>
        <div class="mt-2 font-extrabold text-white truncate">${item.name}</div>
        <div class="text-xs text-zinc-400 mt-1 truncate">${item.area || "Sin área"}</div>
        <div class="mt-2 text-lg font-extrabold ${pointsClass}">${item.points}</div>
        <div class="text-xs text-zinc-400">aciertos</div>
      </div>
    `;
  }

  return `
    <div class="grid grid-cols-3 gap-2">
      ${makeCard(second, 2)}
      ${makeCard(first, 1)}
      ${makeCard(third, 3)}
    </div>
  `;
  // Auto-seleccionar jornada activa
  const activePool = (data || []).find(function(p) { return p.status === "open"; });
  if (activePool) sel.value = activePool.id;
  else if ((data || []).length) sel.value = data[0].id;
}



// Función Ganador Quiniela Sencilla (carga desde Supabase)
async function loadSimpleWinnerSummary(poolId) {
  const pool_id = poolId || $("standingsPool").value;
  if (!pool_id) return null;

  const { data: winners, error } = await supabaseClient
    .from("pool_simple_winner")
    .select("pool_id,entry_id,participant_id,winning_points,winners_count,prize_pool,commission_amount,total_collected,prize_per_winner")
    .eq("pool_id", pool_id);

  if (error) { showAlert(error.message, "error"); return null; }
  if (!winners || !winners.length) return null;

  const participantIds = winners.map(function(w){ return w.participant_id; });
  const { data: parts, error: pErr } = await supabaseClient
    .from("participants").select("id, name, area").in("id", participantIds);
  if (pErr) { showAlert(pErr.message, "error"); return null; }

  const partMap = new Map((parts||[]).map(function(p){ return [p.id, p]; }));

  return {
    winners: winners.map(function(w) {
      const p = partMap.get(w.participant_id) || {};
      return { participant_id: w.participant_id, name: p.name||"Sin nombre",
               area: p.area||"", winning_points: Number(w.winning_points||0) };
    }),
    winners_count:      Number(winners[0].winners_count      || 0),
    prize_pool:         Number(winners[0].prize_pool         || 0),
    commission_amount:  Number(winners[0].commission_amount  || 0),
    total_collected:    Number(winners[0].total_collected    || 0),
    prize_per_winner:   Number(winners[0].prize_per_winner   || 0),
    winning_points:     Number(winners[0].winning_points     || 0)
  };
}

// Render caja ganador/lider en la sección Aciertos
function renderSimpleWinnerBox(rows, poolStats, completionInfo, winnerSummary) {
  if (!rows || !rows.length) {
    return '<div class="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-400">Aún no hay datos suficientes para determinar líder o ganador.</div>';
  }

  var prizePool        = Number(poolStats?.prize_pool        || 0);
  var paidCount        = Number(poolStats?.paid_count        || 0);
  var totalCollected   = Number(poolStats?.total_collected   || 0);
  var commissionAmount = Number(poolStats?.commission_amount || 0);
  var isFinished       = !!(completionInfo && completionInfo.isFinished);
  var totalMatches     = Number(completionInfo?.totalMatches    || 0);
  var completedMatches = Number(completionInfo?.completedMatches || 0);
  var progressText     = totalMatches ? "Partidos con resultado: " + completedMatches + "/" + totalMatches : "Sin partidos cargados";

  if (!winnerSummary || !winnerSummary.winners || !winnerSummary.winners.length) {
    return [
      '<div class="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">',
        '<div class="text-xs uppercase tracking-wide text-zinc-400">Quiniela Sencilla</div>',
        '<div class="mt-2 text-sm text-zinc-300">Todavía no hay ganador calculado para esta jornada.</div>',
        '<div class="text-xs text-zinc-500 mt-2">' + progressText + '</div>',
        '<div class="grid grid-cols-3 gap-2 mt-4 text-sm">',
          '<div class="p-3 bg-zinc-900 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Pagados</div><div class="font-bold text-white">' + paidCount + '</div></div>',
          '<div class="p-3 bg-zinc-900 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Total</div><div class="font-bold text-white">' + money(totalCollected) + '</div></div>',
          '<div class="p-3 bg-zinc-900 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Bolsa</div><div class="font-bold text-white">' + money(prizePool) + '</div></div>',
        '</div>',
      '</div>'
    ].join("");
  }

  var winners        = winnerSummary.winners;
  var winnersCount   = Number(winnerSummary.winners_count   || 0);
  var winningPoints  = Number(winnerSummary.winning_points  || 0);
  var prizePerWinner = Number(winnerSummary.prize_per_winner || 0);
  var isTie          = winnersCount > 1;

  var titleLabel = isTie
    ? (isFinished ? "EMPATE FINAL • QUINIELA SENCILLA" : "EMPATE PROVISIONAL • QUINIELA SENCILLA")
    : (isFinished ? "GANADOR FINAL • QUINIELA SENCILLA" : "GANADOR PROVISIONAL • QUINIELA SENCILLA");

  var boxClass   = isTie    ? "bg-amber-500/10 border-amber-500/20"  : isFinished ? "bg-sky-500/10 border-sky-500/20"    : "bg-emerald-500/10 border-emerald-500/20";
  var titleClass = isTie    ? "text-amber-300"                       : isFinished ? "text-sky-300"                       : "text-emerald-300";
  var prizeClass = titleClass;

  var winnerNames = winners.map(function(x){ return x.name; }).join(", ");
  var winnerAreas = [...new Set(winners.map(function(x){ return x.area||""; }).filter(Boolean))].join(", ");

  return [
    '<div class="p-4 ' + boxClass + ' border rounded-xl">',
      '<div class="text-xs uppercase tracking-wide ' + titleClass + '">' + titleLabel + '</div>',
      '<div class="mt-2 text-xl font-extrabold text-white">' + winnerNames + '</div>',
      '<div class="text-sm text-zinc-300 mt-1">' + (winnerAreas || "Sin área") + ' • ' + winningPoints + ' aciertos</div>',
      '<div class="text-xs text-zinc-400 mt-2">' + progressText + '</div>',
      '<div class="grid grid-cols-2 gap-2 mt-4 text-sm">',
        '<div class="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Bolsa actual</div><div class="font-bold text-white">' + money(prizePool) + '</div></div>',
        '<div class="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Premio automático' + (isTie ? " por persona" : "") + '</div><div class="font-bold ' + prizeClass + '">' + money(prizePerWinner) + '</div></div>',
      '</div>',
      '<div class="grid grid-cols-3 gap-2 mt-2 text-sm">',
        '<div class="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Pagados</div><div class="font-bold text-white">' + paidCount + '</div></div>',
        '<div class="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Total</div><div class="font-bold text-white">' + money(totalCollected) + '</div></div>',
        '<div class="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Comisión</div><div class="font-bold text-white">' + money(commissionAmount) + '</div></div>',
      '</div>',
    '</div>'
  ].join("");
}

// Función completion info (requerida por loadStandings y exportWinnerCard)
async function getPoolCompletionInfo(poolId) {
  const { data, error } = await supabaseClient
    .from("matches")
    .select("id, home_goals, away_goals")
    .eq("pool_id", poolId);
  if (error) throw error;
  const rows = data || [];
  const totalMatches = rows.length;
  const completedMatches = rows.filter(function(m) {
    return m.home_goals !== null && m.away_goals !== null;
  }).length;
  return {
    totalMatches: totalMatches,
    completedMatches: completedMatches,
    isFinished: totalMatches > 0 && completedMatches === totalMatches
  };
}

// Cargar Tabla Aciertos
async function loadStandings() {
  hideAlert();

  const pool_id = $("standingsPool").value;
  if (!pool_id) {
    $("standingsList").innerHTML = "";
    $("standingsGoalsTotal").textContent = "0";
    $("standingsWinnerBox").innerHTML = "";
    if ($("standingsInfoBox")) $("standingsInfoBox").innerHTML = "";
    if ($("standingsPodiumBox")) $("standingsPodiumBox").innerHTML = "";
    return showAlert("Selecciona una jornada.", "error");
  }

  // Solo entries pagados de la jornada
  const { data: paidEntries, error: paidErr } = await supabaseClient
    .from("entries")
    .select("id, participant_id, paid")
    .eq("pool_id", pool_id)
    .eq("paid", true);

  if (paidErr) return showAlert(paidErr.message, "error");

  const paidEntryIds = (paidEntries || []).map(function(e) {
    return e.id;
  });

  const paidParticipantIds = (paidEntries || []).map(function(e) {
    return e.participant_id;
  });

  // Si no hay pagados, limpiar y salir bonito
  if (!paidEntryIds.length) {
    const { data: goalsData, error: goalsErr } = await supabaseClient
      .from("pool_goals_total")
      .select("total_goals")
      .eq("pool_id", pool_id)
      .maybeSingle();

    if (goalsErr) return showAlert(goalsErr.message, "error");

    $("standingsGoalsTotal").textContent = String(goalsData?.total_goals || 0);

    if ($("standingsInfoBox")) {
      $("standingsInfoBox").innerHTML = `
        <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-300">
          📊 Tabla oficial: solo participan boletos <strong>pagados</strong>.
          <div class="text-xs mt-1 opacity-80">
            💡 Tip: paga tu boleto antes del cierre para participar en la tabla oficial.
          </div>
        </div>
      `;
    }

    if ($("standingsPodiumBox")) $("standingsPodiumBox").innerHTML = "";

    $("standingsWinnerBox").innerHTML = `
      <div class="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-400">
        Todavía no hay boletos pagados para esta jornada.
      </div>
    `;

    $("standingsList").innerHTML = `
      <div class="text-sm text-zinc-400 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
        No hay boletos pagados para mostrar en la tabla oficial.
      </div>
    `;

    return;
  }

  // Puntos por boleto, pero solo de entries pagados
  const { data: pointsRows, error: pointsErr } = await supabaseClient
    .from("entry_points")
    .select("entry_id, pool_id, participant_id, points, played_matches, captured_picks")
    .eq("pool_id", pool_id)
    .in("entry_id", paidEntryIds);

  if (pointsErr) return showAlert(pointsErr.message, "error");

  // Participantes solo de entries pagados
  const { data: participants, error: partErr } = await supabaseClient
    .from("participants")
    .select("id, name, area")
    .in("id", paidParticipantIds);

  if (partErr) return showAlert(partErr.message, "error");

  const partMap = new Map(
    (participants || []).map(function(p) {
      return [p.id, p];
    })
  );

  // Total de goles jornada
  const { data: goalsData, error: goalsErr } = await supabaseClient
    .from("pool_goals_total")
    .select("total_goals")
    .eq("pool_id", pool_id)
    .maybeSingle();

  if (goalsErr) return showAlert(goalsErr.message, "error");

  $("standingsGoalsTotal").textContent = String(goalsData?.total_goals || 0);

  const rows = (pointsRows || []).map(function(r) {
    const p = partMap.get(r.participant_id) || {};
    return {
      entry_id: r.entry_id,
      participant_id: r.participant_id,
      name: p.name || "Sin nombre",
      area: p.area || "",
      points: Number(r.points || 0),
      played_matches: Number(r.played_matches || 0),
      captured_picks: Number(r.captured_picks || 0)
    };
  });

  rows.sort(function(a, b) {
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name);
  });

  if ($("standingsPodiumBox")) {
    $("standingsPodiumBox").innerHTML = renderStandingsPodium(rows);
  }

  // Stats de la jornada
  const { data: poolStats, error: statsErr } = await supabaseClient
    .from("pool_stats")
    .select("paid_count, total_collected, commission_amount, prize_pool")
    .eq("pool_id", pool_id)
    .maybeSingle();

  if (statsErr) return showAlert(statsErr.message, "error");

  const completionInfo = await getPoolCompletionInfo(pool_id);
  const winnerSummary = await loadSimpleWinnerSummary(pool_id);

  const isFinished = completionInfo?.isFinished;

  if ($("standingsInfoBox")) {
    $("standingsInfoBox").innerHTML = `
      <div class="p-3 border rounded-xl text-sm ${
        isFinished
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
          : "bg-blue-500/10 border-blue-500/20 text-blue-300"
      }">
        ${
          isFinished
            ? "🏁 Jornada finalizada. Resultados oficiales."
            : "📊 Tabla en tiempo real (puede cambiar conforme se registren resultados)."
        }
        <br>
        Solo participan boletos <strong>pagados</strong>.
        <div class="text-xs mt-1 opacity-80">
          💡 Tip: paga tu boleto antes del cierre para participar en la tabla oficial.
        </div>
      </div>
    `;
  }

  $("standingsWinnerBox").innerHTML = renderSimpleWinnerBox(
    rows,
    poolStats,
    completionInfo,
    winnerSummary
  );

  $("standingsList").innerHTML = rows.length
    ? rows.map(function(r, index) {
        const pos = index + 1;
        const area = r.area ? " • " + r.area : "";

        return `
          <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-semibold">${pos}. ${r.name}</div>
              <div class="text-xs text-zinc-400 truncate">
                ${area} • Picks: ${r.captured_picks} • Partidos jugados: ${r.played_matches}
              </div>
            </div>

            <div class="shrink-0 text-right">
              <div class="text-lg font-extrabold text-emerald-300">${r.points}</div>
              <div class="text-xs text-zinc-400">aciertos</div>
            </div>
          </div>
        `;
      }).join("")
    : `
      <div class="text-sm text-zinc-400 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
        No hay boletos pagados o pronósticos oficiales para esta jornada todavía.
      </div>
    `;
}

// ═══════════════════════════════════════════════════
// CARTEL TABLA DE ACIERTOS — DARK PREMIUM
// ═══════════════════════════════════════════════════
function makeStandingsCard(opts) {
  var poolName    = opts.poolName    || "Jornada";
  var totalGoals  = opts.totalGoals  || 0;
  var rows        = opts.rows        || [];
  var logoUrl     = (typeof QUINIELA_LOGO_URL !== "undefined") ? QUINIELA_LOGO_URL : "";

  var card = document.createElement("div");
  card.style.cssText = [
    "width:900px", "box-sizing:border-box",
    "background:linear-gradient(160deg,#050810 0%,#071220 50%,#040c10 100%)",
    "color:#f0f4f8", "border-radius:24px",
    "padding:40px 36px", "font-family:Arial,sans-serif",
    "position:relative", "overflow:hidden"
  ].join(";");

  // Glow blobs decorativos
  var glow1 = document.createElement("div");
  glow1.style.cssText = "position:absolute;top:-80px;left:-80px;width:320px;height:320px;" +
    "border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.15) 0%,transparent 70%);pointer-events:none;";
  var glow2 = document.createElement("div");
  glow2.style.cssText = "position:absolute;bottom:-60px;right:-60px;width:260px;height:260px;" +
    "border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,.1) 0%,transparent 70%);pointer-events:none;";
  card.appendChild(glow1);
  card.appendChild(glow2);

  // Grid overlay sutil
  var grid = document.createElement("div");
  grid.style.cssText = "position:absolute;inset:0;pointer-events:none;" +
    "background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px)," +
    "linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);" +
    "background-size:40px 40px;";
  card.appendChild(grid);

  // Línea acento top
  var topLine = document.createElement("div");
  topLine.style.cssText = "position:absolute;top:0;left:15%;right:15%;height:2px;" +
    "background:linear-gradient(90deg,transparent,#10b981,transparent);border-radius:0 0 4px 4px;";
  card.appendChild(topLine);

  // ── HEADER ──
  var header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;" +
    "margin-bottom:28px;position:relative;";
  header.innerHTML = [
    // Logo + nombre
    '<div style="display:flex;align-items:center;gap:16px;">',
      '<img src="' + logoUrl + '" crossorigin="anonymous"',
        ' style="width:64px;height:64px;object-fit:contain;border-radius:12px;',
        'box-shadow:0 0 24px rgba(16,185,129,.4);" />',
      '<div>',
        '<div style="font-size:22px;font-weight:900;color:#fff;line-height:1.1;">Quiniela Arc\u00e1ngel</div>',
        '<div style="font-size:13px;color:#34d399;margin-top:3px;">&#34;Pasi\u00f3n X Ganar&#34;</div>',
      '</div>',
    '</div>',
    // Goles badge
    '<div style="padding:10px 20px;border-radius:999px;',
      'background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);',
      'font-size:15px;font-weight:700;color:#34d399;">',
      '\u26bd\ufe0f ' + totalGoals + ' goles',
    '</div>'
  ].join("");
  card.appendChild(header);

  // Separador
  var sep = document.createElement("div");
  sep.style.cssText = "height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);margin-bottom:20px;";
  card.appendChild(sep);

  // Título + jornada
  var titleWrap = document.createElement("div");
  titleWrap.style.cssText = "text-align:center;margin-bottom:28px;";
  titleWrap.innerHTML = [
    '<div style="font-size:38px;font-weight:900;color:#fff;line-height:1;">Tabla de Aciertos</div>',
    '<div style="font-size:17px;color:#8a94a6;margin-top:8px;">' + poolName + '</div>'
  ].join("");
  card.appendChild(titleWrap);

  // ── LISTA ──
  var list = document.createElement("div");
  list.style.cssText = "display:grid;gap:10px;position:relative;";

  var medals = ["#f59e0b","#9ca3af","#b45309"];
  var medalEmojis = ["🥇","🥈","🥉"];

  rows.forEach(function(r, i) {
    var pos = i + 1;
    var isFirst = pos === 1;
    var isTop3  = pos <= 3;

    var rowBg = isFirst
      ? "background:linear-gradient(135deg,rgba(16,185,129,.18) 0%,rgba(6,182,212,.08) 100%);border:1px solid rgba(16,185,129,.35);"
      : isTop3
        ? "background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);"
        : "background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);";

    var medalColor  = medals[i]  || "#4a5568";
    var medalEmoji  = medalEmojis[i] || "";
    var posDisplay  = medalEmoji
      ? '<div style="font-size:28px;line-height:1;">' + medalEmoji + '</div>'
      : '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);' +
          'display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#6b7280;">' + pos + '</div>';

    var ptsColor = isFirst ? "#34d399" : isTop3 ? "#a3e635" : "#f0f4f8";

    var item = document.createElement("div");
    item.style.cssText = "display:flex;align-items:center;justify-content:space-between;" +
      "gap:16px;padding:16px 20px;border-radius:16px;" + rowBg;

    item.innerHTML = [
      '<div style="display:flex;align-items:center;gap:16px;min-width:0;">',
        posDisplay,
        '<div style="min-width:0;">',
          '<div style="font-size:22px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + r.name + '</div>',
          '<div style="font-size:13px;color:#8a94a6;margin-top:2px;">' + (r.area||"Sin área") + ' &bull; ' + r.captured_picks + ' picks &bull; ' + r.played_matches + ' jugados</div>',
        '</div>',
      '</div>',
      '<div style="text-align:right;flex-shrink:0;">',
        '<div style="font-size:32px;font-weight:900;color:' + ptsColor + ';line-height:1;">' + r.points + '</div>',
        '<div style="font-size:12px;color:#6b7280;margin-top:2px;">aciertos</div>',
      '</div>'
    ].join("");

    list.appendChild(item);
  });

  card.appendChild(list);

  // ── FOOTER ──
  var footer = document.createElement("div");
  footer.style.cssText = "margin-top:28px;text-align:center;";
  footer.innerHTML = [
    '<div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);margin-bottom:18px;"></div>',
    '<div style="font-size:18px;font-weight:800;color:#fff;">\u00a1Gracias por participar! \uD83C\uDFC6</div>',
    '<div style="font-size:14px;color:#8a94a6;margin-top:4px;">Quiniela Arc\u00e1ngel &mdash; Pasi\u00f3n X Ganar</div>'
  ].join("");
  card.appendChild(footer);

  return card;
}


// Funcion Exportar Imagen Tabla de Aciertos
async function exportStandingsImage() {
  hideAlert();
  const pool_id = $("standingsPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada.", "error");

  const { data: pool } = await supabaseClient.from("pools")
    .select("id, name").eq("id", pool_id).maybeSingle();

  const { data: paidEntries } = await supabaseClient.from("entries")
    .select("id, participant_id").eq("pool_id", pool_id).eq("paid", true);

  if (!paidEntries || !paidEntries.length)
    return showAlert("No hay boletos pagados para exportar.", "error");

  const paidEntryIds    = paidEntries.map(function(e){ return e.id; });
  const paidPartIds     = paidEntries.map(function(e){ return e.participant_id; });

  const { data: pointsRows } = await supabaseClient.from("entry_points")
    .select("entry_id, participant_id, points, played_matches, captured_picks")
    .eq("pool_id", pool_id).in("entry_id", paidEntryIds);

  const { data: participants } = await supabaseClient.from("participants")
    .select("id, name, area").in("id", paidPartIds);

  const { data: goalsData } = await supabaseClient.from("pool_goals_total")
    .select("total_goals").eq("pool_id", pool_id).maybeSingle();

  const partMap = new Map((participants||[]).map(function(p){ return [p.id, p]; }));

  const rows = (pointsRows||[]).map(function(r) {
    const p = partMap.get(r.participant_id) || {};
    return { name: p.name||"Sin nombre", area: p.area||"", points: Number(r.points||0),
             played_matches: Number(r.played_matches||0), captured_picks: Number(r.captured_picks||0) };
  }).sort(function(a,b){ return b.points - a.points || a.name.localeCompare(b.name); });

  const printArea = $("printArea");
  printArea.classList.remove("hidden");
  printArea.innerHTML = "";

  const card = makeStandingsCard({
    poolName: pool?.name || "Jornada",
    totalGoals: goalsData?.total_goals || 0,
    rows: rows
  });

  printArea.appendChild(card);

  try {
    const canvas = await html2canvas(card, { scale: 2, backgroundColor: "#050810", useCORS: true });
    const a = document.createElement("a");
    const safeName = (pool?.name||"tabla").replace(/[^\w\s-]/g,"").replace(/\s+/g,"-");
    a.download = safeName + "-tabla-aciertos.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
    showAlert("Tabla de aciertos exportada ✅", "ok");
  } catch(err) {
    showAlert("Error: " + (err?.message||err), "error");
  } finally {
    printArea.innerHTML = "";
    printArea.classList.add("hidden");
  }
}

// ═══════════════════════════════════════════════════
// CARTEL GANADOR — DARK PREMIUM
// ═══════════════════════════════════════════════════
function makeWinnerCard(opts) {
  var poolName       = opts.poolName       || "Jornada";
  var season         = opts.season         || "";
  var isFinished     = !!opts.isFinished;
  var winners        = opts.winners        || [];
  var winningPoints  = Number(opts.winningPoints  || 0);
  var prizePool      = Number(opts.prizePool      || 0);
  var prizePerWinner = Number(opts.prizePerWinner || 0);
  var winnersCount   = Number(opts.winnersCount   || 0);
  var logoUrl        = (typeof QUINIELA_LOGO_URL !== "undefined") ? QUINIELA_LOGO_URL : "";

  var isTie  = winnersCount > 1;
  var names  = winners.map(function(w){ return w.name; }).join(" & ");
  var title  = isTie
    ? (isFinished ? "Empate Final" : "Empate Provisional")
    : (isFinished ? "Ganador Final" : "Ganador Provisional");
  var subtitle = isTie
    ? "Premio dividido entre " + winnersCount + " participantes"
    : "Resultado oficial de la Quiniela Sencilla";

  var accentStart = isTie ? "#f59e0b" : "#10b981";
  var accentEnd   = isTie ? "#d97706" : "#059669";
  var accentGlow  = isTie ? "rgba(245,158,11,.3)" : "rgba(16,185,129,.3)";
  var accentLight = isTie ? "#fbbf24" : "#34d399";

  var card = document.createElement("div");
  card.style.cssText = [
    "width:1080px", "box-sizing:border-box",
    "background:linear-gradient(160deg,#050810 0%,#071220 50%,#040c10 100%)",
    "color:#f0f4f8", "border-radius:28px",
    "padding:60px 56px", "font-family:Arial,sans-serif",
    "position:relative", "overflow:hidden"
  ].join(";");

  // Glow blobs
  [
    "position:absolute;top:-100px;left:-100px;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle," + accentGlow + " 0%,transparent 70%);pointer-events:none;",
    "position:absolute;bottom:-80px;right:-80px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,.1) 0%,transparent 70%);pointer-events:none;"
  ].forEach(function(css) {
    var el = document.createElement("div");
    el.style.cssText = css;
    card.appendChild(el);
  });

  // Grid overlay
  var grid = document.createElement("div");
  grid.style.cssText = "position:absolute;inset:0;pointer-events:none;" +
    "background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px)," +
    "linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);" +
    "background-size:50px 50px;";
  card.appendChild(grid);

  // Top accent line
  var topLine = document.createElement("div");
  topLine.style.cssText = "position:absolute;top:0;left:10%;right:10%;height:3px;" +
    "background:linear-gradient(90deg,transparent," + accentStart + "," + accentEnd + ",transparent);border-radius:0 0 6px 6px;";
  card.appendChild(topLine);

  // ── HEADER: logo + quiniela ──
  var header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:40px;position:relative;";
  header.innerHTML = [
    '<img src="' + logoUrl + '" crossorigin="anonymous"',
      ' style="width:80px;height:80px;object-fit:contain;border-radius:16px;',
      'box-shadow:0 0 32px ' + accentGlow + ';" />',
    '<div>',
      '<div style="font-size:28px;font-weight:900;color:#fff;line-height:1.1;">Quiniela Arc\u00e1ngel</div>',
      '<div style="font-size:15px;color:' + accentLight + ';margin-top:4px;">&#34;Pasi\u00f3n X Ganar&#34; &bull; ' + (season||"Clausura 2026") + '</div>',
    '</div>'
  ].join("");
  card.appendChild(header);

  // ── TÍTULO ──
  var titleEl = document.createElement("div");
  titleEl.style.cssText = "text-align:center;margin-bottom:36px;";
  titleEl.innerHTML = [
    '<div style="font-size:58px;font-weight:900;color:#fff;line-height:1.05;letter-spacing:-1px;">' + title + '</div>',
    '<div style="font-size:20px;color:#8a94a6;margin-top:10px;">' + poolName + '</div>'
  ].join("");
  card.appendChild(titleEl);

  // ── WINNER BOX ──
  var winnerBox = document.createElement("div");
  winnerBox.style.cssText = [
    "margin-bottom:32px",
    "padding:32px",
    "border-radius:24px",
    "background:rgba(255,255,255,.05)",
    "border:1px solid rgba(255,255,255,.1)",
    "text-align:center",
    "position:relative",
    "overflow:hidden"
  ].join(";");

  // Inner glow
  var innerGlow = document.createElement("div");
  innerGlow.style.cssText = "position:absolute;top:-40px;left:50%;transform:translateX(-50%);" +
    "width:300px;height:150px;border-radius:50%;" +
    "background:radial-gradient(circle," + accentGlow + " 0%,transparent 70%);pointer-events:none;";
  winnerBox.appendChild(innerGlow);

  var winnerContent = document.createElement("div");
  winnerContent.style.cssText = "position:relative;";
  winnerContent.innerHTML = [
    '<div style="font-size:16px;color:#8a94a6;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">' + subtitle + '</div>',
    '<div style="font-size:' + (isTie ? "36px" : "52px") + ';font-weight:900;color:#fff;line-height:1.1;">' + names + '</div>',
    '<div style="margin-top:16px;display:inline-block;padding:8px 24px;border-radius:999px;' +
      'background:linear-gradient(135deg,' + accentStart + ',' + accentEnd + ');' +
      'font-size:18px;font-weight:800;color:#fff;">' +
      winningPoints + ' aciertos',
    '</div>'
  ].join("");
  winnerBox.appendChild(winnerContent);
  card.appendChild(winnerBox);

  // ── STATS GRID ──
  var stats = document.createElement("div");
  stats.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:36px;";
  stats.innerHTML = [
    '<div style="padding:24px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);text-align:center;">',
      '<div style="font-size:13px;color:#8a94a6;text-transform:uppercase;letter-spacing:.6px;">Bolsa</div>',
      '<div style="font-size:36px;font-weight:900;color:#fff;margin-top:8px;">' + money(prizePool) + '</div>',
    '</div>',
    '<div style="padding:24px;border-radius:20px;background:linear-gradient(135deg,' + accentStart + ',' + accentEnd + ');text-align:center;box-shadow:0 8px 32px ' + accentGlow + ';">',
      '<div style="font-size:13px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.6px;">Premio</div>',
      '<div style="font-size:36px;font-weight:900;color:#fff;margin-top:8px;">' + money(prizePerWinner) + '</div>',
    '</div>',
    '<div style="padding:24px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);text-align:center;">',
      '<div style="font-size:13px;color:#8a94a6;text-transform:uppercase;letter-spacing:.6px;">Ganadores</div>',
      '<div style="font-size:36px;font-weight:900;color:#fff;margin-top:8px;">' + winnersCount + '</div>',
    '</div>'
  ].join("");
  card.appendChild(stats);

  // ── FOOTER ──
  var footer = document.createElement("div");
  footer.style.cssText = "text-align:center;";
  footer.innerHTML = [
    '<div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);margin-bottom:22px;"></div>',
    '<div style="font-size:22px;font-weight:800;color:#fff;">\u00a1Gracias por participar! \uD83C\uDFC6</div>',
    '<div style="font-size:16px;color:#8a94a6;margin-top:6px;">Quiniela Arc\u00e1ngel &mdash; Pasi\u00f3n X Ganar</div>'
  ].join("");
  card.appendChild(footer);

  return card;
}

// Exportar Cartel Ganador
async function exportWinnerCard() {
  hideAlert();

  const pool_id = $("standingsPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada.", "error");

  const { data: pool, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, name, season")
    .eq("id", pool_id)
    .maybeSingle();

  if (poolErr) return showAlert(poolErr.message, "error");

  const completionInfo = await getPoolCompletionInfo(pool_id);
  const winnerSummary = await loadSimpleWinnerSummary(pool_id);

  if (!winnerSummary || !winnerSummary.winners || !winnerSummary.winners.length) {
    return showAlert("No hay ganador calculado todavía para esta jornada.", "error");
  }

  const printArea = $("printArea");
  printArea.classList.remove("hidden");
  printArea.innerHTML = "";

  const card = makeWinnerCard({
    poolName: pool?.name || "Jornada",
    season: pool?.season || "",
    isFinished: completionInfo?.isFinished,
    winners: winnerSummary.winners,
    winningPoints: winnerSummary.winning_points,
    prizePool: winnerSummary.prize_pool,
    prizePerWinner: winnerSummary.prize_per_winner,
    winnersCount: winnerSummary.winners_count
  });

  printArea.appendChild(card);

  try {
    const canvas = await html2canvas(card, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });

    const a = document.createElement("a");
    const safeName = (pool?.name || "ganador")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    a.download = safeName + "-ganador.png";
    a.href = canvas.toDataURL("image/png");
    a.click();

    showAlert("Cartel del ganador generado ✅", "ok");
  } catch (err) {
    showAlert("Error generando cartel: " + (err?.message || err), "error");
  } finally {
    printArea.innerHTML = "";
    printArea.classList.add("hidden");
  }
}

// =====================
// Eventos
// =====================

// =========================
// LISTENERS GLOBALES
// =========================

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

// Botón Más
$("btnMoreMenu").addEventListener("click", openMoreMenu);
$("btnCloseMoreMenu").addEventListener("click", closeMoreMenu);
$("moreMenuBackdrop").addEventListener("click", closeMoreMenu);

document.querySelectorAll(".more-menu-btn").forEach(function(btn) {
  btn.addEventListener("click", async function() {
    const tabId = btn.getAttribute("data-tab");
    closeMoreMenu();
    await showAppTab(tabId);
  });
});

// Participantes: insertar

// ═══════════════════════════════════════
// WhatsApp Bienvenida Participante
// ═══════════════════════════════════════
function showWelcomeWaModal(name, whatsapp) {
  // Si no tiene WhatsApp, mostrar solo alerta
  if (!whatsapp) {
    showAlert("Participante agregado. No tiene WhatsApp registrado.", "ok");
    return;
  }

  // Crear modal
  var modal = document.createElement("div");
  modal.id = "welcomeWaModal";
  modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";
  modal.innerHTML = [
    '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="welcomeWaBackdrop"></div>',
    '<div style="position:relative;width:100%;max-width:400px;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
         'border-radius:24px;padding:24px;box-shadow:0 32px 80px rgba(0,0,0,.8);">',

      // Top accent
      '<div style="position:absolute;top:-1px;left:15%;right:15%;height:2px;',
           'background:linear-gradient(90deg,transparent,#10b981,transparent);border-radius:0 0 4px 4px;"></div>',

      // Icon + title
      '<div style="text-align:center;margin-bottom:16px;">',
        '<div style="font-size:44px;line-height:1;">📲</div>',
        '<div style="font-size:18px;font-weight:800;color:#fff;margin-top:8px;">',
          '\u00a1Participante agregado!',
        '</div>',
        '<div style="font-size:13px;color:#8a94a6;margin-top:4px;">',
          '\u00bfEnviar WhatsApp de bienvenida a <strong style="color:#f0f4f8;">' + name + '</strong>?',
        '</div>',
      '</div>',

      // Message preview
      '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);',
           'border-radius:14px;padding:12px 14px;font-size:12px;color:#a1a1aa;line-height:1.6;',
           'max-height:140px;overflow-y:auto;margin-bottom:16px;white-space:pre-wrap;" id="welcomeMsgPreview">',
      '</div>',

      // Buttons
      '<div style="display:grid;gap:10px;">',
        '<button id="btnSendWelcomeWa" style="width:100%;padding:14px;border-radius:14px;',
          'background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;',
          'font-size:15px;font-weight:700;cursor:pointer;">',
          '\u2705 S\u00ed, enviar WhatsApp',
        '</button>',
        '<button id="btnSkipWelcomeWa" style="width:100%;padding:12px;border-radius:14px;',
          'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
          'color:#8a94a6;font-size:14px;cursor:pointer;">',
          'Omitir por ahora',
        '</button>',
      '</div>',
    '</div>'
  ].join('');

  document.body.appendChild(modal);

  // Build message
  var groupLink = "https://chat.whatsapp.com/Hb7rAWVOBzH3bSNxeCv15f?mode=gi_t";
  var msgLines = [
    "\uD83C\uDFC6 *\u00a1Bienvenido/a a Quiniela Arc\u00e1ngel, " + name + "!*",
    "",
    "Nos da mucho gusto tenerte en nuestra quiniela de f\u00fatbol.",
    "Cada jornada podr\u00e1s participar con tus pron\u00f3sticos y competir por el premio.",
    "",
    "\uD83D\uDCF1 *\u00dale a unirte a nuestro grupo de WhatsApp:*",
    groupLink,
    "",
    "En el grupo encontrar\u00e1s:",
    "\u2022 Quinielas de cada jornada",
    "\u2022 Resultados en tiempo real",
    "\u2022 Tabla de posiciones",
    "\u2022 Estad\u00edsticas e informaci\u00f3n",
    "",
    "Registro: " + getPicksDeadline(),
    "\uD83D\uDCB3 *Pago:* S\u00e1bado 4:00 PM",
    "\uD83D\uDCCA Boleto pagado, boleto jugado.",
    "",
    "\u26BD\uFE0F \u00a1Mucha suerte!"
  ];
  var msgText = msgLines.join("\n");

  // Show preview
  var preview = document.getElementById("welcomeMsgPreview");
  if (preview) preview.textContent = msgText;

  // Send button
  document.getElementById("btnSendWelcomeWa").addEventListener("click", function() {
    var clean = String(whatsapp).replace(/\D/g, "");
    var url = "https://wa.me/52" + clean + "?text=" + encodeURIComponent(msgText);
    window.open(url, "_blank");
    closeWelcomeWaModal();
  });

  // Skip / backdrop
  document.getElementById("btnSkipWelcomeWa").addEventListener("click", closeWelcomeWaModal);
  document.getElementById("welcomeWaBackdrop").addEventListener("click", closeWelcomeWaModal);
}

function closeWelcomeWaModal() {
  var modal = document.getElementById("welcomeWaModal");
  if (modal) modal.remove();
}

$("formParticipant").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const name = $("pName").value.trim();
  const area = $("pArea").value.trim();
  const whatsapp = $("pWhatsapp").value.trim();

  if (!name) return showAlert("El nombre es obligatorio.", "error");

  const { error } = await supabaseClient
    .from("participants")
    .insert({ name, area, whatsapp });

  if (error) return showAlert(error.message, "error");

  $("pName").value = "";
  $("pArea").value = "";
  $("pWhatsapp").value = "";

  await loadParticipants();
  await fillEntryParticipantsSelect();
  await fillPickParticipantsSelect();
  await loadDashboardSummary();

  // Mostrar modal de bienvenida por WhatsApp
  showWelcomeWaModal(name, whatsapp);
});
$("btnCloseParticipantEdit").addEventListener("click", closeParticipantEditModal);
$("participantEditBackdrop").addEventListener("click", closeParticipantEditModal);

$("formParticipantEdit").addEventListener("submit", async (e) => {
  e.preventDefault();
  await updateParticipant();
});

// Ver archivados / activos
$("btnToggleArchived").addEventListener("click", () => {
  const nextFilter = currentParticipantFilter === "archived" ? "all" : "archived";
  applyParticipantFilter(nextFilter);
});

// Jornadas / Pools: insertar
$("formPool").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  // ── Validación manual visible (no depende del tooltip nativo del browser) ──
  const roundRaw = $("poolRound").value.trim();
  if (!roundRaw || isNaN(Number(roundRaw)) || Number(roundRaw) < 1) {
    showAlert("⚠️ Ingresa el número de jornada (campo obligatorio).", "error");
    $("poolRound").focus();
    // Scroll al alert para que se vea en móvil
    $("alert").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const round = Number(roundRaw);
  const mode_code = $("poolMode").value;
  const carryover_enabled = (mode_code === "ACUMULADA" || mode_code === "GOLEO");
  const competition = $("poolCompetition").value.trim() || "Liga MX";
  const season = $("poolSeason").value.trim() || "Clausura 2026";
  const date_label = $("poolDates").value.trim() || null;
  const price = Number($("poolPrice").value || 20);
  const commission_pct = Number($("poolCommission").value || 15);
  const name = `Jornada ${round} - ${competition} - ${season}`;

  // ── Estado de carga en el botón ──
  const btnCrear = $("formPool").querySelector("button[type=submit], button:not([type])");
  setBusy(btnCrear, true, "Creando…");

  try {
    const { error } = await supabaseClient
      .from("pools")
      .insert({
        round,
        competition,
        season,
        name,
        price,
        commission_pct,
        status: "draft",
        date_label,
        mode_code,
        carryover_enabled
      });

    if (error) {
      // Muestra el error exacto de Supabase y hace scroll para verlo
      showAlert("❌ Error Supabase: " + error.message + (error.details ? " — " + error.details : ""), "error");
      $("alert").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    showAlert("✅ Jornada " + round + " creada como borrador.", "ok");
    $("alert").scrollIntoView({ behavior: "smooth", block: "center" });

    // Limpiar formulario
    $("poolRound").value = "";
    $("poolCompetition").value = "";
    $("poolSeason").value = "";
    $("poolDates").value = "";
    $("poolPrice").value = "";
    $("poolCommission").value = "";

    await loadPools();
    await fillTplPools();
    await fillEntryPoolsSelect();
    await fillPickPoolsSelect();
    await loadDashboardSummary();

  } catch (err) {
    showAlert("❌ Error inesperado: " + (err?.message || String(err)), "error");
    $("alert").scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    setBusy(btnCrear, false);
  }
});

$("btnCloseActivePool").addEventListener("click", closeActivePool);
$("btnOpenActivePool").addEventListener("click", openLatestClosedPool);

// Pagos / Boletos
$("btnAddEntry").addEventListener("click", addEntry);
$("btnRefreshStats").addEventListener("click", loadEntriesAndStats);
$("entryPool").addEventListener("change", async () => {
  currentEntriesSearch = "";
  if ($("entriesSearch")) $("entriesSearch").value = "";
  await loadEntriesAndStats();
});
$("btnRefreshEntriesList").addEventListener("click", loadEntriesAndStats);


// Plantillas
$("btnBuildRows").addEventListener("click", () => {
  buildTplRowsUI(Number($("tplNumMatches").value || 9));
});

$("btnSaveTemplate").addEventListener("click", saveTemplateMatches);

$("tplPool").addEventListener("change", async () => {
  $("tplSavedStatus").textContent = "Jornada seleccionada. Usa “Cargar plantilla guardada” o “Ver / actualizar preview”.";
  $("tplPreviewWrap").innerHTML = "";
});

//Cargar y Preview Plantilla
$("btnLoadTemplateEditor").addEventListener("click", async () => {
  await loadTemplateIntoEditor();
  showAlert("Plantilla cargada al editor ✅", "ok");
});

$("btnRefreshTemplatePreview").addEventListener("click", async () => {
  await renderPreview();
  showAlert("Preview actualizado ✅", "ok");
});

//Limpiar Plantilla y Borrar Plantilla
$("btnClearTemplateEditor").addEventListener("click", clearTemplateEditor);
$("btnDeleteTemplate").addEventListener("click", deleteCurrentTemplate);

// PDF PNG
if ($("btnExportPDF")) $("btnExportPDF").addEventListener("click", exportAllToPDF);
if ($("btnExportCurrentPNG")) $("btnExportCurrentPNG").addEventListener("click", exportCurrentTemplatePNG);
if ($("btnExportStoryPNG")) $("btnExportStoryPNG").addEventListener("click", exportStoryTemplatePNG);

// Captura Pronósticos 1X2
$("btnLoadEntryForPick").addEventListener("click", async () => {
  const poolId = $("pickPool").value;
  const partId = $("pickParticipant").value;
  await loadEntryForPick(poolId, partId);
});

$("btnSavePicks").addEventListener("click", previewAndSavePicks);
$("btnClearPicks").addEventListener("click", clearPicksSelection);

$("btnRefreshPickStatus").addEventListener("click", loadPickStatusList);

$("pickPool").addEventListener("change", async () => {
  currentPickStatusSearch = "";
  if ($("pickStatusSearch")) $("pickStatusSearch").value = "";

  await fillPickParticipantsSelect();
  await loadPickStatusList();
  $("pickMatches").innerHTML = "";
  $("pickEntryLabel").textContent = "—";
});

$("pickParticipant").addEventListener("change", () => {
  $("pickMatches").innerHTML = "";
  $("pickEntryLabel").textContent = "—";
});

$("btnPickLegend").addEventListener("click", () => {
  $("pickLegendBox").classList.toggle("hidden");
});

// Pendientes de pago
if ($("btnExportPending")) {
  $("btnExportPending").addEventListener("click", exportPendingPayments);
}

// Resultados
$("btnLoadResultsMatches").addEventListener("click", loadResultsMatches);
$("btnSaveResults").addEventListener("click", saveResultsMatches);
$("btnCloseResults").addEventListener("click", function() {
  $("resultsMatchesList").innerHTML = "";
  $("resultsGoalsTotal").textContent = "0";
  hideAlert();
});

// Aciertos
$("btnLoadStandings").addEventListener("click", loadStandings);
$("btnExportStandingsImage").addEventListener("click", exportStandingsImage);
$("btnExportWinnerCard").addEventListener("click", exportWinnerCard);

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
// Pendientes de Pago
// =====================

async function exportPendingPayments() {
  hideAlert();
  var pool_id = $("entryPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

  var poolRes = await supabaseClient.from("pools")
    .select("name, round, price").eq("id", pool_id).maybeSingle();
  var partRes = await supabaseClient.from("participants")
    .select("id, name, area").eq("is_active", true).order("name");
  var entRes  = await supabaseClient.from("entries")
    .select("participant_id, paid").eq("pool_id", pool_id);

  if (poolRes.error || partRes.error || entRes.error) return showAlert("Error cargando datos.", "error");

  var pool  = poolRes.data;
  var parts = partRes.data || [];
  var ents  = entRes.data  || [];

  var paidSet = new Set(ents.filter(function(e){ return e.paid; }).map(function(e){ return e.participant_id; }));
  var pending = parts.filter(function(p){ return !paidSet.has(p.id); });

  if (!pending.length) return showAlert("Todos han pagado! No hay pendientes.", "ok");

  var jornada = pool && pool.round ? "Jornada " + pool.round : (pool && pool.name ? pool.name : "Jornada");
  var precio  = pool && pool.price ? "$" + pool.price : "";

  var msgLines = [
    "Quiniela Arcangel - " + jornada,
    "Pendientes de pago (" + precio + " c/u):",
    ""
  ];
  pending.forEach(function(p, i) {
    msgLines.push((i + 1) + ". " + p.name + (p.area ? " (" + p.area + ")" : ""));
  });
  msgLines.push("");
  msgLines.push("Boleto pagado, boleto jugado. Gracias!");

  var text = msgLines.join("\n");
  var encoded = encodeURIComponent(text);
  window.open("https://wa.me/?text=" + encoded, "_blank");
}

// =====================
// Tabla Historica
// =====================

async function loadHistoricalStandings() {
  hideAlert();
  var wrap = $("historicalStandingsList");
  if (!wrap) return;
  wrap.innerHTML = '<div class="text-sm text-zinc-400 p-3">Cargando...</div>';

  // Traer todas las jornadas cerradas con resultados
  var poolsRes = await supabaseClient.from("pools")
    .select("id, round, name, season, competition")
    .in("status", ["closed", "open"])
    .order("round", { ascending: true });
  if (poolsRes.error) return showAlert(poolsRes.error.message, "error");

  var pools = poolsRes.data || [];
  if (!pools.length) {
    wrap.innerHTML = '<div class="text-sm text-zinc-400 p-3">No hay jornadas con resultados aun.</div>';
    return;
  }

  // Traer participantes activos
  var partRes = await supabaseClient.from("participants")
    .select("id, name, area").eq("is_active", true).order("name");
  if (partRes.error) return showAlert(partRes.error.message, "error");
  var participants = partRes.data || [];

  // Traer todos los matches con resultados
  var poolIds = pools.map(function(p){ return p.id; });
  var matchRes = await supabaseClient.from("matches")
    .select("id, pool_id, match_no, home_goals, away_goals")
    .in("pool_id", poolIds);
  if (matchRes.error) return showAlert(matchRes.error.message, "error");
  var matches = matchRes.data || [];

  // Solo jornadas con al menos 1 resultado
  var poolsWithResults = pools.filter(function(pool) {
    return matches.some(function(m) {
      return m.pool_id === pool.id && m.home_goals !== null && m.away_goals !== null;
    });
  });

  if (!poolsWithResults.length) {
    wrap.innerHTML = '<div class="text-sm text-zinc-400 p-3">No hay resultados capturados aun.</div>';
    return;
  }

  // Calcular resultado real por match
  var matchResult = {};
  matches.forEach(function(m) {
    if (m.home_goals !== null && m.away_goals !== null) {
      if (m.home_goals > m.away_goals)       matchResult[m.id] = "H";
      else if (m.home_goals < m.away_goals)  matchResult[m.id] = "A";
      else                                   matchResult[m.id] = "D";
    }
  });

  // Traer entries de esos pools
  var entRes = await supabaseClient.from("entries")
    .select("id, pool_id, participant_id").in("pool_id", poolIds);
  if (entRes.error) return showAlert(entRes.error.message, "error");
  var entries = entRes.data || [];
  var entryIds = entries.map(function(e){ return e.id; });

  // Traer predictions
  var predRes = await supabaseClient.from("predictions_1x2")
    .select("entry_id, match_id, pick").in("entry_id", entryIds);
  if (predRes.error) return showAlert(predRes.error.message, "error");
  var preds = predRes.data || [];

  // Mapa pick por entry+match
  var pickMap = {};
  preds.forEach(function(p) { pickMap[p.entry_id + "_" + p.match_id] = p.pick; });

  // Calcular aciertos por participante por jornada
  var totalByPart = {};
  participants.forEach(function(p) { totalByPart[p.id] = { name: p.name, area: p.area, total: 0, jornadas: 0 }; });

  poolsWithResults.forEach(function(pool) {
    var poolMatches = matches.filter(function(m) { return m.pool_id === pool.id && matchResult[m.id]; });
    if (!poolMatches.length) return;

    // Entries de esta jornada por participante (puede haber varios)
    var poolEntries = entries.filter(function(e) { return e.pool_id === pool.id; });

    participants.forEach(function(part) {
      var partEntries = poolEntries.filter(function(e) { return e.participant_id === part.id; });
      if (!partEntries.length) return;

      // Tomar el mejor resultado entre todas sus boletas
      var best = 0;
      partEntries.forEach(function(entry) {
        var hits = 0;
        poolMatches.forEach(function(m) {
          var pick = pickMap[entry.id + "_" + m.id];
          if (pick && pick === matchResult[m.id]) hits++;
        });
        if (hits > best) best = hits;
      });

      if (totalByPart[part.id]) {
        totalByPart[part.id].total += best;
        totalByPart[part.id].jornadas += 1;
      }
    });
  });

  // Ordenar por total descendente
  var ranked = Object.values(totalByPart)
    .filter(function(p) { return p.jornadas > 0; })
    .sort(function(a, b) { return b.total - a.total || a.name.localeCompare(b.name); });

  if (!ranked.length) {
    wrap.innerHTML = '<div class="text-sm text-zinc-400 p-3">No hay aciertos registrados aun.</div>';
    return;
  }

  var medals = ["🥇","🥈","🥉"];
  var totalJornadas = poolsWithResults.length;

  wrap.innerHTML = ranked.map(function(p, i) {
    var medal = i < 3 ? medals[i] : '<span class="text-zinc-500 font-bold text-sm">' + (i+1) + '</span>';
    var pct = totalJornadas > 0 ? Math.round((p.total / (totalJornadas * 9)) * 100) : 0;
    var barColor = i === 0 ? "bg-yellow-400" : i === 1 ? "bg-zinc-300" : i === 2 ? "bg-amber-600" : "bg-emerald-500";
    return [
      '<div class="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">',
        '<div class="text-xl w-8 text-center flex-shrink-0">' + medal + '</div>',
        '<div class="flex-1 min-w-0">',
          '<div class="font-semibold text-sm truncate">' + p.name + '</div>',
          '<div class="text-xs text-zinc-400 mt-0.5">' + (p.area || "Sin area") + ' &bull; ' + p.jornadas + ' jornadas</div>',
          '<div class="mt-1.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden">',
            '<div class="h-full rounded-full ' + barColor + '" style="width:' + pct + '%"></div>',
          '</div>',
        '</div>',
        '<div class="text-right flex-shrink-0">',
          '<div class="text-lg font-black text-white">' + p.total + '</div>',
          '<div class="text-xs text-zinc-400">aciertos</div>',
        '</div>',
      '</div>'
    ].join("");
  }).join("");
}

// =====================
// Dashboard Mejorado
// =====================

async function loadDashboardEnhanced() {
  // Jornadas totales cerradas
  var poolsRes = await supabaseClient.from("pools")
    .select("id, status", { count: "exact" });
  var allPools = poolsRes.data || [];
  var closedCount = allPools.filter(function(p){ return p.status === "closed"; }).length;
  var el = $("dashClosedPools");
  if (el) el.textContent = closedCount;

  // Recaudacion total historica
  var statsRes = await supabaseClient.from("pool_stats")
    .select("total_collected");
  var totalHistorico = (statsRes.data || []).reduce(function(sum, s) {
    return sum + Number(s.total_collected || 0);
  }, 0);
  var elH = $("dashTotalHistorico");
  if (elH) elH.textContent = money(totalHistorico);

  // Total de boletos en toda la historia
  var entRes = await supabaseClient.from("entries")
    .select("id", { count: "exact", head: true });
  var elB = $("dashTotalBoletos");
  if (elB) elB.textContent = entRes.count || 0;
}


// ═══════════════════════════════════════
// HISTORIAL DE GANADORES POR JORNADA
// ═══════════════════════════════════════
async function loadWinnersHistory() {
  var wrap = $("winnersHistoryList");
  if (!wrap) return;
  wrap.innerHTML = '<div class="text-sm text-zinc-400">Cargando...</div>';

  // Todas las jornadas con resultados
  var poolsRes = await supabaseClient.from("pools")
    .select("id, round, name, season, competition, status")
    .order("round", { ascending: false })
    .limit(50);
  if (poolsRes.error) { wrap.innerHTML = '<div class="text-xs text-red-400">Error cargando jornadas.</div>'; return; }

  var pools = (poolsRes.data || []);

  // Entry points de todas las jornadas
  var poolIds = pools.map(function(p){ return p.id; });
  if (!poolIds.length) { wrap.innerHTML = '<div class="text-sm text-zinc-400">Sin jornadas todavía.</div>'; return; }

  var epRes = await supabaseClient.from("entry_points")
    .select("entry_id, pool_id, participant_id, points")
    .in("pool_id", poolIds)
    .order("points", { ascending: false });
  if (epRes.error) { wrap.innerHTML = '<div class="text-xs text-red-400">Error cargando aciertos.</div>'; return; }

  // Solo entries pagados
  var entRes = await supabaseClient.from("entries")
    .select("id, pool_id, participant_id, paid")
    .in("pool_id", poolIds)
    .eq("paid", true);
  if (entRes.error) { wrap.innerHTML = '<div class="text-xs text-red-400">Error cargando boletos.</div>'; return; }

  var paidEntryIds = new Set((entRes.data || []).map(function(e){ return e.id; }));

  // Participantes
  var partIds = [...new Set((epRes.data || []).map(function(r){ return r.participant_id; }))];
  var partRes = partIds.length
    ? await supabaseClient.from("participants").select("id, name, area").in("id", partIds)
    : { data: [] };
  var partMap = {};
  (partRes.data || []).forEach(function(p){ partMap[p.id] = p; });

  // Ganador por jornada = max points entre entries pagados
  var winnerByPool = {};
  pools.forEach(function(pool) {
    var poolRows = (epRes.data || []).filter(function(r){
      return r.pool_id === pool.id && paidEntryIds.has(r.entry_id);
    });
    if (!poolRows.length) return;
    var maxPts = Math.max.apply(null, poolRows.map(function(r){ return r.points; }));
    if (maxPts < 0) return;
    var winners = poolRows.filter(function(r){ return r.points === maxPts; });
    // Agrupar por participante (puede tener 2 boletas)
    var winnerNames = [...new Set(winners.map(function(r){
      var p = partMap[r.participant_id];
      return p ? p.name : "—";
    }))];
    winnerByPool[pool.id] = { names: winnerNames, points: maxPts, tie: winnerNames.length > 1 };
  });

  var hasAny = Object.keys(winnerByPool).length > 0;
  if (!hasAny) {
    wrap.innerHTML = '<div class="text-sm text-zinc-400">Aún no hay jornadas con resultados finalizados.</div>';
    return;
  }

  wrap.innerHTML = pools.map(function(pool) {
    var w = winnerByPool[pool.id];
    if (!w) return ''; // jornada sin resultados
    var jornada = pool.round ? 'J' + pool.round : pool.name;
    var label = w.tie ? w.names.join(', ') : w.names[0];
    var badgeClass = w.tie
      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
    var icon = w.tie ? '🤝' : '🏆';
    return [
      '<div class="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">',
        '<div class="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-sm font-black text-zinc-300 shrink-0">' + jornada + '</div>',
        '<div class="flex-1 min-w-0">',
          '<div class="font-semibold text-sm truncate">' + label + '</div>',
          '<div class="text-xs text-zinc-500">' + (pool.competition || 'Liga MX') + ' · ' + (pool.season || '') + '</div>',
        '</div>',
        '<div class="shrink-0 text-right">',
          '<span class="text-xs px-2 py-1 rounded-full border ' + badgeClass + '">' + icon + ' ' + w.points + ' ac.</span>',
        '</div>',
      '</div>'
    ].join('');
  }).filter(Boolean).join('');
}

// ═══════════════════════════════════════
// WHATSAPP: Notificación jornada nueva
// ═══════════════════════════════════════
async function sendWhatsAppJornadaNotification() {
  hideAlert();

  // Obtener jornada activa
  var poolRes = await supabaseClient.from("pools")
    .select("id, round, name, competition, season, date_label, price, status")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (poolRes.error) return showAlert(poolRes.error.message, "error");

  var pool = poolRes.data;
  if (!pool) return showAlert("No hay jornada activa actualmente.", "error");

  // Obtener partidos de esa jornada
  var matchRes = await supabaseClient.from("matches")
    .select("match_no, home_team, away_team")
    .eq("pool_id", pool.id)
    .order("match_no", { ascending: true });

  if (matchRes.error) return showAlert(matchRes.error.message, "error");

  var matches = matchRes.data || [];
  var jornada = pool.round ? "Jornada " + pool.round : pool.name;
  var precio   = pool.price ? "$" + pool.price : "";
  var fechas   = pool.date_label ? pool.date_label : "";
  var comp     = pool.competition || "Liga MX";
  var season   = pool.season || "";

  var lines = [];
  lines.push("\u26bd\ufe0f *Quiniela Arc\u00e1ngel* \u2014 " + jornada);
  lines.push(comp + " \u2022 " + season);
  if (fechas) lines.push("\ud83d\udcc5 Fechas: " + fechas);
  lines.push("\ud83d\udcb0 Costo: " + precio + " por boleto");
  lines.push("");
  lines.push("*Partidos:*");
  if (matches.length) {
    matches.forEach(function(m) {
      lines.push((m.match_no) + ". " + m.home_team + " vs " + m.away_team);
    });
  } else {
    lines.push("(Plantilla pendiente)");
  }
  lines.push("");
  lines.push("\u23f0 *Registro:* Viernes 05:00 PM");
  lines.push("Pago: " + getPaymentDeadline());
  lines.push("Envia tus pronosticos al: " + getAdminWhatsapp());
  lines.push("");
  lines.push("\ud83c\udfc6 \u00a1Mucha suerte a todos!");

  var text = lines.join("\n");
  var encoded = encodeURIComponent(text);
  window.open("https://wa.me/?text=" + encoded, "_blank");
}


// ═══════════════════════════════════════════════
// FEATURE 1: Exportar tabla de aciertos por WhatsApp
// ═══════════════════════════════════════════════
async function exportStandingsWhatsApp() {
  hideAlert();
  var pool_id = $("standingsPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

  var poolRes = await supabaseClient.from("pools")
    .select("id, name, round, season, competition, date_label").eq("id", pool_id).maybeSingle();
  if (poolRes.error) return showAlert(poolRes.error.message, "error");
  var pool = poolRes.data;

  // Leer las filas ya calculadas del DOM (standigsList ya esta cargado)
  var cards = Array.from(document.querySelectorAll("#standingsList > div"));
  if (!cards.length) return showAlert("Primero carga la tabla de aciertos.", "error");

  var jornada = pool && pool.round ? "Jornada " + pool.round : (pool && pool.name ? pool.name : "Jornada");
  var goles   = $("standingsGoalsTotal") ? $("standingsGoalsTotal").textContent : "0";

  var lines = [
    "Quiniela Arcangel - " + jornada,
    (pool && pool.competition ? pool.competition : "Liga MX") + " - " + (pool && pool.season ? pool.season : ""),
    "Goles de la jornada: " + goles,
    ""
  ];

  // Extraer posicion, nombre y aciertos de cada card del DOM
  var cardList = document.querySelectorAll("#standingsList > div");
  cardList.forEach(function(card, i) {
    var nameEl  = card.querySelector(".font-semibold");
    var ptsEl   = card.querySelector(".text-emerald-300");
    var name    = nameEl ? nameEl.textContent.trim() : ("Pos " + (i+1));
    var pts     = ptsEl  ? ptsEl.textContent.trim()  : "0";
    var medal   = i === 0 ? "1." : i === 1 ? "2." : i === 2 ? "3." : (i+1) + ".";
    lines.push(medal + " " + name + " - " + pts + " aciertos");
  });

  lines.push("");
  lines.push("Quiniela Arcangel - Pasion x Ganar");

  var text = lines.join("\n");
  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
}

// ═══════════════════════════════════════════════
// FEATURE 2: Vista previa antes de guardar picks
// ═══════════════════════════════════════════════
async function previewAndSavePicks() {
  hideAlert();

  if (!currentPickEntryId) return showAlert("Primero carga un boleto.", "error");

  var pool_id = currentPickPoolId || $("pickPool").value;

  var poolRes = await supabaseClient.from("pools")
    .select("id, status, name, round").eq("id", pool_id).maybeSingle();
  if (poolRes.error) return showAlert(poolRes.error.message, "error");
  if (!poolRes.data || poolRes.data.status !== "open")
    return showAlert("Esta jornada ya esta cerrada.", "error");

  // Recolectar seleccion actual
  var selected = {};
  document.querySelectorAll(".pick-btn[data-selected='1'], .pick-btn.bg-emerald-600").forEach(function(btn) {
    selected[btn.getAttribute("data-match-id")] = btn.getAttribute("data-pick");
  });

  if (!Object.keys(selected).length) return showAlert("No seleccionaste pronosticos.", "error");

  // Construir preview con los partidos del DOM
  var matchDivs = document.querySelectorAll("#pickMatches > div[class*='p-3']");
  var previewLines = [];
  function pickLabel(c) { return c === "H" ? "LOCAL" : c === "D" ? "EMPATE" : c === "A" ? "VISITA" : "?"; }

  matchDivs.forEach(function(div, i) {
    // Get match name from the div
    var matchName = div.querySelector(".text-sm.font-semibold, .font-semibold");
    var label = matchName ? matchName.textContent.trim() : ("Partido " + (i+1));
    // Find selected pick for this match's buttons
    var btns = div.querySelectorAll(".pick-btn, .pickbtn");
    var pick = null;
    btns.forEach(function(b) {
      if (b.dataset.selected === "1" || b.classList.contains("bg-emerald-600") || b.classList.contains("pickbtn-on")) {
        pick = b.getAttribute("data-pick") || b.getAttribute("data-pickbtn");
      }
    });
    if (!pick) {
      // Try from selected map using match_id
      btns.forEach(function(b) {
        var mid = b.getAttribute("data-match-id") || b.getAttribute("data-mid");
        if (mid && selected[mid]) pick = selected[mid];
      });
    }
    var arrow = pick === "H" ? "->" : pick === "A" ? "<-" : pick === "D" ? "=" : "?";
    previewLines.push((i+1) + ". " + label + "  " + arrow + " " + (pick ? pickLabel(pick) : "Sin pick"));
  });

  // Show preview modal
  var jornada = poolRes.data.round ? "Jornada " + poolRes.data.round : poolRes.data.name;
  var partName = $("pickEntryLabel") ? $("pickEntryLabel").textContent.split("•")[0].trim() : "";

  var modal = document.createElement("div");
  modal.id = "picksPreviewModal";
  modal.style.cssText = "position:fixed;inset:0;z-index:9998;display:flex;align-items:flex-end;padding:0;";

  var previewHtml = previewLines.map(function(l) {
    return '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;color:#e5e7eb;">' + l + '</div>';
  }).join("");

  modal.innerHTML = [
    '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="picksPreviewBg"></div>',
    '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
         'border-radius:24px 24px 0 0;padding:24px;max-height:80vh;overflow-y:auto;">',
      '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 18px;"></div>',
      '<div style="font-size:17px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">Vista previa</div>',
      '<div style="font-size:13px;color:#8a94a6;margin-bottom:16px;">' + jornada + (partName ? " - " + partName : "") + '</div>',
      '<div style="margin-bottom:16px;">' + previewHtml + '</div>',
      '<div style="display:grid;gap:10px;">',
        '<button id="picksPreviewConfirm" style="width:100%;padding:14px;border-radius:14px;border:none;',
          'background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-size:15px;font-weight:700;cursor:pointer;">',
          'Confirmar y guardar',
        '</button>',
        '<button id="picksPreviewCancel" style="width:100%;padding:12px;border-radius:14px;',
          'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
          'color:#8a94a6;font-size:14px;cursor:pointer;">Corregir</button>',
      '</div>',
    '</div>'
  ].join("");

  document.body.appendChild(modal);

  document.getElementById("picksPreviewBg").addEventListener("click", function() { modal.remove(); });
  document.getElementById("picksPreviewCancel").addEventListener("click", function() { modal.remove(); });
  document.getElementById("picksPreviewConfirm").addEventListener("click", async function() {
    modal.remove();
    await savePicks();
  });
}

// ═══════════════════════════════════════════════
// FEATURE 3: Recordatorio WhatsApp a sin picks
// ═══════════════════════════════════════════════
async function sendPicksReminder() {
  hideAlert();
  var pool_id = $("pickPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

  var poolRes = await supabaseClient.from("pools")
    .select("id, name, round, date_label, status").eq("id", pool_id).maybeSingle();
  if (poolRes.error) return showAlert(poolRes.error.message, "error");
  var pool = poolRes.data;

  // Entries de la jornada
  var entRes = await supabaseClient.from("entries")
    .select("id, participant_id, paid").eq("pool_id", pool_id);
  if (entRes.error) return showAlert(entRes.error.message, "error");
  var entries = entRes.data || [];

  if (!entries.length) return showAlert("No hay boletos registrados en esta jornada.", "error");

  var entryIds = entries.map(function(e) { return e.id; });

  // Picks existentes
  var picksRes = await supabaseClient.from("predictions_1x2")
    .select("entry_id").in("entry_id", entryIds);
  if (picksRes.error) return showAlert(picksRes.error.message, "error");

  var picksCountMap = {};
  (picksRes.data || []).forEach(function(p) {
    picksCountMap[p.entry_id] = (picksCountMap[p.entry_id] || 0) + 1;
  });

  // Total partidos
  var matchRes = await supabaseClient.from("matches")
    .select("id", { count: "exact", head: true }).eq("pool_id", pool_id);
  var totalMatches = matchRes.count || 0;

  // Entries sin picks completos (< totalMatches)
  var pendingEntries = entries.filter(function(e) {
    return (picksCountMap[e.id] || 0) < totalMatches;
  });

  if (!pendingEntries.length) return showAlert("Todos tienen sus pronosticos completos.", "ok");

  // Participantes de esos entries
  var partIds = [...new Set(pendingEntries.map(function(e) { return e.participant_id; }))];
  var partRes = await supabaseClient.from("participants")
    .select("id, name, area, whatsapp").in("id", partIds);
  if (partRes.error) return showAlert(partRes.error.message, "error");

  var participants = partRes.data || [];
  var conWa = participants.filter(function(p) { return p.whatsapp; });
  var sinWa = participants.filter(function(p) { return !p.whatsapp; });

  var jornada = pool && pool.round ? "Jornada " + pool.round : (pool && pool.name ? pool.name : "Jornada");
  var fechas  = pool && pool.date_label ? pool.date_label : "";

  // Show modal to choose who to remind
  var modal = document.createElement("div");
  modal.id = "reminderModal";
  modal.style.cssText = "position:fixed;inset:0;z-index:9998;display:flex;align-items:flex-end;";

  var listHtml = conWa.map(function(p) {
    return [
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;',
           'border-bottom:1px solid rgba(255,255,255,.06);">',
        '<div>',
          '<div style="font-size:14px;font-weight:600;color:#f0f4f8;">' + p.name + '</div>',
          '<div style="font-size:12px;color:#8a94a6;">' + (p.area || "") + '</div>',
        '</div>',
        '<button class="reminder-send-btn" data-name="' + p.name + '" data-wa="' + p.whatsapp + '"',
          'style="padding:8px 14px;border-radius:10px;border:none;',
          'background:linear-gradient(135deg,#059669,#10b981);',
          'color:#fff;font-size:13px;font-weight:700;cursor:pointer;">',
          'Recordar',
        '</button>',
      '</div>'
    ].join("");
  }).join("");

  var sinWaHtml = sinWa.length
    ? '<div style="font-size:12px;color:#6b7280;margin-top:12px;">Sin WhatsApp: ' + sinWa.map(function(p){return p.name;}).join(", ") + '</div>'
    : "";

  modal.innerHTML = [
    '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="reminderBg"></div>',
    '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
         'border-radius:24px 24px 0 0;padding:24px;max-height:75vh;overflow-y:auto;">',
      '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 16px;"></div>',
      '<div style="font-size:17px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">Recordatorio de picks</div>',
      '<div style="font-size:13px;color:#8a94a6;margin-bottom:16px;">' + jornada + (fechas ? " - " + fechas : "") + " - " + pendingEntries.length + " boletos pendientes</div>",
      conWa.length ? listHtml : '<div style="font-size:13px;color:#6b7280;">Nadie con WhatsApp pendiente.</div>',
      sinWaHtml,
      '<button id="reminderClose" style="width:100%;margin-top:16px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
        'color:#8a94a6;font-size:14px;cursor:pointer;">Cerrar</button>',
    '</div>'
  ].join("");

  document.body.appendChild(modal);

  document.getElementById("reminderBg").addEventListener("click", function() { modal.remove(); });
  document.getElementById("reminderClose").addEventListener("click", function() { modal.remove(); });

  // Individual send buttons
  modal.querySelectorAll(".reminder-send-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var name = btn.getAttribute("data-name");
      var wa   = btn.getAttribute("data-wa");
      var clean = String(wa).replace(/\D/g, "");
      var lines = [
        "Quiniela Arcangel - " + jornada,
        "Hola " + name + "! Te recordamos que aun no has enviado tus pronosticos.",
        (fechas ? "Fechas: " + fechas : ""),
        "",
        "Recuerda enviar tus picks antes del cierre: " + getPicksDeadline(),
        "Boleto pagado, boleto jugado.",
        "Suerte!"
      ].filter(Boolean);
      window.open("https://wa.me/52" + clean + "?text=" + encodeURIComponent(lines.join("\n")), "_blank");
    });
  });
}



// ═══════════════════════════════════════════════════
// CONFIGURACIÓN: Horarios límite editables
// ═══════════════════════════════════════════════════
const DEFAULT_SETTINGS = {
  picksDeadline: "Viernes 05:00 PM",
  paymentDeadline: "Sábado 04:00 PM",
  adminWhatsapp: "8715118046"
};

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem("qa_settings") || "null") || DEFAULT_SETTINGS;
  } catch(e) { return DEFAULT_SETTINGS; }
}

function saveSettings(s) {
  localStorage.setItem("qa_settings", JSON.stringify(s));
}

function openSettingsModal() {
  var s = loadSettings();
  var existing = document.getElementById("settingsModal");
  if (existing) existing.remove();

  var modal = document.createElement("div");
  modal.id = "settingsModal";
  modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";

  modal.innerHTML = [
    '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="settingsBg"></div>',
    '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
         'border-radius:24px 24px 0 0;padding:24px;max-height:80vh;overflow-y:auto;">',
      '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 18px;"></div>',
      '<div style="font-size:18px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">Configuración</div>',
      '<div style="font-size:13px;color:#8a94a6;margin-bottom:20px;">Ajustes de la quiniela</div>',

      '<div style="display:grid;gap:14px;">',
        '<div>',
          '<div style="font-size:12px;color:#8a94a6;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Fecha límite de picks</div>',
          '<input id="settingPicksDeadline" value="' + s.picksDeadline + '"',
            ' style="width:100%;padding:12px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);',
            'border-radius:12px;color:#f0f4f8;font-size:15px;box-sizing:border-box;" placeholder="Ej: Viernes 05:00 PM" />',
        '</div>',
        '<div>',
          '<div style="font-size:12px;color:#8a94a6;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Fecha límite de pago</div>',
          '<input id="settingPaymentDeadline" value="' + s.paymentDeadline + '"',
            ' style="width:100%;padding:12px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);',
            'border-radius:12px;color:#f0f4f8;font-size:15px;box-sizing:border-box;" placeholder="Ej: Sábado 04:00 PM" />',
        '</div>',
        '<div>',
          '<div style="font-size:12px;color:#8a94a6;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">WhatsApp admin</div>',
          '<input id="settingAdminWa" value="' + s.adminWhatsapp + '"',
            ' style="width:100%;padding:12px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);',
            'border-radius:12px;color:#f0f4f8;font-size:15px;box-sizing:border-box;" placeholder="10 dígitos" />',
        '</div>',
      '</div>',

      '<div style="display:grid;gap:10px;margin-top:20px;">',
        '<button id="settingsSave" style="width:100%;padding:14px;border-radius:14px;border:none;',
          'background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-size:15px;font-weight:700;cursor:pointer;">',
          'Guardar cambios',
        '</button>',
        '<button id="settingsClose" style="width:100%;padding:12px;border-radius:14px;',
          'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
          'color:#8a94a6;font-size:14px;cursor:pointer;">Cancelar</button>',
      '</div>',
    '</div>'
  ].join("");

  document.body.appendChild(modal);

  document.getElementById("settingsBg").addEventListener("click", function(){ modal.remove(); });
  document.getElementById("settingsClose").addEventListener("click", function(){ modal.remove(); });
  document.getElementById("settingsSave").addEventListener("click", function() {
    var newSettings = {
      picksDeadline:   document.getElementById("settingPicksDeadline").value.trim()   || DEFAULT_SETTINGS.picksDeadline,
      paymentDeadline: document.getElementById("settingPaymentDeadline").value.trim() || DEFAULT_SETTINGS.paymentDeadline,
      adminWhatsapp:   document.getElementById("settingAdminWa").value.trim()         || DEFAULT_SETTINGS.adminWhatsapp
    };
    saveSettings(newSettings);
    modal.remove();
    showAlert("Configuración guardada ✅", "ok");
  });
}

// Helper para usar en mensajes
function getPicksDeadline()   { return loadSettings().picksDeadline; }
function getPaymentDeadline() { return loadSettings().paymentDeadline; }
function getAdminWhatsapp()   { return loadSettings().adminWhatsapp; }

// ═══════════════════════════════════════════════════
// HISTORIAL DE PRONÓSTICOS POR PARTICIPANTE
// ═══════════════════════════════════════════════════
async function showParticipantHistory(participantId, participantName) {
  hideAlert();
  if (!participantId) return;

  var modal = document.createElement("div");
  modal.id = "historyModal";
  modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";

  modal.innerHTML = [
    '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="historyBg"></div>',
    '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
         'border-radius:24px 24px 0 0;padding:24px;max-height:85vh;overflow-y:auto;">',
      '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 16px;"></div>',
      '<div style="font-size:18px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">Historial de ' + participantName + '</div>',
      '<div style="font-size:13px;color:#8a94a6;margin-bottom:16px;">Pronósticos por jornada</div>',
      '<div id="historyContent" style="display:grid;gap:12px;">',
        '<div style="text-align:center;color:#8a94a6;padding:20px;">Cargando...</div>',
      '</div>',
      '<button id="historyClose" style="width:100%;margin-top:16px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
        'color:#8a94a6;font-size:14px;cursor:pointer;">Cerrar</button>',
    '</div>'
  ].join("");

  document.body.appendChild(modal);
  document.getElementById("historyBg").addEventListener("click", function(){ modal.remove(); });
  document.getElementById("historyClose").addEventListener("click", function(){ modal.remove(); });

  // Load data
  var [entriesRes, poolsRes] = await Promise.all([
    supabaseClient.from("entries")
      .select("id, pool_id, paid, created_at")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false }),
    supabaseClient.from("pools")
      .select("id, name, round, competition, season, status")
      .order("round", { ascending: false })
  ]);

  var entries = entriesRes.data || [];
  var pools   = poolsRes.data  || [];
  var poolMap = {};
  pools.forEach(function(p){ poolMap[p.id] = p; });

  if (!entries.length) {
    document.getElementById("historyContent").innerHTML =
      '<div style="text-align:center;color:#8a94a6;padding:20px;">Sin boletos registrados.</div>';
    return;
  }

  var entryIds = entries.map(function(e){ return e.id; });

  var [picksRes, pointsRes, matchRes] = await Promise.all([
    supabaseClient.from("predictions_1x2")
      .select("entry_id, match_id, pick").in("entry_id", entryIds),
    supabaseClient.from("entry_points")
      .select("entry_id, pool_id, points, played_matches").in("entry_id", entryIds),
    supabaseClient.from("matches")
      .select("id, pool_id, match_no, home_team, away_team, home_goals, away_goals")
      .in("pool_id", entries.map(function(e){ return e.pool_id; }))
      .order("match_no", { ascending: true })
  ]);

  var allPicks  = picksRes.data  || [];
  var allPoints = pointsRes.data || [];
  var allMatches= matchRes.data  || [];

  var picksByEntry  = {};
  allPicks.forEach(function(p) {
    if (!picksByEntry[p.entry_id]) picksByEntry[p.entry_id] = {};
    picksByEntry[p.entry_id][p.match_id] = p.pick;
  });

  var pointsByEntry = {};
  allPoints.forEach(function(p){ pointsByEntry[p.entry_id] = p; });

  var matchesByPool = {};
  allMatches.forEach(function(m) {
    if (!matchesByPool[m.pool_id]) matchesByPool[m.pool_id] = [];
    matchesByPool[m.pool_id].push(m);
  });

  function pickLabel(c) { return c === "H" ? "L" : c === "D" ? "E" : c === "A" ? "V" : "—"; }
  function pickColor(c) { return c === "H" ? "#34d399" : c === "D" ? "#fbbf24" : c === "A" ? "#60a5fa" : "#4a5568"; }

  var html = entries.map(function(entry) {
    var pool    = poolMap[entry.pool_id] || {};
    var pts     = pointsByEntry[entry.id];
    var picks   = picksByEntry[entry.id] || {};
    var matches = matchesByPool[entry.pool_id] || [];
    var jornada = pool.round ? "J" + pool.round : (pool.name || "Jornada");
    var statusEmoji = entry.paid ? "✅" : "⏳";
    var aciertos = pts ? pts.points : "—";
    var aciertoColor = typeof aciertos === "number" && aciertos > 0 ? "#34d399" : "#8a94a6";

    var matchRows = matches.map(function(m) {
      var pick     = picks[m.id] || null;
      var hasGoals = m.home_goals !== null && m.away_goals !== null;
      var result   = null;
      if (hasGoals) {
        result = m.home_goals > m.away_goals ? "H" : m.home_goals < m.away_goals ? "A" : "D";
      }
      var correct = pick && result && pick === result;
      var bg = correct ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.04)";
      var pickClr = pick ? pickColor(pick) : "#4a5568";

      return [
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;',
             'border-radius:8px;background:' + bg + ';margin-bottom:4px;">',
          '<div style="font-size:12px;color:#e5e7eb;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">',
            m.home_team + ' vs ' + m.away_team,
          '</div>',
          '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0;margin-left:8px;">',
            pick ? '<span style="font-size:11px;font-weight:800;color:' + pickClr + ';background:rgba(255,255,255,.08);padding:2px 7px;border-radius:6px;">' + pickLabel(pick) + '</span>' : '',
            hasGoals ? '<span style="font-size:11px;color:#6b7280;">' + m.home_goals + '-' + m.away_goals + '</span>' : '',
            correct  ? '<span style="font-size:11px;">✅</span>' : (hasGoals && pick ? '<span style="font-size:11px;">❌</span>' : ''),
          '</div>',
        '</div>'
      ].join("");
    }).join("");

    return [
      '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;">',
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;',
             'background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.07);">',
          '<div>',
            '<div style="font-size:14px;font-weight:800;color:#fff;">' + jornada + ' ' + statusEmoji + '</div>',
            '<div style="font-size:12px;color:#8a94a6;">' + (pool.competition || "Liga MX") + '</div>',
          '</div>',
          '<div style="text-align:right;">',
            '<div style="font-size:22px;font-weight:900;color:' + aciertoColor + ';">' + aciertos + '</div>',
            '<div style="font-size:11px;color:#6b7280;">aciertos</div>',
          '</div>',
        '</div>',
        matches.length ? '<div style="padding:10px 12px;">' + matchRows + '</div>'
          : '<div style="padding:12px;font-size:12px;color:#6b7280;">Sin plantilla guardada</div>',
      '</div>'
    ].join("");
  }).join("");

  var content = document.getElementById("historyContent");
  if (content) content.innerHTML = html;
}



// ═══════════════════════════════════════════════════
// BORRAR PARTICIPANTES DE PRUEBA
// ═══════════════════════════════════════════════════
async function deleteTestParticipants() {
  hideAlert();

  // Buscar participantes cuyo nombre empiece con "Prueba" o "prueba" o "TEST"
  var { data: tests, error } = await supabaseClient.from("participants")
    .select("id, name, is_active")
    .ilike("name", "prueba%");

  if (error) return showAlert(error.message, "error");
  if (!tests || !tests.length) return showAlert("No se encontraron participantes de prueba.", "info");

  var names = tests.map(function(p){ return p.name; }).join(", ");

  var confirmed = await showConfirmModal({
    icon: "🗑️",
    title: "Borrar participantes de prueba",
    message: "Se eliminarán: " + names + ". Esta acción NO se puede deshacer.",
    confirmLabel: "Sí, eliminar",
    confirmStyle: "background:linear-gradient(135deg,#be123c,#e11d48);"
  });
  if (!confirmed) return;

  var ids = tests.map(function(p){ return p.id; });

  // Intentar archivar primero (más seguro — no rompe FK)
  var { error: archErr } = await supabaseClient.from("participants")
    .update({ is_active: false })
    .in("id", ids);

  if (archErr) return showAlert("Error archivando: " + archErr.message, "error");

  showAlert("Participantes de prueba archivados (" + ids.length + ") ✅", "ok");
  await loadParticipants();
  await loadDashboardSummary();
}

// ═══════════════════════════════════════════════════
// PDF PLANTILLA: múltiples copias en una sola hoja
// para imprimir y repartir físicamente
// ═══════════════════════════════════════════════════
async function printTemplateCopiesPage() {
  hideAlert();

  var pool_id = $("tplPool").value;
  if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

  var pool, matches;
  try {
    pool    = await getPoolInfo(pool_id);
    matches = await getMatches(pool_id);
  } catch(e) { return showAlert(e.message, "error"); }

  if (!matches || !matches.length)
    return showAlert("Esta jornada no tiene plantilla guardada.", "error");

  // A4 → 794×1123px  |  3 cols × 4 filas = 12 copias
  var COPIES = 12;
  var PAGE_W = 794;
  var PAGE_H = 1123;

  var logoUrl = (typeof QUINIELA_LOGO_URL !== "undefined") ? QUINIELA_LOGO_URL : "";
  var jornada  = pool && pool.round ? "J" + pool.round : (pool && pool.name ? pool.name : "J?");
  var fechas   = pool && pool.date_label ? pool.date_label : "";
  var precio   = pool && pool.price ? "$" + pool.price : "";
  var subtitulo = jornada + (fechas ? " \u2022 " + fechas : "") + (precio ? " \u2022 " + precio : "");

  var printArea = $("printArea");
  printArea.classList.remove("hidden");
  printArea.innerHTML = "";

  var page = document.createElement("div");
  page.style.cssText = [
    "width:"   + PAGE_W + "px",
    "height:"  + PAGE_H + "px",
    "background:#ffffff",
    "display:grid",
    "grid-template-columns:1fr 1fr 1fr",
    "grid-template-rows:repeat(4,1fr)",
    "gap:4px",
    "padding:6px",
    "box-sizing:border-box",
    "font-family:Arial,Helvetica,sans-serif",
    "color:#111111"
  ].join(";");

  for (var i = 0; i < COPIES; i++) {
    var copy = document.createElement("div");
    copy.style.cssText = [
      "border:1px solid #999",
      "border-radius:5px",
      "padding:4px 5px 4px 5px",
      "background:#ffffff",
      "box-sizing:border-box",
      "display:flex",
      "flex-direction:column",
      "color:#111111"
    ].join(";");

    // ── HEADER ──
    var header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:2px;";
    header.innerHTML =
      '<img src="' + logoUrl + '" crossorigin="anonymous" ' +
        'style="width:18px;height:18px;object-fit:contain;border-radius:3px;flex-shrink:0;" />' +
      '<div style="min-width:0;color:#111;">' +
        '<div style="font-weight:900;font-size:8px;line-height:1.2;color:#111;white-space:nowrap;">Quiniela Arc\u00e1ngel</div>' +
        '<div style="font-size:6.5px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + subtitulo + '</div>' +
      '</div>';
    copy.appendChild(header);

    // ── INSTRUCTION ──
    var instr = document.createElement("div");
    instr.style.cssText = "font-size:6.5px;color:#333;text-align:center;margin-bottom:2px;font-style:italic;";
    instr.textContent = "Marca una opci\u00f3n por partido";
    copy.appendChild(instr);

    // ── COLUMN HEADERS L / E / V ──
    var colHeaders = document.createElement("div");
    colHeaders.style.cssText = [
      "display:grid",
      "grid-template-columns:14px 1fr 13px 1fr 14px",
      "gap:1px",
      "margin-bottom:2px",
      "font-size:7px",
      "font-weight:900",
      "color:#111"
    ].join(";");
    colHeaders.innerHTML =
      '<div style="text-align:center;">L</div>' +
      '<div></div>' +
      '<div style="text-align:center;">E</div>' +
      '<div></div>' +
      '<div style="text-align:center;">V</div>';
    copy.appendChild(colHeaders);

    // ── MATCH ROWS ──
    var matchWrap = document.createElement("div");
    matchWrap.style.cssText = "flex:1;";

    matches.forEach(function(m) {
      var hLogo = (typeof TEAM_LOGOS !== "undefined" && TEAM_LOGOS[(m.home_team||"").toUpperCase()]) || "";
      var aLogo = (typeof TEAM_LOGOS !== "undefined" && TEAM_LOGOS[(m.away_team||"").toUpperCase()]) || "";

      var BOX  = '<div style="width:12px;height:10px;border:1.2px solid #333;border-radius:2px;flex-shrink:0;background:#fff;"></div>';
      var EBOX = '<div style="width:10px;height:10px;border:1.2px solid #333;border-radius:2px;flex-shrink:0;margin:0 auto;background:#fff;"></div>';

      var hImg = hLogo ? '<img src="' + hLogo + '" crossorigin="anonymous" style="width:8px;height:8px;object-fit:contain;flex-shrink:0;" />' : '';
      var aImg = aLogo ? '<img src="' + aLogo + '" crossorigin="anonymous" style="width:8px;height:8px;object-fit:contain;flex-shrink:0;" />' : '';

      var row = document.createElement("div");
      row.style.cssText = [
        "display:grid",
        "grid-template-columns:14px 1fr 13px 1fr 14px",
        "gap:1px",
        "align-items:center",
        "margin-bottom:1.5px"
      ].join(";");
      row.innerHTML =
        BOX +
        '<div style="display:flex;align-items:center;gap:1px;min-width:0;overflow:hidden;">' +
          hImg +
          '<span style="font-weight:700;font-size:7px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;">' + m.home_team + '</span>' +
        '</div>' +
        EBOX +
        '<div style="display:flex;align-items:center;justify-content:flex-end;gap:1px;min-width:0;overflow:hidden;">' +
          '<span style="font-weight:700;font-size:7px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;line-height:1.2;">' + m.away_team + '</span>' +
          aImg +
        '</div>' +
        BOX;
      matchWrap.appendChild(row);
    });
    copy.appendChild(matchWrap);

    // ── FOOTER — líneas DEBAJO de cada label ──
    var footer = document.createElement("div");
    footer.style.cssText = [
      "margin-top:3px",
      "padding-top:3px",
      "border-top:0.8px solid #aaa",
      "font-size:6.5px",
      "color:#111",
      "display:flex",
      "flex-direction:column",
      "gap:3px"
    ].join(";");

    // Each field: label on its own line, then underline below
    ["Nombre","Área","*WhatsApp"].forEach(function(label) {
      var field = document.createElement("div");
      field.innerHTML =
        '<div style="font-weight:700;color:#333;margin-bottom:1px;">' + label + ':</div>' +
        '<div style="height:8px;border-bottom:0.8px solid #555;width:100%;"></div>';
      footer.appendChild(field);
    });

    // Note
    var note = document.createElement("div");
    note.style.cssText = "font-size:5.5px;color:#666;margin-top:1px;line-height:1.3;";
    note.textContent = "*Registro 1\u00aa vez para env\u00edo de link Plataforma de Resultados";
    footer.appendChild(note);

    copy.appendChild(footer);
    page.appendChild(copy);
  }

  printArea.appendChild(page);

  try {
    var { jsPDF } = window.jspdf;
    var pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    var canvas = await html2canvas(page, {
      scale: 2.5,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      imageTimeout: 10000,
      logging: false
    });

    var imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 4, 4, 587, 834);

    var safeName = (pool && pool.name ? pool.name : "Plantilla")
      .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    pdf.save(safeName + "-copias-imprimir.pdf");
    showAlert("PDF generado \u2014 12 copias en A4 \u2705", "ok");
  } catch(err) {
    showAlert("Error: " + (err && err.message ? err.message : String(err)), "error");
  } finally {
    printArea.innerHTML = "";
    printArea.classList.add("hidden");
  }
}

// =====================
// Init
// =====================


// ═══════════════════════════════════════
// WhatsApp Pronóstico Individual
// ═══════════════════════════════════════
async function sendPicksViaWhatsApp(poolId, participantId, entryId) {
  hideAlert();
  if (!poolId || !participantId) return showAlert("Faltan datos.", "error");

  var partRes = await supabaseClient.from("participants")
    .select("id, name, area, whatsapp").eq("id", participantId).maybeSingle();
  if (partRes.error || !partRes.data) return showAlert("Participante no encontrado.", "error");
  var part = partRes.data;
  if (!part.whatsapp) return showAlert(part.name + " no tiene WhatsApp registrado.", "error");

  var poolRes = await supabaseClient.from("pools")
    .select("id, round, name, date_label, price, season").eq("id", poolId).maybeSingle();
  if (poolRes.error) return showAlert(poolRes.error.message, "error");
  var pool = poolRes.data;

  var eid = entryId;
  if (!eid) {
    var entRes = await supabaseClient.from("entries")
      .select("id").eq("pool_id", poolId).eq("participant_id", participantId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (entRes.error || !entRes.data) return showAlert("No tiene boleto en esta jornada.", "error");
    eid = entRes.data.id;
  }

  var matchRes = await supabaseClient.from("matches")
    .select("id, match_no, home_team, away_team")
    .eq("pool_id", poolId).order("match_no", { ascending: true });
  if (matchRes.error) return showAlert(matchRes.error.message, "error");
  var matches = matchRes.data || [];

  var picksRes = await supabaseClient.from("predictions_1x2")
    .select("match_id, pick").eq("entry_id", eid);
  if (picksRes.error) return showAlert(picksRes.error.message, "error");
  var pickMap = {};
  (picksRes.data || []).forEach(function(p) { pickMap[p.match_id] = p.pick; });

  if (!Object.keys(pickMap).length) return showAlert("Sin pronosticos capturados.", "error");

  function pickLabel(c) { return c === "H" ? "LOCAL" : c === "D" ? "EMPATE" : c === "A" ? "VISITA" : "?"; }
  function pickArrow(c) { return c === "H" ? "->" : c === "A" ? "<-" : c === "D" ? "=" : "?"; }

  var jornada = pool && pool.round ? "Jornada " + pool.round : (pool && pool.name ? pool.name : "Jornada");
  var fechas  = pool && pool.date_label ? pool.date_label : "";

  var lines = [
    "Quiniela Arcangel - " + jornada,
    "Pronostico de: " + part.name + (part.area ? " (" + part.area + ")" : ""),
  ];
  if (fechas) lines.push("Fechas: " + fechas);
  lines.push("");
  matches.forEach(function(m) {
    var pick = pickMap[m.id];
    lines.push(m.match_no + ". " + m.home_team + " vs " + m.away_team);
    lines.push("   " + pickArrow(pick) + " " + (pick ? pickLabel(pick) : "Sin pick"));
  });
  lines.push("");
  lines.push("Boleto pagado, boleto jugado. Suerte!");

  var text = lines.join("\n");
  var clean = String(part.whatsapp).replace(/\D/g, "");
  window.open("https://wa.me/52" + clean + "?text=" + encodeURIComponent(text), "_blank");
}


supabaseClient.auth.onAuthStateChange(function(event, session) {
  var newUserId = session && session.user ? session.user.id : null;

  if (event === "SIGNED_IN") {
    // Solo reiniciar si es un usuario diferente o la app aun no cargo
    if (!appInitialized || newUserId !== lastAuthUserId) {
      lastAuthUserId = newUserId;
      safeInit();
    }
  } else if (event === "SIGNED_OUT") {
    lastAuthUserId = null;
    appInitialized = false;
    safeInit();
  }
  // TOKEN_REFRESHED, USER_UPDATED, etc. → ignorar (no reiniciar la app)
});

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

  // Solo redibujar la vista si no estamos ya en el dashboard
  if (!appInitialized) {
    setView("viewDash");
    // Solicitar permisos de notificación al primer login
    if (typeof requestPushPermission === "function") {
      setTimeout(requestPushPermission, 2000);
    }
  }

  const now = new Date();
  const saludo = getGreetingByHour(getMonterreyHour(now));
  const fecha = formatMxHeader(now);
  $("greetingMain").textContent = `👋 ${saludo}, ${profile.display_name}`;
  $("greetingDate").textContent = fecha;

  await loadPools();
  await loadParticipants();

  await fillEntryPoolsSelect();
  await fillEntryParticipantsSelect();
  await loadEntriesAndStats();

  await fillTplPools();
  await loadTemplateIntoEditor();
  await renderPreview();

  await fillPickPoolsSelect();
  await fillPickParticipantsSelect();

  await loadDashboardSummary();

  initBottomNav();

  // Solo navegar a Inicio en el primer arranque
  if (!appInitialized) {
    await showAppTab("tab-home");
  }

  appInitialized = true;
  await updateNavBadges();
}

// Arranque
setView("viewLogin");
safeInit();

// Errores globales — ya registrados arriba (eliminado duplicado)

// DOMContentLoaded eliminado — safeInit() ya se llama en línea 'Arranque'