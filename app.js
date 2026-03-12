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

document.body.insertAdjacentHTML(
  "beforeend",
  '<div id="jsok" style="position:fixed;bottom:12px;right:12px;z-index:9999;padding:6px 10px;border-radius:8px;background:#0a7;color:#fff;font:12px system-ui;">JS OK</div>'
);


// =====================
// CONFIG SUPABASE
// =====================
const SUPABASE_URL = "https://zapoxyrmeoqukshjzgki.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qYDfuLHeUz6Uy3Vy5t8mFA_QfXbMU9v";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

let showArchivedParticipants = false;
let currentPickEntryId = null;
let currentPickPoolId = null;
let currentPickParticipantId = null;

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

async function showAppTab(tabId) {
  document.querySelectorAll(".app-tab").forEach(tab => {
    tab.classList.add("hidden");
  });

  const target = document.getElementById(tabId);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".bottom-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });

  try {
    if (tabId === "tab-dashboard") {
      await loadDashboardSummary();
    }

    if (tabId === "tab-participants") {
      await loadParticipants();
    }

    if (tabId === "tab-pools") {
      await loadPools();
    }

    if (tabId === "tab-templates") {
  await fillTplPools();
}

    if (tabId === "tab-payments") {
      await fillEntryPoolsSelect();
      await fillEntryParticipantsSelect();
      await loadEntriesAndStats();
    }

    if (tabId === "tab-picks") {
  await fillPickPoolsSelect();
  await fillPickParticipantsSelect();
  await loadPickStatusList(); }

if (tabId === "tab-results") {
  await fillResultsPoolsSelect();
}

if (tabId === "tab-standings") {
  await fillStandingsPoolsSelect();
}

  } catch (err) {
    showAlert("Error cargando sección: " + (err?.message || err), "error");
  }
}

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
  } else {
    $("dashPaidEntries").textContent = "0";
    $("dashPrize").textContent = "$0";
  }
}

async function loadParticipants() {
  const q = supabaseClient
    .from("participants")
    .select("id, name, area, whatsapp, is_active, created_at")
    .order("created_at", { ascending: false });

  const { data, error } = showArchivedParticipants
    ? await q.eq("is_active", false)
    : await q.eq("is_active", true);

  if (error) return showAlert(error.message, "error");

  const rows = data || [];
  $("participantsList").innerHTML = rows.map(p => `
    <div class="p-3 bg-zinc-950 border border-zinc-800 rounded flex justify-between items-center gap-2">
      <div>
        <div class="font-semibold">${p.name}</div>
        <div class="text-xs text-zinc-400">${p.area || "-"} • ${p.whatsapp || "-"}</div>
      </div>

      ${
        showArchivedParticipants
          ? `<button data-restore="${p.id}" class="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-xs">Restaurar</button>`
          : `<button data-archive="${p.id}" class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">Eliminar</button>`
      }
    </div>
  `).join("");

  // Archivar
  document.querySelectorAll("[data-archive]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-archive");
      if (!confirm("¿Eliminar participante? (Se ocultará, no se borra historial)")) return;

      const { error } = await supabaseClient.from("participants").update({ is_active: false }).eq("id", id);
      if (error) return showAlert(error.message, "error");

      showAlert("Participante eliminado ✅", "ok");
      await loadParticipants();
      await fillEntryParticipantsSelect();
    });
  });

  // Restaurar
  document.querySelectorAll("[data-restore]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-restore");

      const { error } = await supabaseClient.from("participants").update({ is_active: true }).eq("id", id);
      if (error) return showAlert(error.message, "error");

      showAlert("Participante restaurado ✅", "ok");
      await loadParticipants();
      await fillEntryParticipantsSelect();
    });
  });
}

async function loadPools() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, round, competition, season, price, commission_pct, date_label, mode_code,carryover_enabled, created_at")
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
            <div class="text-xs text-zinc-400"><div class="text-xs text-emerald-300 mt-1">
Modo: ${p.mode_code}
</div>
  $${Number(p.price).toFixed(0)} • Comisión ${Number(p.commission_pct).toFixed(0)}% • ${p.competition} • ${p.season}
</div>
${p.date_label ? `<div class="text-xs text-emerald-300/90 mt-1">Fechas: ${p.date_label}</div>` : ""}
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-1 rounded-full border ${badge}">${statusLabel}</span>

<button data-dates="${p.id}" data-curdates="${(p.date_label || "").replace(/"/g, "&quot;")}"
  class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">
  Editar fechas
</button>

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

document.querySelectorAll("[data-dates]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const id = btn.getAttribute("data-dates");
    const cur = btn.getAttribute("data-curdates") || "";
    await editPoolDates(id, cur);
  });
});



document.querySelectorAll("[data-archive]").forEach(btn => {
  btn.addEventListener("click", async () => {

    const id = btn.getAttribute("data-archive");

    if (!confirm("¿Eliminar participante? (Se ocultará del sistema)")) return;

    const { error } = await supabaseClient
      .from("participants")
      .update({ is_active: false })
      .eq("id", id);

    if (error) return showAlert(error.message, "error");

    showAlert("Participante eliminado ✅", "ok");

    await loadParticipants();
    await fillEntryParticipantsSelect();
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

function money(n) {
  const x = Number(n || 0);
  return "$" + x.toFixed(0);
}

async function fillEntryPoolsSelect() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, price, commission_pct, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return showAlert(error.message, "error");

  const sel = $("entryPool");
  sel.innerHTML = (data || []).map(p => {
    const tag = p.status === "open" ? " (Activa)" : "";
    return `<option value="${p.id}">${p.name}${tag}</option>`;
  }).join("");

  // Si hay activa, seleccionarla por defecto
  const active = (data || []).find(p => p.status === "open");
  if (active) sel.value = active.id;
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
  sel.innerHTML = (data || []).map(function(p) {
    const tag = p.status === "open" ? " (Activa)" : "";
    return `<option value="${p.id}">${p.name}${tag}</option>`;
  }).join("");

  const active = (data || []).find(function(p) {
    return p.status === "open";
  });

  if (active) sel.value = active.id;
}

async function fillPickParticipantsSelect() {
  const { data, error } = await supabaseClient
    .from("participants")
    .select("id, name, area, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
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
    .select("id, paid, created_at")
    .eq("pool_id", pool_id)
    .eq("participant_id", participant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (entryError) return showAlert(entryError.message, "error");

  if (!entry) {
    currentPickEntryId = null;
    $("pickEntryLabel").textContent = "Sin boleto";
    $("pickMatches").innerHTML = "";
    return showAlert("Ese participante no tiene boleto registrado en esta jornada.", "error");
  }

  currentPickEntryId = entry.id;
  currentPickPoolId = pool_id;
  currentPickParticipantId = participant_id;

  $("pickEntryLabel").textContent = entry.paid ? "Pagado ✅" : "Pendiente";

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

async function savePicks() {
  hideAlert();

  if (!currentPickEntryId) {
    return showAlert("Primero carga un boleto.", "error");
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
}


function clearPicksSelection() {
  document.querySelectorAll(".pick-btn").forEach(function(btn) {
    btn.classList.remove("bg-emerald-600", "border-emerald-500", "text-white");
    btn.classList.add("bg-zinc-900", "border-zinc-700", "text-zinc-200");
    btn.dataset.selected = "";
  });
}

async function loadPickStatusList() {
  hideAlert();

  const pool_id = $("pickPool").value;
  if (!pool_id) {
    $("pickStatusList").innerHTML = "";
    return;
  }

  // Participantes activos
  const { data: participants, error: pErr } = await supabaseClient
    .from("participants")
    .select("id, name, area")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (pErr) return showAlert(pErr.message, "error");

  // Boletos de esa jornada
  const { data: entries, error: eErr } = await supabaseClient
    .from("entries")
    .select("id, participant_id, paid")
    .eq("pool_id", pool_id);

  if (eErr) return showAlert(eErr.message, "error");

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

  const rowsHtml = (participants || []).map(function(participant) {
    const entry = entryByParticipant.get(participant.id);
    const area = participant.area ? " • " + participant.area : "";

    let statusText = "Sin boleto";
    let statusClasses = "bg-zinc-700/20 border-zinc-600/30 text-zinc-200";
    let actionBtn = "";

    if (entry) {
      const pickCount = picksCountByEntry.get(entry.id) || 0;

      if (pickCount > 0) {
        statusText = "Capturado ✅";
        statusClasses = "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
      } else {
        statusText = "Pendiente";
        statusClasses = "bg-amber-500/10 border-amber-500/20 text-amber-300";
      }

      actionBtn = `
  <div class="flex items-center gap-2">
    <button
      type="button"
      class="pick-status-open px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
      data-participant-id="${participant.id}">
      Abrir
    </button>

    <button
      type="button"
      class="pick-status-export px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
      data-participant-id="${participant.id}">
      Imagen
    </button>
  </div>
`;
    }

    return `
      <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold truncate">${participant.name}</div>
          <div class="text-xs text-zinc-400 truncate">${area || "Sin área"}</div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs px-2 py-1 rounded-full border ${statusClasses}">
            ${statusText}
          </span>
          ${actionBtn}
        </div>
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
  var pool = opts.pool;
  var participant = opts.participant;
  var matches = opts.matches || [];
  var pickMap = opts.pickMap || new Map();

  var card = document.createElement("div");
  card.style.width = "820px";
  card.style.background = "#ffffff";
  card.style.color = "#111111";
  card.style.border = "1.5px solid #222222";
  card.style.borderRadius = "16px";
  card.style.padding = "22px";
  card.style.boxSizing = "border-box";
  card.style.fontFamily = "Arial, sans-serif";

  card.innerHTML =
    '<div style="font-size:30px;font-weight:900;text-align:center;">Quiniela Herseg MX</div>' +
    '<div style="font-size:16px;color:#555;text-align:center;margin-top:4px;">"Pasión X Ganar" ⚽ ' + (pool?.season || "") + '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr 110px;gap:10px;margin-top:16px;">' +
      '<div style="border:1px solid #222;border-radius:10px;padding:10px;text-align:center;">' +
        '<div style="font-size:11px;color:#666;text-transform:uppercase;">Jornada</div>' +
        '<div style="font-size:18px;font-weight:800;margin-top:2px;">' + (pool?.round ? ('Jornada ' + pool.round) : (pool?.name || 'Jornada')) + '</div>' +
      '</div>' +
      '<div style="border:1px solid #222;border-radius:10px;padding:10px;text-align:center;">' +
        '<div style="font-size:11px;color:#666;text-transform:uppercase;">Fechas</div>' +
        '<div style="font-size:18px;font-weight:800;margin-top:2px;">' + (pool?.date_label || 'FECHAS') + '</div>' +
      '</div>' +
      '<div style="border:1px solid #222;border-radius:10px;padding:10px;text-align:center;">' +
        '<div style="font-size:11px;color:#666;text-transform:uppercase;">Costo</div>' +
        '<div style="font-size:18px;font-weight:900;margin-top:2px;">$' + Number(pool?.price || 20) + '</div>' +
      '</div>' +
    '</div>' +

    '<div style="margin-top:16px;padding:12px 14px;border-radius:12px;background:#f4f4f5;border:1px solid #d4d4d8;">' +
      '<div style="font-size:18px;font-weight:800;">' + (participant?.name || "") + '</div>' +
      '<div style="font-size:14px;color:#555;margin-top:2px;">' + (participant?.area || "Sin área") + '</div>' +
      '<div style="font-size:13px;color:#0f766e;font-weight:700;margin-top:8px;">Boleto Registrado ✅</div>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:70px 48px 1fr 70px 48px 1fr 70px;gap:10px;align-items:end;margin-top:18px;margin-bottom:8px;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">' +
      '<div style="text-align:center;padding:5px 0;border-radius:8px;background:#f4f4f5;">Local</div>' +
      '<div></div>' +
      '<div></div>' +
      '<div style="text-align:center;padding:5px 0;border-radius:8px;background:#f4f4f5;">Empate</div>' +
      '<div></div>' +
      '<div></div>' +
      '<div style="text-align:center;padding:5px 0;border-radius:8px;background:#f4f4f5;">Visita</div>' +
    '</div>';

  var table = document.createElement("div");
  table.style.display = "grid";
  table.style.gap = "10px";
  table.style.marginTop = "8px";

  matches.forEach(function(m) {
    var pick = pickMap.get(m.id) || "";
    var homeLogo = getTeamLogo(m.home_team);
    var awayLogo = getTeamLogo(m.away_team);

    function box(selected) {
      return '<div style="width:70px;height:32px;border:1.5px solid #222;border-radius:7px;background:' + (selected ? '#111111' : '#ffffff') + ';color:' + (selected ? '#ffffff' : '#111111') + ';display:flex;align-items:center;justify-content:center;font-weight:900;">' +
        (selected ? '✓' : '') +
      '</div>';
    }

    var row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "70px 48px 1fr 70px 48px 1fr 70px";
    row.style.alignItems = "center";
    row.style.gap = "10px";

    row.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;">' + box(pick === "H") + '</div>' +

      '<div style="display:flex;align-items:center;justify-content:center;padding-left:6px;padding-right:6px;">' +
        (homeLogo ? '<img src="' + homeLogo + '" style="width:30px;height:30px;object-fit:contain;" crossorigin="anonymous">' : '') +
      '</div>' +

      '<div style="text-align:left;font-weight:700;font-size:15px;color:#111;padding-left:4px;">' + m.home_team + '</div>' +

      '<div style="display:flex;align-items:center;justify-content:center;">' + box(pick === "D") + '</div>' +

      '<div style="display:flex;align-items:center;justify-content:center;padding-left:6px;padding-right:6px;">' +
        (awayLogo ? '<img src="' + awayLogo + '" style="width:30px;height:30px;object-fit:contain;" crossorigin="anonymous">' : '') +
      '</div>' +

      '<div style="text-align:left;font-weight:700;font-size:15px;color:#111;padding-left:4px;">' + m.away_team + '</div>' +

      '<div style="display:flex;align-items:center;justify-content:center;">' + box(pick === "A") + '</div>';

    table.appendChild(row);
  });

  card.appendChild(table);

  var footer = document.createElement("div");
  footer.style.marginTop = "22px";
  footer.style.textAlign = "center";
  footer.style.lineHeight = "1.8";
  footer.innerHTML =
    '<div style="font-size:20px;font-weight:800;color:#111;">Gracias por Participar</div>' +
    '<div style="font-size:16px;color:#444;">Que la Fuerza te acompañe ✋🏻</div>';

  card.appendChild(footer);

  return card;
}

async function addEntry() {
  hideAlert();

  const pool_id = $("entryPool").value;
  const participant_id = $("entryParticipant").value;
  const paid = $("entryPaid").checked;

  if (!pool_id || !participant_id) {
    return showAlert("Falta seleccionar pool/participante.", "error");
  }

  const payload = {
    pool_id,
    participant_id,
    paid,
    paid_at: paid ? new Date().toISOString() : null
  };

  const { error } = await supabaseClient.from("entries").insert(payload);
  if (error) return showAlert(error.message, "error");

  showAlert("Boleto registrado ✅", "ok");
  $("entryPaid").checked = false;

  await loadEntriesAndStats();
  await fillPickPoolsSelect();
  await fillPickParticipantsSelect();
  await loadDashboardSummary();
}

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

  // Lista de entries recientes
  const { data: rows, error } = await supabaseClient
    .from("entries")
    .select("id, paid, created_at, participants(name), pools(name)")
    .eq("pool_id", pool_id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return showAlert(error.message, "error");

  $("entriesList").innerHTML = (rows || []).map(r => {
    const badge = r.paid
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
      : "bg-zinc-700/20 border-zinc-600/30 text-zinc-200";

    return `
      <div class="p-2 bg-zinc-950 border border-zinc-800 rounded flex items-center justify-between gap-2">
        <div>
          <div class="font-semibold">${r.participants?.name || "—"}</div>
          <div class="text-xs text-zinc-400">${new Date(r.created_at).toLocaleString("es-MX")}</div>
        </div>
        <span class="text-xs px-2 py-1 rounded-full border ${badge}">
          ${r.paid ? "Pagado" : "Pendiente"}
        </span>
      </div>
    `;
  }).join("");
}

async function fillTplPools() {
  const { data, error } = await supabaseClient
    .from("pools")
    .select("id, name, status, round, competition, season, price")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return showAlert(error.message, "error");

  const sel = $("tplPool");
  sel.innerHTML = (data || []).map(p => {
    const tag = p.status === "open" ? " (Activa)" : "";
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
    return showAlert("Selecciona una jornada.", "error");
  }

  const rows = [];

  for (let i = 1; i <= n; i++) {
    const home = document.querySelector(`[data-home="${i}"]`)?.value?.trim();
    const away = document.querySelector(`[data-away="${i}"]`)?.value?.trim();

    if (!home || !away) {
      $("tplSavedStatus").textContent = `Falta capturar Local/Visita en partido #${i}`;
      return showAlert(`Falta Local/Visita en partido #${i}`, "error");
    }

    rows.push({
      pool_id,
      match_no: i,
      home_team: home.toUpperCase(),
      away_team: away.toUpperCase()
    });
  }

  $("tplSavedStatus").textContent = `Guardando plantilla (${rows.length} partidos)...`;
  showAlert(`Guardando plantilla (${rows.length} partidos)...`, "ok");

  try {
    const { data ,error } = await supabaseClient
      .from("matches")
      .insert(rows); // 👈 sin .select()

    if (error) {
      $("tplSavedStatus").textContent = "Error guardando plantilla.";
      return showAlert("Error guardando plantilla: " + error.message, "error");
    }

    $("tplSavedStatus").textContent = `Plantilla guardada: ${rows.length} partidos ✅`;
    showAlert(`Plantilla guardada ✅ (${rows.length} partidos)`, "ok");
return;
  } catch (err) {
    $("tplSavedStatus").textContent = "Error inesperado al guardar.";
    showAlert("Error inesperado: " + (err?.message || err), "error");
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

function makeTemplateCard(opts) {
  var title = opts.title;
  var subtitle = opts.subtitle;
  var jornadaText = opts.jornadaText;
  var dateText = opts.dateText;
  var priceText = opts.priceText;
  var matches = opts.matches || [];
  var exportMode = opts.exportMode === true;

  var bg = exportMode ? "#ffffff" : "#0b0f14";
  var text = exportMode ? "#111111" : "#e5e7eb";
  var sub = exportMode ? "#555555" : "#a1a1aa";
  var border = exportMode ? "#222222" : "#1f2937";
  var innerBg = exportMode ? "#ffffff" : "#0a0e13";
  var soft = exportMode ? "#f4f4f5" : "#111827";

  var card = document.createElement("div");
  card.className = "qh-card";
  card.style.background = bg;
  card.style.color = text;
  card.style.border = "1.5px solid " + border;
  card.style.borderRadius = exportMode ? "16px" : "16px";
  card.style.padding = exportMode ? "22px" : "12px";
  card.style.width = exportMode ? "760px" : "360px";
  card.style.maxWidth = "100%";
  card.style.boxSizing = "border-box";
  card.style.fontFamily = "Arial, sans-serif";

  card.innerHTML =
    '<div style="font-weight:800;text-align:center;font-size:' + (exportMode ? "28px" : "18px") + ';color:' + text + ';letter-spacing:.3px;">' +
      title +
    '</div>' +

    '<div style="text-align:center;font-size:' + (exportMode ? "15px" : "12px") + ';color:' + sub + ';margin-top:4px;">' +
      subtitle +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr 100px;gap:10px;margin-top:16px;font-size:' + (exportMode ? "14px" : "12px") + ';">' +
      '<div style="border:1px solid ' + border + ';border-radius:10px;padding:10px;text-align:center;background:' + innerBg + ';color:' + text + ';">' +
        '<div style="font-size:' + (exportMode ? "11px" : "10px") + ';color:' + sub + ';text-transform:uppercase;letter-spacing:.5px;">Jornada</div>' +
        '<div style="font-weight:800;margin-top:3px;">' + jornadaText + '</div>' +
      '</div>' +

      '<div style="border:1px solid ' + border + ';border-radius:10px;padding:10px;text-align:center;background:' + innerBg + ';color:' + text + ';">' +
        '<div style="font-size:' + (exportMode ? "11px" : "10px") + ';color:' + sub + ';text-transform:uppercase;letter-spacing:.5px;">Fechas</div>' +
        '<div style="font-weight:800;margin-top:3px;">' + dateText + '</div>' +
      '</div>' +

      '<div style="border:1px solid ' + border + ';border-radius:10px;padding:10px;text-align:center;background:' + innerBg + ';color:' + text + ';">' +
        '<div style="font-size:' + (exportMode ? "11px" : "10px") + ';color:' + sub + ';text-transform:uppercase;letter-spacing:.5px;">Costo</div>' +
        '<div style="font-weight:900;margin-top:3px;">$' + Number(priceText || 0) + '</div>' +
      '</div>' +
    '</div>' +

    '<div style="text-align:center;font-size:' + (exportMode ? "12px" : "10px") + ';color:' + sub + ';margin-top:10px;margin-bottom:8px;">Marca una sola opción por partido</div>' +

    '<div style="display:grid;grid-template-columns:' + (exportMode ? "70px 48px 1fr 70px 48px 1fr 70px" : "58px 34px 1fr 58px 34px 1fr 58px") + ';gap:' + (exportMode ? "10px" : "8px") + ';align-items:end;margin-top:6px;margin-bottom:8px;font-size:' + (exportMode ? "12px" : "10px") + ';font-weight:700;color:' + sub + ';text-transform:uppercase;letter-spacing:.4px;">' +
      '<div style="text-align:center;padding:5px 0;border-radius:8px;background:' + soft + ';">Local</div>' +
      '<div></div>' +
      '<div></div>' +
      '<div style="text-align:center;padding:5px 0;border-radius:8px;background:' + soft + ';">Empate</div>' +
      '<div></div>' +
      '<div></div>' +
      '<div style="text-align:center;padding:5px 0;border-radius:8px;background:' + soft + ';">Visita</div>' +
    '</div>' +

    '<div class="qh-table" style="margin-top:6px;display:grid;gap:' + (exportMode ? "10px" : "8px") + ';"></div>' +

    '<div style="margin-top:22px;font-size:' + (exportMode ? "13px" : "11px") + ';color:' + text + ';line-height:1.7;">' +
      '<div>Nombre:_______________________________________________</div>' +
      '<div>Área:______________________________</div>' +
      '<div>WhatsApp:____________________________________________</div>' +
      '<div style="font-size:' + (exportMode ? "11px" : "10px") + ';color:' + sub + ';margin-top:6px;">Registro único para recibir resultados, quinielas y premio acumulado.</div>' +
    '</div>';

  var table = card.querySelector(".qh-table");

  matches.forEach(function (m) {
    var row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = exportMode
      ? "70px 48px 1fr 70px 48px 1fr 70px"
      : "58px 34px 1fr 58px 34px 1fr 58px";
    row.style.alignItems = "center";
    row.style.gap = exportMode ? "10px" : "8px";

    var boxW = exportMode ? 70 : 58;
    var boxH = exportMode ? 32 : 28;
    var teamFont = exportMode ? "15px" : "12px";
    var logoSize = exportMode ? 30 : 22;

    var homeLogo = getTeamLogo(m.home_team);
    var awayLogo = getTeamLogo(m.away_team);

    row.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;">' +
        '<div style="width:' + boxW + 'px;height:' + boxH + 'px;border:1.5px solid ' + border + ';border-radius:7px;background:' + innerBg + ';"></div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;justify-content:center;padding-left:6px;padding-right:6px;">' +
        (homeLogo
          ? '<img src="' + homeLogo + '" style="width:' + logoSize + 'px;height:' + logoSize + 'px;object-fit:contain;" crossorigin="anonymous">'
          : '') +
      '</div>' +

      '<div style="text-align:left;font-weight:700;font-size:' + teamFont + ';color:' + text + ';padding-left:4px;">' +
        m.home_team +
      '</div>' +

      '<div style="display:flex;align-items:center;justify-content:center;">' +
        '<div style="width:' + boxW + 'px;height:' + boxH + 'px;border:1.5px solid ' + border + ';border-radius:7px;background:' + innerBg + ';"></div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;justify-content:center;padding-left:6px;padding-right:6px;">' +
        (awayLogo
          ? '<img src="' + awayLogo + '" style="width:' + logoSize + 'px;height:' + logoSize + 'px;object-fit:contain;" crossorigin="anonymous">'
          : '') +
      '</div>' +

      '<div style="text-align:left;font-weight:700;font-size:' + teamFont + ';color:' + text + ';padding-left:4px;">' +
        m.away_team +
      '</div>' +

      '<div style="display:flex;align-items:center;justify-content:center;">' +
        '<div style="width:' + boxW + 'px;height:' + boxH + 'px;border:1.5px solid ' + border + ';border-radius:7px;background:' + innerBg + ';"></div>' +
      '</div>';

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
  title: "Quiniela Herseg MX",
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
      title: "Quiniela Herseg MX",
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
  pdf.save("Plantillas-Quiniela-Herseg.pdf");
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
    title: "Quiniela Herseg MX",
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

  const story = document.createElement("div");
  story.style.width = "1080px";
  story.style.height = "1920px";
  story.style.background = "linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)";
  story.style.boxSizing = "border-box";
  story.style.padding = "70px 60px";
  story.style.display = "flex";
  story.style.flexDirection = "column";
  story.style.alignItems = "center";
  story.style.justifyContent = "flex-start";
  story.style.gap = "26px";
  story.style.fontFamily = "Arial, sans-serif";

  const topBadge = document.createElement("div");
  topBadge.style.display = "inline-flex";
  topBadge.style.alignItems = "center";
  topBadge.style.gap = "10px";
  topBadge.style.padding = "12px 22px";
  topBadge.style.borderRadius = "999px";
  topBadge.style.background = "#111111";
  topBadge.style.color = "#ffffff";
  topBadge.style.fontSize = "22px";
  topBadge.style.fontWeight = "700";
  topBadge.innerHTML = "⚽ Quiniela Herseg MX";

  const header = document.createElement("div");
  header.style.textAlign = "center";
  header.innerHTML =
    '<div style="font-size:52px;font-weight:900;color:#111111;line-height:1.05;">Participa en la Jornada</div>' +
    '<div style="font-size:28px;color:#444444;margin-top:12px;">Llena tu boleta y envíala por WhatsApp</div>';

  const chips = document.createElement("div");
  chips.style.display = "flex";
  chips.style.gap = "14px";
  chips.style.flexWrap = "wrap";
  chips.style.justifyContent = "center";
  chips.innerHTML =
    '<div style="padding:12px 18px;border-radius:999px;background:#ffffff;border:1px solid #d4d4d8;font-size:22px;font-weight:800;color:#111111;">' +
      (pool?.round ? 'Jornada ' + pool.round : (pool?.name || 'Jornada')) +
    '</div>' +
    '<div style="padding:12px 18px;border-radius:999px;background:#ffffff;border:1px solid #d4d4d8;font-size:22px;font-weight:800;color:#111111;">' +
      (pool?.date_label || 'FECHAS') +
    '</div>' +
    '<div style="padding:12px 18px;border-radius:999px;background:#111111;border:1px solid #111111;font-size:22px;font-weight:900;color:#ffffff;">$' +
      Number(pool?.price || 20) +
    '</div>';

  const card = makeTemplateCard({
    title: "Quiniela Herseg MX",
    subtitle: `"Pasión X Ganar" ⚽ ${pool?.season || ""}`.trim(),
    jornadaText: pool?.round ? `Jornada ${pool.round}` : (pool?.name || "Jornada"),
    dateText: (pool?.date_label || "FECHAS"),
    priceText: Number(pool?.price || 20),
    matches,
    exportMode: true
  });

  card.style.width = "930px";
  card.style.padding = "24px";
  card.style.borderRadius = "24px";
  card.style.boxShadow = "0 18px 60px rgba(0,0,0,.10)";

  const footer = document.createElement("div");
  footer.style.textAlign = "center";
  footer.style.fontSize = "24px";
  footer.style.color = "#222222";
  footer.style.marginTop = "8px";
  footer.style.lineHeight = "1.5";
  footer.innerHTML =
    '<div style="font-weight:800;">Marca Local, Empate o Visita</div>' +
    '<div style="margin-top:6px;">Envía tu pronóstico antes del cierre 📲</div>';

  story.appendChild(topBadge);
  story.appendChild(header);
  story.appendChild(chips);
  story.appendChild(card);
  story.appendChild(footer);

  printArea.appendChild(story);

  try {
    const canvas = await html2canvas(story, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });

    const a = document.createElement("a");
    const safeName = (pool?.name || "Plantilla-Historia")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    a.download = `${safeName}-story-premium-9x16.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();

    showAlert("Historia premium 9:16 generada ✅", "ok");
  } catch (err) {
    showAlert("Error generando historia: " + (err?.message || err), "error");
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
      title: "Quiniela Herseg MX",
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
    const tag = p.status === "open" ? " (Activa)" : "";
    return `<option value="${p.id}">${p.name}${tag}</option>`;
  }).join("");
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

      <div class="grid grid-cols-[1fr_70px_40px_70px_1fr] gap-2 items-center">
        <div class="text-sm font-semibold text-right">${match.home_team}</div>

        <input
          type="number"
          min="0"
          inputmode="numeric"
          data-result-home="${match.id}"
          value="${hg}"
          class="p-2 bg-zinc-900 border border-zinc-700 rounded-xl text-center font-bold" />

        <div class="text-center text-zinc-400 font-bold">vs</div>

        <input
          type="number"
          min="0"
          inputmode="numeric"
          data-result-away="${match.id}"
          value="${ag}"
          class="p-2 bg-zinc-900 border border-zinc-700 rounded-xl text-center font-bold" />

        <div class="text-sm font-semibold text-left">${match.away_team}</div>
      </div>

      <div class="mt-3 flex items-center justify-between text-xs">
        <div class="text-zinc-400">
          Resultado: <span data-result-outcome="${match.id}" class="font-semibold text-zinc-200">${outcome}</span>
        </div>
        <div class="text-zinc-400">
          Total goles: <span data-result-total="${match.id}" class="font-semibold text-zinc-200">${totalGoals}</span>
        </div>
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

// Cargar Tabla Aciertos
async function loadStandings() {
  hideAlert();

  const pool_id = $("standingsPool").value;
  if (!pool_id) {
    $("standingsList").innerHTML = "";
    $("standingsGoalsTotal").textContent = "0";
    return showAlert("Selecciona una jornada.", "error");
  }

  // puntos por boleto
  const { data: pointsRows, error: pointsErr } = await supabaseClient
    .from("entry_points")
    .select("entry_id, pool_id, participant_id, points, played_matches, captured_picks")
    .eq("pool_id", pool_id);

  if (pointsErr) return showAlert(pointsErr.message, "error");

  // participantes
  const { data: participants, error: partErr } = await supabaseClient
    .from("participants")
    .select("id, name, area");

  if (partErr) return showAlert(partErr.message, "error");

  const partMap = new Map(
    (participants || []).map(function(p) {
      return [p.id, p];
    })
  );

  // total de goles jornada
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
      participant_id: r.participant_id,
      name: p.name || "Sin nombre",
      area: p.area || "",
      points: r.points || 0,
      played_matches: r.played_matches || 0,
      captured_picks: r.captured_picks || 0
    };
  });

  rows.sort(function(a, b) {
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name);
  });

  $("standingsList").innerHTML = rows.length
    ? rows.map(function(r, index) {
        const pos = index + 1;
        const area = r.area ? " • " + r.area : "";

        return `
          <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-semibold truncate">${pos}. ${r.name}</div>
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
        No hay boletos o pronósticos para esta jornada todavía.
      </div>
    `;
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

  await loadParticipants();
  await fillEntryParticipantsSelect();
  await fillPickParticipantsSelect();
  await loadDashboardSummary();
});

// Ver archivados / activos
$("btnToggleArchived").addEventListener("click", async () => {
  showArchivedParticipants = !showArchivedParticipants;
  $("btnToggleArchived").textContent = showArchivedParticipants
    ? "👁️ Ver activos"
    : "👁️ Ver archivados";

  await loadParticipants();
});

// Jornadas / Pools: insertar
$("formPool").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const mode_code = $("poolMode").value;
  const carryover_enabled = (mode_code === "ACUMULADA" || mode_code === "GOLEO");

  const round = Number($("poolRound").value);
  const competition = $("poolCompetition").value.trim() || "Liga MX";
  const season = $("poolSeason").value.trim() || "Clausura 2026";
  const date_label = $("poolDates").value.trim() || null;
  const price = Number($("poolPrice").value || 20);
  const commission_pct = Number($("poolCommission").value || 15);

  const name = `Jornada ${round} - ${competition} - ${season}`;

  const { error } = await supabaseClient
    .from("pools")
    .insert({
      round,
      competition,
      season,
      name,
      price,
      commission_pct,
      status: "open",
      date_label,
      mode_code,
      carryover_enabled
    });

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada creada ✅", "ok");

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
});

// Pagos / Boletos
$("btnAddEntry").addEventListener("click", addEntry);
$("btnRefreshStats").addEventListener("click", loadEntriesAndStats);
$("entryPool").addEventListener("change", loadEntriesAndStats);

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
$("btnExportPDF").addEventListener("click", exportAllToPDF);
$("btnExportCurrentPNG").addEventListener("click", exportCurrentTemplatePNG);
$("btnExportStoryPNG").addEventListener("click", exportStoryTemplatePNG);

// Captura Pronósticos 1X2
$("btnLoadEntryForPick").addEventListener("click", async () => {
  const poolId = $("pickPool").value;
  const partId = $("pickParticipant").value;
  await loadEntryForPick(poolId, partId);
});

$("btnSavePicks").addEventListener("click", savePicks);
$("btnClearPicks").addEventListener("click", clearPicksSelection);

$("btnRefreshPickStatus").addEventListener("click", loadPickStatusList);

$("pickPool").addEventListener("change", async () => {
  await fillPickParticipantsSelect();
  await loadPickStatusList();
  $("pickMatches").innerHTML = "";
  $("pickEntryLabel").textContent = "—";
});

$("pickParticipant").addEventListener("change", () => {
  $("pickMatches").innerHTML = "";
  $("pickEntryLabel").textContent = "—";
});

// Resultados
$("btnLoadResultsMatches").addEventListener("click", loadResultsMatches);
$("btnSaveResults").addEventListener("click", saveResultsMatches);

// Aciertos
$("btnLoadStandings").addEventListener("click", loadStandings);

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

  setView("viewDash");

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
  await showAppTab("tab-dashboard");
}

// Arranque
setView("viewLogin");
safeInit();

// Errores globales visibles
window.addEventListener("error", (e) => showAlert("JS error: " + e.message, "error"));
window.addEventListener("unhandledrejection", (e) => showAlert("Promise error: " + (e.reason?.message || e.reason), "error"));

// Errores init
document.addEventListener("DOMContentLoaded", () => {
  try {
    init();
  } catch (e) {
    showFatal(e.message || String(e));
  }
});