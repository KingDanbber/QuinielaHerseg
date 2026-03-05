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

async function addEntry() {
  hideAlert();

  const pool_id = $("entryPool").value;
  const participant_id = $("entryParticipant").value;
  const paid = $("entryPaid").checked;

  if (!pool_id || !participant_id) return showAlert("Falta seleccionar pool/participante.", "error");

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

  if (!pool_id) return showAlert("Selecciona una jornada.", "error");

  // borrar plantilla anterior y volver a insertar (simple y confiable)
  const { error: delErr } = await supabaseClient.from("matches").delete().eq("pool_id", pool_id);
  if (delErr) return showAlert(delErr.message, "error");

  const rows = [];
  for (let i = 1; i <= n; i++) {
    const home = document.querySelector(`[data-home="${i}"]`)?.value?.trim();
    const away = document.querySelector(`[data-away="${i}"]`)?.value?.trim();
    if (!home || !away) return showAlert(`Falta Local/Visita en partido #${i}`, "error");
    rows.push({ pool_id, match_no: i, home_team: home.toUpperCase(), away_team: away.toUpperCase() });
  }

  const { error } = await supabaseClient.from("matches").insert(rows);
  if (error) return showAlert(error.message, "error");

  showAlert("Plantilla guardada ✅", "ok");
  await renderPreview();
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

async function renderPreview() {
  const pool_id = $("tplPool").value;
  if (!pool_id) return;

  const wrap = $("tplPreviewWrap");
  wrap.innerHTML = "";

  let pool, matches;
  try {
    pool = await getPoolInfo(pool_id);
    matches = await getMatches(pool_id);
  } catch (e) {
    return showAlert(e.message, "error");
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

//Ver archivados
$("btnToggleArchived").addEventListener("click", async () => {
  showArchivedParticipants = !showArchivedParticipants;
  $("btnToggleArchived").textContent = showArchivedParticipants ? "👁️ Ver activos" : "👁️ Ver archivados";
  await loadParticipants();
});

// Jornadas: insertar
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

  const { error } = await supabaseClient.from("pools").insert({
    round, competition, season, name, price, commission_pct, status: "open", date_label
  });

  if (error) return showAlert(error.message, "error");

  showAlert("Jornada creada ✅", "ok");
  $("poolRound").value = "";
  loadPools();
});

//Registrar Boletos Pagos
$("btnAddEntry").addEventListener("click", addEntry);
$("btnRefreshStats").addEventListener("click", loadEntriesAndStats);

$("entryPool").addEventListener("change", loadEntriesAndStats);

// Plantillas
$("btnBuildRows").addEventListener("click", () => buildTplRowsUI(Number($("tplNumMatches").value || 9)));
$("btnSaveTemplate").addEventListener("click", saveTemplateMatches);
$("tplPool").addEventListener("change", renderPreview);

$("btnExportPDF").addEventListener("click", exportAllToPDF);
$("btnExportPNGs").addEventListener("click", exportAllToPNGs);

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

  // ✅ YA TODO OK -> MOSTRAR DASH
  setView("viewDash");

  // Saludo
  const now = new Date();
  const saludo = getGreetingByHour(getMonterreyHour(now));
  const fecha = formatMxHeader(now);
  $("greetingMain").textContent = `👋 ${saludo}, ${profile.display_name}`;
  $("greetingDate").textContent = fecha;

  // Cargar listas base
  await loadParticipants();
  await loadPools();

  // Selects de pagos
  await fillEntryPoolsSelect();
  await fillEntryParticipantsSelect();
  await loadEntriesAndStats();

  // Selects + preview de plantillas
  await fillTplPools();
  buildTplRowsUI(Number($("tplNumMatches").value || 9));
  await renderPreview();
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