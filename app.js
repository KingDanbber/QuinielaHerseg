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
      await loadTemplateIntoEditor();
      await renderPreview();
    }

    if (tabId === "tab-payments") {
      await fillEntryPoolsSelect();
      await fillEntryParticipantsSelect();
      await loadEntriesAndStats();
    }

    if (tabId === "tab-picks") {
      await fillPickPoolsSelect();
      await fillPickParticipantsSelect();
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
    .limit(30);

  if (error) return showAlert(error.message, "error");

  const sel = $("pickPool");
  sel.innerHTML = (data || []).map(p => {
    const tag = p.status === "open" ? " (Activa)" : "";
    return `<option value="${p.id}">${p.name}${tag}</option>`;
  }).join("");

  const active = (data || []).find(p => p.status === "open");
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
  sel.innerHTML = (data || []).map(p => {
    const area = p.area ? ` • ${p.area}` : "";
    return `<option value="${p.id}">${p.name}${area}</option>`;
  }).join("");
}

function renderPickRow(match, selectedPick = null) {
  return `
    <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="text-xs text-zinc-400">Partido #${match.match_no}</div>
        <div class="text-sm font-semibold text-center flex-1">
          ${match.home_team} vs ${match.away_team}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button type="button"
          data-match-id="${match.id}"
          data-pick="H"
          class="pick-btn px-3 py-3 rounded-lg border ${selectedPick === "H" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900 border-zinc-700"}">
          L
        </button>

        <button type="button"
          data-match-id="${match.id}"
          data-pick="D"
          class="pick-btn px-3 py-3 rounded-lg border ${selectedPick === "D" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900 border-zinc-700"}">
          E
        </button>

        <button type="button"
          data-match-id="${match.id}"
          data-pick="A"
          class="pick-btn px-3 py-3 rounded-lg border ${selectedPick === "A" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900 border-zinc-700"}">
          V
        </button>
      </div>
    </div>
  `;
}

async function loadEntryForPick() {
  hideAlert();

  const pool_id = $("pickPool").value;
  const participant_id = $("pickParticipant").value;

  if (!pool_id || !participant_id) {
    return showAlert("Selecciona jornada y participante.", "error");
  }

  // Buscar boleto del participante en esa jornada
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

  // Cargar partidos de la plantilla
  const { data: matches, error: matchError } = await supabaseClient
    .from("matches")
    .select("id, match_no, home_team, away_team")
    .eq("pool_id", pool_id)
    .order("match_no", { ascending: true });

  if (matchError) return showAlert(matchError.message, "error");

  // Cargar picks ya guardados
  const { data: existingPicks, error: picksError } = await supabaseClient
    .from("predictions_1x2")
    .select("match_id, pick")
    .eq("entry_id", entry.id);

  if (picksError) return showAlert(picksError.message, "error");

  const picksMap = new Map((existingPicks || []).map(p => [p.match_id, p.pick]));

  $("pickMatches").innerHTML = (matches || [])
    .map(match => renderPickRow(match, picksMap.get(match.id) || null))
    .join("");

  attachPickButtonsEvents();
}

function attachPickButtonsEvents() {
  document.querySelectorAll(".pick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const matchId = btn.getAttribute("data-match-id");
      const pick = btn.getAttribute("data-pick");

      // Limpiar solo los del mismo partido
      document.querySelectorAll(`.pick-btn[data-match-id="${matchId}"]`).forEach(b => {
        b.classList.remove("bg-emerald-600", "border-emerald-500", "text-white");
        b.classList.add("bg-zinc-900", "border-zinc-700");
      });

      btn.classList.remove("bg-zinc-900", "border-zinc-700");
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
  document.querySelectorAll(".pick-btn[data-selected='1'], .pick-btn.bg-emerald-600").forEach(btn => {
    const matchId = btn.getAttribute("data-match-id");
    const pick = btn.getAttribute("data-pick");
    selected[matchId] = pick;
  });

  const rows = Object.entries(selected).map(([match_id, pick]) => ({
    entry_id: currentPickEntryId,
    match_id,
    pick
  }));

  if (rows.length === 0) {
    return showAlert("No seleccionaste pronósticos.", "error");
  }

  const { error } = await supabaseClient
    .from("predictions_1x2")
    .upsert(rows, { onConflict: "entry_id,match_id" });

  if (error) return showAlert(error.message, "error");

  showAlert("Pronósticos guardados ✅", "ok");
}

function clearPicksSelection() {
  document.querySelectorAll(".pick-btn").forEach(btn => {
    btn.classList.remove("bg-emerald-600", "border-emerald-500", "text-white");
    btn.classList.add("bg-zinc-900", "border-zinc-700");
    btn.dataset.selected = "";
  });
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
      match_no: i,
      home_team: home,
      away_team: away
    });
  }

  $("tplSavedStatus").textContent = `Guardando plantilla (${rows.length} partidos)...`;
  showAlert(`Guardando plantilla (${rows.length} partidos)...`, "ok");

  try {
    const rpcPromise = supabaseClient.rpc("save_template_matches", {
      p_pool_id: pool_id,
      p_matches: JSON.stringify(rows)
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout RPC: tardó demasiado.")), 10000)
    );

    const result = await Promise.race([rpcPromise, timeoutPromise]);
    const { data, error } = result;

    if (error) {
      $("tplSavedStatus").textContent = "Error guardando plantilla.";
      return showAlert("Error guardando plantilla: " + error.message, "error");
    }

    const savedCount = data?.saved_count || rows.length;

    // ✅ NO recargar editor ni preview todavía
    $("tplSavedStatus").textContent = `Plantilla guardada: ${savedCount} partidos ✅`;
    showAlert(`Plantilla guardada ✅ (${savedCount} partidos)`, "ok");

  } catch (err) {
    $("tplSavedStatus").textContent = "Error o timeout al guardar.";
    showAlert("Error/timeout: " + (err?.message || err), "error");
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

function makeTemplateCard({title, subtitle, jornadaText, dateText, priceText, matches}) {
  const card = document.createElement("div");
  card.className = "qh-card";

  card.innerHTML = `
    <div class="qh-title">${title}</div>
    <div class="qh-sub">${subtitle}</div>

    <div class="qh-meta">
      <div>${jornadaText}</div>
      <div>${dateText}</div>
      <div>${priceText}</div>
    </div>

    <div class="qh-table"></div>

    <div class="qh-foot">
      <div class="line">Nombre:______________________________________</div>
      <div class="line">Área:________________________</div>
      <div class="line">*WhatsApp:___________________________________</div>
      <div class="line">*Registro 1vez para envío link Aplicación Resultados, Quinielas y Premio Acumulado</div>
    </div>
  `;

  const table = card.querySelector(".qh-table");
  matches.forEach(m => {
    const r = document.createElement("div");
    r.className = "qh-match";
    r.innerHTML = `
      <div class="qh-box"></div>
      <div class="qh-team">${m.home_team}</div>
      <div class="qh-box"></div>
      <div class="qh-team">${m.away_team}</div>
      <div class="qh-box"></div>
    `;
    table.appendChild(r);
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
    matches
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
      matches: ms
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

    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#0b0f14" });
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

  const card = makeTemplateCard({
    title: "Quiniela Herseg MX",
    subtitle: `"Pasión X Ganar" ⚽ ${pool?.season || ""}`.trim(),
    jornadaText: pool?.round ? `Jornada ${pool.round}` : (pool?.name || "Jornada"),
    dateText: (pool?.date_label || "FECHAS"),
    priceText: Number(pool?.price || 20),
    matches
  });

  printArea.appendChild(card);

  const canvas = await html2canvas(card, {
    scale: 2,
    backgroundColor: "#0b0f14"
  });

  const a = document.createElement("a");
  const safeName = (pool?.name || "Plantilla").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  a.download = `${safeName}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();

  printArea.innerHTML = "";
  printArea.classList.add("hidden");

  showAlert("Imagen generada ✅", "ok");
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
      matches: ms
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

async function loadEntryForPick(poolId, participantId) {
  // 1) buscar el entry (boleto) más reciente de ese participante en ese pool
  const { data: entry, error: eErr } = await supabaseClient
    .from("entries")
    .select("id, paid, created_at")
    .eq("pool_id", poolId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eErr) return showAlert(eErr.message, "error");
  if (!entry) {
    currentPickEntryId = null;
    $("pickEntryLabel").textContent = "No hay boleto";
    $("pickMatches").innerHTML = "";
    return showAlert("Ese participante no tiene boleto registrado en esta jornada.", "error");
  }

  currentPickEntryId = entry.id;
  currentPickPoolId = poolId;
  currentPickParticipantId = participantId;
  $("pickEntryLabel").textContent = entry.paid ? "Pagado ✅" : "No pagado";

  // 2) cargar matches de la plantilla
  const { data: matches, error: mErr } = await supabaseClient
    .from("matches")
    .select("id, match_no, home_team, away_team")
    .eq("pool_id", poolId)
    .order("match_no", { ascending: true });

  if (mErr) return showAlert(mErr.message, "error");

  // 3) cargar picks existentes
  const { data: picks, error: pErr } = await supabaseClient
    .from("predictions_1x2")
    .select("match_id, pick")
    .eq("entry_id", entry.id);

  if (pErr) return showAlert(pErr.message, "error");

  const pickMap = new Map((picks || []).map(x => [x.match_id, x.pick]));

  // 4) render UI
  $("pickMatches").innerHTML = (matches || []).map(m =>
    renderPickRow({
      match_no: m.match_no,
      home_team: m.home_team,
      away_team: m.away_team,
      match_id: m.id,
      selected: pickMap.get(m.id) || null
    })
  ).join("");

  // 5) listeners botones
  wirePickButtons();
}

function wirePickButtons() {
  document.querySelectorAll("[data-pickbtn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const mid = btn.getAttribute("data-mid");
      const pick = btn.getAttribute("data-pickbtn");

      // apaga los 3 del mismo partido
      document.querySelectorAll(`[data-mid="${mid}"]`).forEach(b => b.classList.remove("pickbtn-on"));
      // enciende seleccionado
      btn.classList.add("pickbtn-on");
      btn.setAttribute("data-selected", "1");
    });
  });
}

async function savePicks() {
  if (!currentPickEntryId) return showAlert("Primero carga un boleto.", "error");

  // construir lista de picks desde UI
  const rows = [];
  const groups = new Map(); // match_id => pick

  document.querySelectorAll("[data-pickbtn].pickbtn-on").forEach(btn => {
    const mid = btn.getAttribute("data-mid");
    const pick = btn.getAttribute("data-pickbtn");
    groups.set(mid, pick);
  });

  if (groups.size === 0) return showAlert("No seleccionaste ningún pronóstico.", "error");

  groups.forEach((pick, match_id) => {
    rows.push({
      entry_id: currentPickEntryId,
      match_id,
      pick
    });
  });

  // Upsert: requiere UNIQUE(entry_id, match_id) en predictions_1x2
  const { error } = await supabaseClient
    .from("predictions_1x2")
    .upsert(rows, { onConflict: "entry_id,match_id" });

  if (error) return showAlert(error.message, "error");

  showAlert("Pronósticos guardados ✅", "ok");
}

function clearPicksUI() {
  document.querySelectorAll("[data-pickbtn]").forEach(b => b.classList.remove("pickbtn-on"));
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
  await loadTemplateIntoEditor();
  await renderPreview();
});

$("btnClearTemplateEditor").addEventListener("click", clearTemplateEditor);

// Exportación
$("btnExportPDF").addEventListener("click", exportAllToPDF);
$("btnExportCurrentPNG").addEventListener("click", exportCurrentTemplatePNG);

// Test insert directo


// Captura Pronósticos 1X2
$("btnLoadEntryForPick").addEventListener("click", async () => {
  const poolId = $("pickPool").value;
  const partId = $("pickParticipant").value;
  await loadEntryForPick(poolId, partId);
});

$("btnSavePicks").addEventListener("click", savePicks);
$("btnClearPicks").addEventListener("click", clearPicksSelection);

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