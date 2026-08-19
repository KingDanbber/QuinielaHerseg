window.addEventListener("error", (e) => {
    const msg = (e && e.message) ? e.message: "Error JS";
    showFatal(msg);
});

window.addEventListener("unhandledrejection", (e) => {
    const msg = (e && e.reason && e.reason.message) ? e.reason.message: ("" + (e.reason || "Promise error"));
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
            var currentId = sess.data.session.user ? sess.data.session.user.id: null;
            lastAuthUserId = currentId; // sincronizar para que onAuthStateChange no lo trate como nuevo login
            await supabaseClient.auth.refreshSession();
        }
    } catch(e) {
        console.warn("session refresh error", e);
    }
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


// ═══════════════════════════════════════════════
// CACHÉ LOCAL — evita re-queries innecesarios
// ═══════════════════════════════════════════════
var _cache = {};
var _cacheLoaded = {}; // qué tabs ya cargaron datos

function cacheSet(key, data, ttlSeconds) {
    _cache[key] = {
        data: data, expires: Date.now() + (ttlSeconds || 30) * 1000
    };
}
function cacheGet(key) {
    var entry = _cache[key];
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        delete _cache[key]; return null;
    }
    return entry.data;
}
function cacheInvalidate(key) {
    // Supports prefix matching e.g. "participants" clears "participants_*"
    Object.keys(_cache).forEach(function(k) {
        if (k === key || k.startsWith(key)) delete _cache[k];
    });
}
function markTabLoaded(tabId) {
    _cacheLoaded[tabId] = true;
}
function isTabLoaded(tabId) {
    return !!_cacheLoaded[tabId];
}
function resetTabLoaded(tabId) {
    delete _cacheLoaded[tabId];
}
function resetAllTabs() {
    _cacheLoaded = {};
}

// ── Control de inicialización ──
let appInitialized = false; // true después del primer init completo
let lastAuthUserId = null; // para detectar cambios reales de usuario

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
    "SAN LUIS": "./assets/logos/san-luis.png", "ATLANTE": "./assets/logos/atlante.png"
};

function normalizeTeamName(name) {
    return String(name || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g,
        " ");
}

const WORLD_TEAM_LOGOS = {
    "ALEMANIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/alemania.png",
    "ALGERIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/argelia.png",
    "ARABIA SAUDI": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/arabia-saudita.png",
    "ARABIA SAUDITA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/arabia-saudita.png",
    "ARGELIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/argelia.png",
    "ARGENTINA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/argentina.png",
    "AUSTRALIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/australia.png",
    "AUSTRIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/austria.png",
    "BELGICA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/belgica.png",
    "BELGIUM": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/belgica.png",
    "BOSNIA HERZEGOVINA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/bosniaherzegovina.png",
    "BOSNIA Y HERZEGOVINA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/bosniaherzegovina.png",
    "BRASIL": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/brasil.png",
    "BRAZIL": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/brasil.png",
    "BÉLGICA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/belgica.png",
    "CABO VERDE": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/cabo-verde.png",
    "CANADA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/canada.png",
    "CANADÁ": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/canada.png",
    "COLOMBIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/colombia.png",
    "CONGO": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/congo.png",
    "COREA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/corea-del-sur.png",
    "COREA DEL SUR": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/corea-del-sur.png",
    "COSTA DE MARFIL": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/costa-de-marfil.png",
    "CROACIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/croacia.png",
    "CROATIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/croacia.png",
    "CURAZAO": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/curazao.png",
    "CZECH REPUBLIC": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/republica-checa.png",
    "ECUADOR": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/ecuador.png",
    "EGIPTO": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/egipto.png",
    "EGYPT": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/egipto.png",
    "ENGLAND": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/inglaterra.png",
    "ESCOCIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/escocia.jpg",
    "ESPANA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/espana.png",
    "ESPAÑA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/espana.png",
    "ESTADOS UNIDOS": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/usa.png",
    "FRANCE": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/francia.png",
    "FRANCIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/francia.png",
    "GERMANY": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/alemania.png",
    "GHANA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/ghana.png",
    "HAITI": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/haiti.png",
    "HAITÍ": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/haiti.png",
    "HOLANDA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/holanda.png",
    "INGLATERRA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/inglaterra.png",
    "IRAK": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/irak.png",
    "IRAN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/iran.png",
    "IRAQ": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/irak.png",
    "IRÁN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/iran.png",
    "IVORY COAST": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/costa-de-marfil.png",
    "JAPAN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/japon.png",
    "JAPON": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/japon.png",
    "JAPÓN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/japon.png",
    "JORDAN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/jordania.png",
    "JORDANIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/jordania.png",
    "MARRUECOS": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/marruecos.png",
    "MEXICO": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/mexico.png",
    "MOROCCO": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/marruecos.png",
    "MÉXICO": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/mexico.png",
    "NETHERLANDS": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/holanda.png",
    "NEW ZEALAND": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/nueva-zelanda.png",
    "NORUEGA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/noruega.png",
    "NORWAY": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/noruega.png",
    "NUEVA ZELANDA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/nueva-zelanda.png",
    "PAISES BAJOS": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/holanda.png",
    "PANAMA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/panama.png",
    "PANAMÁ": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/panama.png",
    "PARAGUAY": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/paraguay.png",
    "PAÍSES BAJOS": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/holanda.png",
    "PORTUGAL": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/portugal.png",
    "QATAR": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/qatar.png",
    "REPUBLICA CHECA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/republica-checa.png",
    "REPÚBLICA CHECA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/republica-checa.png",
    "SCOTLAND": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/escocia.jpg",
    "SENEGAL": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/senegal.png",
    "SOUTH AFRICA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/sudafrica.png",
    "SOUTH KOREA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/corea-del-sur.png",
    "SPAIN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/espana.png",
    "SUDAFRICA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/sudafrica.png",
    "SUDÁFRICA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/sudafrica.png",
    "SUECIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/suecia.png",
    "SUIZA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/suiza.png",
    "SWEDEN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/suecia.png",
    "SWITZERLAND": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/suiza.png",
    "TUNEZ": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/tunez.png",
    "TUNISIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/tunez.png",
    "TURKEY": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/turquia.png",
    "TURQUIA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/turquia.png",
    "TURQUÍA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/turquia.png",
    "TÚNEZ": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/tunez.png",
    "UNITED STATES": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/usa.png",
    "URUGUAY": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/uruguay.png",
    "USA": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/usa.png",
    "UZBEKISTAN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/uzbekistan.png",
    "UZBEKISTÁN": "https://raw.githubusercontent.com/KingDanbber/QuinielaHerseg/main/assets/mundial2026/uzbekistan.png"
};

function getTeamLogo(teamName) {
    var key = normalizeTeamName(teamName);
    return TEAM_LOGOS[key] || WORLD_TEAM_LOGOS[key] || "";
}

// =====================
// UI Helpers
// =====================

function showAlert(msg, type = "info") {
    const el = $("alert");
    el.classList.remove("hidden");
    el.textContent = msg;

    el.className = "mb-4 p-3 rounded border text-sm";
    if (type === "error") el.classList.add("bg-red-950/40", "border-red-800", "text-red-100");
    else if (type === "ok") el.classList.add("bg-emerald-950/40", "border-emerald-800", "text-emerald-100");
    else el.classList.add("bg-zinc-900", "border-zinc-700", "text-zinc-100");
}

function hideAlert() {
    $("alert").classList.add("hidden");
    $("alert").textContent = "";
}

function setView(v) {
    ["viewLogin",
        "viewProfile",
        "viewDenied",
        "viewDash"].forEach(id => $(id).classList.add("hidden"));
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

function escapeHTML(value) {
    return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


const _externalScriptPromises = new Map();

function loadExternalScriptOnce(src, isReady) {
    if (typeof isReady === "function" && isReady()) {
        return Promise.resolve();
    }

    if (_externalScriptPromises.has(src)) {
        return _externalScriptPromises.get(src);
    }

    const promise = new Promise(function(resolve, reject) {
        const existing = document.querySelector(`script[data-lazy-src="${src}"]`);

        if (existing) {
            existing.addEventListener("load", resolve, {
                once: true
            });
            existing.addEventListener("error", function() {
                reject(new Error("No se pudo cargar: " + src));
            }, {
                once: true
            });
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.lazySrc = src;
        script.onload = resolve;
        script.onerror = function() {
            _externalScriptPromises.delete(src);
            reject(new Error("No se pudo cargar: " + src));
        };
        document.head.appendChild(script);
    });

    _externalScriptPromises.set(src,
        promise);
    return promise;
}

async function ensureExportLibraries(options = {}) {
    const needsPdf = options.pdf === true;
    const tasks = [];

    if (typeof window.html2canvas !== "function") {
        tasks.push(loadExternalScriptOnce(
            "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
            function() {
                return typeof window.html2canvas === "function";
            }
        ));
    }

    if (needsPdf && !(window.jspdf && window.jspdf.jsPDF)) {
        tasks.push(loadExternalScriptOnce(
            "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
            function() {
                return !!(window.jspdf && window.jspdf.jsPDF);
            }
        ));
    }

    if (tasks.length) {
        showAlert("Preparando herramientas de exportación…", "info");
        await Promise.all(tasks);
        hideAlert();
    }
}

/** Sanitiza todos los <canvas> del documento: evita createPattern con tamaño 0. */
function sanitizeZeroSizeCanvases(root) {
    var scope = root || document;
    var list = scope.querySelectorAll ? scope.querySelectorAll("canvas") : [];
    Array.prototype.forEach.call(list, function(c) {
        var w = Number(c.width) || 0;
        var h = Number(c.height) || 0;
        if (w < 2 || h < 2) {
            try {
                c.width = Math.max(2, w);
                c.height = Math.max(2, h);
            } catch (e) { /* ignore */ }
            if ((Number(c.width) || 0) < 2 || (Number(c.height) || 0) < 2) {
                c.setAttribute("data-export-skip", "1");
                if (c.style) c.style.display = "none";
            }
        }
    });
}

/** Monta el nodo en un contenedor aislado fuera de pantalla (layout real). */
function mountForExport(node) {
    var printArea = $("printArea");
    if (!printArea) throw new Error("No existe #printArea");
    printArea.classList.remove("hidden");
    printArea.innerHTML = "";
    printArea.style.cssText = [
        "position:fixed",
        "left:-10000px",
        "top:0",
        "opacity:1",
        "visibility:visible",
        "pointer-events:none",
        "z-index:-1",
        "width:auto",
        "height:auto",
        "max-width:none",
        "overflow:visible",
        "background:transparent",
        "display:block"
    ].join(";");
    printArea.appendChild(node);
    void printArea.offsetWidth;
    void node.offsetWidth;
    return printArea;
}

function unmountExport() {
    var printArea = $("printArea");
    if (!printArea) return;
    printArea.innerHTML = "";
    printArea.style.cssText = "";
    printArea.classList.add("hidden");
}

async function waitForExportImages(root) {
    var imgs = Array.from((root && root.querySelectorAll) ? root.querySelectorAll("img") : []);
    await Promise.all(imgs.map(function(img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(function(resolve) {
            var done = function() { resolve(); };
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 2500);
        });
    }));
    await new Promise(function(r) {
        requestAnimationFrame(function() {
            requestAnimationFrame(r);
        });
    });
}

async function captureElementPng(el, html2canvasOpts) {
    if (!el) throw new Error("Nada que exportar");
    await ensureExportLibraries();

    // 1) Arreglar canvas 0x0 en el DOM vivo (causa clásica de createPattern)
    sanitizeZeroSizeCanvases(document);

    await waitForExportImages(el);

    var w = el.offsetWidth || el.scrollWidth || 0;
    var h = el.offsetHeight || el.scrollHeight || 0;
    if (w < 8 || h < 8) {
        if (el.style) {
            el.style.width = el.style.width || "900px";
            el.style.minWidth = "320px";
            el.style.display = "block";
        }
        void el.offsetWidth;
        w = el.offsetWidth || el.scrollWidth || 0;
        h = el.offsetHeight || el.scrollHeight || 0;
    }
    if (w < 8 || h < 8) {
        throw new Error("El cartel no tiene tamaño aún. Intenta de nuevo.");
    }

    var userOpts = html2canvasOpts || {};
    var userIgnore = userOpts.ignoreElements;
    var userOnclone = userOpts.onclone;

    var opts = Object.assign({
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#050810",
        foreignObjectRendering: false,
        windowWidth: Math.ceil(w) + 40,
        windowHeight: Math.ceil(h) + 40
    }, userOpts);

    opts.ignoreElements = function(node) {
        if (!node) return false;
        if (node.getAttribute && node.getAttribute("data-export-skip") === "1") return true;
        if (node.tagName === "CANVAS") {
            var cw = Number(node.width) || 0;
            var ch = Number(node.height) || 0;
            if (cw < 2 || ch < 2) return true;
            if (node.id === "accuracyCanvas") return true;
        }
        if (typeof userIgnore === "function" && userIgnore(node)) return true;
        return false;
    };

    opts.onclone = function(clonedDoc, clonedEl) {
        try {
            var canvases = clonedDoc.querySelectorAll("canvas");
            Array.prototype.forEach.call(canvases, function(c) {
                var cw = Number(c.width) || 0;
                var ch = Number(c.height) || 0;
                if (cw < 2 || ch < 2 || c.id === "accuracyCanvas" ||
                    (c.getAttribute && c.getAttribute("data-export-skip") === "1")) {
                    if (c.parentNode) c.parentNode.removeChild(c);
                }
            });
            var imgs = clonedDoc.querySelectorAll("img");
            Array.prototype.forEach.call(imgs, function(img) {
                if (!img.complete || img.naturalWidth < 1) {
                    img.style.display = "none";
                    img.removeAttribute("src");
                }
            });
        } catch (e) {
            console.warn("onclone sanitize", e);
        }
        if (typeof userOnclone === "function") {
            try { userOnclone(clonedDoc, clonedEl); } catch (e2) { /* ignore */ }
        }
    };

    return html2canvas(el, opts);
}

function setBusy(btn, busy, textBusy = "Procesando…") {
    if (!btn) return;
    if (!btn.dataset.text) btn.dataset.text = btn.textContent;
    btn.disabled = busy;
    btn.classList.toggle("opacity-60", busy);
    btn.classList.toggle("cursor-not-allowed", busy);
    btn.textContent = busy ? textBusy: btn.dataset.text;
}

function pickLabel(code) {
    if (code === "H") return "L";
    if (code === "D") return "E";
    if (code === "A") return "V";
    return "";
}

function renderPickRow( {
    match_no, home_team, away_team, match_id, selected
}) {
    // Botones grandes para celular
    return `
    <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
    <div class="flex items-center justify-between gap-2 mb-2">
    <div class="text-xs text-zinc-400">#${match_no}</div>
    <div class="text-sm font-semibold">${home_team} vs ${away_team}</div>
    </div>

    <div class="grid grid-cols-3 gap-2">
    <button data-pickbtn="H" data-mid="${match_id}" class="pickbtn ${selected === "H" ? "pickbtn-on": ""}">
    L
    </button>
    <button data-pickbtn="D" data-mid="${match_id}" class="pickbtn ${selected === "D" ? "pickbtn-on": ""}">
    E
    </button>
    <button data-pickbtn="A" data-mid="${match_id}" class="pickbtn ${selected === "A" ? "pickbtn-on": ""}">
    V
    </button>
    </div>
    </div>`;
}

// =====================
// Fecha / Saludo
// =====================
function getMonterreyHour(date = new Date()) {
    const hourStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Monterrey",
        hour: "2-digit",
        hour12: false
    }).format(date);

    const h = Number(hourStr);
    return Number.isFinite(h) ? h: date.getHours();
}

function getGreetingByHour(h) {
    if (h >= 5 && h < 12) return "Buenos días";
    if (h >= 12 && h < 19) return "Buenas tardes";
    return "Buenas noches";
}

// Formato: "Dom, 01 Marzo, 2026"
function formatMxHeader(date = new Date()) {
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
        el.textContent = n > 99 ? "99+": String(n);
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
    const {
        data,
        error
    } = await supabaseClient.rpc("is_admin");
    if (error) throw error;
    return !!data;
}

async function getProfile(userId) {
    const {
        data,
        error
    } = await supabaseClient
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
    if (error) throw error;
    return data;
}

async function upsertProfile(userId, displayName) {
    const {
        error
    } = await supabaseClient
    .from("profiles")
    .upsert({
        user_id: userId, display_name: displayName
    }, {
        onConflict: "user_id"
    });
    if (error) throw error;
}


// ═══════════════════════════════════════════════
// CARGA DIFERIDA — contenido secundario del Inicio
// ═══════════════════════════════════════════════
let _dashboardExtrasScheduled = false;
let _dashboardExtrasInFlight = null;
let _dashboardExtrasLoadedAt = 0;
const DASHBOARD_EXTRAS_TTL_MS = 60000;

function runWhenBrowserIdle(callback, timeout = 1200) {
    if ("requestIdleCallback" in window) {
        window.requestIdleCallback(callback, {
            timeout: timeout
        });
    } else {
        window.setTimeout(callback, 250);
    }
}

function scheduleDashboardExtras(options = {}) {
    const force = options.force === true;
    const isFresh = Date.now() - _dashboardExtrasLoadedAt < DASHBOARD_EXTRAS_TTL_MS;

    if (!force && isFresh) return;
    if (_dashboardExtrasScheduled || _dashboardExtrasInFlight) return;

    _dashboardExtrasScheduled = true;

    runWhenBrowserIdle(function() {
        _dashboardExtrasScheduled = false;

        _dashboardExtrasInFlight = Promise.allSettled([
            loadDashboardEnhanced(),
            loadWinnersHistory(),
            loadHistoricalStandings(),
            loadWeeklySummary(),
            loadAccuracyChart()
        ]).then(function(results) {
            results.forEach(function(result) {
                if (result.status === "rejected") {
                    console.warn("Dashboard extra:", result.reason?.message || result.reason);
                }
            });
            _dashboardExtrasLoadedAt = Date.now();
        }).finally(function() {
            _dashboardExtrasInFlight = null;
        });
    });
}

function invalidateDashboardExtras() {
    _dashboardExtrasLoadedAt = 0;
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

        // INICIO — primero pinta KPIs críticos; lo histórico se difiere
        if (tabId === "tab-home") {
            const homeWasLoaded = isTabLoaded("tab-home");
            await loadDashboardSummary();
            markTabLoaded("tab-home");
            scheduleDashboardExtras( {
                force: homeWasLoaded
            });
        }

        // PARTICIPANTES — lazy: solo carga si no estaba cargado
        if (tabId === "tab-participants") {
            if (!isTabLoaded("tab-participants")) {
                await loadParticipants();
                markTabLoaded("tab-participants");
            }
        }

        // JORNADAS — lazy
        if (tabId === "tab-pools") {
            if (!isTabLoaded("tab-pools")) {
                await loadPools();
                markTabLoaded("tab-pools");
            }
        }

        // PLANTILLAS — carga completa solo al abrir esta sección
        if (tabId === "tab-templates") {
            if (!isTabLoaded("tab-templates")) {
                await fillTplPools();
                await loadTemplateIntoEditor();
                await renderPreview();
                markTabLoaded("tab-templates");
            }
        }

        // PAGOS — siempre refresca (estado de pagos cambia frecuentemente)
        if (tabId === "tab-payments") {
            await fillEntryPoolsSelect();
            await fillEntryParticipantsSelect();
            await loadEntriesAndStats();
        }

        // PICKS — siempre refresca (picks cambian frecuentemente)
        if (tabId === "tab-picks") {
            await fillPickPoolsSelect();
            await fillPickParticipantsSelect();
            await loadPickStatusList();
            await restoreLastPickSelection();
        }

        // RESULTADOS — lazy
        if (tabId === "tab-results") {
            if (!isTabLoaded("tab-results")) {
                await fillResultsPoolsSelect();
                markTabLoaded("tab-results");
            }
        }

        // ACIERTOS — lazy
        if (tabId === "tab-standings") {
            if (!isTabLoaded("tab-standings")) {
                await fillStandingsPoolsSelect();
                markTabLoaded("tab-standings");
            }
        }

        // MUNDIAL — siempre refresca (tiempo real)
        if (tabId === "tab-mundial") {
            await loadMundialStandings();
        }

    } catch (err) {
        showAlert("Error cargando sección: " + (err?.message || err), "error");
    }

    // No bloquear la navegación por una insignia secundaria.
    const refreshBadgesWithoutBlocking = function() {
        updateNavBadges().catch(function(err) {
            console.warn("Badges en navegación:", err?.message || err);
        });
    };

    if (!appInitialized) {
        runWhenBrowserIdle(refreshBadgesWithoutBlocking, 1800);
    } else {
        refreshBadgesWithoutBlocking();
    }
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

// =================
// Actualizar Badges
let _navBadgesCache = null;
let _navBadgesCacheExpiresAt = 0;
let _navBadgesInFlight = null;
const NAV_BADGES_TTL_MS = 15000;

function applyNavBadgeState(state) {
    const safe = state || {
        picksPendingCount: 0,
        moreCount: 0,
        paymentsPendingCount: 0,
        resultsPendingCount: 0,
        standingsReadyCount: 0
    };

    setBadge("navBadgePicks", safe.picksPendingCount || 0);
    setBadge("navBadgeMore", safe.moreCount || 0);
    setBadge("moreBadgePayments", safe.paymentsPendingCount || 0);
    setBadge("moreBadgeResults", safe.resultsPendingCount || 0);
    setBadge("moreBadgeStandings", safe.standingsReadyCount || 0);
}

function clearNavBadgesCache() {
    _navBadgesCache = null;
    _navBadgesCacheExpiresAt = 0;
}

async function updateNavBadges(options = {}) {
  const force = options === true || options.force === true;
  const now = Date.now();

  if (!force && _navBadgesCache && now < _navBadgesCacheExpiresAt) {
    applyNavBadgeState(_navBadgesCache);
    return _navBadgesCache;
  }

  if (_navBadgesInFlight) {
    return _navBadgesInFlight;
  }

  _navBadgesInFlight = (async function() {
    try {
      // TODAS las jornadas abiertas (Sencilla + Goleó + otras)
      const { data: activePools, error: poolErr } = await supabaseClient
        .from("pools")
        .select("id, name, mode_code, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (poolErr) throw poolErr;

      const pools = activePools || [];

      if (!pools.length) {
        const empty = {
          picksPendingCount: 0,
          moreCount: 0,
          paymentsPendingCount: 0,
          resultsPendingCount: 0,
          standingsReadyCount: 0
        };
        _navBadgesCache = empty;
        _navBadgesCacheExpiresAt = Date.now() + NAV_BADGES_TTL_MS;
        applyNavBadgeState(empty);
        return empty;
      }

      let picksPendingCount = 0;
      let paymentsPendingCount = 0;
      let resultsPendingCount = 0;
      let standingsReadyCount = 0;

      // Procesar cada jornada activa
      for (const pool of pools) {
        const poolId = pool.id;

        const [entriesRes, matchesRes] = await Promise.all([
          supabaseClient
            .from("entries")
            .select("id, participant_id, paid")
            .eq("pool_id", poolId),
          supabaseClient
            .from("matches")
            .select("id, home_goals, away_goals")
            .eq("pool_id", poolId)
        ]);

        if (entriesRes.error) throw entriesRes.error;
        if (matchesRes.error) throw matchesRes.error;

        const entries = entriesRes.data || [];
        const matches = matchesRes.data || [];
        const entryIds = entries.map(function(e) { return e.id; });
        const validMatchIds = matches.map(function(m) { return m.id; });
        const validMatchSet = new Set(validMatchIds);
        const totalMatches = validMatchIds.length;
        const picksByEntry = new Map();

        var modeUpper = String(pool.mode_code || "SENCILLA").toUpperCase();

        // GOLEÓ: pendiente = boleto pagado o no sin pronóstico de goles
        if (modeUpper === "GOLEO" && entryIds.length) {
          var goalsByEntry = new Set();
          try {
            var { data: gRows } = await supabaseClient
              .from("predictions_goals_total")
              .select("entry_id")
              .eq("pool_id", poolId)
              .in("entry_id", entryIds);
            (gRows || []).forEach(function(g) {
              if (g.entry_id) goalsByEntry.add(g.entry_id);
            });
          } catch (e) { /* ignore */ }
          picksPendingCount += entries.filter(function(entry) {
            return !goalsByEntry.has(entry.id);
          }).length;
        } else if (entryIds.length && validMatchIds.length) {
          // Sencilla / 1X2: picks incompletos vs plantilla de partidos
          const ENTRY_CHUNK = 80;
          const PAGE_SIZE = 500;

          for (let start = 0; start < entryIds.length; start += ENTRY_CHUNK) {
            const entryChunk = entryIds.slice(start, start + ENTRY_CHUNK);

            for (let offset = 0; ; offset += PAGE_SIZE) {
              const { data: page, error: picksErr } = await supabaseClient
                .from("predictions_1x2")
                .select("entry_id, match_id")
                .in("entry_id", entryChunk)
                .in("match_id", validMatchIds)
                .order("entry_id", { ascending: true })
                .order("match_id", { ascending: true })
                .range(offset, offset + PAGE_SIZE - 1);

              if (picksErr) throw picksErr;
              if (!page || !page.length) break;

              page.forEach(function(pick) {
                if (!validMatchSet.has(pick.match_id)) return;
                if (!picksByEntry.has(pick.entry_id)) {
                  picksByEntry.set(pick.entry_id, new Set());
                }
                picksByEntry.get(pick.entry_id).add(pick.match_id);
              });

              if (page.length < PAGE_SIZE) break;
            }
          }

          picksPendingCount += entries.filter(function(entry) {
            const completedMatches = picksByEntry.get(entry.id)?.size || 0;
            return completedMatches < totalMatches;
          }).length;
        }

        // Pagos pendientes (todas las activas)
        paymentsPendingCount += entries.filter(function(entry) {
          return entry.paid !== true;
        }).length;

        // Resultados pendientes (partidos sin goles)
        const poolResultsPending = matches.filter(function(match) {
          return match.home_goals === null || match.away_goals === null;
        }).length;
        resultsPendingCount += poolResultsPending;

        // Standings listo: jornada con partidos y TODOS con resultado
        if (totalMatches > 0 && poolResultsPending === 0) {
          standingsReadyCount += 1;
        }
      }

      const moreCount =
        paymentsPendingCount + resultsPendingCount + standingsReadyCount;

      const state = {
        picksPendingCount,
        moreCount,
        paymentsPendingCount,
        resultsPendingCount,
        standingsReadyCount
      };

      _navBadgesCache = state;
      _navBadgesCacheExpiresAt = Date.now() + NAV_BADGES_TTL_MS;
      applyNavBadgeState(state);

      console.info("Badges multi-jornada", {
        pools: pools.map(function(p) {
          return (p.name || "") + " (" + (p.mode_code || "SENCILLA") + ")";
        }),
        picksPending: picksPendingCount,
        paymentsPending: paymentsPendingCount,
        resultsPending: resultsPendingCount,
        standingsReady: standingsReadyCount
      });

      return state;
    } catch (err) {
      console.warn("updateNavBadges:", err?.message || err);
      const empty = {
        picksPendingCount: 0,
        moreCount: 0,
        paymentsPendingCount: 0,
        resultsPendingCount: 0,
        standingsReadyCount: 0
      };
      applyNavBadgeState(empty);
      return empty;
    } finally {
      _navBadgesInFlight = null;
    }
  })();

  return _navBadgesInFlight;
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

/** Texto corto y limpio para una jornada activa (chips / banners). */
function formatActivePoolLine(p) {
    if (!p) return "—";
    var mode = String(p.mode_code || "SENCILLA").toUpperCase();
    var modeShort = typeof formatModeShort === "function" ? formatModeShort(mode) : formatModeLabel(mode);
    var parts = [];
    if (p.round != null && String(p.round).trim() !== "") {
        parts.push("J" + String(p.round).trim());
    }
    if (p.competition) parts.push(String(p.competition).trim());
    if (p.season) parts.push(String(p.season).trim());
    if (!parts.length && p.name) parts.push(String(p.name).trim());
    return parts.join(" · ") + " · " + modeShort;
}

/** Banner de jornadas activas en pestaña Jornadas (ordenado y legible). */
function renderActivePoolsBanner(actives) {
    var list = actives || [];
    var countEl = $("activePoolsCount");
    var banner = $("activePoolsBanner");
    var nameEl = $("activePoolName");

    if (countEl) {
        countEl.textContent = list.length === 1
            ? "1 activa"
            : (list.length + " activas");
        countEl.className = list.length
            ? "text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20"
            : "text-[11px] font-semibold text-zinc-500 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700";
    }

    if (!nameEl) return;

    if (!list.length) {
        nameEl.innerHTML = "";
        if (banner) banner.classList.add("hidden");
        return;
    }

    if (banner) banner.classList.remove("hidden");

    // Orden: por jornada (round) y luego por modo
    var sorted = list.slice().sort(function(a, b) {
        var ra = Number(a.round);
        var rb = Number(b.round);
        if (!isNaN(ra) && !isNaN(rb) && ra !== rb) return ra - rb;
        return String(a.mode_code || "").localeCompare(String(b.mode_code || ""));
    });

    nameEl.innerHTML = sorted.map(function(p) {
        var mode = String(p.mode_code || "SENCILLA").toUpperCase();
        var modeBadge = mode === "GOLEO"
            ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
            : mode === "ACUMULADA"
            ? "bg-sky-500/15 text-sky-300 border-sky-500/25"
            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
        var modeShort = typeof formatModeShort === "function" ? formatModeShort(mode) : formatModeLabel(mode);
        var title = [];
        if (p.round != null && String(p.round).trim() !== "") title.push("Jornada " + String(p.round).trim());
        if (p.competition) title.push(String(p.competition).trim());
        if (p.season) title.push(String(p.season).trim());
        if (!title.length) title.push(p.name || "Jornada");

        return (
            '<div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">' +
            '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>' +
            '<span class="text-sm text-zinc-100 font-medium flex-1 min-w-0 truncate">' +
            escapeHTML(title.join(" · ")) +
            '</span>' +
            '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ' + modeBadge + '">' +
            escapeHTML(modeShort) +
            '</span>' +
            '</div>'
        );
    }).join("");
}

/** Etiqueta corta de modo para selects (móvil) */
function formatModeShort(mode) {
    switch (mode) {
        case "SENCILLA":
            return "Sencilla";
        case "ACUMULADA":
            return "Acumulada";
        case "GOLEO":
            return "Goleo";
        case "CAMPEON_CAMPEONES":
            return "C. Campeones";
        default:
            return mode || "—";
    }
}

function formatPoolStatusTag(status) {
    if (status === "open") return "✅ Activa";
    if (status === "draft") return "📝 Borrador";
    return "🔒 Cerrada";
}

/** Label premium unificado para <option> de jornadas */
function formatPoolOptionLabel(p, opts) {
    opts = opts || {};
    const name = (p && p.name) ? String(p.name) : "Jornada";
    const mode = formatModeShort((p && p.mode_code) || "SENCILLA");
    const parts = [name, mode];
    if (opts.showStatus !== false) {
        parts.push(formatPoolStatusTag(p && p.status));
    }
    return parts.join(" · ");
}

// ═══════════════════════════════════════════════
// SELECTORES PREMIUM (bottom sheet al tema de la app)
// Sustituye el picker nativo del SO por UI propia.
// ═══════════════════════════════════════════════
var PREMIUM_SELECT_IDS = [
    "tplPool",
    "entryPool",
    "entryParticipant",
    "pickPool",
    "pickParticipant",
    "resultsPool",
    "standingsPool",
    "poolMode",
    "areaFilter"
];

var PREMIUM_SELECT_TITLES = {
    tplPool: "Seleccionar jornada",
    entryPool: "Jornada (pagos)",
    entryParticipant: "Participante",
    pickPool: "Jornada (pronósticos)",
    pickParticipant: "Participante",
    resultsPool: "Jornada (resultados)",
    standingsPool: "Jornada (aciertos)",
    poolMode: "Modo de juego",
    areaFilter: "Filtrar por área"
};

function parsePoolOptionMeta(label) {
    // "Name · Mode · Status" from formatPoolOptionLabel
    var parts = String(label || "").split(" · ").map(function(s) {
        return s.trim();
    }).filter(Boolean);
    if (parts.length >= 3) {
        return {
            title: parts[0],
            subtitle: parts.slice(1).join(" · "),
            mode: parts[1],
            status: parts[2]
        };
    }
    if (parts.length === 2) {
        return {
            title: parts[0],
            subtitle: parts[1],
            mode: parts[1],
            status: ""
        };
    }
    return {
        title: label || "—",
        subtitle: "",
        mode: "",
        status: ""
    };
}

function modeBadgeClass(modeText) {
    var m = String(modeText || "").toLowerCase();
    if (m.indexOf("goleo") >= 0) return "ps-badge-goleo";
    if (m.indexOf("acumul") >= 0) return "ps-badge-acum";
    if (m.indexOf("campeon") >= 0 || m.indexOf("campeón") >= 0) return "ps-badge-cc";
    return "ps-badge-sencilla";
}

function closePremiumSelectSheet() {
    var sheet = document.getElementById("premiumSelectSheet");
    if (sheet) sheet.remove();
    document.body.classList.remove("overflow-hidden");
}

function openPremiumSelectSheet(selectId) {
    var sel = $(selectId);
    if (!sel || !sel.options || !sel.options.length) return;

    closePremiumSelectSheet();

    var title = PREMIUM_SELECT_TITLES[selectId] || "Seleccionar";
    var options = Array.from(sel.options);
    var current = sel.value;

    var sheet = document.createElement("div");
    sheet.id = "premiumSelectSheet";
    sheet.className = "ps-sheet-root";

    var listHtml = options.map(function(opt, idx) {
        var val = opt.value;
        var label = opt.textContent || opt.label || "";
        var selected = val === current;
        var meta = parsePoolOptionMeta(label);
        var isPoolLike = ["tplPool", "entryPool", "pickPool", "resultsPool", "standingsPool"].indexOf(selectId) >= 0;
        var badge = "";
        if (isPoolLike && meta.mode) {
            badge = '<span class="ps-badge ' + modeBadgeClass(meta.mode) + '">' + escapeHTML(meta.mode) + '</span>';
        }
        var statusLine = meta.status
            ? '<div class="ps-opt-sub">' + escapeHTML(meta.status) + '</div>'
            : (meta.subtitle && !isPoolLike
                ? '<div class="ps-opt-sub">' + escapeHTML(meta.subtitle) + '</div>'
                : "");

        return [
            '<button type="button" class="ps-opt' + (selected ? " ps-opt-on" : "") + '" data-value="' + escapeHTML(val) + '" data-idx="' + idx + '">',
            '<div class="ps-opt-main">',
            '<div class="ps-opt-title">' + escapeHTML(isPoolLike ? meta.title : label) + '</div>',
            statusLine,
            '</div>',
            badge,
            selected ? '<span class="ps-check">✓</span>' : '<span class="ps-radio"></span>',
            '</button>'
        ].join("");
    }).join("");

    sheet.innerHTML = [
        '<div class="ps-backdrop" id="psBackdrop"></div>',
        '<div class="ps-panel" role="dialog" aria-modal="true">',
        '<div class="ps-handle"></div>',
        '<div class="ps-header">',
        '<div class="ps-title">' + escapeHTML(title) + '</div>',
        '<button type="button" class="ps-close" id="psCloseBtn" aria-label="Cerrar">✕</button>',
        '</div>',
        '<div class="ps-list">' + listHtml + '</div>',
        '</div>'
    ].join("");

    document.body.appendChild(sheet);
    document.body.classList.add("overflow-hidden");

    // animate in
    requestAnimationFrame(function() {
        sheet.classList.add("ps-open");
    });

    function pick(val) {
        var prev = sel.value;
        sel.value = val;
        syncPremiumSelectTrigger(selectId);
        if (prev !== val) {
            sel.dispatchEvent(new Event("change", {
                bubbles: true
            }));
        }
        closePremiumSelectSheet();
    }

    document.getElementById("psBackdrop").addEventListener("click", closePremiumSelectSheet);
    document.getElementById("psCloseBtn").addEventListener("click", closePremiumSelectSheet);
    sheet.querySelectorAll(".ps-opt").forEach(function(btn) {
        btn.addEventListener("click", function() {
            pick(btn.getAttribute("data-value") || "");
        });
    });
}

function syncPremiumSelectTrigger(selectId) {
    var sel = $(selectId);
    var trigger = document.querySelector('[data-ps-for="' + selectId + '"]');
    if (!sel || !trigger) return;

    var opt = sel.options[sel.selectedIndex];
    var label = opt ? (opt.textContent || opt.label || "—") : "—";
    var meta = parsePoolOptionMeta(label);
    var isPoolLike = ["tplPool", "entryPool", "pickPool", "resultsPool", "standingsPool"].indexOf(selectId) >= 0;

    var titleEl = trigger.querySelector(".ps-trigger-title");
    var subEl = trigger.querySelector(".ps-trigger-sub");
    var badgeEl = trigger.querySelector(".ps-trigger-badge");

    if (titleEl) titleEl.textContent = isPoolLike ? (meta.title || label) : label;
    if (subEl) {
        if (isPoolLike && meta.status) {
            subEl.textContent = meta.status;
            subEl.classList.remove("hidden");
        } else if (!isPoolLike && meta.subtitle) {
            subEl.textContent = meta.subtitle;
            subEl.classList.remove("hidden");
        } else {
            subEl.textContent = "";
            subEl.classList.add("hidden");
        }
    }
    if (badgeEl) {
        if (isPoolLike && meta.mode) {
            badgeEl.textContent = meta.mode;
            badgeEl.className = "ps-trigger-badge ps-badge " + modeBadgeClass(meta.mode);
            badgeEl.classList.remove("hidden");
        } else {
            badgeEl.textContent = "";
            badgeEl.classList.add("hidden");
        }
    }

    if (!sel.options.length || (sel.options.length === 1 && !sel.options[0].value && /sin|selecciona|—/i.test(label))) {
        trigger.classList.add("ps-trigger-empty");
    } else {
        trigger.classList.remove("ps-trigger-empty");
    }
}

function enhancePremiumSelect(selectId) {
    var sel = $(selectId);
    if (!sel) return;

    // Already enhanced?
    var existing = document.querySelector('[data-ps-for="' + selectId + '"]');
    if (existing) {
        syncPremiumSelectTrigger(selectId);
        return;
    }

    sel.classList.add("ps-native-hidden");
    sel.setAttribute("aria-hidden", "true");
    sel.tabIndex = -1;

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ps-trigger";
    trigger.setAttribute("data-ps-for", selectId);
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.innerHTML = [
        '<div class="ps-trigger-text">',
        '<div class="ps-trigger-title">—</div>',
        '<div class="ps-trigger-sub hidden"></div>',
        '</div>',
        '<span class="ps-trigger-badge hidden"></span>',
        '<span class="ps-trigger-chevron" aria-hidden="true"></span>'
    ].join("");

    trigger.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (sel.disabled) return;
        openPremiumSelectSheet(selectId);
    });

    // Insert trigger right after the select
    if (sel.parentNode) {
        sel.parentNode.insertBefore(trigger, sel.nextSibling);
    }

    syncPremiumSelectTrigger(selectId);
}

function refreshPremiumSelect(selectId) {
    enhancePremiumSelect(selectId);
    syncPremiumSelectTrigger(selectId);
}

function initPremiumSelects() {
    PREMIUM_SELECT_IDS.forEach(function(id) {
        enhancePremiumSelect(id);
    });
}



// Cargar Dashboard
async function loadDashboardSummary() {
    const [poolsRes, participantsRes] = await Promise.all([
        supabaseClient
        .from("pools")
        .select("id, name, mode_code, carryover_amount, status, created_at")
        .eq("status", "open")
        .order("created_at", {
            ascending: false
        }),
        supabaseClient
        .from("participants")
        .select("*", {
            count: "exact", head: true
        })
        .eq("is_active", true)
    ]);

    if (poolsRes.error) return showAlert(poolsRes.error.message, "error");
    if (participantsRes.error) return showAlert(participantsRes.error.message, "error");

    const activePools = poolsRes.data || [];
    const participantsCount = participantsRes.count || 0;
    $("dashParticipants").textContent = participantsCount;

    // Helpers UI
    function setEmpty() {
        if ($("dashActivePool")) $("dashActivePool").textContent = "Sin activa";
        if ($("dashMode")) $("dashMode").textContent = "—";
        if ($("dashPrizesByMode")) $("dashPrizesByMode").innerHTML = '<div class="text-zinc-500 text-xs">—</div>';
        if ($("dashPlayingByMode")) $("dashPlayingByMode").innerHTML = '<div class="text-zinc-500 text-xs">—</div>';
        if ($("dashPaidByMode")) $("dashPaidByMode").innerHTML = '<div class="text-zinc-500 text-xs">—</div>';
        if ($("dashUnpaidByMode")) $("dashUnpaidByMode").innerHTML = '<div class="text-zinc-500 text-xs">—</div>';
        if ($("dashPrize")) $("dashPrize").textContent = "$0";
        if ($("dashPaidEntries")) $("dashPaidEntries").textContent = "0";
        if ($("dashUnpaidEntries")) $("dashUnpaidEntries").textContent = "0";
        if ($("dashJugandoJornada")) $("dashJugandoJornada").textContent = "0";
        if ($("dashCarryover")) $("dashCarryover").textContent = money(0);
    }

    if (!activePools.length) {
        setEmpty();
        return;
    }

    // ── Jornadas activas ──
    if ($("dashActivePool")) {
        if (!activePools.length) {
            $("dashActivePool").textContent = "Sin activa";
        } else {
            var sortedActive = activePools.slice().sort(function(a, b) {
                var ra = Number(a.round), rb = Number(b.round);
                if (!isNaN(ra) && !isNaN(rb) && ra !== rb) return ra - rb;
                return String(a.mode_code || "").localeCompare(String(b.mode_code || ""));
            });
            $("dashActivePool").innerHTML = sortedActive.map(function(p) {
                var mode = String(p.mode_code || "SENCILLA").toUpperCase();
                var modeShort = typeof formatModeShort === "function" ? formatModeShort(mode) : formatModeLabel(mode);
                var title = [];
                if (p.round != null && String(p.round).trim() !== "") title.push("Jornada " + String(p.round).trim());
                if (p.competition) title.push(String(p.competition).trim());
                if (p.season) title.push(String(p.season).trim());
                if (!title.length) title.push(p.name || "Jornada");
                var badgeCls = mode === "GOLEO"
                    ? "text-amber-300"
                    : "text-emerald-300";
                return (
                    '<div class="flex items-center gap-2">' +
                    '<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>' +
                    '<span class="text-sm text-zinc-100">' + escapeHTML(title.join(" · ")) +
                    ' <span class="text-xs ' + badgeCls + '">· ' + escapeHTML(modeShort) + '</span>' +
                    '</span>' +
                    '</div>'
                );
            }).join("");
        }
    }

    // ── Modos activos ──
    const modes = [...new Set(activePools.map(function(p) {
        return formatModeLabel(p.mode_code || "SENCILLA");
    }))];
    if ($("dashMode")) $("dashMode").textContent = modes.join(" · ");

    // ── Acumulado ──
    const totalCarryover = activePools.reduce(function(sum, p) {
        return sum + Number(p.carryover_amount || 0);
    }, 0);
    if ($("dashCarryover")) $("dashCarryover").textContent = money(totalCarryover);

    // ── Stats por pool en paralelo ──
    const perPool = await Promise.all(activePools.map(async function(pool) {
        const [statsRes, entriesRes] = await Promise.all([
            supabaseClient
            .from("pool_stats")
            .select("paid_count, prize_pool")
            .eq("pool_id", pool.id)
            .maybeSingle(),
            supabaseClient
            .from("entries")
            .select("id, paid")
            .eq("pool_id", pool.id)
        ]);

        const entries = entriesRes.data || [];
        const paidCount = entries.filter(function(e) {
            return e.paid === true;
        }).length;
        const unpaidCount = entries.length - paidCount;
        // Si pool_stats tiene paid_count, usarlo; si no, el conteo de entries
        const paidFromStats = statsRes.data ? Number(statsRes.data.paid_count || 0): paidCount;
        const prize = statsRes.data ? Number(statsRes.data.prize_pool || 0): 0;

        return {
            pool: pool,
            mode: formatModeLabel(pool.mode_code || "SENCILLA"),
            modeCode: pool.mode_code || "SENCILLA",
            prize: prize,
            playing: entries.length, // boletos / participantes jugando
            paid: paidFromStats || paidCount,
            unpaid: unpaidCount
        };
    }));

    // ── Bolsas separadas + total ──
    if ($("dashPrizesByMode")) {
        $("dashPrizesByMode").innerHTML = perPool.map(function(row) {
            return (
                '<div class="flex items-center justify-between gap-2">' +
                '<span class="text-zinc-300">' + row.mode + '</span>' +
                '<span class="font-semibold text-white">' + money(row.prize) + '</span>' +
                '</div>'
            );
        }).join("");
    }

    const totalPrize = perPool.reduce(function(s, r) {
        return s + r.prize;
    }, 0);
    if ($("dashPrize")) $("dashPrize").textContent = money(totalPrize);

    // ── Jugando separado + total ──
    if ($("dashPlayingByMode")) {
        $("dashPlayingByMode").innerHTML = perPool.map(function(row) {
            return (
                '<div class="flex items-center justify-between gap-2">' +
                '<span class="text-zinc-300">' + row.mode + '</span>' +
                '<span class="font-semibold text-white">' + row.playing + '</span>' +
                '</div>'
            );
        }).join("");
    }

    const totalPlaying = perPool.reduce(function(s, r) {
        return s + r.playing;
    }, 0);
    if ($("dashJugandoJornada")) $("dashJugandoJornada").textContent = totalPlaying;

    // ── Pagados separado + total ──
    if ($("dashPaidByMode")) {
        $("dashPaidByMode").innerHTML = perPool.map(function(row) {
            return (
                '<div class="flex items-center justify-between gap-2">' +
                '<span class="text-zinc-400 text-xs">' + row.mode + '</span>' +
                '<span class="font-semibold text-emerald-300">' + row.paid + '</span>' +
                '</div>'
            );
        }).join("");
    }

    const totalPaid = perPool.reduce(function(s, r) {
        return s + r.paid;
    }, 0);
    if ($("dashPaidEntries")) $("dashPaidEntries").textContent = totalPaid;

    // ── Sin pagar separado + total ──
    if ($("dashUnpaidByMode")) {
        $("dashUnpaidByMode").innerHTML = perPool.map(function(row) {
            return (
                '<div class="flex items-center justify-between gap-2">' +
                '<span class="text-zinc-400 text-xs">' + row.mode + '</span>' +
                '<span class="font-semibold text-amber-300">' + row.unpaid + '</span>' +
                '</div>'
            );
        }).join("");
    }

    const totalUnpaid = perPool.reduce(function(s, r) {
        return s + r.unpaid;
    }, 0);
    if ($("dashUnpaidEntries")) $("dashUnpaidEntries").textContent = totalUnpaid;

    // Volumen de datos (no bloquea el dashboard)
    try {
        loadDbStats().catch(function() { /* ignore */ });
    } catch (e) { /* ignore */ }
}

/** Conteos de filas en tablas principales (proxy de volumen; el disco real está en Supabase Usage). */
async function loadDbStats() {
    var wrap = $("dashDbStats");
    if (!wrap) return;

    var tables = [
        { key: "participants", label: "Participantes" },
        { key: "pools", label: "Jornadas" },
        { key: "entries", label: "Boletos" },
        { key: "matches", label: "Partidos" },
        { key: "predictions_1x2", label: "Picks 1X2" },
        { key: "predictions_goals_total", label: "Picks Goleó" },
        { key: "entry_points", label: "Puntos" }
    ];

    try {
        var results = await Promise.all(tables.map(async function(t) {
            var res = await supabaseClient.from(t.key).select("*", { count: "exact", head: true });
            return {
                label: t.label,
                count: res.error ? null : Number(res.count || 0),
                error: res.error ? res.error.message : null
            };
        }));

        var total = results.reduce(function(s, r) {
            return s + (r.count != null ? r.count : 0);
        }, 0);

        wrap.innerHTML = results.map(function(r) {
            var val = r.count == null
                ? '<span class="text-zinc-500">—</span>'
                : '<span class="font-semibold text-zinc-100">' + r.count.toLocaleString("es-MX") + '</span>';
            return (
                '<div class="flex items-center justify-between gap-2">' +
                '<span class="text-zinc-400 text-xs">' + r.label + '</span>' +
                val +
                '</div>'
            );
        }).join("") +
        '<div class="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-800">' +
        '<span class="text-zinc-500 text-xs">Total filas contadas</span>' +
        '<span class="font-black text-emerald-400">' + total.toLocaleString("es-MX") + '</span>' +
        '</div>';
    } catch (err) {
        wrap.innerHTML = '<div class="text-xs text-amber-400">No se pudo cargar el volumen: ' +
            (err && err.message ? err.message : String(err)) + '</div>';
    }
}

if (typeof document !== "undefined") {
    document.addEventListener("click", function(ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest("#btnRefreshDbStats") : null;
        if (t) {
            var wrap = $("dashDbStats");
            if (wrap) wrap.innerHTML = '<div class="text-xs text-zinc-500">Actualizando…</div>';
            loadDbStats();
        }
    });
}

// Guardar Participantes
async function loadParticipants() {
    hideAlert();

    const {
        data,
        error
    } = await supabaseClient
    .from("participants")
    .select("id, name, area, whatsapp, is_active, created_at")
    .order("created_at", {
        ascending: false
    })
    .limit(500);

    if (error) return showAlert(error.message, "error");

    const rows = data || [];

    $("participantsList").innerHTML = rows.map(function(p) {
        const isActive = p.is_active !== false;
        const statusKey = isActive ? "active": "archived";
        const cardClass = isActive
        ? "bg-emerald-500/5 border-emerald-500/20": "bg-zinc-950 border-zinc-800";
        const statusEmoji = isActive ? "🟢": "⚫";
        const whatsapp = p.whatsapp ? p.whatsapp: "—";
        const hasWhatsapp = !!p.whatsapp;
        const whatsappBadge = hasWhatsapp
        ? '<span class="text-sky-300 text-xs ml-1">📱</span>': '<span class="text-amber-300 text-xs ml-1">⚠️</span>';
        const area = p.area ? p.area: "Sin área";
        const safeName = escapeHTML(p.name || "—");
        const safeArea = escapeHTML(area || "Sin área");
        const safeWhatsapp = escapeHTML(whatsapp || "—");
        const dataName = escapeHTML(String(p.name || "").toLowerCase());
        const dataArea = escapeHTML(String(area || "").toLowerCase());
        const dataWhatsapp = escapeHTML(String(whatsapp || "").toLowerCase());
        const safeRawName = escapeHTML(p.name || "");
        const safeRawArea = escapeHTML(p.area || "");
        const safeRawWhatsapp = escapeHTML(p.whatsapp || "");

        return `
        <div
        class="participant-card p-3 border rounded-xl ${cardClass}"
        data-status="${statusKey}"
        data-name="${dataName}"
        data-area="${dataArea}"
        data-whatsapp="${dataWhatsapp}"
        data-has-whatsapp="${p.whatsapp ? "1": "0"}">

        <!-- Fila superior: checkbox + datos -->
        <div class="flex items-start gap-2">
        <input type="checkbox" class="participant-bulk-check w-4 h-4 rounded accent-emerald-500 flex-shrink-0 mt-1"
        data-id="${p.id}" onchange="updateBulkEditBtn()" />

        <div class="min-w-0 flex-1">
        <!-- Nombre + badges -->
        <div class="flex items-center gap-1 flex-wrap">
        <span class="font-bold text-sm text-white leading-tight">${safeName}</span>
        ${whatsappBadge}
        <span data-picks-badge="${p.id}" class="text-xs" title="Estado de picks"></span>
        <span class="text-xs ${isActive ? "text-emerald-400": "text-zinc-500"}">${statusEmoji}</span>
        </div>
        <!-- Área -->
        <div class="text-xs text-zinc-400 mt-0.5">${safeArea}</div>
        <!-- WhatsApp -->
        ${whatsapp !== "—" ? `<div class="text-xs text-zinc-500">${safeWhatsapp}</div>`: ""}
        </div>
        </div>

        <!-- Fila inferior: botones de acción -->
        <div class="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-800">
        <button type="button"
        class="participant-wa-btn flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm flex items-center justify-center gap-1"
        onclick="openWhatsApp('${safeRawWhatsapp}')"
        title="Abrir WhatsApp">💬</button>
        <button type="button"
        class="participant-edit-btn flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm flex items-center justify-center gap-1"
        data-id="${p.id}"
        data-name="${safeRawName}"
        data-area="${safeRawArea}"
        data-whatsapp="${safeRawWhatsapp}"
        title="Editar datos">✏️</button>
        <button type="button"
        class="participant-history-btn flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm flex items-center justify-center gap-1"
        data-id="${p.id}"
        data-name="${safeRawName}"
        title="Historial picks">📋</button>
        <button type="button"
        class="participant-entry-hist-btn flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm flex items-center justify-center gap-1"
        data-id="${p.id}"
        data-name="${safeRawName}"
        title="Historial boletos">🎫</button>
        <button type="button"
        class="participant-toggle-btn flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm flex items-center justify-center gap-1"
        data-id="${p.id}"
        data-active="${isActive ? "1": "0"}"
        data-name="${safeRawName}"
        title="${isActive ? "Archivar": "Restaurar"}">${isActive ? "📦": "♻️"}</button>
        </div>
        </div>
        `;
    }).join("");

    attachParticipantEditEvents();
    attachParticipantHistoryEvents();
    attachParticipantEntryHistEvents();
    attachParticipantToggleEvents();
    // Load picks status badges
    loadParticipantPicksStatus();
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

    const {
        error
    } = await supabaseClient
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

    resetTabLoaded('tab-participants');
    await loadParticipants();
    await fillEntryParticipantsSelect();
    await fillPickParticipantsSelect();
    await loadDashboardSummary();
}

// Función Archivar Restaurar
async function toggleParticipantActive(id, isCurrentlyActive, participantName) {
    hideAlert();

    const nextValue = !isCurrentlyActive;
    const actionText = isCurrentlyActive ? "archivar": "restaurar";

    const ok = confirm(`¿Seguro que quieres ${actionText} a ${participantName}?`);
    if (!ok) return;

    const {
        error
    } = await supabaseClient
    .from("participants")
    .update({
        is_active: nextValue
    })
    .eq("id", id);

    if (error) return showAlert(error.message, "error");

    showAlert(
        isCurrentlyActive ? "Participante archivado ✅": "Participante restaurado ✅",
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
            openParticipantEditModal( {
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
            var id = btn.getAttribute("data-id");
            var name = btn.getAttribute("data-name") || "Participante";
            showParticipantHistory(id, name);
        });
    });
}

function attachParticipantEntryHistEvents() {
    document.querySelectorAll(".participant-entry-hist-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var id = btn.getAttribute("data-id");
            var name = btn.getAttribute("data-name") || "Participante";
            showParticipantEntryHistory(id, name);
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
    const {
        data,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, status, round, competition, season, price, commission_pct, date_label, mode_code, carryover_enabled, created_at")
    .order("created_at", {
        ascending: false
    });

    if (error) return showAlert(error.message, "error");

    const rows = data || [];
    const actives = rows.filter(function(p) { return p.status === "open"; });
    renderActivePoolsBanner(actives);

    $("poolsList").innerHTML = rows.map(p => {
        const badge =
        p.status === "open"
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300": p.status === "draft"
        ? "bg-sky-500/10 border-sky-500/20 text-sky-300": "bg-amber-500/10 border-amber-500/20 text-amber-300";

        const statusLabel =
        p.status === "open"
        ? "Activa": p.status === "draft"
        ? "Borrador": "Cerrada";

        const actionBtn =
        p.status === "draft"
        ? `
        <button data-open="${p.id}" class="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-xs">
        Activar
        </button>
        `: p.status === "open"
        ? `
        <button data-close="${p.id}" class="px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 text-xs">
        Cerrar
        </button>
        `: `
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

        ${p.date_label ? `<div class="text-xs text-emerald-300/90 mt-1">Fechas: ${p.date_label}</div>`: ""}

        ${p.carryover_enabled ? `<div class="text-xs text-sky-300/90 mt-1">Acumulado habilitado</div>`: ""}
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
        </button>`: ""}
        <button
        data-duplicatematches="${p.id}"
        class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">
        📋 Copiar partidos
        </button>
        <button
        data-poollog="${p.id}"
        data-poolname="${p.name || "Jornada"}"
        class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">
        📅 Historial
        </button>

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
            const id = btn.getAttribute("data-editprice");
            const price = btn.getAttribute("data-curprice") || "20";
            const comm = btn.getAttribute("data-curcomm") || "15";
            await editPoolPrice(id, price, comm);
        });
    });

    // Duplicar partidos
    document.querySelectorAll("[data-duplicatematches]").forEach(function(btn) {
        btn.addEventListener("click", async function() {
            var id = btn.getAttribute("data-duplicatematches");
            await duplicatePoolMatches(id);
        });
    });

    // Historial de jornada
    document.querySelectorAll("[data-poollog]").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var id = btn.getAttribute("data-poollog");
            var name = btn.getAttribute("data-poolname") || "Jornada";
            showPoolChangeLog(id, name);
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

    const date_label = next.trim() ? next.trim(): null;

    // (Opcional) Validador si ya lo tienes
    if (date_label && typeof validateDateLabel === "function" && !validateDateLabel(date_label)) {
        return showAlert("Formato inválido. Ejemplo: 06/07/08 Marzo", "error");
    }

    const {
        error
    } = await supabaseClient
    .from("pools")
    .update({
        date_label
    })
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

    const {
        error
    } = await supabaseClient.from("pools")
    .update({
        price: newPrice, commission_pct: newComm
    })
    .eq("id", poolId);

    if (error) return showAlert(error.message, "error");
    showAlert("Precio y comisión actualizados ✅", "ok");
    await loadPools();
    await loadDashboardSummary();
}

// Abrir Jornada Activa

async function setPoolOpen(poolId) {
    hideAlert();

    // 1. Leer la jornada a activar para saber su modo
    const {
        data: targetPool,
        error: fetchErr
    } = await supabaseClient
    .from("pools")
    .select("id, name, mode_code, status")
    .eq("id", poolId)
    .maybeSingle();

    if (fetchErr) return showAlert(fetchErr.message, "error");
    if (!targetPool) return showAlert("Jornada no encontrada.", "error");

    const mode = targetPool.mode_code || "SENCILLA";
    const modeLabel = formatModeLabel(mode);

    const ok = confirm(
        "¿Activar esta jornada?\n\n" +
        targetPool.name + "\n" +
        "Modo: " + modeLabel + "\n\n" +
        "Solo se cerrarán otras jornadas del MISMO modo (" + modeLabel + ").\n" +
        "Las de otro modo (ej. Sencilla + Goleó) seguirán activas."
    );
    if (!ok) return;

    // 2. Listar abiertas del mismo modo (para acumular Goleó al cerrarlas)
    const {
        data: toClose
    } = await supabaseClient
    .from("pools")
    .select("id, mode_code")
    .eq("status", "open")
    .eq("mode_code", mode)
    .neq("id", poolId);

    // 3. Cerrar SOLO las abiertas del mismo mode_code
    const {
        error: closeErr
    } = await supabaseClient
    .from("pools")
    .update({
        status: "closed"
    })
    .eq("status", "open")
    .eq("mode_code", mode)
    .neq("id", poolId);

    if (closeErr) return showAlert(closeErr.message, "error");

    // 3b. Acumulación automática si se cerraron Goleó sin acertante
    var goleoNotes = [];
    if (toClose && toClose.length) {
        for (var ci = 0; ci < toClose.length; ci++) {
            try {
                var note = await onGoleoPoolClosed(toClose[ci].id);
                if (note) goleoNotes.push(note.trim());
            } catch (e) {
                console.warn("onGoleoPoolClosed", e);
            }
        }
    }

    // 4. Abrir la jornada objetivo
    const {
        error
    } = await supabaseClient
    .from("pools")
    .update({
        status: "open"
    })
    .eq("id", poolId);

    if (error) return showAlert(error.message, "error");

    // Si la jornada que abrimos es Goleó, la bolsa de las cerradas ya apuntó aquí (si aplica)
    var extra = goleoNotes.length ? (" " + goleoNotes.join(" ")) : "";
    showAlert("Jornada activada ✅ (" + modeLabel + ")" + extra, "ok");

    await loadPools();
    await fillTplPools();
    await fillEntryPoolsSelect();
    await fillPickPoolsSelect();
    await loadDashboardSummary();
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
}

// Cerrar Jornada Activa
async function setPoolClosed(poolId) {
    hideAlert();

    const ok = confirm("¿Cerrar esta jornada?");
    if (!ok) return;

    const {
        error
    } = await supabaseClient
    .from("pools")
    .update({
        status: "closed"
    })
    .eq("id", poolId);

    if (error) return showAlert(error.message, "error");

    var goleoNote = "";
    try {
        goleoNote = await onGoleoPoolClosed(poolId);
    } catch (e) {
        console.warn(e);
    }

    showAlert("Jornada cerrada ✅" + (goleoNote || ""), "ok");

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

    const {
        error
    } = await supabaseClient
    .from("pools")
    .update({
        status: "draft"
    })
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
    // Redondear hacia abajo (reducido) para premios divididos
    return "$" + Math.floor(x).toString();
}

// Selector Pagos Jornadas Activa
async function fillEntryPoolsSelect() {
    const {
        data,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, status, price, commission_pct, mode_code, created_at")
    .eq("status", "open")
    .order("created_at", {
        ascending: false
    })
    .limit(30);

    if (error) return showAlert(error.message, "error");

    const sel = $("entryPool");
    if (!sel) return;
    sel.innerHTML = (data || []).map(function(p) {
        return '<option value="' + p.id + '">' + escapeHTML(formatPoolOptionLabel(p)) + '</option>';
    }).join("");

    if ((data || [])[0]) sel.value = data[0].id;

    refreshPremiumSelect("entryPool");
}

async function fillEntryParticipantsSelect() {
    const {
        data,
        error
    } = await supabaseClient
    .from("participants")
    .select("id, name, area")
    .order("created_at", {
        ascending: false
    })
    .limit(200);

    if (error) return showAlert(error.message, "error");

    const sel = $("entryParticipant");
    sel.innerHTML = (data || []).map(p => {
        const safeName = escapeHTML(p.name || "—");
        const safeArea = p.area ? ` • ${escapeHTML(p.area)}`: "";
        return `<option value="${p.id}">${safeName}${safeArea}</option>`;
    }).join("");

    refreshPremiumSelect("entryParticipant");
}

async function fillPickPoolsSelect() {
    const {
        data,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, status, mode_code, created_at")
    .order("created_at", {
        ascending: false
    })
    .limit(50);

    if (error) return showAlert(error.message, "error");

    const sel = $("pickPool");
    if (!sel) return;

    sel.innerHTML = (data || []).map(function(p) {
        return '<option value="' + p.id + '">' + escapeHTML(formatPoolOptionLabel(p)) + '</option>';
    }).join("");

    // Preferir activa; si hay varias activas, la más reciente
    const openPool = (data || []).find(function(p) {
        return p.status === "open";
    });
    const defaultPool = openPool || (data || [])[0];
    if (defaultPool) sel.value = defaultPool.id;

    refreshPremiumSelect("pickPool");
}

async function fillPickParticipantsSelect() {
    const pool_id = $("pickPool").value;

    // Si hay jornada seleccionada, solo participantes con boleto en ella
    if (pool_id) {
        const {
            data: entries,
            error: entErr
        } = await supabaseClient
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
            refreshPremiumSelect("pickParticipant");
            return;
        }

        const {
            data,
            error
        } = await supabaseClient
        .from("participants")
        .select("id, name, area")
        .in("id", partIds)
        .order("name", {
            ascending: true
        });

        if (error) return showAlert(error.message, "error");

        const sel = $("pickParticipant");
        sel.innerHTML = (data || []).map(function(p) {
            const safeName = escapeHTML(p.name || "—");
            const safeArea = p.area ? " • " + escapeHTML(p.area): "";
            return `<option value="${p.id}">${safeName}${safeArea}</option>`;
        }).join("");
        return;
    }

    // Fallback: todos los activos si no hay jornada seleccionada
    const {
        data,
        error
    } = await supabaseClient
    .from("participants")
    .select("id, name, area, is_active")
    .eq("is_active", true)
    .order("name", {
        ascending: true
    })
    .limit(200);

    if (error) return showAlert(error.message, "error");

    const sel = $("pickParticipant");
    sel.innerHTML = (data || []).map(function(p) {
        const safeName = escapeHTML(p.name || "—");
        const safeArea = p.area ? " • " + escapeHTML(p.area): "";
        return `<option value="${p.id}">${safeName}${safeArea}</option>`;
    }).join("");

    refreshPremiumSelect("pickParticipant");
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
    class="pick-btn py-3 rounded-xl border font-bold ${isH ? 'bg-emerald-600 border-emerald-500 text-white': 'bg-zinc-900 border-zinc-700 text-zinc-200'}">
    L
    </button>

    <button type="button"
    data-match-id="${match.id}"
    data-pick="D"
    class="pick-btn py-3 rounded-xl border font-bold ${isD ? 'bg-emerald-600 border-emerald-500 text-white': 'bg-zinc-900 border-zinc-700 text-zinc-200'}">
    E
    </button>

    <button type="button"
    data-match-id="${match.id}"
    data-pick="A"
    class="pick-btn py-3 rounded-xl border font-bold ${isA ? 'bg-emerald-600 border-emerald-500 text-white': 'bg-zinc-900 border-zinc-700 text-zinc-200'}">
    V
    </button>
    </div>
    </div>
    `;
}

async function loadEntryForPick(poolId, partId, entryId = null) {
    hideAlert();

    const pool_id = poolId || $("pickPool").value;
    const participant_id = partId || $("pickParticipant").value;

    if (!pool_id || !participant_id) {
        return showAlert("Selecciona jornada y participante.", "error");
    }

    let entryQuery = supabaseClient
    .from("entries")
    .select("id, paid, created_at, pool_id, participant_id")
    .eq("pool_id", pool_id)
    .eq("participant_id", participant_id);

    if (entryId) {
        entryQuery = entryQuery.eq("id", entryId);
    } else {
        entryQuery = entryQuery
        .order("created_at", {
            ascending: false
        })
        .limit(1);
    }

    const {
        data: entry,
        error: entryError
    } = await entryQuery.maybeSingle();

    if (entryError) return showAlert(entryError.message, "error");

    if (!entry) {
        currentPickEntryId = null;
        currentPickPoolId = null;
        currentPickParticipantId = null;

        $("pickEntryLabel").textContent = "Sin boleto";
        $("pickMatches").innerHTML = "";
        if (typeof hideGoalChampionSection === "function") hideGoalChampionSection();

        $("btnSavePicks").disabled = true;
        $("btnSavePicks").classList.add("opacity-50", "cursor-not-allowed");

        return showAlert("Ese participante no tiene boleto registrado en esta jornada.", "error");
    }

    currentPickEntryId = entry.id;
    currentPickPoolId = pool_id;
    currentPickParticipantId = participant_id;

    const {
        data: poolInfo,
        error: poolErr
    } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", pool_id)
    .maybeSingle();

    if (poolErr) return showAlert(poolErr.message, "error");

    // Load Goleo pick if this is a Goleo pool
    await loadGoalChampionPick();
    if (poolInfo && poolInfo.status === "closed") {
        $("pickEntryLabel").textContent =
        (entry.paid ? "Pagado ✅": "Pendiente ⏳") + " • Jornada cerrada 🔒";

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
        entry.paid ? "Pagado ✅": "Pendiente ⏳";

        $("btnSavePicks").disabled = false;
        $("btnSavePicks").classList.remove("opacity-50", "cursor-not-allowed");
    }

    const {
        data: matches,
        error: matchError
    } = await supabaseClient
    .from("matches")
    .select("id, match_no, home_team, away_team")
    .eq("pool_id", pool_id)
    .order("match_no", {
        ascending: true
    });

    if (matchError) return showAlert(matchError.message, "error");

    const {
        data: existingPicks,
        error: picksError
    } = await supabaseClient
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
    const {
        data: entry,
        error: entryErr
    } = await supabaseClient
    .from("entries")
    .select("id, pool_id, paid")
    .eq("id", entryId)
    .maybeSingle();

    if (entryErr) return showAlert(entryErr.message, "error");
    if (!entry) return showAlert("Boleto no encontrado.", "error");

    // Validar estado de la jornada
    const {
        data: poolInfo,
        error: poolErr
    } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", entry.pool_id)
    .maybeSingle();

    if (poolErr) return showAlert(poolErr.message, "error");

    if (!poolInfo || poolInfo.status !== "open") {
        return showAlert("Esta jornada ya está cerrada. No se puede registrar el pago.", "error");
    }

    var cfmPaid = await showConfirmModal( {
        icon: "💰", title: "Registrar pago",
        message: "Confirmas que este boleto fue pagado?",
        confirmLabel: "Registrar pago",
        confirmStyle: "background:linear-gradient(135deg,#059669,#10b981);"
    });
    if (!cfmPaid) return;

    const {
        error
    } = await supabaseClient
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
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
}

async function markEntryPending(entryId) {
    hideAlert();

    if (!entryId) return showAlert("No se encontró el boleto.", "error");

    const {
        data: entry,
        error: entryErr
    } = await supabaseClient
    .from("entries")
    .select("id, pool_id, paid")
    .eq("id", entryId)
    .maybeSingle();

    if (entryErr) return showAlert(entryErr.message, "error");
    if (!entry) return showAlert("Boleto no encontrado.", "error");

    const {
        data: poolInfo,
        error: poolErr
    } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", entry.pool_id)
    .maybeSingle();

    if (poolErr) return showAlert(poolErr.message, "error");

    if (!poolInfo || poolInfo.status !== "open") {
        return showAlert("Esta jornada ya está cerrada. No se puede cambiar el pago.", "error");
    }

    var cfmPending = await showConfirmModal( {
        icon: "?", title: "Marcar pendiente",
        message: "Revertir el pago de este boleto?",
        confirmLabel: "Marcar pendiente",
        confirmStyle: "background:linear-gradient(135deg,#b45309,#d97706);"
    });
    if (!cfmPending) return;

    const {
        error
    } = await supabaseClient
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
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
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
            '<div style="font-size:40px;line-height:1;margin-bottom:10px;">' + (opts.icon || "?") + '</div>',
            '<div style="font-size:17px;font-weight:800;color:#f0f4f8;">' + (opts.title || "Confirmar") + '</div>',
            '<div style="font-size:13px;color:#8a94a6;margin-top:6px;line-height:1.5;">' + (opts.message || "") + '</div>',
            '</div>',
            '<div style="display:grid;gap:10px;">',
            '<button id="confirmModalYes" style="width:100%;padding:14px;border-radius:14px;border:none;' + confirmStyle + 'color:#fff;font-size:15px;font-weight:700;cursor:pointer;">' + (opts.confirmLabel || "Confirmar") + '</button>',
            '<button id="confirmModalNo" style="width:100%;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#8a94a6;font-size:14px;cursor:pointer;">Cancelar</button>',
            '</div>',
            '</div>'
        ].join("");
        document.body.appendChild(modal);
        function close(r) {
            modal.remove(); resolve(r);
        }
        document.getElementById("confirmModalYes").addEventListener("click", function() {
            close(true);
        });
        document.getElementById("confirmModalNo").addEventListener("click", function() {
            close(false);
        });
        document.getElementById("confirmModalBg").addEventListener("click", function() {
            close(false);
        });
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

            // Auto-guardar borrador (debounced 1.5s)
            schedulePicksDraftSave();
        });
    });
}

// Debounce timer para auto-guardar
var _picksDraftTimer = null;
function schedulePicksDraftSave() {
    if (_picksDraftTimer) clearTimeout(_picksDraftTimer);
    var indicator = $("picksDraftIndicator");
    if (indicator) {
        indicator.textContent = "Guardando..."; indicator.style.color = "#fbbf24";
    }
    _picksDraftTimer = setTimeout(async function() {
        if (!currentPickEntryId) return;
        await savePicksDraft();
    },
        1500);
}

async function savePicksDraft() {
    if (!currentPickEntryId) return;
    var picks = [];
    document.querySelectorAll(".pick-btn[data-selected='1']").forEach(function(btn) {
        picks.push({
            entry_id: currentPickEntryId,
            match_id: btn.getAttribute("data-match-id"),
            pick: btn.getAttribute("data-pick")
        });
    });
    if (!picks.length) return;
    try {
        await supabaseClient.from("predictions_1x2")
        .upsert(picks, {
            onConflict: "entry_id,match_id"
        });
        var indicator = $("picksDraftIndicator");
        if (indicator) {
            indicator.textContent = "✓ Borrador guardado"; indicator.style.color = "#34d399";
        }
        setTimeout(function() {
            var el = $("picksDraftIndicator");
            if (el) el.textContent = "";
        },
            2500);
    } catch(e) {
        var indicator = $("picksDraftIndicator");
        if (indicator) {
            indicator.textContent = "";
        }
    }
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
    const {
        data: poolInfo,
        error: poolErr
    } = await supabaseClient
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

    const {
        error
    } = await supabaseClient
    .from("predictions_1x2")
    .upsert(rows, {
        onConflict: "entry_id,match_id"
    });

    if (error) return showAlert(error.message, "error");

    // Opt-in Campeón de Goleó (si Sencilla tiene hermano GOLEO y el usuario marcó la casilla)
    var goleoResult = null;
    try {
        goleoResult = await saveGoleoOptInFromSencilla();
    } catch (gErr) {
        console.warn("saveGoleoOptInFromSencilla", gErr);
        goleoResult = { ok: false, msg: (gErr && gErr.message) ? gErr.message : String(gErr) };
    }
    if (goleoResult && goleoResult.ok === false) {
        showAlert("Picks 1X2 guardados, pero Goleó falló: " + (goleoResult.msg || "error"), "error");
        await loadPickStatusList();
        return;
    }

    var msg = "Pronósticos guardados ✅";
    if (goleoResult && goleoResult.ok && !goleoResult.skipped) {
        msg += goleoResult.created
            ? " · Goleó registrado (" + goleoResult.predicted + " goles)"
            : " · Goleó actualizado (" + goleoResult.predicted + " goles)";
    }
    showAlert(msg, "ok");
    await loadPickStatusList();
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
    // Refrescar UI del opt-in (estado de boleto / pago)
    try { await loadGoalChampionPick(); } catch (e) { /* ignore */ }
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

    // Boletos de esa jornada (fuente de verdad) — orden cronológico para multi-boleta
    const {
        data: entries,
        error: eErr
    } = await supabaseClient
    .from("entries")
    .select("id, participant_id, paid, created_at")
    .eq("pool_id", pool_id)
    .order("created_at", { ascending: true });

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

    const {
        data: participants,
        error: pErr
    } = await supabaseClient
    .from("participants")
    .select("id, name, area")
    .in("id", participantIdsInPool)
    .order("name", {
        ascending: true
    });

    if (pErr) return showAlert(pErr.message, "error");

    const entryByParticipant = new Map();
    (entries || []).forEach(function(entry) {
        entryByParticipant.set(entry.participant_id, entry);
    });

    // Picks existentes para esos boletos — filtrado en servidor (evita límite 1000 rows)
    const entryIds = (entries || []).map(function(e) {
        return e.id;
    });

    // Modo de la jornada (GOLEO vs 1X2)
    var poolModeInfo = null;
    try {
        var { data: pmi } = await supabaseClient.from("pools")
            .select("id, mode_code, name, round, competition, season, price, date_label")
            .eq("id", pool_id).maybeSingle();
        poolModeInfo = pmi;
    } catch (e) { /* ignore */ }
    var isGoleoPool = poolModeInfo && String(poolModeInfo.mode_code || "").toUpperCase() === "GOLEO";

    // Also get match IDs for this pool to anchor the query (double filter = fastest + most accurate)
    const {
        data: matchIds
    } = await supabaseClient
    .from("matches")
    .select("id")
    .eq("pool_id", pool_id);
    const matchIdList = (matchIds || []).map(function(m) {
        return m.id;
    });

    let picks = [];
    // Predicciones de goles (Goleó)
    var goalsByEntry = new Map();
    if (isGoleoPool && entryIds.length) {
        try {
            var { data: goalsRows } = await supabaseClient.from("predictions_goals_total")
                .select("entry_id, predicted_goals")
                .in("entry_id", entryIds);
            (goalsRows || []).forEach(function(g) {
                if (g.entry_id != null && g.predicted_goals != null) {
                    goalsByEntry.set(g.entry_id, Number(g.predicted_goals));
                }
            });
        } catch (e) {
            console.warn("loadPickStatusList goals", e);
        }
    }

    if (!isGoleoPool && entryIds.length) {
        // Paginate in batches of 500 to handle large pools (24+ matches × many participants)
        const BATCH = 500;
        let allPicks = [];
        for (let offset = 0;; offset += BATCH) {
            let q = supabaseClient
            .from("predictions_1x2")
            .select("entry_id, match_id")
            .in("entry_id", entryIds)
            .range(offset, offset + BATCH - 1);
            if (matchIdList.length) q = q.in("match_id", matchIdList);
            const {
                data: batch,
                error: bErr
            } = await q;
            if (bErr) return showAlert(bErr.message, "error");
            if (!batch || !batch.length) break;
            allPicks = allPicks.concat(batch);
            if (batch.length < BATCH) break;
        }
        picks = allPicks;
    }

    const picksSetByEntry = new Map();
    picks.forEach(function(p) {
        if (!picksSetByEntry.has(p.entry_id)) {
            picksSetByEntry.set(p.entry_id, new Set());
        }
        picksSetByEntry.get(p.entry_id).add(p.match_id);
    });

    const picksCountByEntry = new Map();
    picksSetByEntry.forEach(function(matchSet, entryId) {
        picksCountByEntry.set(entryId, matchSet.size);
    });

    const totalMatchesInPool = isGoleoPool ? 0 : await (async function() {
        const {
            count,
            error
        } = await supabaseClient
        .from("matches")
        .select("*", {
            count: "exact", head: true
        })
        .eq("pool_id", pool_id);

        if (error) {
            showAlert(error.message, "error");
            return 0;
        }

        return Number(count || 0);
    })();

    const rowsHtml = (participants || []).map(function(participant) {
        const entry = entryByParticipant.get(participant.id);
        const area = participant.area ? participant.area: "Sin área";
        const pEntries = (entries || []).filter(function(e) {
            return e.participant_id === participant.id;
        });
        const safeParticipantName = escapeHTML(participant.name || "—");
        const safeArea = escapeHTML(area || "Sin área");
        const dataName = escapeHTML(String(participant.name || "").toLowerCase());
        const dataArea = escapeHTML(String(area || "").toLowerCase());

        let statusEmoji = "🚫";
        let statusTitle = "Sin boleto";
        let statusKey = "noboleto";
        let actionBtn = "";
        let cardClass = "bg-zinc-950 border-zinc-800";
        let iconWrapClass = "border-zinc-700 bg-zinc-900";
        let progressHtml = isGoleoPool
            ? `<div class="text-xs text-zinc-500 mt-1">Sin pronóstico</div>`
            : `<div class="text-xs text-zinc-500 mt-1">0/${totalMatchesInPool || 0}</div>`;

        if (pEntries.length > 0) {
            // ── MODO GOLEÓ: completo = tiene predicted_goals ──
            if (isGoleoPool) {
                const entryProgress = pEntries.map(function(e) {
                    const hasGoals = goalsByEntry.has(e.id);
                    const goals = hasGoals ? goalsByEntry.get(e.id) : null;
                    return {
                        entry: e,
                        hasGoals: hasGoals,
                        goals: goals,
                        complete: hasGoals
                    };
                });
                const completeEntries = entryProgress.filter(function(item) { return item.complete; }).length;
                const allComplete = completeEntries === entryProgress.length;
                const allEmpty = completeEntries === 0;

                if (entryProgress.length === 1) {
                    var g0 = entryProgress[0];
                    progressHtml = g0.hasGoals
                        ? `<div class="text-xs mt-1"><span class="text-amber-300 font-semibold">⚽ Goles: ${g0.goals}</span></div>`
                        : `<div class="text-xs mt-1"><span class="text-zinc-500">Sin pronóstico de goles</span></div>`;
                } else {
                    var goalsBits = entryProgress.map(function(item, idx) {
                        return item.hasGoals
                            ? ("#" + (idx + 1) + ": " + item.goals)
                            : ("#" + (idx + 1) + ": —");
                    }).join(" · ");
                    progressHtml = `
                    <div class="text-xs mt-1">
                    <span class="${allComplete ? "text-emerald-300": "text-amber-300"} font-semibold">
                    ⚽ ${completeEntries}/${entryProgress.length} boletas
                    </span>
                    <span class="text-zinc-400"> · ${goalsBits}</span>
                    </div>`;
                }

                if (allComplete) {
                    statusEmoji = "✅";
                    statusTitle = "Pronóstico de goles listo";
                    statusKey = "complete";
                    cardClass = "bg-emerald-500/5 border-emerald-500/20";
                    iconWrapClass = "border-emerald-500/30 bg-emerald-500/10";
                } else if (allEmpty) {
                    statusEmoji = "⏳";
                    statusTitle = "Pendiente de goles";
                    statusKey = "pending";
                    cardClass = "bg-amber-500/5 border-amber-500/20";
                    iconWrapClass = "border-amber-500/30 bg-amber-500/10";
                } else {
                    statusEmoji = "🟡";
                    statusTitle = "Parcial";
                    statusKey = "partial";
                    cardClass = "bg-yellow-500/5 border-yellow-500/20";
                    iconWrapClass = "border-yellow-500/30 bg-yellow-500/10";
                }

                const multiEntry = pEntries.length > 1;
                actionBtn = pEntries.map(function(e, idx) {
                    const hasG = goalsByEntry.has(e.id);
                    const boletaLabel = multiEntry
                        ? `<span style="font-size:10px;font-weight:700;margin-left:3px;opacity:.85;">#${idx + 1}</span>` : "";
                    const openBtnClass = hasG
                        ? "pick-status-open flex items-center gap-1 px-3 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold"
                        : "pick-status-open flex items-center gap-1 px-3 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold";
                    return `
                    <button type="button" class="${openBtnClass}"
                    data-participant-id="${participant.id}" data-entry-id="${e.id}"
                    title="Abrir boleta ${multiEntry ? idx + 1 : ""}">👁️${boletaLabel}</button>
                    ${hasG ? `
                    <button type="button"
                    class="pick-status-export flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700"
                    data-participant-id="${participant.id}" data-entry-id="${e.id}"
                    title="Descargar comprobante Goleó">🖼️</button>
                    <button type="button" class="pick-status-wa flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700"
                    data-participant-id="${participant.id}" data-entry-id="${e.id}" title="Enviar por WhatsApp">📲</button>` : ""}
                    `;
                }).join("");
            } else {
            // ── MODO SENCILLA / 1X2 ──
            const entryProgress = pEntries.map(function(e) {
                const count = picksCountByEntry.get(e.id) || 0;
                return {
                    entry: e,
                    count: count,
                    complete: totalMatchesInPool > 0 && count >= totalMatchesInPool
                };
            });

            const totalCaptured = entryProgress.reduce(function(sum, item) {
                return sum + item.count;
            }, 0);
            const completeEntries = entryProgress.filter(function(item) {
                return item.complete;
            }).length;
            const allComplete =
            totalMatchesInPool > 0 && completeEntries === entryProgress.length;
            const allEmpty = totalCaptured === 0;

            if (entryProgress.length === 1) {
                progressHtml = `
                <div class="text-xs mt-1">
                <span class="${totalCaptured > 0 ? "text-zinc-300": "text-zinc-500"}">
                ${totalCaptured}/${totalMatchesInPool || 0} picks
                </span>
                </div>
                `;
            } else {
                progressHtml = `
                <div class="text-xs mt-1 flex items-center gap-1 flex-wrap">
                <span class="${allComplete ? "text-emerald-300": "text-zinc-300"}">
                ${completeEntries}/${entryProgress.length} boletas completas
                </span>
                <span class="text-zinc-500">·</span>
                <span class="text-zinc-400">
                ${totalCaptured}/${entryProgress.length * (totalMatchesInPool || 0)} picks
                </span>
                </div>
                `;
            }

            if (allComplete) {
                statusEmoji = "✅";
                statusTitle = "Todas las boletas completas";
                statusKey = "complete";
                cardClass = "bg-emerald-500/5 border-emerald-500/20";
                iconWrapClass = "border-emerald-500/30 bg-emerald-500/10";
            } else if (allEmpty) {
                statusEmoji = "⏳";
                statusTitle = "Pendiente";
                statusKey = "pending";
                cardClass = "bg-amber-500/5 border-amber-500/20";
                iconWrapClass = "border-amber-500/30 bg-amber-500/10";
            } else {
                statusEmoji = "🟡";
                statusTitle = "Una o más boletas incompletas";
                statusKey = "partial";
                cardClass = "bg-yellow-500/5 border-yellow-500/20";
                iconWrapClass = "border-yellow-500/30 bg-yellow-500/10";
            }

            const multiEntry = pEntries.length > 1;
            actionBtn = pEntries.map(function(e, idx) {
                const pickCountE = picksCountByEntry.get(e.id) || 0;
                const isComplete = totalMatchesInPool > 0 && pickCountE >= totalMatchesInPool;
                const boletaLabel = multiEntry
                ? `<span style="font-size:10px;font-weight:700;margin-left:3px;opacity:.85;">#${idx + 1}</span>`: "";
                const openBtnClass = isComplete
                ? "pick-status-open flex items-center gap-1 px-3 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold": "pick-status-open flex items-center gap-1 px-3 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold";

                return `
                <button type="button"
                class="${openBtnClass}"
                data-participant-id="${participant.id}"
                data-entry-id="${e.id}"
                title="Abrir boleta ${multiEntry ? idx + 1: ""}">
                👁️${boletaLabel}
                </button>
                ${pickCountE > 0 ? `
                <button type="button"
                class="pick-status-export flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700"
                data-participant-id="${participant.id}"
                data-entry-id="${e.id}"
                title="Descargar boleta ${multiEntry ? idx + 1: ""}">
                🖼️
                </button>
                <button type="button" class="pick-status-wa flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700" data-participant-id="${participant.id}" data-entry-id="${e.id}" title="Enviar por WhatsApp">📲</button>
                <button type="button" class="pick-status-physical flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700" data-participant-id="${participant.id}" data-entry-id="${e.id}" title="Ver boleta con resultados">🎯</button>`: ""}
                `;
            }).join("");
            } // end !isGoleoPool
        }

        const hiddenByFilter =
        currentPickStatusFilter !== "all" && currentPickStatusFilter !== statusKey
        ? "hidden": "";

        const isMulti = pEntries.length > 1;

        return `
        <div
        class="pick-status-card p-3 border rounded-xl ${cardClass} ${hiddenByFilter}"
        data-status="${statusKey}"
        data-name="${dataName}"
        data-area="${dataArea}">

        <div class="flex items-center justify-between gap-2 mb-${isMulti ? "2": "0"}">
        <div class="min-w-0 flex-1">
        <div class="font-semibold text-sm leading-tight truncate">${safeParticipantName}</div>
        <div class="text-xs text-zinc-400 mt-1 truncate">${safeArea}</div>
        ${progressHtml}
        </div>
        <div class="w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 ${iconWrapClass}"
        title="${statusTitle}">
        ${statusEmoji}
        </div>
        </div>

        ${actionBtn ? `<div class="flex items-center gap-1 flex-wrap mt-1">${actionBtn}</div>`: ""}
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
    attachPickStatusPhysicalEvents();
    attachEditPickEvents();
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
            const entryId = btn.getAttribute("data-entry-id") || null;
            $("pickParticipant").value = participantId;
            await loadEntryForPick($("pickPool").value, participantId, entryId);
        });
    });
}

function attachPickStatusExportEvents() {
    document.querySelectorAll(".pick-status-export").forEach(function(btn) {
        btn.addEventListener("click", async function() {
            const participantId = btn.getAttribute("data-participant-id");
            const entryId = btn.getAttribute("data-entry-id") || null;
            await exportParticipantPickImage($("pickPool").value, participantId, entryId);
        });
    });
}

function attachEditPickEvents() {
    document.querySelectorAll("[data-edit-pick]").forEach(function(btn) {
        btn.addEventListener("click", async function() {
            var entryId = btn.getAttribute("data-entry-id");
            var matchId = btn.getAttribute("data-match-id");
            var label = btn.getAttribute("data-match-label") || "Partido";
            var current = btn.getAttribute("data-current-pick") || null;
            await editSinglePick(entryId, matchId, label, current);
        });
    });
}

function attachPickStatusPhysicalEvents() {
    document.querySelectorAll(".pick-status-physical").forEach(function(btn) {
        btn.addEventListener("click", async function() {
            var pid = btn.getAttribute("data-participant-id");
            var eid = btn.getAttribute("data-entry-id");
            var poolId = $("pickPool").value;
            await showPhysicalTicket(poolId, pid, eid);
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

/**
 * Comprobante Campeón de Goleó — Canvas 2D nativo.
 */
function drawGoleoReceiptCanvas(opts) {
    opts = opts || {};
    var pool = opts.pool || {};
    var participant = opts.participant || {};
    var predictedGoals = Number(opts.predictedGoals || 0);
    var logoImg = opts.logoImg || null;
    var paid = !!opts.paid;

    var W = 900;
    var H = 1100;
    var scale = 2;
    var canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el canvas");
    ctx.scale(scale, scale);

    // Fondo dark premium
    var bg = ctx.createRadialGradient(W / 2, 80, 20, W / 2, H * 0.4, H * 0.9);
    bg.addColorStop(0, "#1a1205");
    bg.addColorStop(0.45, "#0a0c10");
    bg.addColorStop(1, "#050810");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    function glow(x, y, r, c) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, c);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    glow(W / 2, 280, 260, "rgba(251,191,36,0.16)");
    glow(60, 40, 160, "rgba(16,185,129,0.10)");

    // Línea top ámbar
    var lg = ctx.createLinearGradient(W * 0.12, 0, W * 0.88, 0);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, "#fbbf24");
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(W * 0.12, 0, W * 0.76, 3);

    var y = 48;
    ctx.textAlign = "center";
    if (logoImg && logoImg.naturalWidth > 0) {
        try {
            ctx.drawImage(logoImg, W / 2 - 32, y, 64, 64);
            y += 78;
        } catch (e) {
            y += 12;
        }
    } else {
        ctx.font = "36px Arial";
        ctx.fillText("⚽", W / 2, y + 36);
        y += 56;
    }

    ctx.fillStyle = "#34d399";
    ctx.font = "800 13px Arial";
    ctx.fillText("QUINIELA ARCÁNGEL", W / 2, y);
    y += 36;

    ctx.fillStyle = "#fbbf24";
    ctx.font = "900 34px Arial";
    ctx.fillText("⚽ Campeón de Goleó", W / 2, y);
    y += 36;

    var jornada = pool.round != null && pool.round !== ""
        ? ("Jornada " + pool.round)
        : (pool.name || "Jornada");
    var meta = jornada +
        (pool.competition ? "  ·  " + pool.competition : "") +
        (pool.season ? "  ·  " + pool.season : "");
    ctx.fillStyle = "#9ca3af";
    ctx.font = "600 15px Arial";
    ctx.fillText(meta, W / 2, y);
    y += 28;

    if (pool.date_label) {
        ctx.fillStyle = "#6b7280";
        ctx.font = "600 13px Arial";
        ctx.fillText(pool.date_label, W / 2, y);
        y += 24;
    }
    y += 16;

    // Card participante
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    roundRect(ctx, 80, y, W - 160, 120, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 26px Arial";
    ctx.fillText(participant.name || "Participante", W / 2, y + 48);
    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 15px Arial";
    ctx.fillText(participant.area || "Sin área", W / 2, y + 76);
    ctx.fillStyle = paid ? "#34d399" : "#fbbf24";
    ctx.font = "700 13px Arial";
    ctx.fillText(paid ? "Boleto pagado ✅" : "Boleto pendiente ⏳", W / 2, y + 102);
    y += 150;

    // Big goals number
    ctx.fillStyle = "rgba(251,191,36,0.10)";
    ctx.strokeStyle = "rgba(251,191,36,0.40)";
    ctx.lineWidth = 2;
    roundRect(ctx, 140, y, W - 280, 220, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "700 16px Arial";
    ctx.fillText("PRONÓSTICO DE GOLES TOTALES", W / 2, y + 42);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 96px Arial";
    ctx.fillText(String(predictedGoals), W / 2, y + 140);

    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 16px Arial";
    ctx.fillText("goles en la jornada", W / 2, y + 180);
    y += 250;

    // Nota
    ctx.fillStyle = "#6b7280";
    ctx.font = "600 14px Arial";
    ctx.fillText("Gana quien acierte exactamente el total de goles de la jornada.", W / 2, y);
    y += 28;
    if (pool.price != null) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "700 15px Arial";
        ctx.fillText("Costo: $" + pool.price, W / 2, y);
    }

    // Footer
    var fy = H - 70;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(W * 0.18, fy - 12);
    ctx.lineTo(W * 0.82, fy - 12);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 16px Arial";
    ctx.fillText("¡Suerte! 🏆", W / 2, fy + 14);
    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 12px Arial";
    ctx.fillText("Quiniela Arcángel — Pasión X Ganar", W / 2, fy + 36);

    return canvas;
}

async function exportParticipantPickImage(poolId, participantId, entryId) {
    hideAlert();

    if (!poolId || !participantId) {
        return showAlert("Falta jornada o participante.", "error");
    }

    try {
        const pool = await getPoolInfo(poolId);
        var isGoleo = pool && String(pool.mode_code || "").toUpperCase() === "GOLEO";

        const {
            data: participant,
            error: pErr
        } = await supabaseClient
        .from("participants")
        .select("id, name, area, whatsapp")
        .eq("id", participantId)
        .maybeSingle();

        if (pErr) return showAlert(pErr.message, "error");
        if (!participant) return showAlert("Participante no encontrado.", "error");

        var entryQuery = supabaseClient.from("entries")
        .select("id, participant_id, pool_id, created_at, paid")
        .eq("pool_id", poolId)
        .eq("participant_id", participantId)
        .order("created_at", {
            ascending: true
        });

        const {
            data: allEntries,
            error: eErr
        } = await entryQuery;
        if (eErr) return showAlert(eErr.message, "error");
        if (!allEntries || !allEntries.length) return showAlert("Ese participante no tiene boleto en esta jornada.", "error");

        var entry = entryId
        ? allEntries.find(function(e) {
            return e.id === entryId;
        }) || allEntries[allEntries.length - 1]: allEntries[allEntries.length - 1];
        var boletaNum = allEntries.findIndex(function(e) {
            return e.id === entry.id;
        }) + 1;
        var totalBoletas = allEntries.length;

        // ── GOLEÓ: comprobante Canvas 2D ──
        if (isGoleo) {
            var { data: gPred, error: gErr } = await supabaseClient
                .from("predictions_goals_total")
                .select("predicted_goals")
                .eq("entry_id", entry.id)
                .maybeSingle();
            if (gErr) return showAlert(gErr.message, "error");
            if (!gPred || gPred.predicted_goals == null) {
                return showAlert("Aún no hay pronóstico de goles guardado para este boleto.", "error");
            }

            var logoImg = typeof loadLogoImage === "function" ? await loadLogoImage() : null;
            var canvasG = drawGoleoReceiptCanvas({
                pool: pool,
                participant: participant,
                predictedGoals: gPred.predicted_goals,
                logoImg: logoImg,
                paid: !!entry.paid
            });

            const aG = document.createElement("a");
            const safeNameG = (participant.name || "goleo")
                .replace(/[áàäâ]/gi, "a").replace(/[éèëê]/gi, "e")
                .replace(/[íìïî]/gi, "i").replace(/[óòöô]/gi, "o")
                .replace(/[úùüû]/gi, "u").replace(/[ñ]/gi, "n")
                .replace(/[^a-zA-Z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .toLowerCase();
            const safeJG = pool && pool.round ? "J" + pool.round : "Jornada";
            aG.download = safeNameG + "-" + safeJG + "-goleo.png";
            aG.href = canvasG.toDataURL("image/png");
            aG.click();
            showAlert("Comprobante Goleó generado ✅ (" + gPred.predicted_goals + " goles)", "ok");
            return;
        }

        // ── SENCILLA / 1X2 ──
        await ensureExportLibraries();

        const {
            data: matches,
            error: mErr
        } = await supabaseClient
        .from("matches")
        .select("id, match_no, home_team, away_team")
        .eq("pool_id", poolId)
        .order("match_no", {
            ascending: true
        });

        if (mErr) return showAlert(mErr.message, "error");

        const {
            data: picks,
            error: pkErr
        } = await supabaseClient
        .from("predictions_1x2")
        .select("match_id, pick")
        .eq("entry_id", entry.id);

        if (pkErr) return showAlert(pkErr.message, "error");

        const pickMap = new Map(
            (picks || []).map(function(p) {
                return [p.match_id, p.pick];
            })
        );

        // Goleó hermano emparejado 1:1 con esta boleta Sencilla (por orden de creación)
        var goleoOnTicket = null;
        try {
            var sibling = await findSiblingGoleoPool(pool);
            if (sibling && sibling.id) {
                var pair = await getGoleoPairingForSencilla(poolId, sibling.id, participantId, entry.id);
                var gEnt = pair.pairedGoleo;
                if (gEnt && gEnt.id) {
                    var { data: gP } = await supabaseClient.from("predictions_goals_total")
                        .select("predicted_goals")
                        .eq("entry_id", gEnt.id)
                        .maybeSingle();
                    if (gP && gP.predicted_goals != null) {
                        goleoOnTicket = {
                            predicted: gP.predicted_goals,
                            price: sibling.price
                        };
                    }
                }
            }
        } catch (e) { /* ignore */ }

        const printArea = $("printArea");
        printArea.classList.remove("hidden");
        printArea.innerHTML = "";

        var logoBase64 = QUINIELA_LOGO_URL;
        try {
            var logoResp = await fetch(QUINIELA_LOGO_URL);
            var logoBlob = await logoResp.blob();
            logoBase64 = await new Promise(function(res) {
                var reader = new FileReader();
                reader.onload = function() {
                    res(reader.result);
                };
                reader.readAsDataURL(logoBlob);
            });
        } catch(logoErr) {
            console.warn("Logo preload failed:", logoErr);
        }

        const card = makePickedTicketCard( {
            pool: pool,
            participant: participant,
            matches: matches || [],
            pickMap: pickMap,
            logoUrl: logoBase64,
            boletaNum: boletaNum,
            totalBoletas: totalBoletas,
            goleoOnTicket: goleoOnTicket
        });

        printArea.appendChild(card);

        const canvas = await html2canvas(card, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        const a = document.createElement("a");
        const safeName = (participant.name || "boleto")
        .replace(/[áàäâ]/gi, "a").replace(/[éèëê]/gi, "e")
        .replace(/[íìïî]/gi, "i").replace(/[óòöô]/gi, "o")
        .replace(/[úùüû]/gi, "u").replace(/[ñ]/gi, "n")
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase();
        const safeJornada = pool && pool.round ? "J" + pool.round: (pool && pool.name ? pool.name: "Jornada");
        const boletaSuffix = totalBoletas > 1 ? "-Boleta" + boletaNum: "";

        a.download = safeName + "-" + safeJornada + boletaSuffix + ".png";
        a.href = canvas.toDataURL("image/png");
        a.click();

        printArea.innerHTML = "";
        printArea.classList.add("hidden");

        var extra = goleoOnTicket ? " + Goleó (" + goleoOnTicket.predicted + ")" : "";
        showAlert("Imagen del boleto generada ✅" + extra, "ok");
    } catch (err) {
        showAlert("Error generando boleto: " + (err?.message || err), "error");
    }
}

function makePickedTicketCard(opts) {
    var pool = opts.pool || {};
    var participant = opts.participant || {};
    var matches = opts.matches || [];
    var pickMap = opts.pickMap || new Map();
    var logoUrl = opts.logoUrl || (typeof QUINIELA_LOGO_URL !== "undefined" ? QUINIELA_LOGO_URL: "");
    var boletaNum = opts.boletaNum || 1;
    var totalBoletas = opts.totalBoletas || 1;
    var goleoOnTicket = opts.goleoOnTicket || null;

    var bg = "#ffffff";
    var text = "#111111";
    var sub = "#555555";
    var border = "#e4e4e7";
    var innerBg = "#f9f9fb";
    var softBg = "#f0f0f2";
    var accent = "#059669";
    var selFill = "#111111";

    var card = document.createElement("div");
    card.style.cssText = "width:860px;box-sizing:border-box;background:" + bg + ";color:" + text +
    ";border:1.5px solid " + border + ";border-radius:18px;padding:32px 28px;font-family:Arial,sans-serif;";

    var jornadaText = pool && pool.round ? ("Jornada " + pool.round): (pool && pool.name ? pool.name: "Jornada");
    var dateText = (pool && pool.date_label) ? pool.date_label: "—";
    var priceText = "$" + Number((pool && pool.price) ? pool.price: 20);
    var season = (pool && pool.season) ? pool.season: "";
    var partName = (participant && participant.name) ? participant.name: "";
    var partArea = (participant && participant.area) ? participant.area: "Sin área";
    var firstName = partName.split(" ")[0] || "";

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
    "<div style='display:flex;align-items:center;justify-content:space-between;'>" +
    "<span style='font-size:19px;font-weight:800;color:" + text + ";'>" + partName + "</span>" +
    (totalBoletas > 1 ? "<span style='font-size:11px;font-weight:800;background:#111;color:#fff;padding:3px 10px;border-radius:99px;'>Boleta " + boletaNum + "/" + totalBoletas + "</span>": "") +
    "</div>" +
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

    var boxW = 80,
    boxH = 48,
    logoSz = 28,
    teamFont = "14px";

    matches.forEach(function(m) {
        var pick = pickMap.get(m.id) || "";
        var homeLogo = getTeamLogo(m.home_team);
        var awayLogo = getTeamLogo(m.away_team);

        function box(selected) {
            var bg2 = selected ? selFill: bg;
            var bd2 = selected ? selFill: border;
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
            " style='width:" + logoSz + "px;height:" + logoSz + "px;object-fit:contain;flex:0 0 auto;'>": "") +
        "<span style='font-weight:800;font-size:" + teamFont + ";color:" + text + ";line-height:1.4;white-space:nowrap;'>" +
        m.home_team + "</span>" +
        "</div>" +
        "<div style='display:flex;justify-content:center;align-items:center;'>" + box(pick === "D") + "</div>" +
        "<div style='display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;'>" +
        "<span style='font-weight:800;font-size:" + teamFont + ";color:" + text + ";line-height:1.4;white-space:nowrap;'>" +
        m.away_team + "</span>" +
        (awayLogo ? "<img src='" + awayLogo + "' crossorigin='anonymous'" +
            " style='width:" + logoSz + "px;height:" + logoSz + "px;object-fit:contain;flex:0 0 auto;'>": "") +
        "</div>" +
        "<div style='display:flex;justify-content:center;align-items:center;'>" + box(pick === "A") + "</div>";

        table.appendChild(row);
    });

    card.appendChild(table);

    // Bloque Goleó si el participante también jugó el modo hermano
    if (goleoOnTicket && goleoOnTicket.predicted != null) {
        var goleoDiv = document.createElement("div");
        goleoDiv.style.cssText = "margin-top:16px;padding:14px 16px;border-radius:12px;" +
            "background:#fffbeb;border:1.5px solid #f59e0b;box-sizing:border-box;";
        var gp = goleoOnTicket.price != null ? (" · $" + goleoOnTicket.price) : "";
        goleoDiv.innerHTML =
            "<div style='font-weight:900;font-size:15px;color:#b45309;margin-bottom:6px;'>⚽ Campeón de Goleó" + gp + "</div>" +
            "<div style='font-size:14px;color:#111;font-weight:700;'>Total de goles pronosticado: " +
            "<span style='font-size:22px;font-weight:900;color:#b45309;'>" + goleoOnTicket.predicted + "</span></div>";
        card.appendChild(goleoDiv);
    }

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

    const {
        data: activePool,
        error: findErr
    } = await supabaseClient
    .from("pools")
    .select("id, name, status")
    .eq("status", "open")
    .order("created_at", {
        ascending: false
    })
    .limit(1)
    .maybeSingle();

    if (findErr) return showAlert(findErr.message, "error");

    if (!activePool) {
        return showAlert("No hay jornada activa para cerrar.", "error");
    }

    const ok = confirm(`¿Seguro que quieres cerrar la jornada activa?\n\n${activePool.name}\n\nDespués ya no se podrán registrar boletos ni guardar pronósticos.`);
    if (!ok) return;

    const {
        error
    } = await supabaseClient
    .from("pools")
    .update({
        status: "closed"
    })
    .eq("id", activePool.id);

    if (error) return showAlert(error.message, "error");

    var goleoNote = "";
    try {
        goleoNote = await onGoleoPoolClosed(activePool.id);
    } catch (e) {
        console.warn(e);
    }

    showAlert("Jornada cerrada ✅" + (goleoNote || ""), "ok");

    await loadPools();
    await loadDashboardSummary();
    await fillEntryPoolsSelect();
    await fillPickPoolsSelect();
    await fillStandingsPoolsSelect();
    await fillResultsPoolsSelect();
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
}

// Función Reabrir Quiniela
async function openLatestClosedPool() {
    hideAlert();

    const {
        data: closedPool,
        error: findErr
    } = await supabaseClient
    .from("pools")
    .select("id, name, status, mode_code")
    .eq("status", "closed")
    .order("created_at", {
        ascending: false
    })
    .limit(1)
    .maybeSingle();

    if (findErr) return showAlert(findErr.message, "error");
    if (!closedPool) return showAlert("No hay jornada cerrada para reabrir.", "error");

    const mode = closedPool.mode_code || "SENCILLA";
    const modeLabel = formatModeLabel(mode);

    const ok = confirm(
        "¿Reabrir esta jornada?\n\n" +
        closedPool.name + "\n" +
        "Modo: " + modeLabel + "\n\n" +
        "Solo se cerrarán otras del mismo modo."
    );
    if (!ok) return;

    // Listar y cerrar solo las abiertas del mismo modo
    const {
        data: toCloseReopen
    } = await supabaseClient
    .from("pools")
    .select("id, mode_code")
    .eq("status", "open")
    .eq("mode_code", mode)
    .neq("id", closedPool.id);

    await supabaseClient
    .from("pools")
    .update({
        status: "closed"
    })
    .eq("status", "open")
    .eq("mode_code", mode)
    .neq("id", closedPool.id);

    var goleoNotesRe = [];
    if (toCloseReopen && toCloseReopen.length) {
        for (var ri = 0; ri < toCloseReopen.length; ri++) {
            try {
                var n = await onGoleoPoolClosed(toCloseReopen[ri].id);
                if (n) goleoNotesRe.push(n.trim());
            } catch (e) {
                console.warn(e);
            }
        }
    }

    const {
        error
    } = await supabaseClient
    .from("pools")
    .update({
        status: "open"
    })
    .eq("id", closedPool.id);

    if (error) return showAlert(error.message, "error");

    var extraRe = goleoNotesRe.length ? (" " + goleoNotesRe.join(" ")) : "";
    showAlert("Jornada reabierta ✅ (" + modeLabel + ")" + extraRe, "ok");

    await loadPools();
    await loadDashboardSummary();
    await fillEntryPoolsSelect();
    await fillPickPoolsSelect();
    await fillStandingsPoolsSelect();
    await fillResultsPoolsSelect();
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
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
    const {
        data: poolInfo,
        error: poolErr
    } = await supabaseClient
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
        paid_at: paid ? new Date().toISOString(): null
    };

    const {
        error
    } = await supabaseClient
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
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
}

//Lista Boletos Pagados
async function loadEntriesAndStats() {
    const pool_id = $("entryPool").value;
    if (!pool_id) return;

    // Stats desde vista pool_stats
    const {
        data: stats,
        error: stErr
    } = await supabaseClient
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
    const {
        data: poolInfo,
        error: poolErr
    } = await supabaseClient
    .from("pools")
    .select("id, status, name")
    .eq("id", pool_id)
    .maybeSingle();

    if (poolErr) return showAlert(poolErr.message, "error");

    // Total de partidos en la jornada
    const {
        count: totalMatches,
        error: matchesCountErr
    } = await supabaseClient
    .from("matches")
    .select("*", {
        count: "exact", head: true
    })
    .eq("pool_id", pool_id);

    if (matchesCountErr) return showAlert(matchesCountErr.message, "error");

    // Lista de entries
    const {
        data: rows,
        error
    } = await supabaseClient
    .from("entries")
    .select("id, paid, paid_at, created_at, participant_id, participants(name, area), pools(name)")
    .eq("pool_id", pool_id)
    .order("created_at", {
        ascending: false
    })
    .limit(300);

    if (error) return showAlert(error.message, "error");

    const entryIds = (rows || []).map(function(r) {
        return r.id;
    });

    // Picks para esos entries
    let picks = [];
    if (entryIds.length) {
        const {
            data: picksData,
            error: picksErr
        } = await supabaseClient
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
        ticketNumberMap.set(r.id, {
            num: seq, total: ticketTotalMap.get(pid)
        });
    });

    $("entriesList").innerHTML = (rows || []).map(function(r) {
        const paidStatus = r.paid ? "paid": "pending";
        const pickCount = Number(picksCountByEntry.get(r.id) || 0);
        const tInfo = ticketNumberMap.get(r.id);
        const boleta = tInfo && tInfo.total > 1
        ? ` <span style="font-size:10px;padding:2px 7px;border-radius:99px;background:rgba(6,182,212,.15);color:#67e8f9;border:1px solid rgba(6,182,212,.3);font-weight:700;">Boleta #${tInfo.num}</span>`: "";

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
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300": "bg-zinc-700/20 border-zinc-600/30 text-zinc-200";

        const actionBtn = isClosed
        ? `
        <button
        type="button"
        class="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-500 text-sm cursor-not-allowed"
        disabled>
        🔒
        </button>
        `: r.paid
        ? `
        <button
        type="button"
        class="entry-mark-pending px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
        data-entry-id="${r.id}">
        ↩️ Pendiente
        </button>
        `: `
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
        data-name="${String(r.participants?.name || "").toLowerCase()}"
        data-area="${String(r.participants?.area || "").trim()}">

        <div class="min-w-0">
        <div class="font-semibold flex items-center gap-2 flex-wrap">${r.participants?.name || "—"}${boleta}</div>

        <div class="text-xs text-zinc-400 mt-1">
        ${new Date(r.created_at).toLocaleString("es-MX")}
        ${r.paid && r.paid_at ? " • Pagó: " + new Date(r.paid_at).toLocaleString("es-MX"): ""}
        </div>

        <div class="text-xs mt-1 ${picksTextClass}">
        ${picksEmoji} Picks ${pickCount}/${matchesTotal}
        </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs px-2 py-1 rounded-full border ${badge}">
        ${r.paid ? "Pagado": "Pendiente"}
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
    const {
        data,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, status, round, competition, season, price, mode_code")
    .order("created_at", {
        ascending: false
    })
    .limit(50);

    if (error) return showAlert(error.message, "error");

    const sel = $("tplPool");
    if (!sel) return;
    sel.innerHTML = (data || []).map(function(p) {
        return '<option value="' + p.id + '">' + escapeHTML(formatPoolOptionLabel(p)) + '</option>';
    }).join("");

    refreshPremiumSelect("tplPool");
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
        $("alert").scrollIntoView({
            behavior: "smooth", block: "center"
        });
        return;
    }

    const rows = [];

    for (let i = 1; i <= n; i++) {
        const home = document.querySelector(`[data-home="${i}"]`)?.value?.trim();
        const away = document.querySelector(`[data-away="${i}"]`)?.value?.trim();

        if (!home || !away) {
            $("tplSavedStatus").textContent = `Falta capturar Local/Visita en partido #${i}`;
            showAlert(`Falta Local o Visita en partido #${i}`, "error");
            $("alert").scrollIntoView({
                behavior: "smooth", block: "center"
            });
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
        el.onclick = () => {
            el.style.display = "none";
        };
    }

    try {
        // Estrategia fila por fila: UPDATE si existe, INSERT si no.
        // Evita locks de transacciones anteriores y no requiere unique constraint.
        for (const row of rows) {
            // 1) Intentar UPDATE
            const {
                data: updated,
                error: updErr
            } = await withTimeout(
                supabaseClient
                .from("matches")
                .update({
                    home_team: row.home_team, away_team: row.away_team
                })
                .eq("pool_id", row.pool_id)
                .eq("match_no", row.match_no)
                .select("id"),
                8000,
                `UPDATE partido #${row.match_no}`
            );
            if (updErr) throw new Error(`UPDATE partido #${row.match_no}: ${updErr.message}`);

            // 2) Si no actualizó ninguna fila, hacer INSERT
            if (!updated || updated.length === 0) {
                const {
                    error: insErr
                } = await withTimeout(
                    supabaseClient.from("matches").insert(row),
                    8000,
                    `INSERT partido #${row.match_no}`
                );
                if (insErr) throw new Error(`INSERT partido #${row.match_no}: ${insErr.message}`);
            }
        }

        $("tplSavedStatus").textContent = `Plantilla guardada: ${rows.length} partidos ✅`;
        showAlert(`Plantilla de ${rows.length} partidos guardada ✅`, "ok");
        $("alert").scrollIntoView({
            behavior: "smooth", block: "center"
        });

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
        const {
            error
        } = await supabaseClient
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

        clearNavBadgesCache();
        await updateNavBadges( {
            force: true
        });

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

async function getPoolInfo(pool_id) {
    const {
        data,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, round, competition, season, price, date_label, mode_code, status")
    .eq("id", pool_id)
    .maybeSingle();
    if (error) throw error;
    return data;
}

/** Busca pool hermano GOLEO de la misma jornada (round + competition + season).
 *  Solo open o draft (no cerrados). */
async function findSiblingGoleoPool(sourcePool) {
    if (!sourcePool || sourcePool.round == null || sourcePool.round === "") return null;
    var q = supabaseClient
        .from("pools")
        .select("id, name, mode_code, status, price, round")
        .eq("round", sourcePool.round)
        .eq("mode_code", "GOLEO")
        .in("status", ["open", "draft"]);
    if (sourcePool.id) q = q.neq("id", sourcePool.id);
    if (sourcePool.competition) q = q.eq("competition", sourcePool.competition);
    if (sourcePool.season) q = q.eq("season", sourcePool.season);
    var { data, error } = await q.order("status", { ascending: true }).limit(5);
    if (error || !data || !data.length) return null;
    var open = data.find(function(p) { return p.status === "open"; });
    var draft = data.find(function(p) { return p.status === "draft"; });
    return open || draft || null;
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

async function getMatches(pool_id) {
    const {
        data,
        error
    } = await supabaseClient
    .from("matches")
    .select("match_no, home_team, away_team")
    .eq("pool_id", pool_id)
    .order("match_no", {
        ascending: true
    });
    if (error) throw error;
    return data || [];
}

// ===================
// Construcción Quiniela Arcángel

function makeTemplateCard(opts) {
    const title = opts.title;
    const subtitle = opts.subtitle;
    const jornadaText = opts.jornadaText;
    const dateText = opts.dateText;
    const priceText = opts.priceText;
    const matches = opts.matches || [];
    const exportMode = opts.exportMode === true;
    const showFooterInfo = opts.showFooterInfo !== false;
    const showGoleo = opts.showGoleo === true;
    const goleoPrice = opts.goleoPrice != null ? opts.goleoPrice : "";

    // ── Paleta ──
    const bg = exportMode ? "#ffffff": "#0b0f14";
    const text = exportMode ? "#111111": "#e5e7eb";
    const sub = exportMode ? "#555555": "#8a94a6";
    const border = exportMode ? "#e4e4e7": "#1f2937";
    const innerBg = exportMode ? "#f9f9fb": "#0a0e13";
    const softBg = exportMode ? "#f0f0f2": "#111827";
    const accentClr = exportMode ? "#059669": "#34d399";
    // Goleó accents
    const goleoBorder = exportMode ? "#f59e0b": "rgba(245,158,11,.45)";
    const goleoBg = exportMode ? "#fffbeb": "rgba(245,158,11,.08)";
    const goleoTitle = exportMode ? "#b45309": "#fbbf24";
    const goleoLine = exportMode ? "#333333": "#9ca3af";

    const card = document.createElement("div");
    card.style.cssText = [
        "box-sizing:border-box",
        "font-family:Arial,sans-serif",
        "border-radius:" + (exportMode ? "18px": "14px"),
        "border:1.5px solid " + border,
        "background:" + bg,
        "color:" + text,
        "padding:" + (exportMode ? "32px 28px": "14px"),
        "width:" + (exportMode ? "860px": "360px"),
        "max-width:100%"
    ].join(";");

    // ── HEADER: logo + título ──
    const logoSize = exportMode ? 72: 50;
    const goleoPriceHtml = goleoPrice
        ? (' <span style="font-weight:700;color:' + accentClr + ';">(' + goleoPrice + ')</span>')
        : "";

    const goleoBlockHtml = showGoleo ? `
    <div style="margin-top:${exportMode ? "16px" : "10px"};margin-bottom:${exportMode ? "4px" : "2px"};padding:${exportMode ? "14px 16px" : "10px 12px"};border:1.5px solid ${goleoBorder};border-radius:12px;background:${goleoBg};">
      <div style="display:flex;align-items:center;gap:${exportMode ? "10px" : "8px"};margin-bottom:${exportMode ? "10px" : "6px"};">
        <div style="width:${exportMode ? "22px" : "16px"};height:${exportMode ? "22px" : "16px"};border:2px solid ${goleoLine};border-radius:5px;background:${innerBg};flex-shrink:0;box-sizing:border-box;"></div>
        <div style="font-weight:900;font-size:${exportMode ? "15px" : "12px"};color:${goleoTitle};line-height:1.2;">
          ⚽ Campeón de Goleó${goleoPriceHtml}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:${exportMode ? "12px" : "8px"};">
        <div style="font-weight:700;font-size:${exportMode ? "13px" : "11px"};color:${text};white-space:nowrap;">Total de goles de la jornada:</div>
        <div style="flex:1;height:${exportMode ? "28px" : "22px"};border:1.5px solid ${border};border-radius:8px;background:${innerBg};"></div>
      </div>
      <div style="margin-top:${exportMode ? "8px" : "5px"};font-size:${exportMode ? "11px" : "9px"};color:${sub};line-height:1.35;">
        Marca la casilla si también juegas Goleó y escribe tu predicción de goles totales.
      </div>
    </div>` : "";

    card.innerHTML = `
    <div style="display:flex;align-items:center;gap:${exportMode?"16px": "10px"};margin-bottom:${exportMode?"18px": "10px"};">
    <img src="${typeof QUINIELA_LOGO_URL !== "undefined"?QUINIELA_LOGO_URL: ""}"
    alt="" crossorigin="anonymous"
    style="width:${logoSize}px;height:${logoSize}px;object-fit:contain;flex:0 0 auto;border-radius:10px;"/>
    <div>
    <div style="font-weight:900;font-size:${exportMode?"26px": "15px"};color:${text};line-height:1.1;">${title}</div>
    <div style="font-size:${exportMode?"13px": "10px"};color:${sub};margin-top:4px;">${subtitle}</div>
    </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 100px;gap:10px;margin-bottom:${exportMode?"18px": "10px"};">
    <div style="border:1px solid ${border};border-radius:10px;padding:${exportMode?"10px 8px": "7px"};text-align:center;background:${innerBg};">
    <div style="font-size:${exportMode?"10px": "9px"};color:${sub};text-transform:uppercase;letter-spacing:.6px;">Jornada</div>
    <div style="font-weight:800;font-size:${exportMode?"15px": "12px"};color:${text};margin-top:4px;">${jornadaText}</div>
    </div>
    <div style="border:1px solid ${border};border-radius:10px;padding:${exportMode?"10px 8px": "7px"};text-align:center;background:${innerBg};">
    <div style="font-size:${exportMode?"10px": "9px"};color:${sub};text-transform:uppercase;letter-spacing:.6px;">Fechas</div>
    <div style="font-weight:800;font-size:${exportMode?"15px": "12px"};color:${text};margin-top:4px;">${dateText}</div>
    </div>
    <div style="border:1px solid ${border};border-radius:10px;padding:${exportMode?"10px 8px": "7px"};text-align:center;background:${innerBg};">
    <div style="font-size:${exportMode?"10px": "9px"};color:${sub};text-transform:uppercase;letter-spacing:.6px;">Costo</div>
    <div style="font-weight:900;font-size:${exportMode?"16px": "13px"};color:${accentClr};margin-top:4px;">$${Number(priceText || 0)}</div>
    </div>
    </div>

    <div style="text-align:center;font-size:${exportMode?"11px": "9px"};color:${sub};margin-bottom:${exportMode?"10px": "6px"};">
    Marca una sola opción por partido
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:${exportMode?"14px": "8px"};margin-bottom:${exportMode?"12px": "8px"};">
    <div style="text-align:center;font-size:${exportMode?"11px": "9px"};font-weight:800;color:${sub};background:${softBg};padding:${exportMode?"7px": "5px"};border-radius:8px;letter-spacing:.5px;">LOCAL</div>
    <div style="text-align:center;font-size:${exportMode?"11px": "9px"};font-weight:800;color:${sub};background:${softBg};padding:${exportMode?"7px": "5px"};border-radius:8px;letter-spacing:.5px;">EMPATE</div>
    <div style="text-align:center;font-size:${exportMode?"11px": "9px"};font-weight:800;color:${sub};background:${softBg};padding:${exportMode?"7px": "5px"};border-radius:8px;letter-spacing:.5px;">VISITA</div>
    </div>

    <div class="qh-table" style="display:grid;gap:${exportMode?"10px": "7px"};"></div>

    ${goleoBlockHtml}

    ${showFooterInfo ? `
    <div style="margin-top:${exportMode?"16px": "10px"};padding:${exportMode?"14px 16px": "9px 10px"};border:1px solid ${border};border-radius:12px;background:${softBg};font-size:${exportMode?"12px": "9px"};line-height:1.6;color:${text};">
    <div style="font-weight:700;">Devolver con tu pronóstico rellenado, tu nombre y tu área al WhatsApp: <strong>8715118046</strong></div>
    <div style="margin-top:4px;"><strong>Fecha límite de registro de pronósticos:</strong> Viernes 05:00 PM</div>
    <div style="margin-top:4px;font-weight:800;">Boleto pagado, boleto jugado. &nbsp;¡Suerte!</div>
    </div>`: ""}
    `;

    const table = card.querySelector(".qh-table");

    // ── Dimensiones de casilla y logo según modo ──
    const boxW = exportMode ? 80: 50;
    const boxH = exportMode ? 48: 32;
    const logoSzRow = exportMode ? 28: 17;
    const teamFont = exportMode ? "14px": "11px";
    const colGap = exportMode ? "10px": "6px";

    matches.forEach(function(m) {
        const homeLogo = getTeamLogo(m.home_team);
        const awayLogo = getTeamLogo(m.away_team);

        const boxStyle = `width:${boxW}px;height:${boxH}px;border:1.5px solid ${border};border-radius:8px;background:${innerBg};flex:0 0 auto;`;

        const row = document.createElement("div");
        row.style.cssText = `display:grid;grid-template-columns:${boxW}px 1fr ${boxW}px 1fr ${boxW}px;align-items:center;column-gap:${colGap};min-height:${exportMode?52: 36}px;`;

        row.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;">
        <div style="${boxStyle}"></div>
        </div>

        <div style="display:flex;align-items:center;gap:${exportMode?"8px": "5px"};min-width:0;overflow:hidden;">
        ${homeLogo?`<img src="${homeLogo}" crossorigin="anonymous" style="width:${logoSzRow}px;height:${logoSzRow}px;object-fit:contain;flex:0 0 auto;">`: ""}
        <span style="font-weight:800;font-size:${teamFont};color:${text};white-space:nowrap;overflow:visible;letter-spacing:.2px;line-height:1.4;padding-bottom:2px;">${m.home_team}</span>
        </div>

        <div style="display:flex;justify-content:center;align-items:center;">
        <div style="${boxStyle}"></div>
        </div>

        <div style="display:flex;align-items:center;justify-content:flex-end;gap:${exportMode?"8px": "5px"};min-width:0;overflow:hidden;">
        <span style="font-weight:800;font-size:${teamFont};color:${text};white-space:nowrap;overflow:visible;letter-spacing:.2px;line-height:1.4;padding-bottom:2px;">${m.away_team}</span>
        ${awayLogo?`<img src="${awayLogo}" crossorigin="anonymous" style="width:${logoSzRow}px;height:${logoSzRow}px;object-fit:contain;flex:0 0 auto;">`: ""}
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

    const {
        data: matches,
        error
    } = await supabaseClient
    .from("matches")
    .select("match_no, home_team, away_team")
    .eq("pool_id", pool_id)
    .order("match_no", {
        ascending: true
    });

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

    let pool,
    matches;
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

    var goleoSibling = null;
    var isGoleoTemplate = pool && String(pool.mode_code || "").toUpperCase() === "GOLEO";
    if (!isGoleoTemplate) {
        try {
            goleoSibling = await findSiblingGoleoPool(pool);
        } catch (e) { /* ignore */ }
    }

    const card = makeTemplateCard( {
        title: "Quiniela Arcángel",
        subtitle: `"Pasión X Ganar" ⚽ ${pool?.season || ""}`.trim(),
        jornadaText: pool?.round ? `Jornada ${pool.round}`: (pool?.name || "Jornada"),
        dateText: (pool?.date_label || "FECHAS"),
        priceText: Number(pool?.price || 20),
        matches,
        exportMode: false,
        showGoleo: !!goleoSibling,
        goleoPrice: goleoSibling && goleoSibling.price != null ? ("$" + goleoSibling.price) : ""
    });

    wrap.appendChild(card);
    var goleoNote = goleoSibling ? " · + Goleó" : "";
    $("tplSavedStatus").textContent = `Plantilla guardada: ${matches.length} partidos` + goleoNote;
}

async function exportAllToPDF() {
    await ensureExportLibraries( {
        pdf: true
    });
    hideAlert();

    // trae pools que tengan plantilla
    const {
        data: pools,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, round, season, price, date_label, created_at")
    .order("created_at", {
        ascending: true
    })
    .limit(200);

    if (error) return showAlert(error.message, "error");

    // filtra solo pools con matches
    const cards = [];
    for (const p of (pools || [])) {
        const ms = await getMatches(p.id);
        if (!ms.length) continue;

        cards.push(makeTemplateCard( {
            title: "Quiniela Arcángel",
            subtitle: `"Pasión X Ganar" ⚽ ${p.season || ""}`.trim(),
            jornadaText: p.round ? `Jornada ${p.round}`: p.name,
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

    const {
        jsPDF
    } = window.jspdf;
    const pdf = new jsPDF( {
        orientation: "landscape", unit: "pt", format: "a4"
    });

    const perPage = 9; // 5 + 4 (idéntico a tu Excel)
    let pageIndex = 0;

    for (let i = 0; i < cards.length; i += perPage) {
        const chunk = cards.slice(i, i + perPage);

        const sheet = document.createElement("div");
        sheet.className = "sheet";

        const row1 = document.createElement("div");
        row1.className = "sheet-row";
        chunk.slice(0, 5).forEach(c => row1.appendChild(c));
        sheet.appendChild(row1);

        const row2 = document.createElement("div");
        row2.className = "sheet-row second";
        chunk.slice(5, 9).forEach(c => row2.appendChild(c));
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
    await ensureExportLibraries();
    hideAlert();

    const pool_id = $("tplPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada.", "error");

    let pool,
    matches;

    try {
        pool = await getPoolInfo(pool_id);
        matches = await getMatches(pool_id);
    } catch (e) {
        return showAlert(e.message, "error");
    }

    if (!matches || matches.length === 0) {
        return showAlert("Esta jornada no tiene plantilla guardada.", "error");
    }

    // Goleó hermano (open/draft) de la misma jornada — igual que PDF imprimible
    var goleoSibling = null;
    var isGoleoTemplate = pool && String(pool.mode_code || "").toUpperCase() === "GOLEO";
    if (!isGoleoTemplate) {
        try {
            goleoSibling = await findSiblingGoleoPool(pool);
        } catch (e) {
            console.warn("findSiblingGoleoPool exportPNG", e);
        }
    }
    var showGoleo = !!goleoSibling;
    var goleoPrice = goleoSibling && goleoSibling.price != null ? ("$" + goleoSibling.price) : "";

    const printArea = $("printArea");
    printArea.classList.remove("hidden");
    printArea.innerHTML = "";

    // hoja blanca
    const sheet = document.createElement("div");
    sheet.style.background = "#ffffff";
    sheet.style.padding = "20px";
    sheet.style.width = "900px";
    sheet.style.boxSizing = "border-box";

    const card = makeTemplateCard( {
        title: "Quiniela Arcángel",
        subtitle: `"Pasión X Ganar" ⚽ ${pool?.season || ""}`.trim(),
        jornadaText: pool?.round ? `Jornada ${pool.round}`: (pool?.name || "Jornada"),
        dateText: (pool?.date_label || "FECHAS"),
        priceText: Number(pool?.price || 20),
        matches,
        exportMode: true,
        showGoleo: showGoleo,
        goleoPrice: goleoPrice
    });

    sheet.appendChild(card);
    printArea.appendChild(sheet);

    try {
        const canvas = await html2canvas(sheet, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false,
            foreignObjectRendering: false
        });

        const a = document.createElement("a");
        const safeName = (pool?.name || "Plantilla")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");

        a.download = `${safeName}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();

        var extra = showGoleo ? " + Campeón de Goleó" : "";
        showAlert("Imagen generada ✅" + extra, "ok");
    } catch (err) {
        showAlert("Error generando imagen: " + (err?.message || err), "error");
    } finally {
        printArea.innerHTML = "";
        printArea.classList.add("hidden");
    }
}

/**
 * Historia 9:16 — Canvas 2D nativo (sin html2canvas).
 */
function drawStoryTemplateCanvas(opts) {
    opts = opts || {};
    var matches = opts.matches || [];
    var pool = opts.pool || {};
    var showGoleo = !!opts.showGoleo;
    var goleoPrice = opts.goleoPrice || "";
    var logoImg = opts.logoImg || null;

    var W = 1080;
    var H = 1920;
    var padX = 64;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el canvas");

    // Fondo
    var bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
    bg.addColorStop(0, "#050810");
    bg.addColorStop(0.45, "#071220");
    bg.addColorStop(1, "#040c10");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    function glow(x, y, r, c) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, c);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    glow(80, 60, 280, "rgba(16,185,129,0.16)");
    glow(W - 60, H - 100, 240, "rgba(6,182,212,0.10)");

    var y = 72;

    // Logo + marca
    if (logoImg && logoImg.naturalWidth > 0) {
        try {
            ctx.drawImage(logoImg, padX, y, 88, 88);
        } catch (e) { /* ignore */ }
    } else {
        ctx.font = "48px Arial";
        ctx.textAlign = "left";
        ctx.fillText("🏆", padX + 10, y + 60);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 36px Arial";
    ctx.fillText("Quiniela Arcángel", padX + 108, y + 38);
    ctx.fillStyle = "#34d399";
    ctx.font = "600 18px Arial";
    ctx.fillText('"Pasión X Ganar" ⚽ ' + (pool.season || ""), padX + 108, y + 68);
    y += 120;

    // Título jornada
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 68px Arial";
    var jornadaLabel = pool.round != null && pool.round !== ""
        ? ("Jornada " + pool.round)
        : (pool.name || "Jornada");
    ctx.fillText(jornadaLabel, W / 2, y);
    y += 42;
    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 24px Arial";
    ctx.fillText(pool.competition || "Liga MX", W / 2, y);
    y += 48;

    // Chips fechas + precio
    var dateTxt = "📅  " + (pool.date_label || "—");
    var priceTxt = "$" + Number(pool.price || 20) + " por boleto";
    ctx.font = "800 20px Arial";
    var dw = ctx.measureText(dateTxt).width + 48;
    var pw = ctx.measureText(priceTxt).width + 48;
    var chipsGap = 16;
    var chipsTotal = dw + pw + chipsGap;
    var cx0 = (W - chipsTotal) / 2;

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx0, y, dw, 48, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.font = "800 20px Arial";
    ctx.fillText(dateTxt, cx0 + dw / 2, y + 31);

    var px = cx0 + dw + chipsGap;
    var pGrad = ctx.createLinearGradient(px, y, px + pw, y + 48);
    pGrad.addColorStop(0, "#059669");
    pGrad.addColorStop(1, "#10b981");
    ctx.fillStyle = pGrad;
    roundRect(ctx, px, y, pw, 48, 24);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 20px Arial";
    ctx.fillText(priceTxt, px + pw / 2, y + 31);
    y += 72;

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 28;

    // Headers
    ctx.fillStyle = "#34d399";
    ctx.font = "800 15px Arial";
    ctx.textAlign = "left";
    ctx.fillText("LOCAL", padX + 8, y);
    ctx.textAlign = "right";
    ctx.fillText("VISITA", W - padX - 8, y);
    y += 22;

    // Filas
    var n = matches.length || 1;
    var availableH = H - y - (showGoleo ? 220 : 160) - 40;
    var rowH = Math.min(58, Math.max(40, Math.floor(availableH / n)));
    var teamFont = rowH >= 52 ? 20 : 17;

    matches.forEach(function(m, i) {
        var ry = y + i * rowH;
        var isEven = i % 2 === 0;
        ctx.fillStyle = isEven ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)";
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = 1;
        roundRect(ctx, padX, ry, W - padX * 2, rowH - 8, 14);
        ctx.fill();
        ctx.stroke();

        var cy = ry + (rowH - 8) / 2 + 6;
        ctx.fillStyle = "#f0f4f8";
        ctx.font = "800 " + teamFont + "px Arial";
        ctx.textAlign = "left";
        var homeName = String(m.home_team || "");
        if (ctx.measureText(homeName).width > 360) {
            while (homeName.length > 3 && ctx.measureText(homeName + "…").width > 360) {
                homeName = homeName.slice(0, -1);
            }
            homeName += "…";
        }
        ctx.fillText(homeName, padX + 18, cy);

        ctx.fillStyle = "#4a5568";
        ctx.font = "700 15px Arial";
        ctx.textAlign = "center";
        ctx.fillText("VS", W / 2, cy);

        ctx.fillStyle = "#f0f4f8";
        ctx.font = "800 " + teamFont + "px Arial";
        ctx.textAlign = "right";
        var awayName = String(m.away_team || "");
        if (ctx.measureText(awayName).width > 360) {
            while (awayName.length > 3 && ctx.measureText(awayName + "…").width > 360) {
                awayName = awayName.slice(0, -1);
            }
            awayName += "…";
        }
        ctx.fillText(awayName, W - padX - 18, cy);
    });
    y += n * rowH + 16;

    // Goleó
    if (showGoleo) {
        ctx.fillStyle = "rgba(245,158,11,0.10)";
        ctx.strokeStyle = "rgba(245,158,11,0.45)";
        ctx.lineWidth = 1.5;
        roundRect(ctx, padX, y, W - padX * 2, 140, 18);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2.5;
        roundRect(ctx, padX + 22, y + 22, 28, 28, 6);
        ctx.stroke();

        ctx.fillStyle = "#fbbf24";
        ctx.font = "900 26px Arial";
        ctx.textAlign = "left";
        var gTitle = "⚽  Campeón de Goleó" + (goleoPrice ? "  (" + goleoPrice + ")" : "");
        ctx.fillText(gTitle, padX + 62, y + 44);

        ctx.fillStyle = "#e5e7eb";
        ctx.font = "700 18px Arial";
        ctx.fillText("Total de goles de la jornada:", padX + 22, y + 88);

        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1.5;
        roundRect(ctx, padX + 300, y + 68, W - padX * 2 - 322, 36, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#8a94a6";
        ctx.font = "600 15px Arial";
        ctx.fillText("Marca si también juegas Goleó y escribe tu predicción.", padX + 22, y + 124);
        y += 160;
    }

    // Footer
    var fy = H - 120;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX + 40, fy - 16);
    ctx.lineTo(W - padX - 40, fy - 16);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 20px Arial";
    ctx.fillText("Envía tu pronóstico al WhatsApp:", W / 2, fy + 8);

    ctx.fillStyle = "#34d399";
    ctx.font = "900 34px Arial";
    ctx.fillText("8715118046", W / 2, fy + 48);

    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 18px Arial";
    ctx.fillText("Fecha límite: Viernes 05:00 PM", W / 2, fy + 78);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 26px Arial";
    ctx.fillText("¡Suerte a todos! 🏆", W / 2, fy + 112);

    return canvas;
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

    if (!matches || !matches.length) return showAlert("Esta jornada no tiene plantilla guardada.", "error");

    var goleoSibling = null;
    var isGoleoTemplate = pool && String(pool.mode_code || "").toUpperCase() === "GOLEO";
    if (!isGoleoTemplate) {
        try {
            goleoSibling = await findSiblingGoleoPool(pool);
        } catch (e) { /* ignore */ }
    }
    var showGoleo = !!goleoSibling;
    var goleoPrice = goleoSibling && goleoSibling.price != null ? ("$" + goleoSibling.price) : "";

    try {
        var logoImg = typeof loadLogoImage === "function" ? await loadLogoImage() : null;
        var canvas = drawStoryTemplateCanvas({
            pool: pool,
            matches: matches,
            showGoleo: showGoleo,
            goleoPrice: goleoPrice,
            logoImg: logoImg
        });

        const a = document.createElement("a");
        const safeName = ((pool && pool.name) || "Plantilla-Historia")
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-");
        a.download = safeName + "-story-9x16.png";
        a.href = canvas.toDataURL("image/png");
        a.click();

        var extra = showGoleo ? " + Goleó" : "";
        showAlert("Historia premium 9:16 generada ✅" + extra, "ok");
    } catch (err) {
        showAlert("Error generando historia: " + (err && err.message ? err.message : err), "error");
    }
}

async function exportAllToPNGs() {
    await ensureExportLibraries();
    hideAlert();

    const {
        data: pools,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, round, season, price, date_label, created_at")
    .order("created_at", {
        ascending: true
    })
    .limit(200);

    if (error) return showAlert(error.message, "error");

    const printArea = $("printArea");
    printArea.classList.remove("hidden");
    printArea.innerHTML = "";

    let count = 0;

    for (const p of (pools || [])) {
        const ms = await getMatches(p.id);
        if (!ms.length) continue;

        const card = makeTemplateCard( {
            title: "Quiniela Arcángel",
            subtitle: `"Pasión X Ganar" ⚽ ${p.season || ""}`.trim(),
            jornadaText: p.round ? `Jornada ${p.round}`: p.name,
            dateText: (p.date_label || "FECHAS"),
            priceText: Number(p.price || 20),
            matches: ms,
            exportMode: true
        });

        printArea.appendChild(card);

        const canvas = await html2canvas(card, {
            scale: 2, backgroundColor: "#0b0f14"
        });
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
    .select("id, name, status, mode_code, created_at")
    .order("created_at", {
        ascending: false
    })
    .limit(50);

    if (poolsRes.error) return showAlert(poolsRes.error.message, "error");

    $("pickPool").innerHTML = (poolsRes.data || []).map(function(p) {
        return '<option value="' + p.id + '">' + escapeHTML(formatPoolOptionLabel(p)) + '</option>';
    }).join("");

    const partsRes = await supabaseClient
    .from("participants")
    .select("id, name, area, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", {
        ascending: false
    })
    .limit(200);

    if (partsRes.error) return showAlert(partsRes.error.message, "error");

    $("pickParticipant").innerHTML = (partsRes.data || []).map(p =>
        `<option value="${p.id}">${p.name}${p.area ? " • " + p.area: ""}</option>`
    ).join("");
}

// =====================
// Funciones Resultados
// =====================

// Selector de Jornadas por Plantillas
async function fillResultsPoolsSelect() {
    const {
        data,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, status, mode_code, created_at")
    .order("created_at", {
        ascending: false
    })
    .limit(50);

    if (error) return showAlert(error.message, "error");

    const sel = $("resultsPool");
    if (!sel) return;
    sel.innerHTML = (data || []).map(function(p) {
        return '<option value="' + p.id + '">' + escapeHTML(formatPoolOptionLabel(p)) + '</option>';
    }).join("");

    const active = (data || []).find(function(p) {
        return p.status === "open";
    });
    if (active) sel.value = active.id;
    else if ((data || []).length) sel.value = data[0].id;

    refreshPremiumSelect("resultsPool");
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
    <div class="flex items-center gap-2">
    <div class="text-zinc-400">Goles: <span data-result-total="${match.id}" class="font-semibold text-zinc-200">${totalGoals}</span></div>
    <button data-save-row="${match.id}" onclick="saveOneResult('${match.id}')"
    class="px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 font-bold text-xs border border-emerald-500/20">
    💾
    </button>
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

    const {
        data: matches,
        error
    } = await supabaseClient
    .from("matches")
    .select("id, match_no, home_team, away_team, home_goals, away_goals")
    .eq("pool_id", pool_id)
    .order("match_no", {
        ascending: true
    });

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
    // Attach input listeners for progress bar
    $("resultsMatchesList").querySelectorAll("input[data-result-home],input[data-result-away]").forEach(function(inp) {
        inp.addEventListener("input", updateResultsGoalsSummary);
    });
    updateResultsGoalsSummary();

    attachResultsInputsEvents();
    updateResultsGoalsSummary();
}

// Actualizar Cálculo Visual Automático
function attachResultsInputsEvents() {
    document.querySelectorAll("[data-result-home], [data-result-away]").forEach(function(inp) {
        inp.addEventListener("input", function() {
            const matchId = inp.hasAttribute("data-result-home")
            ? inp.getAttribute("data-result-home"): inp.getAttribute("data-result-away");

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

// ═══════════════════════════════════════════════
// Sincronizar resultados de partidos a pools hermanos
// (misma jornada/round + competition + season, distinto mode_code)
// Así Sencilla ↔ Goleó (y otros modos) comparten goles reales.
// updates: Array<{ match_no, home_goals, away_goals }>
// ═══════════════════════════════════════════════
async function syncMatchResultsToSiblingPools(sourcePoolId, updates) {
    if (!sourcePoolId || !updates || !updates.length) return { synced: 0, siblings: 0 };

    const { data: sourcePool, error: poolErr } = await supabaseClient
        .from("pools")
        .select("id, round, competition, season, mode_code, name")
        .eq("id", sourcePoolId)
        .maybeSingle();

    if (poolErr || !sourcePool) {
        console.warn("syncMatchResultsToSiblingPools: no se pudo cargar pool origen", poolErr);
        return { synced: 0, siblings: 0 };
    }

    // Seguridad: sin round no sincronizamos (evitar tocar todo el catálogo)
    if (sourcePool.round == null || sourcePool.round === "") {
        return { synced: 0, siblings: 0 };
    }

    let q = supabaseClient
        .from("pools")
        .select("id, name, mode_code, round")
        .neq("id", sourcePoolId)
        .eq("round", sourcePool.round);

    if (sourcePool.competition) {
        q = q.eq("competition", sourcePool.competition);
    }
    if (sourcePool.season) {
        q = q.eq("season", sourcePool.season);
    }

    const { data: siblings, error: sibErr } = await q;
    if (sibErr) {
        console.warn("syncMatchResultsToSiblingPools: error buscando hermanos", sibErr);
        return { synced: 0, siblings: 0 };
    }

    const siblingPools = siblings || [];
    if (!siblingPools.length) {
        return { synced: 0, siblings: 0 };
    }

    let totalSynced = 0;

    for (const sib of siblingPools) {
        const { data: sibMatches, error: mErr } = await supabaseClient
            .from("matches")
            .select("id, match_no, home_goals, away_goals")
            .eq("pool_id", sib.id);

        if (mErr || !sibMatches || !sibMatches.length) continue;

        const byNo = {};
        sibMatches.forEach(function (m) {
            byNo[String(m.match_no)] = m;
        });

        for (const u of updates) {
            if (u.match_no == null) continue;
            const target = byNo[String(u.match_no)];
            if (!target) continue;

            const sameHome = target.home_goals === u.home_goals ||
                (target.home_goals == null && u.home_goals == null);
            const sameAway = target.away_goals === u.away_goals ||
                (target.away_goals == null && u.away_goals == null);
            if (sameHome && sameAway) continue;

            const { error: updErr } = await supabaseClient
                .from("matches")
                .update({
                    home_goals: u.home_goals,
                    away_goals: u.away_goals
                })
                .eq("id", target.id);

            if (updErr) {
                console.warn("syncMatchResultsToSiblingPools: error actualizando match", target.id, updErr);
                continue;
            }
            totalSynced++;
        }
    }

    return { synced: totalSynced, siblings: siblingPools.length };
}


async function saveResultsMatches() {
    hideAlert();

    const pool_id = $("resultsPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada.", "error");

    const {
        data: matches,
        error: loadErr
    } = await supabaseClient
    .from("matches")
    .select("id, match_no")
    .eq("pool_id", pool_id)
    .order("match_no", {
        ascending: true
    });

    if (loadErr) return showAlert(loadErr.message, "error");

    const rows = matches || [];

    if (!rows.length) {
        return showAlert("Esta jornada no tiene partidos cargados.", "error");
    }

    const syncUpdates = [];

    for (let i = 0; i < rows.length; i++) {
        const matchId = rows[i].id;
        const homeVal = document.querySelector(`[data-result-home="${matchId}"]`)?.value;
        const awayVal = document.querySelector(`[data-result-away="${matchId}"]`)?.value;

        const home_goals = homeVal === "" ? null: Number(homeVal);
        const away_goals = awayVal === "" ? null: Number(awayVal);

        const {
            error
        } = await supabaseClient
        .from("matches")
        .update({
            home_goals, away_goals
        })
        .eq("id", matchId);

        if (error) {
            return showAlert("Error guardando partido: " + error.message, "error");
        }

        syncUpdates.push({
            match_no: rows[i].match_no,
            home_goals,
            away_goals
        });
    }

    // Propagar a jornadas hermanas (mismo round/competition/season, otro mode)
    try {
        const syncRes = await syncMatchResultsToSiblingPools(pool_id, syncUpdates);
        if (syncRes && syncRes.synced > 0) {
            showAlert("Resultados guardados ✅ (sincronizados " + syncRes.synced + " en " + syncRes.siblings + " jornada(s) hermana(s))", "ok");
        } else {
            showAlert("Resultados guardados ✅", "ok");
        }
    } catch (syncErr) {
        console.warn("syncMatchResultsToSiblingPools falló", syncErr);
        showAlert("Resultados guardados ✅ (sin sincronizar hermanos)", "ok");
    }

    clearNavBadgesCache();
    await updateNavBadges({ force: true });
}

// =====================
// Funciones Aciertos
// =====================

// Selector Jornadas para Aciertos
async function fillStandingsPoolsSelect() {
    const {
        data,
        error
    } = await supabaseClient
    .from("pools")
    .select("id, name, status, mode_code, created_at")
    .order("created_at", {
        ascending: false
    })
    .limit(50);

    if (error) return showAlert(error.message, "error");

    const sel = $("standingsPool");
    if (!sel) return;
    sel.innerHTML = (data || []).map(function(p) {
        return '<option value="' + p.id + '">' + escapeHTML(formatPoolOptionLabel(p)) + '</option>';
    }).join("");

    const active = (data || []).find(function(p) {
        return p.status === "open";
    });
    if (active) sel.value = active.id;
    else if ((data || []).length) sel.value = data[0].id;

    refreshPremiumSelect("standingsPool");
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
    const activePool = (data || []).find(function(p) {
        return p.status === "open";
    });
    if (activePool) sel.value = activePool.id;
    else if ((data || []).length) sel.value = data[0].id;
}



// Función Ganador Quiniela Sencilla (carga desde Supabase)
async function loadSimpleWinnerSummary(poolId) {
    const pool_id = poolId || $("standingsPool").value;
    if (!pool_id) return null;

    const {
        data: winners,
        error
    } = await supabaseClient
    .from("pool_simple_winner")
    .select("pool_id,entry_id,participant_id,winning_points,winners_count,prize_pool,commission_amount,total_collected,prize_per_winner")
    .eq("pool_id", pool_id);

    if (error) {
        showAlert(error.message, "error"); return null;
    }
    if (!winners || !winners.length) return null;

    const participantIds = winners.map(function(w) {
        return w.participant_id;
    });
    const {
        data: parts,
        error: pErr
    } = await supabaseClient
    .from("participants").select("id, name, area").in("id", participantIds);
    if (pErr) {
        showAlert(pErr.message, "error"); return null;
    }

    const partMap = new Map((parts || []).map(function(p) {
        return [p.id, p];
    }));

    return {
        winners: winners.map(function(w) {
            const p = partMap.get(w.participant_id) || {};
            return {
                participant_id: w.participant_id, name: p.name || "Sin nombre",
                area: p.area || "", winning_points: Number(w.winning_points || 0)
            };
        }),
        winners_count: Number(winners[0].winners_count || 0),
        prize_pool: Number(winners[0].prize_pool || 0),
        commission_amount: Number(winners[0].commission_amount || 0),
        total_collected: Number(winners[0].total_collected || 0),
        prize_per_winner: Math.floor(Number(winners[0].prize_per_winner || 0)),
        winning_points: Number(winners[0].winning_points || 0)
    };
}

// Render caja ganador/lider en la sección Aciertos
function renderSimpleWinnerBox(rows, poolStats, completionInfo, winnerSummary) {
    if (!rows || !rows.length) {
        return '<div class="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-400">Aún no hay datos suficientes para determinar líder o ganador.</div>';
    }

    var prizePool = Number(poolStats?.prize_pool || 0);
    var paidCount = Number(poolStats?.paid_count || 0);
    var totalCollected = Number(poolStats?.total_collected || 0);
    var commissionAmount = Number(poolStats?.commission_amount || 0);
    var isFinished = !!(completionInfo && completionInfo.isFinished);
    var totalMatches = Number(completionInfo?.totalMatches || 0);
    var completedMatches = Number(completionInfo?.completedMatches || 0);
    var progressText = totalMatches ? "Partidos con resultado: " + completedMatches + "/" + totalMatches: "Sin partidos cargados";

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

    var winners = winnerSummary.winners;
    var winnersCount = Number(winnerSummary.winners_count || 0);
    var winningPoints = Number(winnerSummary.winning_points || 0);
    var prizePerWinner = Number(winnerSummary.prize_per_winner || 0);
    var isTie = winnersCount > 1;

    var titleLabel = isTie
    ? (isFinished ? "EMPATE FINAL • QUINIELA SENCILLA": "EMPATE PROVISIONAL • QUINIELA SENCILLA"): (isFinished ? "GANADOR FINAL • QUINIELA SENCILLA": "GANADOR PROVISIONAL • QUINIELA SENCILLA");

    var boxClass = isTie ? "bg-amber-500/10 border-amber-500/20": isFinished ? "bg-sky-500/10 border-sky-500/20": "bg-emerald-500/10 border-emerald-500/20";
    var titleClass = isTie ? "text-amber-300": isFinished ? "text-sky-300": "text-emerald-300";
    var prizeClass = titleClass;

    var winnerNames = winners.map(function(x) {
        return x.name;
    }).join(", ");
    var winnerAreas = [...new Set(winners.map(function(x) {
        return x.area || "";
    }).filter(Boolean))].join(", ");

    return [
        '<div class="p-4 ' + boxClass + ' border rounded-xl">',
        '<div class="text-xs uppercase tracking-wide ' + titleClass + '">' + titleLabel + '</div>',
        '<div class="mt-2 text-xl font-extrabold text-white">' + winnerNames + '</div>',
        '<div class="text-sm text-zinc-300 mt-1">' + (winnerAreas || "Sin área") + ' • ' + winningPoints + ' aciertos</div>',
        '<div class="text-xs text-zinc-400 mt-2">' + progressText + '</div>',
        '<div class="grid grid-cols-2 gap-2 mt-4 text-sm">',
        '<div class="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Bolsa actual</div><div class="font-bold text-white">' + money(prizePool) + '</div></div>',
        '<div class="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl"><div class="text-xs text-zinc-400">Premio automático' + (isTie ? " por persona": "") + '</div><div class="font-bold ' + prizeClass + '">' + money(prizePerWinner) + '</div></div>',
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
    const {
        data,
        error
    } = await supabaseClient
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
    const {
        data: paidEntries,
        error: paidErr
    } = await supabaseClient
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
        const {
            data: goalsData,
            error: goalsErr
        } = await supabaseClient
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
    const {
        data: pointsRows,
        error: pointsErr
    } = await supabaseClient
    .from("entry_points")
    .select("entry_id, pool_id, participant_id, points, played_matches, captured_picks")
    .eq("pool_id", pool_id)
    .in("entry_id", paidEntryIds);

    if (pointsErr) return showAlert(pointsErr.message, "error");

    // Participantes solo de entries pagados
    const {
        data: participants,
        error: partErr
    } = await supabaseClient
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
    const {
        data: goalsData,
        error: goalsErr
    } = await supabaseClient
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
    // Load Goleo standings if applicable
    await loadGoalChampionStandings();

    // Stats de la jornada
    const {
        data: poolStats,
        error: statsErr
    } = await supabaseClient
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
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300": "bg-blue-500/10 border-blue-500/20 text-blue-300"
        }">
        ${
        isFinished
        ? "🏁 Jornada finalizada. Resultados oficiales.": "📊 Tabla en tiempo real (puede cambiar conforme se registren resultados)."
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
        const safeName = escapeHTML(r.name || "—");
        const safeArea = r.area ? " • " + escapeHTML(r.area): "";

        return `
        <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
        <div class="font-semibold">${pos}. ${safeName}</div>
        <div class="text-xs text-zinc-400 truncate">
        ${safeArea} • Picks: ${Number(r.captured_picks || 0)} • Jugados: ${Number(r.played_matches || 0)}
        </div>
        </div>
        <div class="shrink-0 text-right">
        <div class="text-lg font-extrabold text-emerald-300">${r.points}</div>
        <div class="text-xs text-zinc-400">aciertos</div>
        </div>
        </div>
        `;
    }).join(""): `
    <div class="text-sm text-zinc-400 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
    No hay boletos pagados o pronósticos oficiales para esta jornada todavía.
    </div>
    `;
}

// ═══════════════════════════════════════════════════
// CARTEL TABLA DE ACIERTOS — DARK PREMIUM
// ═══════════════════════════════════════════════════
function makeStandingsCard(opts) {
    var poolName = opts.poolName || "Jornada";
    var totalGoals = opts.totalGoals || 0;
    var rows = opts.rows || [];
    var logoUrl = opts.logoUrl || ((typeof QUINIELA_LOGO_URL !== "undefined") ? QUINIELA_LOGO_URL : "");

    var card = document.createElement("div");
    card.style.cssText = [
        "width:900px",
        "box-sizing:border-box",
        "background:linear-gradient(160deg,#050810 0%,#071220 50%,#040c10 100%)",
        "color:#f0f4f8",
        "border-radius:24px",
        "padding:40px 36px",
        "font-family:Arial,sans-serif",
        "position:relative",
        "overflow:hidden"
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
        '<img src="' + logoUrl + '" crossorigin="anonymous" width="64" height="64"',
        ' onerror="this.style.display=\'none\'"',
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

    var medals = ["#f59e0b",
        "#9ca3af",
        "#b45309"];
    var medalEmojis = ["🥇",
        "🥈",
        "🥉"];

    rows.forEach(function(r, i) {
        var pos = i + 1;
        var isFirst = pos === 1;
        var isTop3 = pos <= 3;

        var rowBg = isFirst
        ? "background:linear-gradient(135deg,rgba(16,185,129,.18) 0%,rgba(6,182,212,.08) 100%);border:1px solid rgba(16,185,129,.35);": isTop3
        ? "background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);": "background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);";

        var medalColor = medals[i] || "#4a5568";
        var medalEmoji = medalEmojis[i] || "";
        var posDisplay = medalEmoji
        ? '<div style="font-size:28px;line-height:1;">' + medalEmoji + '</div>': '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);' +
        'display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#6b7280;">' + pos + '</div>';

        var ptsColor = isFirst ? "#34d399": isTop3 ? "#a3e635": "#f0f4f8";

        var item = document.createElement("div");
        item.style.cssText = "display:flex;align-items:center;justify-content:space-between;" +
        "gap:16px;padding:16px 20px;border-radius:16px;" + rowBg;

        item.innerHTML = [
            '<div style="display:flex;align-items:center;gap:16px;min-width:0;">',
            posDisplay,
            '<div style="min-width:0;">',
            '<div style="font-size:22px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + r.name + '</div>',
            '<div style="font-size:13px;color:#8a94a6;margin-top:2px;">' + (r.area || "Sin área") + ' &bull; ' + r.captured_picks + ' picks &bull; ' + r.played_matches + ' jugados</div>',
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
/** Precarga el logo como Image (o null). */
async function loadLogoImage() {
    var logoUrl = typeof QUINIELA_LOGO_URL !== "undefined" ? QUINIELA_LOGO_URL : "";
    if (!logoUrl) return null;
    return new Promise(function(resolve) {
        var img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function() { resolve(img.naturalWidth > 0 ? img : null); };
        img.onerror = function() { resolve(null); };
        img.src = logoUrl;
        setTimeout(function() { resolve(img.complete && img.naturalWidth > 0 ? img : null); }, 2000);
    });
}

/**
 * Tabla de aciertos premium — Canvas 2D nativo (sin html2canvas).
 */
function drawStandingsCanvas(opts) {
    opts = opts || {};
    var rows = opts.rows || [];
    var poolName = opts.poolName || "Jornada";
    var totalGoals = opts.totalGoals != null ? opts.totalGoals : 0;
    var logoImg = opts.logoImg || null;
    var isGoleo = !!opts.isGoleo;

    var W = 900;
    var padX = 36;
    var rowH = 64;
    var headerH = 200;
    var footerH = 90;
    var H = headerH + Math.max(rows.length, 1) * rowH + footerH + 24;
    H = Math.max(H, 520);

    var scale = 2;
    var canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el canvas");
    ctx.scale(scale, scale);

    // Fondo
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#071220");
    bg.addColorStop(0.5, "#050810");
    bg.addColorStop(1, "#040c10");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Glows
    function glow(x, y, r, c) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, c);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    glow(80, 60, 180, "rgba(16,185,129,0.14)");
    glow(W - 70, H - 80, 160, "rgba(6,182,212,0.10)");

    // Línea top
    var lg = ctx.createLinearGradient(W * 0.12, 0, W * 0.88, 0);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, "#10b981");
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(W * 0.12, 0, W * 0.76, 3);

    // Header
    var hy = 32;
    if (logoImg && logoImg.naturalWidth > 0) {
        try {
            ctx.drawImage(logoImg, padX, hy, 52, 52);
        } catch (e) { /* ignore */ }
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 22px Arial";
    ctx.fillText("Quiniela Arcángel", padX + 64, hy + 22);
    ctx.fillStyle = "#34d399";
    ctx.font = "600 13px Arial";
    ctx.fillText('"Pasión X Ganar"', padX + 64, hy + 42);

    // Badge goles
    var goalsTxt = "⚽  " + totalGoals + " goles";
    ctx.font = "700 14px Arial";
    var gw = ctx.measureText(goalsTxt).width + 28;
    var gx = W - padX - gw;
    ctx.fillStyle = "rgba(16,185,129,0.12)";
    ctx.strokeStyle = "rgba(16,185,129,0.35)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, gx, hy + 8, gw, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#34d399";
    ctx.textAlign = "center";
    ctx.fillText(goalsTxt, gx + gw / 2, hy + 29);

    // Título
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 36px Arial";
    ctx.fillText(isGoleo ? "Campeón de Goleó" : "Tabla de Aciertos", W / 2, 120);
    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 16px Arial";
    ctx.fillText(poolName, W / 2, 148);

    // Separador
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, 168);
    ctx.lineTo(W - padX, 168);
    ctx.stroke();

    // Filas
    var y0 = 184;
    var medals = ["#fbbf24", "#9ca3af", "#c2410c"];
    rows.forEach(function(r, i) {
        var y = y0 + i * rowH;
        var isFirst = i === 0;
        var isTop3 = i < 3;

        // Fondo fila
        var isExact = isGoleo && r.isExact;
        if (isExact || (isFirst && !isGoleo)) {
            ctx.fillStyle = "rgba(16,185,129,0.14)";
            ctx.strokeStyle = "rgba(16,185,129,0.32)";
        } else if (isTop3) {
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.strokeStyle = "rgba(255,255,255,0.10)";
        } else {
            ctx.fillStyle = "rgba(255,255,255,0.03)";
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
        }
        ctx.lineWidth = 1;
        roundRect(ctx, padX, y, W - padX * 2, rowH - 8, 14);
        ctx.fill();
        ctx.stroke();

        var cy = y + (rowH - 8) / 2;

        // Posición
        if (i < 3) {
            ctx.beginPath();
            ctx.arc(padX + 28, cy, 16, 0, Math.PI * 2);
            ctx.fillStyle = medals[i];
            ctx.globalAlpha = 0.25;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = medals[i];
            ctx.font = "900 16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(i + 1), padX + 28, cy + 1);
            ctx.textBaseline = "alphabetic";
        } else {
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.beginPath();
            ctx.arc(padX + 28, cy, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#6b7280";
            ctx.font = "800 13px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(i + 1), padX + 28, cy + 1);
            ctx.textBaseline = "alphabetic";
        }

        // Nombre + área
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 17px Arial";
        ctx.fillText(r.name || "?", padX + 56, cy - 6);
        ctx.fillStyle = "#8a94a6";
        ctx.font = "600 12px Arial";
        var sub;
        if (isGoleo) {
            sub = (r.area || "Sin área") + (isExact ? "  ·  EXACTO ✅" : (r.diff != null ? "  ·  ±" + r.diff : ""));
        } else {
            sub = (r.area || "Sin área") + "  ·  " + (r.captured_picks || 0) + " picks  ·  " + (r.played_matches || 0) + " jugados";
        }
        ctx.fillText(sub, padX + 56, cy + 14);

        // Puntos / goles predichos
        var ptsColor = isExact || isFirst ? "#34d399" : (isTop3 ? "#a3e635" : "#f0f4f8");
        ctx.textAlign = "right";
        ctx.fillStyle = ptsColor;
        ctx.font = "900 28px Arial";
        ctx.textBaseline = "middle";
        ctx.fillText(String(r.points || 0), W - padX - 16, cy - 4);
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = isExact ? "#34d399" : "#6b7280";
        ctx.font = "600 10px Arial";
        ctx.fillText(isGoleo ? (isExact ? "exacto" : "goles pred.") : "aciertos", W - padX - 16, cy + 16);
    });

    // Footer
    var fy = H - 56;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(padX, fy - 12);
    ctx.lineTo(W - padX, fy - 12);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 16px Arial";
    ctx.fillText("¡Gracias por participar! 🏆", W / 2, fy + 8);
    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 12px Arial";
    ctx.fillText("Quiniela Arcángel — Pasión X Ganar", W / 2, fy + 28);

    return canvas;
}

async function exportStandingsImage() {
    hideAlert();
    const pool_id = $("standingsPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada.", "error");

    const { data: pool } = await supabaseClient.from("pools")
        .select("id, name, mode_code, round").eq("id", pool_id).maybeSingle();

    const isGoleo = pool && String(pool.mode_code || "").toUpperCase() === "GOLEO";

    const { data: paidEntries } = await supabaseClient.from("entries")
        .select("id, participant_id").eq("pool_id", pool_id).eq("paid", true);

    if (!paidEntries || !paidEntries.length)
        return showAlert("No hay boletos pagados para exportar.", "error");

    const paidEntryIds = paidEntries.map(function(e) { return e.id; });
    const paidPartIds = paidEntries.map(function(e) { return e.participant_id; });

    const { data: participants } = await supabaseClient.from("participants")
        .select("id, name, area").in("id", paidPartIds);

    const { data: goalsData } = await supabaseClient.from("pool_goals_total")
        .select("total_goals").eq("pool_id", pool_id).maybeSingle();

    const actualGoals = goalsData && goalsData.total_goals != null ? Number(goalsData.total_goals) : null;
    const partMap = new Map((participants || []).map(function(p) { return [p.id, p]; }));
    const paidMap = {};
    paidEntries.forEach(function(e) { paidMap[e.id] = e; });

    var rows = [];

    if (isGoleo) {
        const { data: preds } = await supabaseClient.from("predictions_goals_total")
            .select("entry_id, predicted_goals").eq("pool_id", pool_id).in("entry_id", paidEntryIds);
        rows = (preds || []).map(function(pred) {
            var entry = paidMap[pred.entry_id] || {};
            var p = partMap.get(entry.participant_id) || {};
            var predicted = Number(pred.predicted_goals);
            var diff = actualGoals !== null ? Math.abs(predicted - actualGoals) : null;
            return {
                name: p.name || "Sin nombre",
                area: p.area || "",
                points: predicted,
                predicted: predicted,
                diff: diff,
                isExact: diff === 0,
                played_matches: 0,
                captured_picks: 0
            };
        }).sort(function(a, b) {
            if (a.diff === null && b.diff === null) return a.name.localeCompare(b.name);
            if (a.diff === null) return 1;
            if (b.diff === null) return -1;
            return a.diff - b.diff || a.name.localeCompare(b.name);
        });
    } else {
        const { data: pointsRows } = await supabaseClient.from("entry_points")
            .select("entry_id, participant_id, points, played_matches, captured_picks")
            .eq("pool_id", pool_id).in("entry_id", paidEntryIds);

        rows = (pointsRows || []).map(function(r) {
            const p = partMap.get(r.participant_id) || {};
            return {
                name: p.name || "Sin nombre",
                area: p.area || "",
                points: Number(r.points || 0),
                played_matches: Number(r.played_matches || 0),
                captured_picks: Number(r.captured_picks || 0)
            };
        }).sort(function(a, b) {
            return b.points - a.points || a.name.localeCompare(b.name);
        });
    }

    try {
        var logoImg = await loadLogoImage();
        var canvas = drawStandingsCanvas({
            poolName: (pool && pool.name) || "Jornada",
            totalGoals: actualGoals != null ? actualGoals : 0,
            rows: rows,
            logoImg: logoImg,
            isGoleo: isGoleo
        });
        const a = document.createElement("a");
        const safeName = ((pool && pool.name) || "tabla").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
        a.download = safeName + (isGoleo ? "-tabla-goleo.png" : "-tabla-aciertos.png");
        a.href = canvas.toDataURL("image/png");
        a.click();
        showAlert(isGoleo ? "Tabla Goleó exportada ✅" : "Tabla de aciertos exportada ✅", "ok");
    } catch (err) {
        showAlert("Error exportando tabla: " + (err && err.message ? err.message : err), "error");
    }
}

// ═══════════════════════════════════════════════════
// CARTEL GANADOR — DARK PREMIUM
// ═══════════════════════════════════════════════════
function makeWinnerCard(opts) {
    var poolName = opts.poolName || "Jornada";
    var season = opts.season || "";
    var isFinished = !!opts.isFinished;
    var winners = opts.winners || [];
    var winningPoints = Number(opts.winningPoints || 0);
    var prizePool = Number(opts.prizePool || 0);
    var prizePerWinner = Number(opts.prizePerWinner || 0);
    var winnersCount = Number(opts.winnersCount || 0);
    var logoUrl = (typeof QUINIELA_LOGO_URL !== "undefined") ? QUINIELA_LOGO_URL: "";

    var isTie = winnersCount > 1;
    var names = winners.map(function(w) {
        return w.name;
    }).join(" & ");
    var title = isTie
    ? (isFinished ? "Empate Final": "Empate Provisional"): (isFinished ? "Ganador Final": "Ganador Provisional");
    var subtitle = isTie
    ? "Premio dividido entre " + winnersCount + " participantes": "Resultado oficial de la Quiniela Sencilla";

    var accentStart = isTie ? "#f59e0b": "#10b981";
    var accentEnd = isTie ? "#d97706": "#059669";
    var accentGlow = isTie ? "rgba(245,158,11,.3)": "rgba(16,185,129,.3)";
    var accentLight = isTie ? "#fbbf24": "#34d399";

    var card = document.createElement("div");
    card.style.cssText = [
        "width:1080px",
        "box-sizing:border-box",
        "background:linear-gradient(160deg,#050810 0%,#071220 50%,#040c10 100%)",
        "color:#f0f4f8",
        "border-radius:28px",
        "padding:60px 56px",
        "font-family:Arial,sans-serif",
        "position:relative",
        "overflow:hidden"
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
        '<div style="font-size:15px;color:' + accentLight + ';margin-top:4px;">&#34;Pasi\u00f3n X Ganar&#34; &bull; ' + (season || "Clausura 2026") + '</div>',
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
        '<div style="font-size:' + (isTie ? "36px": "52px") + ';font-weight:900;color:#fff;line-height:1.1;">' + names + '</div>',
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
/**
 * Cartel del ganador premium — Canvas 2D nativo.
 */
function drawWinnerCanvas(opts) {
    opts = opts || {};
    var poolName = opts.poolName || "Jornada";
    var season = opts.season || "";
    var isFinished = !!opts.isFinished;
    var winners = opts.winners || [];
    var winningPoints = Number(opts.winningPoints || 0);
    var prizePool = Number(opts.prizePool || 0);
    var prizePerWinner = Number(opts.prizePerWinner || 0);
    var winnersCount = Number(opts.winnersCount || winners.length || 1);
    var logoImg = opts.logoImg || null;
    var isGoleo = !!opts.isGoleo;
    var noExactWinner = !!opts.noExactWinner;
    var actualGoals = opts.actualGoals != null ? Number(opts.actualGoals) : winningPoints;
    var isTie = !noExactWinner && winnersCount > 1;
    var names = noExactWinner
        ? "Sin acertante exacto"
        : winners.map(function(w) { return w.name || "?"; }).join(" & ");
    var title;
    if (isGoleo) {
        if (noExactWinner) title = isFinished ? "Bolsa Acumulada" : "Sin Acertante";
        else if (isTie) title = isFinished ? "Empate Goleó" : "Empate Provisional Goleó";
        else title = isFinished ? "Campeón de Goleó" : "Líder Goleó";
    } else {
        title = isTie
            ? (isFinished ? "Empate Final" : "Empate Provisional")
            : (isFinished ? "Ganador Final" : "Ganador Provisional");
    }

    var W = 900;
    var H = 1000;
    var scale = 2;
    var canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el canvas");
    ctx.scale(scale, scale);

    // Fondo dark premium
    var bg = ctx.createRadialGradient(W / 2, 120, 20, W / 2, H * 0.4, H * 0.9);
    bg.addColorStop(0, "#0c1a2e");
    bg.addColorStop(0.5, "#050810");
    bg.addColorStop(1, "#03060c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    function glow(x, y, r, c) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, c);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    glow(W / 2, 280, 240, "rgba(251,191,36,0.16)");
    glow(60, 40, 150, "rgba(16,185,129,0.12)");

    // Línea top
    var lg = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, "#fbbf24");
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(W * 0.15, 0, W * 0.7, 3);

    // Logo + marca
    var hy = 40;
    ctx.textAlign = "center";
    if (logoImg && logoImg.naturalWidth > 0) {
        try {
            ctx.drawImage(logoImg, W / 2 - 28, hy, 56, 56);
            hy += 70;
        } catch (e) {
            hy += 10;
        }
    } else {
        ctx.font = "32px Arial";
        ctx.fillText("🏆", W / 2, hy + 28);
        hy += 52;
    }

    ctx.fillStyle = "#34d399";
    ctx.font = "800 13px Arial";
    ctx.fillText("QUINIELA ARCÁNGEL", W / 2, hy);
    hy += 40;

    // Título estado
    ctx.fillStyle = isFinished ? "#fbbf24" : "#38bdf8";
    ctx.font = "800 14px Arial";
    ctx.fillText(title.toUpperCase(), W / 2, hy);
    hy += 44;

    // Avatar círculo ganador
    var avR = 64;
    var avCy = hy + avR;
    var ringGrad = ctx.createLinearGradient(W / 2 - avR, avCy - avR, W / 2 + avR, avCy + avR);
    ringGrad.addColorStop(0, "#fde68a");
    ringGrad.addColorStop(1, "#b45309");
    ctx.beginPath();
    ctx.arc(W / 2, avCy, avR + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(251,191,36,0.25)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W / 2, avCy, avR + 3, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W / 2, avCy, avR, 0, Math.PI * 2);
    ctx.fillStyle = "#1c1917";
    ctx.fill();

    var initials = nameInitials(winners[0] && winners[0].name ? winners[0].name : "G");
    if (noExactWinner) initials = "⚽";
    else if (isTie) initials = "🤝";
    ctx.fillStyle = "#fbbf24";
    ctx.font = (isTie || noExactWinner) ? "40px Arial" : "900 36px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, W / 2, avCy + 1);
    ctx.textBaseline = "alphabetic";

    hy = avCy + avR + 36;

    // Nombres
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 32px Arial";
    wrapText(ctx, names, W / 2, hy, W - 80, 36);
    hy += 48;

    // Subtítulo jornada
    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 15px Arial";
    ctx.fillText(poolName + (season ? "  ·  " + season : ""), W / 2, hy);
    hy += 40;

    // Stats cards
    var cards;
    if (isGoleo) {
        cards = [
            { label: "Goles reales", value: String(actualGoals), color: "#34d399" },
            { label: "Bolsa", value: (typeof money === "function" ? money(prizePool) : ("$" + prizePool)), color: "#fbbf24" },
            {
                label: noExactWinner ? "Acumula" : (isTie ? "Por persona" : "Premio"),
                value: noExactWinner
                    ? (typeof money === "function" ? money(prizePool) : ("$" + prizePool))
                    : (typeof money === "function" ? money(prizePerWinner) : ("$" + prizePerWinner)),
                color: "#38bdf8"
            }
        ];
    } else {
        cards = [
            { label: "Aciertos", value: String(winningPoints), color: "#34d399" },
            { label: "Bolsa", value: (typeof money === "function" ? money(prizePool) : ("$" + prizePool)), color: "#fbbf24" },
            { label: isTie ? "Por persona" : "Premio", value: (typeof money === "function" ? money(prizePerWinner) : ("$" + prizePerWinner)), color: "#38bdf8" }
        ];
    }
    var cardW = 240;
    var cardGap = 18;
    var cardsTotal = cards.length * cardW + (cards.length - 1) * cardGap;
    var cx0 = (W - cardsTotal) / 2;
    cards.forEach(function(c, i) {
        var x = cx0 + i * (cardW + cardGap);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 1;
        roundRect(ctx, x, hy, cardW, 88, 16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#8a94a6";
        ctx.font = "700 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(c.label.toUpperCase(), x + cardW / 2, hy + 28);
        ctx.fillStyle = c.color;
        ctx.font = "900 26px Arial";
        ctx.fillText(c.value, x + cardW / 2, hy + 62);
    });
    hy += 120;

    // Ganadores count / nota Goleó
    if (isGoleo && noExactWinner) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "700 14px Arial";
        ctx.fillText("Nadie acertó exacto · la bolsa pasa a la próxima jornada", W / 2, hy);
        hy += 28;
    } else if (isTie) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "700 14px Arial";
        ctx.fillText(winnersCount + " ganadores empatados" + (isGoleo ? " (acierto exacto)" : ""), W / 2, hy);
        hy += 28;
    } else if (isGoleo && winnersCount === 1) {
        ctx.fillStyle = "#34d399";
        ctx.font = "700 14px Arial";
        ctx.fillText("⚽ Acierto exacto · " + actualGoals + " goles", W / 2, hy);
        hy += 28;
    }

    // Footer
    var fy = H - 60;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(W * 0.18, fy - 10);
    ctx.lineTo(W * 0.82, fy - 10);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 16px Arial";
    ctx.fillText("¡Gracias por participar! 🏆", W / 2, fy + 12);
    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 12px Arial";
    ctx.fillText("Quiniela Arcángel — Pasión X Ganar", W / 2, fy + 32);

    return canvas;
}

async function exportWinnerCard() {
    hideAlert();

    const pool_id = $("standingsPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada.", "error");

    const {
        data: pool,
        error: poolErr
    } = await supabaseClient
        .from("pools")
        .select("id, name, season, mode_code, round, competition, price, carryover_amount")
        .eq("id", pool_id)
        .maybeSingle();

    if (poolErr) return showAlert(poolErr.message, "error");

    var isGoleo = pool && String(pool.mode_code || "").toUpperCase() === "GOLEO";
    const completionInfo = await getPoolCompletionInfo(pool_id);

    // ── GOLEÓ: solo acertantes EXACTOS ──
    if (isGoleo) {
        var goalsRes = await supabaseClient.from("pool_goals_total")
            .select("total_goals").eq("pool_id", pool_id).maybeSingle();
        var actualGoals = goalsRes.data ? Number(goalsRes.data.total_goals) : null;
        if (actualGoals === null || isNaN(actualGoals)) {
            return showAlert("Captura primero el total de goles de la jornada.", "error");
        }

        var [paidRes, predsRes] = await Promise.all([
            supabaseClient.from("entries").select("id, participant_id, paid").eq("pool_id", pool_id).eq("paid", true),
            supabaseClient.from("predictions_goals_total").select("entry_id, predicted_goals").eq("pool_id", pool_id)
        ]);
        var paidMap = {};
        (paidRes.data || []).forEach(function(e) { paidMap[e.id] = e; });
        var partIds = [...new Set((paidRes.data || []).map(function(e) { return e.participant_id; }))];
        var partMap = {};
        if (partIds.length) {
            var partRes = await supabaseClient.from("participants").select("id, name, area").in("id", partIds);
            (partRes.data || []).forEach(function(p) { partMap[p.id] = p; });
        }

        var exactWinners = (predsRes.data || []).filter(function(pred) {
            return paidMap[pred.entry_id] && Number(pred.predicted_goals) === actualGoals;
        }).map(function(pred) {
            var entry = paidMap[pred.entry_id];
            var p = partMap[entry.participant_id] || {};
            return { name: p.name || "?", area: p.area || "", predicted: Number(pred.predicted_goals) };
        });

        // Deduplicar por nombre (mismo participante con 2 boletas exactas cuenta 1 premio? 
        // Por boleto: si 2 boletas exactas del mismo, ambos aparecen — reglas de negocio: 1 premio por entry
        // Mantener uno por entry ya está; si mismo nombre 2 veces es OK si 2 boletas)

        var bag = { total_bag: 0, prize_pool: 0, carryover_amount: 0 };
        try {
            bag = await getGoleoBagAmount(pool_id);
        } catch (e) { /* ignore */ }

        var winnersCount = exactWinners.length;
        var prizePool = Number(bag.total_bag || 0);
        var prizePer = winnersCount > 0 ? Math.floor(prizePool / winnersCount) : 0;

        try {
            var logoImg = await loadLogoImage();
            var canvas = drawWinnerCanvas({
                poolName: (pool && pool.name) || "Jornada",
                season: (pool && pool.season) || "",
                isFinished: completionInfo && completionInfo.isFinished,
                winners: exactWinners.length ? exactWinners : [{ name: "Sin acertante exacto" }],
                winningPoints: actualGoals,
                prizePool: prizePool,
                prizePerWinner: prizePer,
                winnersCount: winnersCount || 0,
                logoImg: logoImg,
                isGoleo: true,
                noExactWinner: winnersCount === 0,
                actualGoals: actualGoals
            });

            const a = document.createElement("a");
            const safeName = ((pool && pool.name) || "ganador")
                .replace(/[^\w\s-]/g, "")
                .replace(/\s+/g, "-");
            a.download = safeName + "-ganador-goleo.png";
            a.href = canvas.toDataURL("image/png");
            a.click();
            showAlert(winnersCount
                ? "Cartel Campeón de Goleó exportado ✅"
                : "Cartel Goleó (sin acertante) exportado ✅", "ok");
        } catch (err) {
            showAlert("Error generando cartel: " + (err && err.message ? err.message : err), "error");
        }
        return;
    }

    // ── SENCILLA / 1X2 ──
    const winnerSummary = await loadSimpleWinnerSummary(pool_id);

    if (!winnerSummary || !winnerSummary.winners || !winnerSummary.winners.length) {
        return showAlert("No hay ganador calculado todavía para esta jornada.", "error");
    }

    try {
        var logoImg2 = await loadLogoImage();
        var canvas2 = drawWinnerCanvas({
            poolName: (pool && pool.name) || "Jornada",
            season: (pool && pool.season) || "",
            isFinished: completionInfo && completionInfo.isFinished,
            winners: winnerSummary.winners,
            winningPoints: winnerSummary.winning_points,
            prizePool: winnerSummary.prize_pool,
            prizePerWinner: winnerSummary.prize_per_winner,
            winnersCount: winnerSummary.winners_count,
            logoImg: logoImg2,
            isGoleo: false
        });

        const a2 = document.createElement("a");
        const safeName2 = ((pool && pool.name) || "ganador")
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-");
        a2.download = safeName2 + "-ganador.png";
        a2.href = canvas2.toDataURL("image/png");
        a2.click();
        showAlert("Cartel del ganador premium exportado ✅", "ok");
    } catch (err) {
        showAlert("Error generando cartel: " + (err && err.message ? err.message : err), "error");
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
    inp.type = isHidden ? "text": "password";
    $("btnTogglePassword").textContent = isHidden ? "🙈 Ocultar": "👁️ Ver";
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
        const {
            error
        } = await supabaseClient.auth.signInWithPassword({
                email, password
            });
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
        const {
            error
        } = await supabaseClient.auth.signUp({
                email, password
            });
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

    const {
        data
    } = await supabaseClient.auth.getUser();
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

    const {
        error
    } = await supabaseClient
    .from("participants")
    .insert({
        name, area, whatsapp
    });

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
    const nextFilter = currentParticipantFilter === "archived" ? "all": "archived";
    applyParticipantFilter(nextFilter);
});

// Jornadas / Pools: insertar
$("formPool").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();

    // ── Validación manual visible (no depende del tooltip nativo del browser) ──
    const roundRaw = $("poolRound").value.trim();
    if (!roundRaw) {
        showAlert("⚠️ Ingresa el número o nombre de jornada (obligatorio).", "error");
        $("poolRound").focus();
        $("alert").scrollIntoView({
            behavior: "smooth", block: "center"
        });
        return;
    }
    // Accept numeric (17) or text (J1, Fase de Grupos) — store as-is
    const round = isNaN(Number(roundRaw)) ? roundRaw: Number(roundRaw);
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
        const {
            error
        } = await supabaseClient
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
            showAlert("❌ Error Supabase: " + error.message + (error.details ? " — " + error.details: ""), "error");
            $("alert").scrollIntoView({
                behavior: "smooth", block: "center"
            });
            return;
        }

        showAlert("✅ Jornada " + round + " creada como borrador.", "ok");
        $("alert").scrollIntoView({
            behavior: "smooth", block: "center"
        });

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
        $("alert").scrollIntoView({
            behavior: "smooth", block: "center"
        });
    } finally {
        setBusy(btnCrear, false);
    }
});

$("btnCloseActivePool").addEventListener("click", closeActivePool);
$("btnOpenActivePool").addEventListener("click", openLatestClosedPool);

// Pagos / Boletos
$("btnAddEntry").addEventListener("click", addEntry);
if ($("btnAddEntryPaid")) $("btnAddEntryPaid").addEventListener("click", addEntryAndPay);
$("btnRefreshStats").addEventListener("click", loadEntriesAndStats);
$("entryPool").addEventListener("change", async () => {
    await loadAreaFilterOptions();
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
if ($("btnSavePicksNext")) $("btnSavePicksNext").addEventListener("click", savePicksAndNext);
if ($("btnFastMode")) $("btnFastMode").addEventListener("click", toggleFastMode);
$("btnClearPicks").addEventListener("click", clearPicksSelection);
if ($("btnDeletePicks")) $("btnDeletePicks").addEventListener("click", clearParticipantPicks);
if ($("btnSaveGoalChampion")) $("btnSaveGoalChampion").addEventListener("click", saveGoalChampionPick);

$("btnRefreshPickStatus").addEventListener("click", loadPickStatusList);
if ($("btnExportAllPicks")) $("btnExportAllPicks").addEventListener("click", exportAllPicksList);

$("pickPool").addEventListener("change", async () => {
    currentPickStatusSearch = "";
    if ($("pickStatusSearch")) $("pickStatusSearch").value = "";

    await fillPickParticipantsSelect();
    await loadPickStatusList();
    $("pickMatches").innerHTML = "";
    $("pickEntryLabel").textContent = "—";
});

$("pickParticipant").addEventListener("change", () => {
    saveLastPickSelection();
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
if ($("btnSaveResultsCalc")) $("btnSaveResultsCalc").addEventListener("click", saveResultsAndCalc);
$("btnCloseResults").addEventListener("click", function() {
    $("resultsMatchesList").innerHTML = "";
    $("resultsGoalsTotal").textContent = "0";
    hideAlert();
});

// Aciertos
$("btnLoadStandings").addEventListener("click", loadStandings);
$("btnExportStandingsImage").addEventListener("click", exportStandingsImage);
$("btnExportWinnerCard").addEventListener("click", exportWinnerCard);
if ($("btnPicksVsResults")) $("btnPicksVsResults").addEventListener("click", function() {
    showPicksVsResults($("standingsPool").value);
});
if ($("btnExportStandingsCSV")) $("btnExportStandingsCSV").addEventListener("click", exportStandingsCSV);
if ($("btnExportTop3Card")) $("btnExportTop3Card").addEventListener("click", exportTop3Card);

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
    var entRes = await supabaseClient.from("entries")
    .select("participant_id, paid").eq("pool_id", pool_id);

    if (poolRes.error || partRes.error || entRes.error) return showAlert("Error cargando datos.", "error");

    var pool = poolRes.data;
    var parts = partRes.data || [];
    var ents = entRes.data || [];

    var paidSet = new Set(ents.filter(function(e) {
        return e.paid;
    }).map(function(e) {
        return e.participant_id;
    }));
    var pending = parts.filter(function(p) {
        return !paidSet.has(p.id);
    });

    if (!pending.length) return showAlert("Todos han pagado! No hay pendientes.", "ok");

    var jornada = pool && pool.round ? "Jornada " + pool.round: (pool && pool.name ? pool.name: "Jornada");
    var precio = pool && pool.price ? "$" + pool.price: "";

    var msgLines = [
        "Quiniela Arcangel - " + jornada,
        "Pendientes de pago (" + precio + " c/u):",
        ""
    ];
    pending.forEach(function(p, i) {
        msgLines.push((i + 1) + ". " + p.name + (p.area ? " (" + p.area + ")": ""));
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
    .order("round", {
        ascending: true
    });
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
    var poolIds = pools.map(function(p) {
        return p.id;
    });
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
            if (m.home_goals > m.away_goals) matchResult[m.id] = "H";
            else if (m.home_goals < m.away_goals) matchResult[m.id] = "A";
            else matchResult[m.id] = "D";
        }
    });

    // Traer entries de esos pools
    var entRes = await supabaseClient.from("entries")
    .select("id, pool_id, participant_id").in("pool_id",
        poolIds);
    if (entRes.error) return showAlert(entRes.error.message, "error");
    var entries = entRes.data || [];
    var entryIds = entries.map(function(e) {
        return e.id;
    });

    // Traer predictions
    var predRes = await supabaseClient.from("predictions_1x2")
    .select("entry_id, match_id, pick").in("entry_id", entryIds);
    if (predRes.error) return showAlert(predRes.error.message, "error");
    var preds = predRes.data || [];

    // Mapa pick por entry+match
    var pickMap = {};
    preds.forEach(function(p) {
        pickMap[p.entry_id + "_" + p.match_id] = p.pick;
    });

    // Calcular aciertos por participante por jornada
    var totalByPart = {};
    participants.forEach(function(p) {
        totalByPart[p.id] = {
            name: p.name, area: p.area, total: 0, jornadas: 0
        };
    });

    poolsWithResults.forEach(function(pool) {
        var poolMatches = matches.filter(function(m) {
            return m.pool_id === pool.id && matchResult[m.id];
        });
        if (!poolMatches.length) return;

        // Entries de esta jornada por participante (puede haber varios)
        var poolEntries = entries.filter(function(e) {
            return e.pool_id === pool.id;
        });

        participants.forEach(function(part) {
            var partEntries = poolEntries.filter(function(e) {
                return e.participant_id === part.id;
            });
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
    // Calculate max possible points: total matches with results across all valid pools
    var _localMatchesByPool = {};
    (matches || []).forEach(function(m) {
        if (!_localMatchesByPool[m.pool_id]) _localMatchesByPool[m.pool_id] = [];
        _localMatchesByPool[m.pool_id].push(m);
    });
    var maxPossiblePts = poolsWithResults.reduce(function(sum, pool) {
        var poolMatches = _localMatchesByPool[pool.id] || [];
        return sum + poolMatches.filter(function(m) {
            return matchResult[m.id];
        }).length;
    },
        0);

    var ranked = Object.values(totalByPart)
    .filter(function(p) {
        return p.jornadas > 0;
    })
    .sort(function(a, b) {
        return b.total - a.total || a.name.localeCompare(b.name);
    });

    if (!ranked.length) {
        wrap.innerHTML = '<div class="text-sm text-zinc-400 p-3">No hay aciertos registrados aun.</div>';
        return;
    }

    var medals = ["🥇",
        "🥈",
        "🥉"];
    var totalJornadas = poolsWithResults.length;

    wrap.innerHTML = ranked.map(function(p, i) {
        var medal = i < 3 ? medals[i]: '<span class="text-zinc-500 font-bold text-sm">' + (i+1) + '</span>';
        var pct = (totalJornadas > 0 && maxPossiblePts > 0) ? Math.round((p.total / maxPossiblePts) * 100): 0;
        var barColor = i === 0 ? "bg-yellow-400": i === 1 ? "bg-zinc-300": i === 2 ? "bg-amber-600": "bg-emerald-500";
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
    .select("id, status", {
        count: "exact"
    });
    var allPools = poolsRes.data || [];
    var closedCount = allPools.filter(function(p) {
        return p.status === "closed";
    }).length;
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
    .select("id", {
        count: "exact", head: true
    });
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
    .order("round", {
        ascending: false
    })
    .limit(50);
    if (poolsRes.error) {
        wrap.innerHTML = '<div class="text-xs text-red-400">Error cargando jornadas.</div>'; return;
    }

    var pools = (poolsRes.data || []);

    // Entry points de todas las jornadas
    var poolIds = pools.map(function(p) {
        return p.id;
    });
    if (!poolIds.length) {
        wrap.innerHTML = '<div class="text-sm text-zinc-400">Sin jornadas todavía.</div>'; return;
    }

    var epRes = await supabaseClient.from("entry_points")
    .select("entry_id, pool_id, participant_id, points")
    .in("pool_id", poolIds)
    .order("points", {
        ascending: false
    });
    if (epRes.error) {
        wrap.innerHTML = '<div class="text-xs text-red-400">Error cargando aciertos.</div>'; return;
    }

    // Solo entries pagados
    var entRes = await supabaseClient.from("entries")
    .select("id, pool_id, participant_id, paid")
    .in("pool_id", poolIds)
    .eq("paid", true);
    if (entRes.error) {
        wrap.innerHTML = '<div class="text-xs text-red-400">Error cargando boletos.</div>'; return;
    }

    var paidEntryIds = new Set((entRes.data || []).map(function(e) {
        return e.id;
    }));

    // Participantes
    var partIds = [...new Set((epRes.data || []).map(function(r) {
        return r.participant_id;
    }))];
    var partRes = partIds.length
    ? await supabaseClient.from("participants").select("id, name, area").in("id", partIds): {
        data: []
    };
    var partMap = {};
    (partRes.data || []).forEach(function(p) {
        partMap[p.id] = p;
    });

    // Ganador por jornada = max points entre entries pagados
    var winnerByPool = {};
    pools.forEach(function(pool) {
        var poolRows = (epRes.data || []).filter(function(r) {
            return r.pool_id === pool.id && paidEntryIds.has(r.entry_id);
        });
        if (!poolRows.length) return;
        var maxPts = Math.max.apply(null, poolRows.map(function(r) {
            return r.points;
        }));
        if (maxPts < 0) return;
        var winners = poolRows.filter(function(r) {
            return r.points === maxPts;
        });
        // Agrupar por participante (puede tener 2 boletas)
        var winnerNames = [...new Set(winners.map(function(r) {
            var p = partMap[r.participant_id];
            return p ? p.name: "—";
        }))];
        winnerByPool[pool.id] = {
            names: winnerNames,
            points: maxPts,
            tie: winnerNames.length > 1
        };
    });

    var hasAny = Object.keys(winnerByPool).length > 0;
    if (!hasAny) {
        wrap.innerHTML = '<div class="text-sm text-zinc-400">Aún no hay jornadas con resultados finalizados.</div>';
        return;
    }

    wrap.innerHTML = pools.map(function(pool) {
        var w = winnerByPool[pool.id];
        if (!w) return ''; // jornada sin resultados
        var jornada = pool.round ? 'J' + pool.round: pool.name;
        var label = w.tie ? w.names.join(', '): w.names[0];
        var badgeClass = w.tie
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300': 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
        var icon = w.tie ? '🤝': '🏆';
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
    .eq("status",
        "open")
    .order("created_at",
        {
            ascending: false
        })
    .limit(1)
    .maybeSingle();

    if (poolRes.error) return showAlert(poolRes.error.message, "error");

    var pool = poolRes.data;
    if (!pool) return showAlert("No hay jornada activa actualmente.", "error");

    // Obtener partidos de esa jornada
    var matchRes = await supabaseClient.from("matches")
    .select("match_no, home_team, away_team")
    .eq("pool_id", pool.id)
    .order("match_no", {
        ascending: true
    });

    if (matchRes.error) return showAlert(matchRes.error.message, "error");

    var matches = matchRes.data || [];
    var jornada = pool.round ? "Jornada " + pool.round: pool.name;
    var precio = pool.price ? "$" + pool.price: "";
    var fechas = pool.date_label ? pool.date_label: "";
    var comp = pool.competition || "Liga MX";
    var season = pool.season || "";

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

    var jornada = pool && pool.round ? "Jornada " + pool.round: (pool && pool.name ? pool.name: "Jornada");
    var goles = $("standingsGoalsTotal") ? $("standingsGoalsTotal").textContent: "0";

    var lines = [
        "Quiniela Arcangel - " + jornada,
        (pool && pool.competition ? pool.competition: "Liga MX") + " - " + (pool && pool.season ? pool.season: ""),
        "Goles de la jornada: " + goles,
        ""
    ];

    // Extraer posicion, nombre y aciertos de cada card del DOM
    var cardList = document.querySelectorAll("#standingsList > div");
    cardList.forEach(function(card, i) {
        var nameEl = card.querySelector(".font-semibold");
        var ptsEl = card.querySelector(".text-emerald-300");
        var name = nameEl ? nameEl.textContent.trim(): ("Pos " + (i+1));
        var pts = ptsEl ? ptsEl.textContent.trim(): "0";
        var medal = i === 0 ? "1.": i === 1 ? "2.": i === 2 ? "3.": (i+1) + ".";
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
    function pickLabel(c) {
        return c === "H" ? "LOCAL": c === "D" ? "EMPATE": c === "A" ? "VISITA": "?";
    }

    matchDivs.forEach(function(div, i) {
        // Get match name from the div
        var matchName = div.querySelector(".text-sm.font-semibold, .font-semibold");
        var label = matchName ? matchName.textContent.trim(): ("Partido " + (i+1));
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
        var arrow = pick === "H" ? "->": pick === "A" ? "<-": pick === "D" ? "=": "?";
        previewLines.push((i+1) + ". " + label + "  " + arrow + " " + (pick ? pickLabel(pick): "Sin pick"));
    });

    // Show preview modal
    var jornada = poolRes.data.round ? "Jornada " + poolRes.data.round: poolRes.data.name;
    var partName = $("pickEntryLabel") ? $("pickEntryLabel").textContent.split("•")[0].trim(): "";

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
        '<div style="font-size:13px;color:#8a94a6;margin-bottom:16px;">' + jornada + (partName ? " - " + partName: "") + '</div>',
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

    document.getElementById("picksPreviewBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("picksPreviewCancel").addEventListener("click", function() {
        modal.remove();
    });
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

    var entryIds = entries.map(function(e) {
        return e.id;
    });

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
    .select("id", {
        count: "exact", head: true
    }).eq("pool_id", pool_id);
    var totalMatches = matchRes.count || 0;

    // Entries sin picks completos (< totalMatches)
    var pendingEntries = entries.filter(function(e) {
        return (picksCountMap[e.id] || 0) < totalMatches;
    });

    if (!pendingEntries.length) return showAlert("Todos tienen sus pronosticos completos.", "ok");

    // Participantes de esos entries
    var partIds = [...new Set(pendingEntries.map(function(e) {
        return e.participant_id;
    }))];
    var partRes = await supabaseClient.from("participants")
    .select("id, name, area, whatsapp").in("id", partIds);
    if (partRes.error) return showAlert(partRes.error.message, "error");

    var participants = partRes.data || [];
    var conWa = participants.filter(function(p) {
        return p.whatsapp;
    });
    var sinWa = participants.filter(function(p) {
        return !p.whatsapp;
    });

    var jornada = pool && pool.round ? "Jornada " + pool.round: (pool && pool.name ? pool.name: "Jornada");
    var fechas = pool && pool.date_label ? pool.date_label: "";

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
    ? '<div style="font-size:12px;color:#6b7280;margin-top:12px;">Sin WhatsApp: ' + sinWa.map(function(p) {
        return p.name;
    }).join(", ") + '</div>': "";

    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="reminderBg"></div>',
        '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px 24px 0 0;padding:24px;max-height:75vh;overflow-y:auto;">',
        '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 16px;"></div>',
        '<div style="font-size:17px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">Recordatorio de picks</div>',
        '<div style="font-size:13px;color:#8a94a6;margin-bottom:16px;">' + jornada + (fechas ? " - " + fechas: "") + " - " + pendingEntries.length + " boletos pendientes</div>",
        conWa.length ? listHtml: '<div style="font-size:13px;color:#6b7280;">Nadie con WhatsApp pendiente.</div>',
        sinWaHtml,
        '<button id="reminderClose" style="width:100%;margin-top:16px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
        'color:#8a94a6;font-size:14px;cursor:pointer;">Cerrar</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);

    document.getElementById("reminderBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("reminderClose").addEventListener("click", function() {
        modal.remove();
    });

    // Individual send buttons
    modal.querySelectorAll(".reminder-send-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var name = btn.getAttribute("data-name");
            var wa = btn.getAttribute("data-wa");
            var clean = String(wa).replace(/\D/g, "");
            var lines = [
                "Quiniela Arcangel - " + jornada,
                "Hola " + name + "! Te recordamos que aun no has enviado tus pronosticos.",
                (fechas ? "Fechas: " + fechas: ""),
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
    } catch(e) {
        return DEFAULT_SETTINGS;
    }
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

    document.getElementById("settingsBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("settingsClose").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("settingsSave").addEventListener("click", function() {
        var newSettings = {
            picksDeadline: document.getElementById("settingPicksDeadline").value.trim() || DEFAULT_SETTINGS.picksDeadline,
            paymentDeadline: document.getElementById("settingPaymentDeadline").value.trim() || DEFAULT_SETTINGS.paymentDeadline,
            adminWhatsapp: document.getElementById("settingAdminWa").value.trim() || DEFAULT_SETTINGS.adminWhatsapp
        };
        saveSettings(newSettings);
        modal.remove();
        showAlert("Configuración guardada ✅", "ok");
    });
}

// Helper para usar en mensajes
function getPicksDeadline() {
    return loadSettings().picksDeadline;
}
function getPaymentDeadline() {
    return loadSettings().paymentDeadline;
}
function getAdminWhatsapp() {
    return loadSettings().adminWhatsapp;
}

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
    document.getElementById("historyBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("historyClose").addEventListener("click", function() {
        modal.remove();
    });

    // Load data
    var [entriesRes,
        poolsRes] = await Promise.all([
            supabaseClient.from("entries")
            .select("id, pool_id, paid, created_at")
            .eq("participant_id", participantId)
            .order("created_at", {
                ascending: false
            }),
            supabaseClient.from("pools")
            .select("id, name, round, competition, season, status")
            .order("round", {
                ascending: false
            })
        ]);

    var entries = entriesRes.data || [];
    var pools = poolsRes.data || [];
    var poolMap = {};
    pools.forEach(function(p) {
        poolMap[p.id] = p;
    });

    if (!entries.length) {
        document.getElementById("historyContent").innerHTML =
        '<div style="text-align:center;color:#8a94a6;padding:20px;">Sin boletos registrados.</div>';
        return;
    }

    var entryIds = entries.map(function(e) {
        return e.id;
    });

    var [picksRes,
        pointsRes,
        matchRes] = await Promise.all([
            supabaseClient.from("predictions_1x2")
            .select("entry_id, match_id, pick").in("entry_id", entryIds),
            supabaseClient.from("entry_points")
            .select("entry_id, pool_id, points, played_matches").in("entry_id", entryIds),
            supabaseClient.from("matches")
            .select("id, pool_id, match_no, home_team, away_team, home_goals, away_goals")
            .in("pool_id", entries.map(function(e) {
                return e.pool_id;
            }))
            .order("match_no", {
                ascending: true
            })
        ]);

    var allPicks = picksRes.data || [];
    var allPoints = pointsRes.data || [];
    var allMatches = matchRes.data || [];

    var picksByEntry = {};
    allPicks.forEach(function(p) {
        if (!picksByEntry[p.entry_id]) picksByEntry[p.entry_id] = {};
        picksByEntry[p.entry_id][p.match_id] = p.pick;
    });

    var pointsByEntry = {};
    allPoints.forEach(function(p) {
        pointsByEntry[p.entry_id] = p;
    });

    var matchesByPool = {};
    allMatches.forEach(function(m) {
        if (!matchesByPool[m.pool_id]) matchesByPool[m.pool_id] = [];
        matchesByPool[m.pool_id].push(m);
    });

    function pickLabel(c) {
        return c === "H" ? "L": c === "D" ? "E": c === "A" ? "V": "—";
    }
    function pickColor(c) {
        return c === "H" ? "#34d399": c === "D" ? "#fbbf24": c === "A" ? "#60a5fa": "#4a5568";
    }

    var html = entries.map(function(entry) {
        var pool = poolMap[entry.pool_id] || {};
        var pts = pointsByEntry[entry.id];
        var picks = picksByEntry[entry.id] || {};
        var matches = matchesByPool[entry.pool_id] || [];
        var jornada = pool.round ? "J" + pool.round: (pool.name || "Jornada");
        var statusEmoji = entry.paid ? "✅": "⏳";
        var aciertos = pts ? pts.points: "—";
        var aciertoColor = typeof aciertos === "number" && aciertos > 0 ? "#34d399": "#8a94a6";

        var matchRows = matches.map(function(m) {
            var pick = picks[m.id] || null;
            var hasGoals = m.home_goals !== null && m.away_goals !== null;
            var result = null;
            if (hasGoals) {
                result = m.home_goals > m.away_goals ? "H": m.home_goals < m.away_goals ? "A": "D";
            }
            var correct = pick && result && pick === result;
            var bg = correct ? "rgba(16,185,129,.15)": "rgba(255,255,255,.04)";
            var pickClr = pick ? pickColor(pick): "#4a5568";

            return [
                '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;',
                'border-radius:8px;background:' + bg + ';margin-bottom:4px;">',
                '<div style="font-size:12px;color:#e5e7eb;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">',
                m.home_team + ' vs ' + m.away_team,
                '</div>',
                '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0;margin-left:8px;">',
                pick ? '<span style="font-size:11px;font-weight:800;color:' + pickClr + ';background:rgba(255,255,255,.08);padding:2px 7px;border-radius:6px;">' + pickLabel(pick) + '</span>': '',
                hasGoals ? '<span style="font-size:11px;color:#6b7280;">' + m.home_goals + '-' + m.away_goals + '</span>': '',
                correct ? '<span style="font-size:11px;">✅</span>': (hasGoals && pick ? '<span style="font-size:11px;">❌</span>': ''),
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
            matches.length ? '<div style="padding:10px 12px;">' + matchRows + '</div>': '<div style="padding:12px;font-size:12px;color:#6b7280;">Sin plantilla guardada</div>',
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
    var {
        data: tests,
        error
    } = await supabaseClient.from("participants")
    .select("id, name, is_active")
    .ilike("name", "prueba%");

    if (error) return showAlert(error.message, "error");
    if (!tests || !tests.length) return showAlert("No se encontraron participantes de prueba.", "info");

    var names = tests.map(function(p) {
        return p.name;
    }).join(", ");

    var confirmed = await showConfirmModal( {
        icon: "🗑️",
        title: "Borrar participantes de prueba",
        message: "Se eliminarán: " + names + ". Esta acción NO se puede deshacer.",
        confirmLabel: "Sí, eliminar",
        confirmStyle: "background:linear-gradient(135deg,#be123c,#e11d48);"
    });
    if (!confirmed) return;

    var ids = tests.map(function(p) {
        return p.id;
    });

    // Intentar archivar primero (más seguro — no rompe FK)
    var {
        error: archErr
    } = await supabaseClient.from("participants")
    .update({
        is_active: false
    })
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
    await ensureExportLibraries( {
        pdf: true
    });
    hideAlert();

    var pool_id = $("tplPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

    var pool,
    matches;
    try {
        pool = await getPoolInfo(pool_id);
        matches = await getMatches(pool_id);
    } catch(e) {
        return showAlert(e.message, "error");
    }

    if (!matches || !matches.length)
        return showAlert("Esta jornada no tiene plantilla guardada.", "error");

    // Detectar Goleó hermano de la misma jornada (solo si la plantilla no es ya GOLEO)
    var goleoSibling = null;
    var isGoleoTemplate = (pool && String(pool.mode_code || "").toUpperCase() === "GOLEO");
    if (!isGoleoTemplate) {
        try {
            goleoSibling = await findSiblingGoleoPool(pool);
        } catch (e) {
            console.warn("findSiblingGoleoPool", e);
        }
    }
    var showGoleoOnTicket = !!goleoSibling;
    var goleoPrice = goleoSibling && goleoSibling.price != null ? ("$" + goleoSibling.price) : "";

    // A4 → 794×1123px
    // Auto-layout: ≤15 partidos → 2×4 = 8 copias | >15 partidos → 2×3 = 6 copias (más espacio)
    // Con bloque Goleó extra, si hay muchos partidos preferir 6 copias para no apretar
    var matchCount = matches.length;
    var ROWS = (matchCount > 15 || (showGoleoOnTicket && matchCount > 12)) ? 3 : 4;
    var COPIES = 2 * ROWS;
    var PAGE_W = 794;
    var PAGE_H = 1123;

    var logoUrl = (typeof QUINIELA_LOGO_URL !== "undefined") ? QUINIELA_LOGO_URL: "";
    var jornada = pool && pool.round ? "J" + pool.round: (pool && pool.name ? pool.name: "J?");
    var fechas = pool && pool.date_label ? pool.date_label: "";
    var precio = pool && pool.price ? "$" + pool.price: "";
    var settings = (function() {
        try {
            return JSON.parse(localStorage.getItem("qa_settings") || "{}");
        } catch(e) {
            return {};
        }
    })();
    var adminWa = settings.adminWhatsapp || "8715118046";
    var picksDeadline = settings.picksDeadline || "Viernes 05:00 PM";

    // Font sizes scale down slightly for more partidos
    var nameFontSize = matchCount > 20 ? "7px": "7.5px";
    var rowMinHeight = matchCount > 20 ? "15px": "16px";
    var rowPadding = matchCount > 20 ? "1.5px 0": "2px 0";

    var printArea = $("printArea");
    printArea.classList.remove("hidden");
    printArea.innerHTML = "";

    var page = document.createElement("div");
    page.style.cssText = [
        "width:" + PAGE_W + "px",
        "height:" + PAGE_H + "px",
        "background:#fff",
        "display:grid",
        "grid-template-columns:1fr 1fr",
        "grid-template-rows:repeat(" + ROWS + ",1fr)",
        "gap:5px",
        "padding:7px",
        "box-sizing:border-box",
        "font-family:Arial,Helvetica,sans-serif",
        "color:#111"
    ].join(";");

    for (var i = 0; i < COPIES; i++) {
        var copy = document.createElement("div");
        copy.style.cssText = [
            "border:1.2px solid #888",
            "border-radius:6px",
            "padding:6px 8px 5px 8px",
            "background:#fff",
            "box-sizing:border-box",
            "display:flex",
            "flex-direction:column",
            "color:#111"
        ].join(";");

        // ── HEADER ──
        var header = document.createElement("div");
        header.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:3px;";
        header.innerHTML =
        '<img src="' + logoUrl + '" crossorigin="anonymous"' +
        ' style="width:24px;height:24px;object-fit:contain;border-radius:3px;flex-shrink:0;" />' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:900;font-size:10px;color:#111;line-height:1.2;">Quiniela Arc\u00e1ngel</div>' +
        '<div style="font-size:7.5px;color:#333;line-height:1.3;">' + jornada + (precio ? " \u2022 " + precio: "") + '</div>' +
        (fechas ? '<div style="font-size:7px;color:#555;line-height:1.2;">' + fechas + '</div>': '') +
        '</div>';
        copy.appendChild(header);

        // ── DIVIDER ──
        var div1 = document.createElement("div");
        div1.style.cssText = "height:1px;background:#ccc;margin-bottom:3px;";
        copy.appendChild(div1);

        // ── INSTRUCTION ──
        var instr = document.createElement("div");
        instr.style.cssText = "font-size:7px;color:#555;text-align:center;margin-bottom:3px;font-style:italic;";
        instr.textContent = "Marca una opci\u00f3n por partido";
        copy.appendChild(instr);

        // ── COLUMN HEADERS ──
        // 3-column: [checkbox L + nombre local] | [checkbox E] | [nombre visita + checkbox V]
        var colH = document.createElement("div");
        colH.style.cssText = [
            "display:grid",
            "grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr)",
            "gap:3px",
            "margin-bottom:2px",
            "font-size:7.5px",
            "font-weight:900",
            "color:#333",
            "text-align:center"
        ].join(";");
        colH.innerHTML =
        '<div style="text-align:left;padding-left:16px;">LOCAL</div>' +
        '<div>E</div>' +
        '<div style="text-align:right;padding-right:16px;">VISITA</div>';
        copy.appendChild(colH);

        // ── MATCHES — sin logos, nombres completos ──
        var matchWrap = document.createElement("div");
        matchWrap.style.cssText = "flex:1;display:flex;flex-direction:column;justify-content:space-around;gap:1px;padding:1px 0;";

        matches.forEach(function(m) {
            // Row layout: [□ NOMBRE LOCAL] [□] [NOMBRE VISITA □]
            var row = document.createElement("div");
            row.style.cssText = [
                "display:grid",
                "grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr)",
                "gap:3px",
                "align-items:center",
                "min-height:" + rowMinHeight,
                "padding:" + rowPadding
            ].join(";");

            var BOX = '<div style="width:12px;height:12px;border:1.2px solid #333;border-radius:2px;background:#fff;flex-shrink:0;box-sizing:border-box;display:inline-block;vertical-align:middle;"></div>';
            var EBOX = '<div style="width:12px;height:12px;border:1.2px solid #333;border-radius:2px;background:#fff;box-sizing:border-box;margin:0 auto;"></div>';

            row.innerHTML =
            // Local: checkbox left, then name
            '<div style="display:flex;align-items:center;gap:2px;min-width:0;">' +
            BOX +
            '<span style="font-size:' + nameFontSize + ';font-weight:700;color:#111;line-height:1.3;white-space:nowrap;">' + m.home_team + '</span>' +
            '</div>' +
            // Empate checkbox centered
            EBOX +
            // Visita: name right-aligned, then checkbox
            '<div style="display:flex;align-items:center;justify-content:flex-end;gap:2px;min-width:0;">' +
            '<span style="font-size:' + nameFontSize + ';font-weight:700;color:#111;line-height:1.3;white-space:nowrap;text-align:right;">' + m.away_team + '</span>' +
            BOX +
            '</div>';

            matchWrap.appendChild(row);
        });
        copy.appendChild(matchWrap);

        // ── FOOTER ──
        var div2 = document.createElement("div");
        div2.style.cssText = "height:1px;background:#ccc;margin-top:4px;margin-bottom:4px;";
        copy.appendChild(div2);

        // ── BLOQUE CAMPEÓN DE GOLEÓ (si hay pool GOLEO hermano activo) ──
        if (showGoleoOnTicket) {
            var goleoBox = document.createElement("div");
            goleoBox.style.cssText = [
                "border:1px solid #999",
                "border-radius:4px",
                "padding:3px 5px",
                "margin-bottom:4px",
                "background:#f7f7f7",
                "box-sizing:border-box"
            ].join(";");
            var BOX_G = '<div style="width:11px;height:11px;border:1.3px solid #222;border-radius:2px;background:#fff;flex-shrink:0;box-sizing:border-box;display:inline-block;vertical-align:middle;"></div>';
            goleoBox.innerHTML =
                '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">' +
                BOX_G +
                '<span style="font-size:7.5px;font-weight:800;color:#111;line-height:1.2;">Campe\u00f3n de Gole\u00f3' +
                (goleoPrice ? ' <span style="font-weight:600;color:#444;">(' + goleoPrice + ')</span>' : '') +
                '</span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:4px;padding-left:1px;">' +
                '<span style="font-size:7px;font-weight:700;color:#222;white-space:nowrap;">Total de Goles Jornada:</span>' +
                '<div style="flex:1;height:11px;border-bottom:1px solid #333;min-width:28px;"></div>' +
                '</div>';
            copy.appendChild(goleoBox);
        }

        var footer = document.createElement("div");
        footer.style.cssText = "display:flex;flex-direction:column;gap:4px;";

        ["Nombre",
            "\u00c1rea",
            "*WhatsApp"].forEach(function(label) {
                var field = document.createElement("div");
                field.innerHTML =
                '<div style="font-size:7.5px;font-weight:700;color:#222;margin-bottom:2px;">' + label + ':</div>' +
                '<div style="height:8px;border-bottom:0.8px solid #444;width:100%;"></div>';
                footer.appendChild(field);
            });

        var note = document.createElement("div");
        note.style.cssText = "font-size:6px;color:#666;margin-top:2px;line-height:1.3;";
        note.textContent = "*Registro 1\u00aa vez para env\u00edo de link Plataforma de Resultados";
        footer.appendChild(note);

        copy.appendChild(footer);
        page.appendChild(copy);
    }

    printArea.appendChild(page);

    try {
        var {
            jsPDF
        } = window.jspdf;
        var pdf = new jsPDF( {
            orientation: "portrait", unit: "pt", format: "a4"
        });

        var canvas = await html2canvas(page, {
            scale: 3,
            backgroundColor: "#ffffff",
            useCORS: true,
            allowTaint: false,
            imageTimeout: 10000,
            logging: false
        });

        var imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 4, 4, 587, 834);

        var safeName = (pool && pool.name ? pool.name: "Plantilla")
        .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
        pdf.save(safeName + "-copias-imprimir.pdf");
        var extra = showGoleoOnTicket ? " + bloque Campe\u00f3n de Gole\u00f3" : "";
        showAlert("PDF generado \u2014 " + COPIES + " copias en A4" + extra + " \u2705", "ok");
    } catch(err) {
        showAlert("Error: " + (err && err.message ? err.message: String(err)), "error");
    } finally {
        printArea.innerHTML = "";
        printArea.classList.add("hidden");
    }
}


// ═══════════════════════════════════════════════════
// MEJORA 1: RESUMEN SEMANAL — estado completo de la jornada
// ═══════════════════════════════════════════════════
async function loadWeeklySummary() {
    var wrap = $("weeklySummaryWrap");
    if (!wrap) return;

    var poolRes = await supabaseClient.from("pools")
    .select("id, name, round, status, price, date_label")
    .eq("status", "open").order("created_at", {
        ascending: false
    }).limit(1).maybeSingle();

    if (!poolRes.data) {
        wrap.innerHTML = ""; return;
    }
    var pool = poolRes.data;

    // Boletos
    var entRes = await supabaseClient.from("entries")
    .select("id, participant_id, paid").eq("pool_id", pool.id);
    var entries = entRes.data || [];
    var totalBoletos = entries.length;
    var pagados = entries.filter(function(e) {
        return e.paid;
    }).length;
    var pendientes = totalBoletos - pagados;

    // Picks
    var entryIds = entries.map(function(e) {
        return e.id;
    });
    var matchRes = await supabaseClient.from("matches")
    .select("id", {
        count: "exact", head: true
    }).eq("pool_id", pool.id);
    var totalMatches = matchRes.count || 0;

    var picksCount = {};
    if (entryIds.length && totalMatches) {
        var predsRes = await supabaseClient.from("predictions_1x2")
        .select("entry_id").in("entry_id", entryIds);
        (predsRes.data || []).forEach(function(p) {
            picksCount[p.entry_id] = (picksCount[p.entry_id] || 0) + 1;
        });
    }

    var conPicksCompletos = entries.filter(function(e) {
        return (picksCount[e.id] || 0) >= totalMatches && totalMatches > 0;
    }).length;
    var sinPicks = entries.filter(function(e) {
        return (picksCount[e.id] || 0) === 0;
    }).length;

    // Resultados
    var gresRes = await supabaseClient.from("matches")
    .select("id, home_goals, away_goals").eq("pool_id", pool.id);
    var allMatches = gresRes.data || [];
    var conResultado = allMatches.filter(function(m) {
        return m.home_goals !== null && m.away_goals !== null;
    }).length;

    var jornada = pool.round ? "Jornada " + pool.round: pool.name;

    wrap.innerHTML = [
        '<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">',
        '<div class="flex items-center justify-between mb-3">',
        '<h3 class="font-semibold text-sm">\uD83D\uDCCB Resumen \u2014 ' + jornada + '</h3>',
        '<span class="text-xs text-emerald-400 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">Activa</span>',
        '</div>',
        (pool.date_label ? '<div class="text-xs text-zinc-400 mb-3">\uD83D\uDCC5 ' + pool.date_label + ' \u2022 $' + (pool.price || 0) + ' por boleto</div>': ''),
        '<div class="grid grid-cols-2 gap-2">',
        _summaryKpi("Boletos registrados", totalBoletos, "#fff"),
        _summaryKpi("Pagados ✅", pagados, "#34d399"),
        _summaryKpi("Pendientes pago ⏳", pendientes, pendientes > 0 ? "#fbbf24": "#34d399"),
        _summaryKpi("Picks completos ✅", conPicksCompletos, "#34d399"),
        _summaryKpi("Sin picks ⏰", sinPicks, sinPicks > 0 ? "#f87171": "#34d399"),
        _summaryKpi("Partidos jugados ⚽", conResultado + "/" + totalMatches, "#60a5fa"),
        '</div>',
        '</div>'
    ].join("");
}

function _summaryKpi(label, value, color) {
    return [
        '<div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">',
        '<div class="text-xs text-zinc-400 leading-tight">' + label + '</div>',
        '<div class="text-lg font-black mt-1" style="color:' + color + ';">' + value + '</div>',
        '</div>'
    ].join("");
}

// ═══════════════════════════════════════════════════
// MEJORA 2: BÚSQUEDA RÁPIDA EN PICKS + FLUJO RÁPIDO
// Al guardar, auto-avanza al siguiente participante
// ═══════════════════════════════════════════════════
function initPicksSearch() {
    var searchInput = $("pickSearchInput");
    var select = $("pickParticipant");
    if (!searchInput || !select) return;

    searchInput.addEventListener("input", function() {
        var q = searchInput.value.toLowerCase().trim();
        var opts = Array.from(select.options);
        var match = opts.find(function(o) {
            return o.text.toLowerCase().includes(q);
        });
        if (match) {
            select.value = match.value;
            select.dispatchEvent(new Event("change"));
        }
    });

    searchInput.addEventListener("keydown",
        function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                $("btnLoadEntryForPick") && $("btnLoadEntryForPick").click();
            }
        });
}

// Auto-avance al siguiente participante tras guardar picks
async function savePicksAndNext() {
    await savePicks();
    // Find current participant index and select next
    var sel = $("pickParticipant");
    if (!sel) return;
    var opts = Array.from(sel.options);
    var currentIdx = opts.findIndex(function(o) {
        return o.value === sel.value;
    });
    var nextIdx = currentIdx + 1;
    if (nextIdx < opts.length) {
        sel.value = opts[nextIdx].value;
        // Auto-load next participant
        setTimeout(async function() {
            await loadEntryForPick($("pickPool").value, opts[nextIdx].value);
            // Scroll pick matches into view
            var pm = $("pickMatches");
            if (pm) pm.scrollIntoView({
                behavior: "smooth", block: "start"
            });
        },
            300);
    }
}

// ═══════════════════════════════════════════════════
// MEJORA 3: HISTORIAL DE PAGOS
// ═══════════════════════════════════════════════════
async function showPaymentHistory() {
    hideAlert();
    var pool_id = $("entryPool").value;

    var modal = document.createElement("div");
    modal.id = "payHistModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";
    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="payHistBg"></div>',
        '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px 24px 0 0;padding:20px;max-height:80vh;overflow-y:auto;">',
        '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 14px;"></div>',
        '<div style="font-size:17px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">\uD83D\uDCB3 Historial de Pagos</div>',
        '<div style="font-size:13px;color:#8a94a6;margin-bottom:16px;">Boletos pagados con fecha y hora</div>',
        '<div id="payHistContent" style="display:flex;flex-direction:column;gap:8px;">',
        '<div style="text-align:center;color:#8a94a6;padding:20px;">Cargando...</div>',
        '</div>',
        '<button id="payHistClose" style="width:100%;margin-top:16px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
        'color:#8a94a6;font-size:14px;cursor:pointer;">Cerrar</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("payHistBg").addEventListener("click",
        function() {
            modal.remove();
        });
    document.getElementById("payHistClose").addEventListener("click",
        function() {
            modal.remove();
        });

    // Load paid entries
    var query = supabaseClient.from("entries")
    .select("id, paid, paid_at, created_at, participant_id, participants(name, area)")
    .eq("paid",
        true)
    .order("paid_at",
        {
            ascending: false
        });

    if (pool_id) query = query.eq("pool_id", pool_id);
    else query = query.limit(50);

    var {
        data,
        error
    } = await query;
    var content = document.getElementById("payHistContent");
    if (!content) return;

    if (error || !data || !data.length) {
        content.innerHTML = '<div style="text-align:center;color:#8a94a6;padding:20px;">No hay pagos registrados.</div>';
        return;
    }

    content.innerHTML = data.map(function(e) {
        var name = e.participants ? e.participants.name: "—";
        var area = e.participants ? (e.participants.area || ""): "";
        var paidAt = e.paid_at ? new Date(e.paid_at).toLocaleString("es-MX", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        }): "Fecha desconocida";
        return [
            '<div style="display:flex;align-items:center;justify-content:space-between;',
            'padding:10px 12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);',
            'border-radius:12px;">',
            '<div>',
            '<div style="font-size:14px;font-weight:700;color:#f0f4f8;">' + name + '</div>',
            '<div style="font-size:11px;color:#8a94a6;">' + area + '</div>',
            '</div>',
            '<div style="text-align:right;">',
            '<div style="font-size:11px;color:#34d399;font-weight:600;">\u2705 Pagado</div>',
            '<div style="font-size:10px;color:#6b7280;">' + paidAt + '</div>',
            '</div>',
            '</div>'
        ].join("");
    }).join("");
}

// ═══════════════════════════════════════════════════
// MEJORA 4: BORRAR PICKS DE UN PARTICIPANTE
// ═══════════════════════════════════════════════════
async function clearParticipantPicks() {
    hideAlert();
    if (!currentPickEntryId) return showAlert("Primero carga un boleto.", "error");

    var pool_id = currentPickPoolId || $("pickPool").value;
    var label = $("pickEntryLabel") ? $("pickEntryLabel").textContent: "este participante";

    var confirmed = await showConfirmModal( {
        icon: "🗑️",
        title: "Borrar pronósticos",
        message: 'Se eliminarán TODOS los picks de "' + label.split("•")[0].trim() + '" en esta jornada. ¿Confirmas?',
        confirmLabel: "Sí, borrar picks",
        confirmStyle: "background:linear-gradient(135deg,#be123c,#e11d48);"
    });
    if (!confirmed) return;

    var {
        error
    } = await supabaseClient.from("predictions_1x2")
    .delete().eq("entry_id", currentPickEntryId);

    if (error) return showAlert(error.message, "error");

    showAlert("Picks eliminados. El participante puede volver a enviarlos. ✅", "ok");
    clearPicksSelection();
    await loadPickStatusList();
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
}

// ═══════════════════════════════════════════════════
// MEJORA 5: EXPORTAR LISTA DE PICKS DE TODOS
// ═══════════════════════════════════════════════════
async function exportAllPicksList() {
    hideAlert();
    var pool_id = $("pickPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

    var poolRes = await supabaseClient.from("pools")
    .select("id, name, round").eq("id", pool_id).maybeSingle();
    var pool = poolRes.data;

    var matchRes = await supabaseClient.from("matches")
    .select("id, match_no, home_team, away_team")
    .eq("pool_id", pool_id).order("match_no", {
        ascending: true
    });
    var matches = matchRes.data || [];
    if (!matches.length) return showAlert("No hay partidos en esta jornada.", "error");

    var entRes = await supabaseClient.from("entries")
    .select("id, participant_id").eq("pool_id", pool_id);
    var entries = entRes.data || [];
    if (!entries.length) return showAlert("No hay boletos registrados.", "error");

    var partIds = [...new Set(entries.map(function(e) {
        return e.participant_id;
    }))];
    var partRes = await supabaseClient.from("participants")
    .select("id, name, area").in("id", partIds);
    var partMap = {};
    (partRes.data || []).forEach(function(p) {
        partMap[p.id] = p;
    });

    var entryIds = entries.map(function(e) {
        return e.id;
    });
    var predsRes = await supabaseClient.from("predictions_1x2")
    .select("entry_id, match_id, pick").in("entry_id", entryIds);
    var pickMap = {};
    (predsRes.data || []).forEach(function(p) {
        if (!pickMap[p.entry_id]) pickMap[p.entry_id] = {};
        pickMap[p.entry_id][p.match_id] = p.pick;
    });

    function pl(c) {
        return c === "H" ? "L": c === "D" ? "E": c === "A" ? "V": "-";
    }

    var jornada = pool && pool.round ? "Jornada " + pool.round: (pool && pool.name ? pool.name: "Jornada");
    var header = "Quiniela Arcangel - " + jornada + " - Lista de Pronosticos\n";
    header += matches.map(function(m, i) {
        return (i+1) + ". " + m.home_team + " vs " + m.away_team;
    }).join(" | ") + "\n\n";

    var lines = entries.map(function(entry) {
        var part = partMap[entry.participant_id] || {};
        var picks = pickMap[entry.id] || {};
        var pickStr = matches.map(function(m) {
            return pl(picks[m.id]);
        }).join(" ");
        return (part.name || "?") + ": " + pickStr;
    }).join("\n");

    var text = header + lines;
    var encoded = encodeURIComponent(text);
    window.open("https://wa.me/?text=" + encoded,
        "_blank");
}




// ═══════════════════════════════════════════════
// LEYENDA DE ÍCONOS — PARTICIPANTES
// ═══════════════════════════════════════════════
function showParticipantLegend() {
    var modal = document.createElement("div");
    modal.id = "legendModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";

    var items = [
        ["📱", "Insignia de WhatsApp", "El participante tiene número registrado"],
        ["✅ / 🟡 / ⏰", "Estado de picks", "✅ Completos · 🟡 Incompletos · ⏰ Sin picks"],
        ["🟢 / 📦", "Estado del participante", "🟢 Activo · 📦 Archivado"],
        ["💬", "Abrir WhatsApp", "Abre chat directo con el participante"],
        ["✏️", "Editar", "Editar nombre, área y WhatsApp"],
        ["📋", "Historial de picks", "Ver pronósticos por jornada"],
        ["🎫", "Historial de boletos", "Ver en qué jornadas participó y si pagó"],
        ["📦 / ♻️", "Archivar / Restaurar", "Ocultar o reactivar al participante"],
        ["☑️", "Seleccionar", "Para cambiar área en bloque con ✏️ Área"],
    ];

    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.75);" id="legendBg"></div>',
        '<div style="position:relative;width:100%;max-width:400px;background:#0c1018;',
        'border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:22px;',
        'max-height:80vh;overflow-y:auto;">',
        '<div style="font-size:17px;font-weight:800;color:#f0f4f8;margin-bottom:16px;">❓ Guía de íconos</div>',
        items.map(function(it) {
            return [
                '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);">',
                '<div style="font-size:16px;flex-shrink:0;width:40px;text-align:center;line-height:1.4;">' + it[0] + '</div>',
                '<div>',
                '<div style="font-size:13px;font-weight:700;color:#f0f4f8;">' + it[1] + '</div>',
                '<div style="font-size:11px;color:#8a94a6;margin-top:2px;">' + it[2] + '</div>',
                '</div>',
                '</div>'
            ].join("");
        }).join(""),
        '<button id="legendClose" style="width:100%;margin-top:16px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);',
        'color:#8a94a6;font-size:14px;cursor:pointer;">Cerrar</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("legendBg").addEventListener("click",
        function() {
            modal.remove();
        });
    document.getElementById("legendClose").addEventListener("click",
        function() {
            modal.remove();
        });
}

// ═══════════════════════════════════════════════
// MEJORA 3: EDITAR ÁREA EN BLOQUE
// ═══════════════════════════════════════════════
async function bulkEditArea() {
    hideAlert();

    var newArea = prompt("Nueva área para los participantes seleccionados\n(deja en blanco para cancelar):");
    if (newArea === null || newArea.trim() === "") return;
    newArea = newArea.trim();

    // Get checked participants
    var checked = Array.from(document.querySelectorAll(".participant-bulk-check:checked"))
    .map(function(cb) {
        return cb.getAttribute("data-id");
    });

    if (!checked.length) return showAlert("Selecciona al menos un participante con la casilla ☑️.", "error");

    var confirmed = await showConfirmModal( {
        icon: "✏️",
        title: "Cambiar área en bloque",
        message: "Se cambiará el área de " + checked.length + " participante(s) a \"" + newArea + "\".",
        confirmLabel: "Cambiar área",
        confirmStyle: "background:linear-gradient(135deg,#059669,#10b981);"
    });
    if (!confirmed) return;

    var {
        error
    } = await supabaseClient.from("participants")
    .update({
        area: newArea
    }).in("id", checked);

    if (error) return showAlert(error.message, "error");

    showAlert("Área actualizada en " + checked.length + " participante(s) ✅", "ok");
    resetTabLoaded("tab-participants");
    await loadParticipants();
}

function toggleAllParticipants(masterCb) {
    var checked = masterCb.checked;
    document.querySelectorAll(".participant-bulk-check").forEach(function(cb) {
        cb.checked = checked;
    });
    updateBulkEditBtn();
}

function updateBulkEditBtn() {
    var count = document.querySelectorAll(".participant-bulk-check:checked").length;
    var btn = $("btnBulkEditArea");
    if (btn) {
        btn.textContent = count > 0 ? "✏️ Cambiar área (" + count + ")": "✏️ Cambiar área";
        btn.classList.toggle("opacity-50", count === 0);
    }
}

// ═══════════════════════════════════════════════
// MEJORA 4: INDICADOR VISUAL PICKS EN PARTICIPANTES
// ═══════════════════════════════════════════════
var _picksStatusCache = {};

async function loadParticipantPicksStatus() {
  // TODAS las jornadas abiertas (Sencilla + Goleó + otras)
  const { data: openPools, error: poolErr } = await supabaseClient
    .from("pools")
    .select("id, mode_code")
    .eq("status", "open");

  if (poolErr || !openPools || !openPools.length) {
    document.querySelectorAll("[data-picks-badge]").forEach(function(el) {
      el.textContent = "";
      el.title = "";
    });
    return;
  }

  const poolIds = openPools.map(function(p) { return p.id; });

  // Entries de todas las jornadas activas
  const { data: entries, error: entErr } = await supabaseClient
    .from("entries")
    .select("id, participant_id, pool_id")
    .in("pool_id", poolIds);

  if (entErr) return;
  const allEntries = entries || [];
  if (!allEntries.length) {
    document.querySelectorAll("[data-picks-badge]").forEach(function(el) {
      el.textContent = "";
      el.title = "";
    });
    return;
  }

  // Partidos por pool
  const { data: matches, error: mErr } = await supabaseClient
    .from("matches")
    .select("id, pool_id")
    .in("pool_id", poolIds);

  if (mErr) return;

  const matchesByPool = {};
  (matches || []).forEach(function(m) {
    if (!matchesByPool[m.pool_id]) matchesByPool[m.pool_id] = [];
    matchesByPool[m.pool_id].push(m.id);
  });

  // Total de partidos por pool (solo pools con plantilla 1X2)
  const totalByPool = {};
  poolIds.forEach(function(pid) {
    totalByPool[pid] = (matchesByPool[pid] || []).length;
  });

  // Picks 1X2 de todos los entries
  const entryIds = allEntries.map(function(e) { return e.id; });
  const pickCount = {}; // entry_id → nº de picks

  if (entryIds.length) {
    const BATCH = 500;
    for (let offset = 0; ; offset += BATCH) {
      const { data: page, error: pErr } = await supabaseClient
        .from("predictions_1x2")
        .select("entry_id, match_id")
        .in("entry_id", entryIds)
        .range(offset, offset + BATCH - 1);

      if (pErr) break;
      if (!page || !page.length) break;

      page.forEach(function(p) {
        pickCount[p.entry_id] = (pickCount[p.entry_id] || 0) + 1;
      });

      if (page.length < BATCH) break;
    }
  }

  // Estado por participante (todas sus boletas en todas las jornadas activas)
  // Reglas:
  // - Solo cuentan pools con plantilla (totalMatches > 0). GOLEÓ sin partidos 1X2 no afecta el badge.
  // - complete: todas las boletas relevantes están completas
  // - none: ninguna tiene picks
  // - partial: mezcla
  _picksStatusCache = {};
  const byParticipant = {};

  allEntries.forEach(function(e) {
    if (!byParticipant[e.participant_id]) byParticipant[e.participant_id] = [];
    byParticipant[e.participant_id].push(e);
  });

  Object.keys(byParticipant).forEach(function(participantId) {
    const participantEntries = byParticipant[participantId];

    // Solo entries de pools con plantilla 1X2
    const relevant = participantEntries.filter(function(e) {
      return (totalByPool[e.pool_id] || 0) > 0;
    });

    if (!relevant.length) {
      // Solo Goleó (sin 1X2) u otras sin plantilla → sin badge de picks 1X2
      return;
    }

    const statuses = relevant.map(function(e) {
      const total = totalByPool[e.pool_id] || 0;
      const count = pickCount[e.id] || 0;
      if (count >= total && total > 0) return "complete";
      if (count === 0) return "none";
      return "partial";
    });

    const allComplete = statuses.every(function(s) { return s === "complete"; });
    const allEmpty = statuses.every(function(s) { return s === "none"; });

    _picksStatusCache[participantId] = {
      complete: allComplete,
      partial: !allComplete && !allEmpty,
      none: allEmpty
    };
  });

  // Pintar badges en el DOM
  document.querySelectorAll("[data-picks-badge]").forEach(function(el) {
    const pid = el.getAttribute("data-picks-badge");
    const status = _picksStatusCache[pid];

    if (!status) {
      el.textContent = "";
      el.title = "";
      return;
    }

    if (status.complete) {
      el.textContent = "✅";
      el.title = "Picks completos en todas las jornadas activas";
    } else if (status.partial) {
      el.textContent = "🟡";
      el.title = "Picks incompletos en alguna jornada activa";
    } else {
      el.textContent = "⏰";
      el.title = "Sin picks en las jornadas activas";
    }
  });
}

// ═══════════════════════════════════════════════
// MEJORA 5: VISTA COMPACTA DE TODOS LOS PICKS
// ═══════════════════════════════════════════════
async function showPicksCompactView() {
    hideAlert();
    var pool_id = $("pickPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

    var modal = document.createElement("div");
    modal.id = "picksTableModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";
    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.75);" id="picksTableBg"></div>',
        '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px 24px 0 0;padding:20px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">',
        '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 14px;"></div>',
        '<div style="font-size:16px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">📊 Todos los pronósticos</div>',
        '<div id="picksTableContent" style="overflow:auto;flex:1;margin-top:12px;-webkit-overflow-scrolling:touch;">',
        '<div style="text-align:center;color:#8a94a6;padding:20px;">Cargando...</div>',
        '</div>',
        '<button id="picksTableClose" style="width:100%;margin-top:12px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#8a94a6;font-size:14px;cursor:pointer;">',
        'Cerrar',
        '</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("picksTableBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("picksTableClose").addEventListener("click", function() {
        modal.remove();
    });

    // Load data
    var [matchRes,
        entRes] = await Promise.all([
            supabaseClient.from("matches").select("id, match_no, home_team, away_team")
            .eq("pool_id", pool_id).order("match_no", {
                ascending: true
            }),
            supabaseClient.from("entries").select("id, participant_id")
            .eq("pool_id", pool_id)
        ]);

    var matches = matchRes.data || [];
    var entries = entRes.data || [];
    if (!matches.length || !entries.length) {
        document.getElementById("picksTableContent").innerHTML =
        '<div style="color:#8a94a6;padding:20px;text-align:center;">Sin datos.</div>';
        return;
    }

    var partIds = [...new Set(entries.map(function(e) {
        return e.participant_id;
    }))];
    var [partRes,
        predsRes] = await Promise.all([
            supabaseClient.from("participants").select("id, name").in("id", partIds),
            supabaseClient.from("predictions_1x2").select("entry_id, match_id, pick")
            .in("entry_id", entries.map(function(e) {
                return e.id;
            }))
        ]);

    var partMap = {};
    (partRes.data || []).forEach(function(p) {
        partMap[p.id] = p.name;
    });

    var entryToParticipant = {};
    entries.forEach(function(e) {
        entryToParticipant[e.id] = e.participant_id;
    });

    var pickMap = {};
    (predsRes.data || []).forEach(function(p) {
        var pid = entryToParticipant[p.entry_id];
        if (!pickMap[pid]) pickMap[pid] = {};
        pickMap[pid][p.match_id] = p.pick;
    });

    function pickLabel(c) {
        return c === "H" ? '<span style="color:#34d399;font-weight:800;">L</span>': c === "D" ? '<span style="color:#fbbf24;font-weight:800;">E</span>': c === "A" ? '<span style="color:#60a5fa;font-weight:800;">V</span>': '<span style="color:#4b5563;">-</span>';
    }

    // Build table
    var colW = "28px";
    var headerRow = '<tr style="border-bottom:1px solid rgba(255,255,255,.1);">' +
    '<th style="text-align:left;padding:6px 8px;font-size:11px;color:#8a94a6;white-space:nowrap;position:sticky;left:0;background:#0c1018;z-index:1;">Participante</th>' +
    matches.map(function(m) {
        return '<th style="text-align:center;padding:4px 2px;font-size:9px;color:#8a94a6;width:' + colW + ';min-width:' + colW + ';">' +
        m.home_team.substring(0, 3) + '<br>vs<br>' + m.away_team.substring(0, 3) + '</th>';
    }).join("") +
    '</tr>';

    var bodyRows = partIds.map(function(pid) {
        var name = partMap[pid] || "?";
        var picks = pickMap[pid] || {};
        var allComplete = matches.every(function(m) {
            return picks[m.id];
        });
        var rowBg = allComplete ? "rgba(16,185,129,.05)": "transparent";
        return '<tr style="border-bottom:1px solid rgba(255,255,255,.05);background:' + rowBg + ';">' +
        '<td style="padding:6px 8px;font-size:11px;font-weight:700;color:#f0f4f8;white-space:nowrap;' +
        'position:sticky;left:0;background:' + (allComplete ? "#061a12": "#0c1018") + ';z-index:1;">' + name + '</td>' +
        matches.map(function(m) {
            return '<td style="text-align:center;padding:4px 2px;font-size:12px;">' + pickLabel(picks[m.id]) + '</td>';
        }).join("") +
        '</tr>';
    }).join("");

    document.getElementById("picksTableContent").innerHTML =
    '<table style="border-collapse:collapse;width:100%;font-size:12px;">' +
    '<thead>' + headerRow + '</thead>' +
    '<tbody>' + bodyRows + '</tbody>' +
    '</table>';
}

// ═══════════════════════════════════════════════
// MEJORA 6: EDITAR PICK INDIVIDUAL DESDE LA LISTA
// ═══════════════════════════════════════════════
async function editSinglePick(entryId, matchId, matchLabel, currentPick) {
    var opts = [{
        pick: "H", label: "LOCAL", icon: "🟢"
    },
        {
            pick: "D", label: "EMPATE", icon: "🟡"
        },
        {
            pick: "A", label: "VISITA", icon: "🔵"
        },
    ];

    var modal = document.createElement("div");
    modal.id = "editPickModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";

    var btnsHtml = opts.map(function(o) {
        var isActive = o.pick === currentPick;
        var activeCss = isActive ? "border:2px solid #10b981;background:rgba(16,185,129,.15);": "border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);";
        return '<button class="edit-pick-opt" data-pick="' + o.pick + '" style="' + activeCss +
        'padding:14px;border-radius:14px;color:#f0f4f8;font-size:15px;font-weight:700;cursor:pointer;text-align:center;width:100%;">' +
        o.icon + ' ' + o.label + '</button>';
    }).join("");

    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="editPickBg"></div>',
        '<div style="position:relative;width:100%;max-width:340px;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px;padding:24px;">',
        '<div style="font-size:16px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">Editar pronóstico</div>',
        '<div style="font-size:12px;color:#8a94a6;margin-bottom:16px;">' + matchLabel + '</div>',
        '<div style="display:flex;flex-direction:column;gap:8px;">' + btnsHtml + '</div>',
        '<button id="editPickCancel" style="width:100%;margin-top:12px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
        'color:#8a94a6;font-size:14px;cursor:pointer;">Cancelar</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);

    document.getElementById("editPickBg").addEventListener("click",
        function() {
            modal.remove();
        });
    document.getElementById("editPickCancel").addEventListener("click",
        function() {
            modal.remove();
        });

    modal.querySelectorAll(".edit-pick-opt").forEach(function(btn) {
        btn.addEventListener("click", async function() {
            var pick = btn.getAttribute("data-pick");
            modal.remove();

            var {
                error
            } = await supabaseClient.from("predictions_1x2")
            .upsert([{
                entry_id: entryId, match_id: matchId, pick: pick
            }],
                {
                    onConflict: "entry_id,match_id"
                });

            if (error) return showAlert(error.message, "error");
            showAlert("Pick actualizado ✅", "ok");
            await loadPickStatusList();
        });
    });
}

// ═══════════════════════════════════════════════
// MEJORA 7: GUARDAR RESULTADO PARTIDO POR PARTIDO
// ═══════════════════════════════════════════════
async function saveOneResult(matchId) {
    var homeInput = document.querySelector('[data-result-home="' + matchId + '"]');
    var awayInput = document.querySelector('[data-result-away="' + matchId + '"]');
    if (!homeInput || !awayInput) return;

    var hg = homeInput.value.trim();
    var ag = awayInput.value.trim();
    if (hg === "" || ag === "") return showAlert("Captura ambos goles antes de guardar.", "error");

    var btn = document.querySelector('[data-save-row="' + matchId + '"]');
    if (btn) {
        btn.disabled = true; btn.textContent = "⏳";
    }

    var {
        error
    } = await supabaseClient.from("matches")
    .update({
        home_goals: Number(hg), away_goals: Number(ag)
    })
    .eq("id", matchId);

    if (btn) {
        btn.disabled = false; btn.textContent = "💾";
    }

    if (error) return showAlert(error.message, "error");

    // Visual feedback on the row
    var outcomeEl = document.querySelector('[data-result-outcome="' + matchId + '"]');
    var totalEl = document.querySelector('[data-result-total="' + matchId + '"]');
    var home = Number(hg),
    away = Number(ag);
    if (outcomeEl) outcomeEl.textContent = home > away ? "Local": home === away ? "Empate": "Visita";
    if (totalEl) totalEl.textContent = home + away;

    updateResultsGoalsSummary();
    showAlert("Resultado guardado ✅", "ok");

    // Sincronizar este partido a pools hermanos
    try {
        const { data: matchRow } = await supabaseClient
            .from("matches")
            .select("id, pool_id, match_no")
            .eq("id", matchId)
            .maybeSingle();

        if (matchRow && matchRow.pool_id != null) {
            await syncMatchResultsToSiblingPools(matchRow.pool_id, [{
                match_no: matchRow.match_no,
                home_goals: home,
                away_goals: away
            }]);
        }
    } catch (syncErr) {
        console.warn("syncMatchResultsToSiblingPools (one) falló", syncErr);
    }

    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
}



// ═══════════════════════════════════════════════
// MEJORA 1: REGISTRAR BOLETO + PAGO EN UN PASO
// ═══════════════════════════════════════════════
async function addEntryAndPay() {
    hideAlert();

    const pool_id = $("entryPool").value;
    const participant_id = $("entryParticipant").value;

    if (!pool_id || !participant_id)
        return showAlert("Falta seleccionar jornada o participante.", "error");

    const {
        data: poolInfo,
        error: poolErr
    } = await supabaseClient
    .from("pools").select("id, status, price").eq("id", pool_id).maybeSingle();

    if (poolErr) return showAlert(poolErr.message, "error");
    if (!poolInfo || poolInfo.status !== "open")
        return showAlert("Esta jornada ya está cerrada.", "error");

    const confirmed = await showConfirmModal( {
        icon: "💰",
        title: "Registrar y marcar pagado",
        message: "Se registrará el boleto y se marcará como PAGADO al instante.",
        confirmLabel: "✅ Registrar y pagar",
        confirmStyle: "background:linear-gradient(135deg,#059669,#10b981);"
    });
    if (!confirmed) return;

    const {
        error
    } = await supabaseClient.from("entries").insert({
            pool_id, participant_id,
            paid: true,
            paid_at: new Date().toISOString()
        });

    if (error) return showAlert(error.message, "error");

    showAlert("Boleto registrado y pagado ✅", "ok");
    $("entryPaid").checked = false;
    await loadEntriesAndStats();
    await fillPickParticipantsSelect();
    await loadPickStatusList();
    await loadDashboardSummary();
    clearNavBadgesCache();
    await updateNavBadges( {
        force: true
    });
}

// ═══════════════════════════════════════════════
// MEJORA 2: FILTRO POR ÁREA EN PAGOS
// ═══════════════════════════════════════════════
var currentAreaFilter = "all";

async function loadAreaFilterOptions() {
    var sel = $("areaFilter");
    if (!sel) return;

    var {
        data,
        error
    } = await supabaseClient
    .from("participants")
    .select("area")
    .eq("is_active", true);

    if (error || !data) return;

    var areas = [...new Set(
        data.map(function(p) {
            return (p.area || "").trim();
        })
        .filter(Boolean)
    )].sort();

    sel.innerHTML = '<option value="all">Todas las áreas</option>' +
    areas.map(function(a) {
        return '<option value="' + a + '">' + a + '</option>';
    }).join("");
    refreshPremiumSelect("areaFilter");
}

function applyAreaFilter() {
    var sel = $("areaFilter");
    currentAreaFilter = sel ? sel.value: "all";

    document.querySelectorAll(".entry-card").forEach(function(card) {
        var area = card.getAttribute("data-area") || "";
        var show = currentAreaFilter === "all" || area === currentAreaFilter;
        card.style.display = show ? "": "none";
    });
}

// ═══════════════════════════════════════════════
// MEJORA 3: GRÁFICA DE ACIERTOS POR JORNADA
// ═══════════════════════════════════════════════
async function loadAccuracyChart() {
    var wrap = $("accuracyChartWrap");
    if (!wrap) return;

    // Get all closed pools with results
    var poolsRes = await supabaseClient.from("pools")
    .select("id, round, name")
    .order("round", {
        ascending: true
    })
    .limit(30);
    var pools = (poolsRes.data || []);
    if (pools.length < 2) {
        wrap.innerHTML = ""; return;
    }

    var poolIds = pools.map(function(p) {
        return p.id;
    });

    // Get entry_points for all pools
    var epRes = await supabaseClient.from("entry_points")
    .select("pool_id, participant_id, points")
    .in("pool_id", poolIds);
    var ep = epRes.data || [];

    // Compute avg points per pool
    var statsByPool = {};
    pools.forEach(function(p) {
        statsByPool[p.id] = {
            sum: 0, count: 0, max: 0
        };
    });
    ep.forEach(function(r) {
        if (!statsByPool[r.pool_id]) return;
        statsByPool[r.pool_id].sum += Number(r.points || 0);
        statsByPool[r.pool_id].count += 1;
        if (Number(r.points) > statsByPool[r.pool_id].max) statsByPool[r.pool_id].max = Number(r.points);
    });

    var labels = [];
    var avgData = [];
    var maxData = [];

    pools.forEach(function(p) {
        var s = statsByPool[p.id];
        if (!s || s.count === 0) return;
        labels.push(p.round ? "J" + p.round: (p.name || "?"));
        avgData.push(parseFloat((s.sum / s.count).toFixed(1)));
        maxData.push(s.max);
    });

    if (labels.length < 2) {
        wrap.innerHTML = ""; return;
    }

    // Si el contenedor está oculto (otra pestaña), no crear canvas:
    // un canvas en display:none o con tamaño 0 provoca createPattern en html2canvas.
    var measured = Math.floor(wrap.getBoundingClientRect().width || wrap.clientWidth || 0);
    if (measured < 40) {
        wrap.innerHTML = [
            '<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">',
            '<div class="flex items-center justify-between mb-3">',
            '<h3 class="font-semibold text-sm">📈 Aciertos por Jornada</h3>',
            '</div>',
            '<div class="text-xs text-zinc-500 py-6 text-center">Se mostrará al volver a Inicio</div>',
            '</div>'
        ].join("");
        return;
    }

    wrap.innerHTML = [
        '<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">',
        '<div class="flex items-center justify-between mb-3">',
        '<h3 class="font-semibold text-sm">📈 Aciertos por Jornada</h3>',
        '<div class="flex gap-3 text-xs text-zinc-400">',
        '<span><span class="inline-block w-3 h-1 bg-emerald-400 rounded mr-1"></span>Promedio</span>',
        '<span><span class="inline-block w-3 h-1 bg-sky-400 rounded mr-1"></span>Máximo</span>',
        '</div>',
        '</div>',
        '<canvas id="accuracyCanvas" width="300" height="140" style="width:100%;max-width:100%;display:block;"></canvas>',
        '</div>'
    ].join("");

    var canvas = document.getElementById("accuracyCanvas");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = Math.max(260, measured - 32);
    canvas.height = 140;

    var W = canvas.width,
    H = canvas.height;
    var pad = {
        t: 10,
        r: 10,
        b: 28,
        l: 28
    };
    var chartW = W - pad.l - pad.r;
    var chartH = H - pad.t - pad.b;

    var allVals = avgData.concat(maxData);
    var minV = 0;
    var maxV = Math.max.apply(null, allVals) + 1;

    function xPos(i) {
        return pad.l + (i / (labels.length - 1)) * chartW;
    }
    function yPos(v) {
        return pad.t + chartH - ((v - minV) / (maxV - minV)) * chartH;
    }

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) {
        var gy = pad.t + (g / 4) * chartH;
        ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
    }

    function drawLine(data, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        data.forEach(function(v, i) {
            if (i === 0) ctx.moveTo(xPos(i), yPos(v));
            else ctx.lineTo(xPos(i), yPos(v));
        });
        ctx.stroke();
        // Dots
        data.forEach(function(v, i) {
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(xPos(i), yPos(v), 3.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawLine(maxData,
        "#38bdf8");
    drawLine(avgData,
        "#34d399");

    // X labels
    ctx.fillStyle = "#8a94a6";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    labels.forEach(function(l, i) {
        ctx.fillText(l, xPos(i), H - 6);
    });

    // Y labels
    ctx.textAlign = "right";
    for (var yl = 0; yl <= 4; yl++) {
        var v2 = minV + (yl / 4) * (maxV - minV);
        ctx.fillText(Math.round(v2), pad.l - 4, pad.t + chartH - (yl / 4) * chartH + 4);
    }
}

// ═══════════════════════════════════════════════
// MEJORA 4: RECORDAR ÚLTIMO PARTICIPANTE EN PICKS
// ═══════════════════════════════════════════════
var _lastPickParticipant = null;
var _lastPickPool = null;

function saveLastPickSelection() {
    var pool = $("pickPool");
    var part = $("pickParticipant");
    if (pool && pool.value) _lastPickPool = pool.value;
    if (part && part.value) _lastPickParticipant = part.value;
}

async function restoreLastPickSelection() {
    if (!_lastPickPool && !_lastPickParticipant) return;
    var pool = $("pickPool");
    var part = $("pickParticipant");
    if (pool && _lastPickPool && pool.querySelector('[value="' + _lastPickPool + '"]')) {
        pool.value = _lastPickPool;
        await fillPickParticipantsSelect();
    }
    if (part && _lastPickParticipant && part.querySelector('[value="' + _lastPickParticipant + '"]')) {
        part.value = _lastPickParticipant;
        // Auto-load the entry
        if (_lastPickPool) await loadEntryForPick(_lastPickPool, _lastPickParticipant);
    }
}

// ═══════════════════════════════════════════════
// MEJORA 5: HISTORIAL DE BOLETOS POR PARTICIPANTE
// ═══════════════════════════════════════════════
async function showParticipantEntryHistory(participantId, participantName) {
    hideAlert();
    if (!participantId) return;

    var modal = document.createElement("div");
    modal.id = "entryHistModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";
    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="entryHistBg"></div>',
        '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px 24px 0 0;padding:20px;max-height:82vh;overflow-y:auto;">',
        '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 14px;"></div>',
        '<div style="font-size:17px;font-weight:800;color:#f0f4f8;margin-bottom:2px;">🎫 Historial de boletos</div>',
        '<div style="font-size:13px;color:#8a94a6;margin-bottom:16px;">' + participantName + '</div>',
        '<div id="entryHistContent"><div style="text-align:center;color:#8a94a6;padding:20px;">Cargando...</div></div>',
        '<button id="exportStatementBtn" style="width:100%;margin-bottom:10px;padding:12px;border-radius:14px;background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">📊 Estado de cuenta por WA</button>',
        '<button id="entryHistClose" style="width:100%;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
        'color:#8a94a6;font-size:14px;cursor:pointer;">Cerrar</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("entryHistBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("entryHistClose").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("exportStatementBtn").addEventListener("click", function() {
        exportParticipantStatement(participantId, participantName);
    });

    var [entriesRes,
        poolsRes] = await Promise.all([
            supabaseClient.from("entries")
            .select("id, pool_id, paid, paid_at, created_at")
            .eq("participant_id", participantId)
            .order("created_at", {
                ascending: false
            }),
            supabaseClient.from("pools")
            .select("id, round, name, status, competition, season, price")
        ]);

    var entries = entriesRes.data || [];
    var poolMap = {};
    (poolsRes.data || []).forEach(function(p) {
        poolMap[p.id] = p;
    });

    var content = document.getElementById("entryHistContent");
    if (!entries.length) {
        content.innerHTML = '<div style="text-align:center;color:#8a94a6;padding:20px;">Sin boletos registrados.</div>';
        return;
    }

    // Get points for each entry
    var entryIds = entries.map(function(e) {
        return e.id;
    });
    var ptRes = await supabaseClient.from("entry_points")
    .select("entry_id, points, played_matches, captured_picks")
    .in("entry_id", entryIds);
    var ptMap = {};
    (ptRes.data || []).forEach(function(r) {
        ptMap[r.entry_id] = r;
    });

    // Stats summary
    var totalBoletos = entries.length;
    var totalPagados = entries.filter(function(e) {
        return e.paid;
    }).length;

    content.innerHTML = [
        // Summary
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">',
        '<div style="padding:10px;background:rgba(255,255,255,.05);border-radius:12px;text-align:center;">',
        '<div style="font-size:11px;color:#8a94a6;">Jornadas</div>',
        '<div style="font-size:20px;font-weight:900;color:#fff;">' + totalBoletos + '</div>',
        '</div>',
        '<div style="padding:10px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:12px;text-align:center;">',
        '<div style="font-size:11px;color:#8a94a6;">Pagados</div>',
        '<div style="font-size:20px;font-weight:900;color:#34d399;">' + totalPagados + '</div>',
        '</div>',
        '<div style="padding:10px;background:rgba(255,255,255,.05);border-radius:12px;text-align:center;">',
        '<div style="font-size:11px;color:#8a94a6;">Pendientes</div>',
        '<div style="font-size:20px;font-weight:900;color:#fbbf24;">' + (totalBoletos - totalPagados) + '</div>',
        '</div>',
        '</div>',
        // Entry list
        entries.map(function(e) {
            var pool = poolMap[e.pool_id] || {};
            var pt = ptMap[e.id];
            var jornada = pool.round ? "Jornada " + pool.round: (pool.name || "—");
            var paidColor = e.paid ? "rgba(16,185,129,.1)": "rgba(255,255,255,.04)";
            var paidBorder = e.paid ? "rgba(16,185,129,.25)": "rgba(255,255,255,.08)";
            var statusIcon = e.paid ? "✅": "⏳";
            var paidDate = e.paid && e.paid_at
            ? new Date(e.paid_at).toLocaleDateString("es-MX", {
                day: "2-digit", month: "short", year: "numeric"
            }): "";
            var pts = pt ? pt.points: null;

            return [
                '<div style="padding:12px 14px;border-radius:14px;border:1px solid ' + paidBorder + ';background:' + paidColor + ';margin-bottom:8px;">',
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">',
                '<div>',
                '<div style="font-size:14px;font-weight:800;color:#f0f4f8;">' + jornada + '</div>',
                '<div style="font-size:11px;color:#8a94a6;margin-top:2px;">' + (pool.competition || "Liga MX") + (pool.season ? " · " + pool.season: "") + '</div>',
                paidDate ? '<div style="font-size:11px;color:#34d399;margin-top:2px;">Pagó: ' + paidDate + '</div>': '',
                '</div>',
                '<div style="text-align:right;flex-shrink:0;">',
                '<div style="font-size:18px;">' + statusIcon + '</div>',
                pts !== null
                ? '<div style="font-size:13px;font-weight:800;color:#60a5fa;margin-top:2px;">' + pts + ' ac.</div>': '',
                '</div>',
                '</div>',
                '</div>'
            ].join("");
        }).join("")
    ].join("");
}



// ═══════════════════════════════════════════════
// MEJORA 1: COMPARATIVA PICKS VS RESULTADO
// Click en fila de la tabla → ver picks de todos
// ═══════════════════════════════════════════════
async function showPicksVsResults(poolId) {
    hideAlert();
    if (!poolId) return showAlert("Selecciona una jornada primero.", "error");

    var modal = document.createElement("div");
    modal.id = "picksVsModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";
    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.78);" id="picksVsBg"></div>',
        '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px 24px 0 0;padding:20px;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;">',
        '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 14px;"></div>',
        '<div style="font-size:16px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">⚡ Picks vs Resultados</div>',
        '<div id="picksVsContent" style="overflow:auto;flex:1;-webkit-overflow-scrolling:touch;margin-top:10px;">',
        '<div style="text-align:center;color:#8a94a6;padding:20px;">Cargando...</div>',
        '</div>',
        '<button id="picksVsClose" style="width:100%;margin-top:12px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#8a94a6;font-size:14px;cursor:pointer;">',
        'Cerrar',
        '</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("picksVsBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("picksVsClose").addEventListener("click", function() {
        modal.remove();
    });

    // Load data
    var [matchRes,
        entRes] = await Promise.all([
            supabaseClient.from("matches").select("id, match_no, home_team, away_team, home_goals, away_goals")
            .eq("pool_id", poolId).order("match_no", {
                ascending: true
            }),
            supabaseClient.from("entries").select("id, participant_id, paid")
            .eq("pool_id", poolId)
        ]);

    var matches = matchRes.data || [];
    var entries = entRes.data || [];

    var partIds = [...new Set(entries.map(function(e) {
        return e.participant_id;
    }))];
    var [partRes,
        predsRes] = await Promise.all([
            supabaseClient.from("participants").select("id, name, area").in("id", partIds),
            supabaseClient.from("predictions_1x2").select("entry_id, match_id, pick")
            .in("entry_id", entries.map(function(e) {
                return e.id;
            }))
        ]);

    var partMap = {};
    (partRes.data || []).forEach(function(p) {
        partMap[p.id] = p;
    });

    var entryToParticipant = {};
    entries.forEach(function(e) {
        entryToParticipant[e.id] = e.participant_id;
    });

    var pickMap = {};
    (predsRes.data || []).forEach(function(p) {
        var pid = entryToParticipant[p.entry_id];
        if (!pickMap[pid]) pickMap[pid] = {};
        pickMap[pid][p.match_id] = p.pick;
    });

    // Real results
    var resultMap = {};
    matches.forEach(function(m) {
        if (m.home_goals !== null && m.away_goals !== null) {
            resultMap[m.id] = m.home_goals > m.away_goals ? "H": m.home_goals < m.away_goals ? "A": "D";
        }
    });

    function pickIcon(pick,
        matchId) {
        var real = resultMap[matchId];
        var label = pick === "H" ? "L": pick === "D" ? "E": pick === "A" ? "V": "–";
        if (!pick) return '<span style="color:#4b5563;font-size:11px;">–</span>';
        if (!real) return '<span style="color:#8a94a6;font-weight:700;font-size:11px;">' + label + '</span>';
        var ok = pick === real;
        return '<span style="font-weight:800;font-size:11px;color:' + (ok ? "#34d399": "#f87171") + ';">' + label + (ok ? "✓": "✗") + '</span>';
    }

    var colW = "32px";
    var resultRow = '<tr style="border-bottom:2px solid rgba(255,255,255,.1);">' +
    '<th style="text-align:left;padding:6px 8px;font-size:10px;color:#fbbf24;position:sticky;left:0;background:#0c1018;z-index:1;">Resultado</th>' +
    matches.map(function(m) {
        var r = resultMap[m.id];
        var lbl = r === "H" ? "L": r === "D" ? "E": r === "A" ? "V": "–";
        return '<td style="text-align:center;width:' + colW + ';font-size:11px;font-weight:800;color:' + (r ? "#fbbf24": "#4b5563") + ';">' + lbl + '</td>';
    }).join("") + '</tr>';

    var headerRow = '<tr style="border-bottom:1px solid rgba(255,255,255,.08);">' +
    '<th style="text-align:left;padding:6px 8px;font-size:10px;color:#8a94a6;white-space:nowrap;position:sticky;left:0;background:#0c1018;z-index:1;">Participante</th>' +
    matches.map(function(m) {
        return '<th style="text-align:center;padding:4px 2px;font-size:8px;color:#6b7280;width:' + colW + ';min-width:' + colW + ';">' +
        m.home_team.substring(0, 3) + '<br>' + m.away_team.substring(0, 3) + '</th>';
    }).join("") +
    '<th style="text-align:center;font-size:9px;color:#8a94a6;padding:4px 6px;">✓</th>' +
    '</tr>';

    var bodyRows = partIds.map(function(pid) {
        var part = partMap[pid] || {
            name: "?"
        };
        var picks = pickMap[pid] || {};
        var hits = matches.filter(function(m) {
            return picks[m.id] && picks[m.id] === resultMap[m.id];
        }).length;
        var hasResults = Object.keys(resultMap).length > 0;

        return '<tr style="border-bottom:1px solid rgba(255,255,255,.04);">' +
        '<td style="padding:6px 8px;font-size:11px;font-weight:700;color:#f0f4f8;white-space:nowrap;position:sticky;left:0;background:#0c1018;z-index:1;">' +
        part.name + (part.area ? '<br><span style="font-size:9px;color:#6b7280;">' + part.area + '</span>': '') +
        '</td>' +
        matches.map(function(m) {
            return '<td style="text-align:center;padding:4px 2px;">' + pickIcon(picks[m.id], m.id) + '</td>';
        }).join("") +
        (hasResults
            ? '<td style="text-align:center;font-size:12px;font-weight:800;color:#34d399;padding:4px 6px;">' + hits + '</td>': '<td style="text-align:center;color:#4b5563;font-size:11px;">–</td>') +
        '</tr>';
    }).join("");

    document.getElementById("picksVsContent").innerHTML =
    '<table style="border-collapse:collapse;width:100%;font-size:12px;">' +
    '<thead>' + headerRow + resultRow + '</thead>' +
    '<tbody>' + bodyRows + '</tbody>' +
    '</table>';
}

// ═══════════════════════════════════════════════
// MEJORA 2: DUPLICAR PLANTILLA DE JORNADA
// ═══════════════════════════════════════════════
async function duplicatePoolMatches(fromPoolId) {
    hideAlert();
    if (!fromPoolId) return showAlert("Selecciona la jornada a copiar.", "error");

    // Get target pool (must be draft or active)
    var {
        data: pools
    } = await supabaseClient.from("pools")
    .select("id, name, round, status")
    .in("status", ["draft", "open"])
    .order("created_at", {
        ascending: false
    });

    if (!pools || !pools.length)
        return showAlert("No hay jornadas en borrador o activas para copiar la plantilla.", "error");

    // Show pool picker
    var modal = document.createElement("div");
    modal.id = "dupModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";

    var poolOptions = pools.filter(function(p) {
        return p.id !== fromPoolId;
    })
    .map(function(p) {
        return '<button class="dup-target-btn w-full text-left p-3 rounded-xl border border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 text-sm font-semibold text-white mb-2" data-id="' + p.id + '">' +
        (p.round ? "Jornada " + p.round: p.name) + '<span class="text-xs text-zinc-400 ml-2">' + p.status + '</span>' +
        '</button>';
    }).join("");

    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" id="dupBg"></div>',
        '<div style="position:relative;width:100%;max-width:360px;background:#0c1018;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:22px;">',
        '<div style="font-size:16px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">📋 Copiar partidos a...</div>',
        '<div style="font-size:12px;color:#8a94a6;margin-bottom:14px;">Selecciona la jornada destino</div>',
        '<div id="dupPoolList">' + poolOptions + '</div>',
        '<button id="dupClose" style="width:100%;margin-top:8px;padding:11px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#8a94a6;font-size:14px;cursor:pointer;">Cancelar</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("dupBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("dupClose").addEventListener("click", function() {
        modal.remove();
    });

    modal.querySelectorAll(".dup-target-btn").forEach(function(btn) {
        btn.addEventListener("click", async function() {
            var toPoolId = btn.getAttribute("data-id");
            modal.remove();

            var confirmed = await showConfirmModal( {
                icon: "📋",
                title: "Copiar partidos",
                message: "Se copiarán los partidos a la jornada destino. ¿Confirmas?",
                confirmLabel: "Sí, copiar",
                confirmStyle: "background:linear-gradient(135deg,#059669,#10b981);"
            });
            if (!confirmed) return;

            var {
                data: srcMatches,
                error: mErr
            } = await supabaseClient.from("matches")
            .select("match_no, home_team, away_team")
            .eq("pool_id", fromPoolId)
            .order("match_no", {
                ascending: true
            });

            if (mErr || !srcMatches || !srcMatches.length)
                return showAlert("La jornada origen no tiene partidos.", "error");

            var newMatches = srcMatches.map(function(m) {
                return {
                    pool_id: toPoolId, match_no: m.match_no, home_team: m.home_team, away_team: m.away_team
                };
            });

            // Delete existing matches in target first
            await supabaseClient.from("matches").delete().eq("pool_id", toPoolId);

            var {
                error: insErr
            } = await supabaseClient.from("matches").insert(newMatches);
            if (insErr) return showAlert("Error copiando: " + insErr.message, "error");

            showAlert(srcMatches.length + " partidos copiados exitosamente ✅", "ok");
            resetTabLoaded("tab-templates");
            await fillTplPools();
        });
    });
}

// ═══════════════════════════════════════════════
// MEJORA 3: VISTA BOLETA FÍSICA CON RESULTADOS
// ═══════════════════════════════════════════════
async function showPhysicalTicket(poolId, participantId, entryId) {
    hideAlert();
    if (!poolId || !participantId) return;

    var [poolRes,
        matchRes,
        entRes,
        partRes] = await Promise.all([
            supabaseClient.from("pools").select("id, name, round, date_label, price, competition, season").eq("id", poolId).maybeSingle(),
            supabaseClient.from("matches").select("id, match_no, home_team, away_team, home_goals, away_goals").eq("pool_id", poolId).order("match_no", {
                ascending: true
            }),
            supabaseClient.from("entries").select("id").eq("pool_id", poolId).eq("participant_id", participantId).order("created_at", {
                ascending: true
            }),
            supabaseClient.from("participants").select("id, name, area").eq("id", participantId).maybeSingle()
        ]);

    var pool = poolRes.data || {};
    var matches = matchRes.data || [];
    var entries = entRes.data || [];
    var part = partRes.data || {};

    var entry = entryId ? entries.find(function(e) {
        return e.id === entryId;
    }): entries[entries.length - 1];
    if (!entry) return showAlert("No se encontró el boleto.", "error");

    var eIds = entries.map(function(e) {
        return e.id;
    });
    var predsRes = await supabaseClient.from("predictions_1x2")
    .select("entry_id, match_id, pick").in("entry_id", eIds);

    var pickMap = {};
    (predsRes.data || []).forEach(function(p) {
        if (p.entry_id === entry.id) pickMap[p.match_id] = p.pick;
    });

    var resultMap = {};
    matches.forEach(function(m) {
        if (m.home_goals !== null && m.away_goals !== null)
            resultMap[m.id] = m.home_goals > m.away_goals ? "H": m.home_goals < m.away_goals ? "A": "D";
    });

    function pickLabel(c) {
        return c === "H" ? "LOCAL": c === "D" ? "EMPATE": c === "A" ? "VISITA": "—";
    }

    var jornada = pool.round ? "Jornada " + pool.round: pool.name;
    var hasResults = Object.keys(resultMap).length > 0;

    var modal = document.createElement("div");
    modal.id = "physTicketModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";
    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.78);" id="physTicketBg"></div>',
        '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px 24px 0 0;padding:20px;max-height:86vh;overflow-y:auto;">',
        '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 14px;"></div>',
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">',
        '<div>',
        '<div style="font-size:16px;font-weight:800;color:#f0f4f8;">🎫 ' + (part.name || "Participante") + '</div>',
        '<div style="font-size:12px;color:#8a94a6;">' + jornada + (pool.date_label ? " · " + pool.date_label: "") + '</div>',
        '</div>',
        (hasResults ? '<div style="font-size:11px;color:#fbbf24;font-weight:700;">Con resultados</div>': '<div style="font-size:11px;color:#6b7280;">Sin resultados aún</div>'),
        '</div>',
        '<div style="display:flex;flex-direction:column;gap:6px;">',
        matches.map(function(m) {
            var pick = pickMap[m.id];
            var real = resultMap[m.id];
            var ok = pick && real && pick === real;
            var miss = pick && real && pick !== real;

            var rowBg = ok ? "rgba(16,185,129,.1);border-color:rgba(16,185,129,.25);": miss ? "rgba(248,113,113,.08);border-color:rgba(248,113,113,.2);": "rgba(255,255,255,.04);border-color:rgba(255,255,255,.08);";

            var pickColor = ok ? "#34d399": miss ? "#f87171": "#8a94a6";
            var icon = ok ? "✅": miss ? "❌": (pick ? "⏳": "—");

            var resultStr = real ? (m.home_goals + "-" + m.away_goals + " " + (real === "H" ? "L": real === "D" ? "E": "V")): "";

            return [
                '<div style="padding:10px 12px;border-radius:12px;border:1px solid;' + rowBg + 'display:flex;align-items:center;gap:10px;">',
                '<div style="font-size:16px;flex-shrink:0;">' + icon + '</div>',
                '<div style="flex:1;min-width:0;">',
                '<div style="font-size:12px;font-weight:700;color:#f0f4f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + m.home_team + ' vs ' + m.away_team + '</div>',
                '<div style="font-size:11px;color:' + pickColor + ';margin-top:2px;">',
                (pick ? '→ ' + pickLabel(pick): 'Sin pick'),
                (resultStr ? ' <span style="color:#6b7280;margin-left:6px;">Resultado: ' + resultStr + '</span>': ''),
                '</div>',
                '</div>',
                '</div>'
            ].join("");
        }).join(""),
        '</div>',
        (hasResults ? '<div style="margin-top:14px;padding:12px;border-radius:14px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);text-align:center;">' +
            '<div style="font-size:24px;font-weight:900;color:#34d399;">' + matches.filter(function(m) {
                return pickMap[m.id] && pickMap[m.id] === resultMap[m.id];
            }).length + ' aciertos</div>' +
            '<div style="font-size:12px;color:#8a94a6;margin-top:2px;">de ' + Object.keys(resultMap).length + ' partidos jugados</div>' +
            '</div>': ''),
        '<button id="physTicketClose" style="width:100%;margin-top:14px;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#8a94a6;font-size:14px;cursor:pointer;">Cerrar</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("physTicketBg").addEventListener("click",
        function() {
            modal.remove();
        });
    document.getElementById("physTicketClose").addEventListener("click",
        function() {
            modal.remove();
        });
}

// ═══════════════════════════════════════════════
// MEJORA 4: INDICADOR DE COMPLETITUD EN RESULTADOS
// ═══════════════════════════════════════════════
function updateResultsGoalsSummary() {
    var allHome = document.querySelectorAll("[data-result-home]");
    var allAway = document.querySelectorAll("[data-result-away]");

    var total = allHome.length;
    var completed = 0;
    allHome.forEach(function(inp) {
        var matchId = inp.getAttribute("data-result-home");
        var away = document.querySelector('[data-result-away="' + matchId + '"]');
        if (inp.value !== "" && away && away.value !== "") completed++;
    });

    var progEl = $("resultsProgressBar");
    var progTxt = $("resultsProgressText");
    if (progEl) {
        var pct = total > 0 ? Math.round((completed / total) * 100): 0;
        progEl.style.width = pct + "%";
        progEl.style.background = pct === 100 ? "#10b981": pct > 50 ? "#fbbf24": "#f87171";
    }
    if (progTxt) {
        progTxt.textContent = completed + "/" + total + " partidos con resultado";
    }

    // Update goals total
    var total_goals = 0;
    document.querySelectorAll("[data-result-home],[data-result-away]").forEach(function(inp) {
        var v = parseInt(inp.value, 10);
        if (!isNaN(v)) total_goals += v;
    });
    var goalsEl = $("resultsGoalsTotal");
    if (goalsEl) goalsEl.textContent = String(total_goals);
}

// ═══════════════════════════════════════════════
// MEJORA 5: HISTORIAL DE CAMBIOS DE JORNADA
// (Log visual usando datos existentes de la BD)
// ═══════════════════════════════════════════════
async function showPoolChangeLog(poolId, poolName) {
    hideAlert();
    if (!poolId) return;

    var modal = document.createElement("div");
    modal.id = "poolLogModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";
    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.75);" id="poolLogBg"></div>',
        '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px 24px 0 0;padding:20px;max-height:75vh;overflow-y:auto;">',
        '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 14px;"></div>',
        '<div style="font-size:16px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">📅 ' + (poolName || "Jornada") + '</div>',
        '<div style="font-size:12px;color:#8a94a6;margin-bottom:14px;">Historial de actividad</div>',
        '<div id="poolLogContent"><div style="text-align:center;color:#8a94a6;padding:20px;">Cargando...</div></div>',
        '<button id="poolLogClose" style="width:100%;margin-top:14px;padding:12px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#8a94a6;font-size:14px;cursor:pointer;">Cerrar</button>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("poolLogBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("poolLogClose").addEventListener("click", function() {
        modal.remove();
    });

    // Build timeline from pool data + entries + matches
    var [poolRes,
        entRes,
        matchRes] = await Promise.all([
            supabaseClient.from("pools").select("id, status, created_at, date_label, price").eq("id", poolId).maybeSingle(),
            supabaseClient.from("entries").select("id, paid, paid_at, created_at").eq("pool_id", poolId).order("created_at", {
                ascending: true
            }),
            supabaseClient.from("matches").select("id, match_no, home_team, away_team, home_goals, away_goals").eq("pool_id", poolId).order("match_no", {
                ascending: true
            })
        ]);

    var pool = poolRes.data || {};
    var entries = entRes.data || [];
    var matches = matchRes.data || [];

    function fmtDate(d) {
        if (!d) return "—";
        return new Date(d).toLocaleString("es-MX", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    }

    var events = [];

    // Pool created
    events.push({
        icon: "🆕", label: "Jornada creada", date: pool.created_at, color: "#60a5fa", detail: "Precio: $" + (pool.price || 0)
    });

    // Matches loaded
    var withResult = matches.filter(function(m) {
        return m.home_goals !== null && m.away_goals !== null;
    });
    if (matches.length) {
        events.push({
            icon: "📋", label: "Plantilla cargada", date: pool.created_at, color: "#a78bfa", detail: matches.length + " partidos"
        });
    }

    // First and last entries
    if (entries.length) {
        events.push({
            icon: "🎫", label: "Primer boleto registrado", date: entries[0].created_at, color: "#34d399", detail: entries.length + " boletos en total"
        });
        var lastEntry = entries[entries.length - 1];
        if (entries.length > 1) {
            events.push({
                icon: "🎫", label: "Último boleto registrado", date: lastEntry.created_at, color: "#34d399", detail: ""
            });
        }
    }

    // Paid entries
    var paidEntries = entries.filter(function(e) {
        return e.paid && e.paid_at;
    });
    if (paidEntries.length) {
        var firstPaid = paidEntries.sort(function(a, b) {
            return new Date(a.paid_at)-new Date(b.paid_at);
        })[0];
        events.push({
            icon: "💰", label: "Primer pago registrado", date: firstPaid.paid_at, color: "#fbbf24", detail: paidEntries.length + " pagados en total"
        });
    }

    // Results
    if (withResult.length) {
        events.push({
            icon: "⚽", label: "Resultados capturados", date: pool.created_at, color: "#f97316", detail: withResult.length + "/" + matches.length + " partidos con resultado"
        });
    }

    // Current status
    var statusColors = {
        open: "#34d399",
        draft: "#60a5fa",
        closed: "#f87171"
    };
    var statusLabels = {
        open: "Activa ✅",
        draft: "Borrador 📝",
        closed: "Cerrada 🔒"
    };
    events.push({
        icon: "📌", label: "Estado actual: " + (statusLabels[pool.status] || pool.status), date: null, color: statusColors[pool.status] || "#8a94a6", detail: ""
    });

    // Sort by date
    events.sort(function(a, b) {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date) - new Date(b.date);
    });

    document.getElementById("poolLogContent").innerHTML = [
        '<div style="position:relative;padding-left:24px;">',
        '<div style="position:absolute;left:8px;top:0;bottom:0;width:2px;background:rgba(255,255,255,.08);border-radius:2px;"></div>',
        events.map(function(ev) {
            return [
                '<div style="position:relative;margin-bottom:14px;">',
                '<div style="position:absolute;left:-20px;top:4px;width:12px;height:12px;border-radius:50%;background:' + ev.color + ';border:2px solid #0c1018;"></div>',
                '<div style="font-size:13px;font-weight:700;color:#f0f4f8;">' + ev.icon + ' ' + ev.label + '</div>',
                ev.date ? '<div style="font-size:11px;color:#8a94a6;margin-top:2px;">' + fmtDate(ev.date) + '</div>': '',
                ev.detail ? '<div style="font-size:11px;color:#6b7280;margin-top:1px;">' + ev.detail + '</div>': '',
                '</div>'
            ].join("");
        }).join(""),
        '</div>'
    ].join("");
}



// ═══════════════════════════════════════════════
// MEJORA 2: ESTADO DE CUENTA POR PARTICIPANTE
// ═══════════════════════════════════════════════
async function exportParticipantStatement(participantId, participantName) {
    hideAlert();
    if (!participantId) return;

    var [entriesRes,
        poolsRes] = await Promise.all([
            supabaseClient.from("entries")
            .select("id, pool_id, paid, paid_at, created_at")
            .eq("participant_id", participantId)
            .order("created_at", {
                ascending: true
            }),
            supabaseClient.from("pools")
            .select("id, round, name, price, competition, season, status")
        ]);

    var entries = entriesRes.data || [];
    var poolMap = {};
    (poolsRes.data || []).forEach(function(p) {
        poolMap[p.id] = p;
    });

    if (!entries.length) return showAlert("Sin boletos registrados.", "error");

    // Build statement lines
    var totalCobrado = 0;
    var totalPagado = 0;
    var totalPendiente = 0;

    var lines = [
        "Estado de Cuenta - Quiniela Arcangel",
        "Participante: " + participantName,
        new Date().toLocaleDateString("es-MX", {
            day: "2-digit", month: "long", year: "numeric"
        }),
        "",
        "Jornada | Monto | Estado | Fecha pago",
        "-----------------------------------"
    ];

    entries.forEach(function(e) {
        var pool = poolMap[e.pool_id] || {};
        var monto = Number(pool.price || 0);
        var jornada = pool.round ? "J" + pool.round: (pool.name || "?");
        var estado = e.paid ? "PAGADO": "PENDIENTE";
        var fechaPago = (e.paid && e.paid_at)
        ? new Date(e.paid_at).toLocaleDateString("es-MX", {
            day: "2-digit", month: "short"
        }): "—";

        totalCobrado += monto;
        if (e.paid) totalPagado += monto;
        else totalPendiente += monto;

        lines.push(jornada + " | $" + monto + " | " + estado + " | " + fechaPago);
    });

    lines.push("-----------------------------------");
    lines.push("Total cobrado:   $" + totalCobrado);
    lines.push("Total pagado:    $" + totalPagado);
    lines.push("Total pendiente: $" + totalPendiente);
    lines.push("");
    lines.push("Quiniela Arcangel - Pasion X Ganar");

    var text = lines.join("\n");
    var encoded = encodeURIComponent(text);
    window.open("https://wa.me/?text=" + encoded,
        "_blank");
}

// ═══════════════════════════════════════════════
// MEJORA 3: EXPORTAR TABLA ACIERTOS A CSV
// ═══════════════════════════════════════════════
async function exportStandingsCSV() {
    hideAlert();
    var pool_id = $("standingsPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

    var [poolRes,
        paidRes,
        ptRes] = await Promise.all([
            supabaseClient.from("pools").select("id, name, round, competition, season").eq("id", pool_id).maybeSingle(),
            supabaseClient.from("entries").select("id, participant_id").eq("pool_id", pool_id).eq("paid", true),
            supabaseClient.from("entry_points").select("entry_id, participant_id, points, played_matches, captured_picks").eq("pool_id", pool_id)
        ]);

    var pool = poolRes.data || {};
    var paidEntries = paidRes.data || [];
    var points = ptRes.data || [];

    if (!points.length) return showAlert("No hay datos de aciertos para esta jornada.", "error");

    var paidEntryIds = new Set(paidEntries.map(function(e) {
        return e.entry_id || e.id;
    }));

    var partIds = [...new Set(points.map(function(r) {
        return r.participant_id;
    }))];
    var partRes = await supabaseClient.from("participants")
    .select("id, name, area").in("id", partIds);
    var partMap = {};
    (partRes.data || []).forEach(function(p) {
        partMap[p.id] = p;
    });

    // Sort by points desc
    var rows = points.map(function(r) {
        var p = partMap[r.participant_id] || {};
        return {
            name: p.name || "?",
            area: p.area || "",
            points: Number(r.points || 0),
            played: Number(r.played_matches || 0),
            picks: Number(r.captured_picks || 0)
        };
    }).sort(function(a, b) {
        return b.points - a.points || a.name.localeCompare(b.name);
    });

    var jornada = pool.round ? "Jornada " + pool.round: pool.name;

    // CSV content
    var csvLines = [
        "Quiniela Arcangel - " + jornada,
        (pool.competition || "Liga MX") + " - " + (pool.season || ""),
        "",
        "Posicion,Nombre,Area,Aciertos,Partidos Jugados,Picks Capturados",
    ];

    rows.forEach(function(r, i) {
        csvLines.push(
            (i+1) + "," +
            '"' + r.name.replace(/"/g, "'") + '",' +
            '"' + r.area.replace(/"/g, "'") + '",' +
            r.points + "," + r.played + "," + r.picks
        );
    });

    var csvContent = csvLines.join("\n");
    var blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var safeName = (jornada).replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    a.href = url;
    a.download = safeName + "-aciertos.csv";
    a.click();
    URL.revokeObjectURL(url);
    showAlert("CSV exportado \u2705", "ok");
}

// ═══════════════════════════════════════════════
// MEJORA 4: IMPORTAR PARTICIPANTES DESDE CSV
// ═══════════════════════════════════════════════
function openImportCSVModal() {
    var modal = document.createElement("div");
    modal.id = "importCSVModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;";

    modal.innerHTML = [
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.75);" id="importCSVBg"></div>',
        '<div style="position:relative;width:100%;background:#0c1018;border:1px solid rgba(255,255,255,.1);',
        'border-radius:24px 24px 0 0;padding:22px;max-height:85vh;overflow-y:auto;">',
        '<div style="width:48px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto 16px;"></div>',
        '<div style="font-size:17px;font-weight:800;color:#f0f4f8;margin-bottom:4px;">📥 Importar participantes</div>',
        '<div style="font-size:12px;color:#8a94a6;margin-bottom:16px;">',
        'Formato CSV: una fila por participante<br>',
        '<code style="background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;font-size:11px;">Nombre,Area,WhatsApp</code>',
        '</div>',

        // Format example
        '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;',
        'padding:10px 12px;font-size:11px;color:#8a94a6;margin-bottom:14px;font-family:monospace;line-height:1.8;">',
        'Juan Perez,Aluminio,8712345678<br>',
        'Maria Lopez,Ventas,<br>',
        'Carlos Ruiz,,8719876543',
        '</div>',

        // File input
        '<div style="margin-bottom:14px;">',
        '<label style="display:block;font-size:12px;color:#8a94a6;margin-bottom:8px;">Seleccionar archivo CSV:</label>',
        '<input type="file" id="csvFileInput" accept=".csv,.txt"',
        ' style="width:100%;padding:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);',
        'border-radius:12px;color:#f0f4f8;font-size:13px;box-sizing:border-box;" />',
        '</div>',

        // Or paste
        '<div style="margin-bottom:14px;">',
        '<label style="display:block;font-size:12px;color:#8a94a6;margin-bottom:8px;">O pega el contenido directamente:</label>',
        '<textarea id="csvPasteInput" rows="5" placeholder="Juan Perez,Aluminio,8712345678&#10;Maria Lopez,Ventas,"',
        ' style="width:100%;padding:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);',
        'border-radius:12px;color:#f0f4f8;font-size:12px;resize:vertical;box-sizing:border-box;font-family:monospace;"></textarea>',
        '</div>',

        '<div id="csvPreview" style="margin-bottom:14px;"></div>',

        '<div style="display:grid;gap:10px;">',
        '<button id="csvParseBtn" style="width:100%;padding:13px;border-radius:14px;border:none;',
        'background:rgba(255,255,255,.1);color:#f0f4f8;font-size:14px;font-weight:600;cursor:pointer;">',
        '👀 Vista previa',
        '</button>',
        '<button id="csvImportBtn" style="width:100%;padding:13px;border-radius:14px;border:none;',
        'background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-size:15px;font-weight:700;',
        'cursor:pointer;display:none;">',
        '✅ Importar participantes',
        '</button>',
        '<button id="csvCancelBtn" style="width:100%;padding:11px;border-radius:14px;',
        'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
        'color:#8a94a6;font-size:14px;cursor:pointer;">Cancelar</button>',
        '</div>',
        '</div>'
    ].join("");

    document.body.appendChild(modal);
    document.getElementById("importCSVBg").addEventListener("click", function() {
        modal.remove();
    });
    document.getElementById("csvCancelBtn").addEventListener("click", function() {
        modal.remove();
    });

    var parsedRows = [];

    // File reader
    document.getElementById("csvFileInput").addEventListener("change", function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            document.getElementById("csvPasteInput").value = ev.target.result;
        };
        reader.readAsText(file, "UTF-8");
    });

    // Parse preview
    document.getElementById("csvParseBtn").addEventListener("click",
        function() {
            var raw = document.getElementById("csvPasteInput").value.trim();
            if (!raw) return;

            var lines = raw.split("\n").map(function(l) {
                return l.trim();
            }).filter(Boolean);
            parsedRows = [];
            var errors = [];

            lines.forEach(function(line, i) {
                // Skip header row if it starts with "Nombre"
                if (i === 0 && /^nombre/i.test(line)) return;

                var parts = line.split(",");
                var name = (parts[0] || "").trim();
                var area = (parts[1] || "").trim();
                var whatsapp = (parts[2] || "").trim().replace(/\D/g, "");

                if (!name) {
                    errors.push("Fila " + (i+1) + ": sin nombre"); return;
                }
                parsedRows.push({
                    name: name, area: area, whatsapp: whatsapp
                });
            });

            var previewEl = document.getElementById("csvPreview");
            var importBtn = document.getElementById("csvImportBtn");

            if (!parsedRows.length) {
                previewEl.innerHTML = '<div style="color:#f87171;font-size:13px;">Sin filas válidas.' + (errors.length ? "<br>" + errors.join("<br>"): "") + '</div>';
                importBtn.style.display = "none";
                return;
            }

            previewEl.innerHTML = [
                '<div style="font-size:13px;color:#34d399;font-weight:700;margin-bottom:8px;">✅ ' + parsedRows.length + ' participantes listos para importar</div>',
                errors.length ? '<div style="font-size:11px;color:#fbbf24;margin-bottom:8px;">' + errors.join("<br>") + '</div>': '',
                '<div style="max-height:140px;overflow-y:auto;background:rgba(255,255,255,.04);border-radius:10px;padding:8px;">',
                parsedRows.map(function(r, i) {
                    return '<div style="font-size:12px;color:#e5e7eb;padding:3px 0;">' +
                    (i+1) + '. ' + r.name + (r.area ? ' <span style="color:#8a94a6;">(' + r.area + ')</span>': '') +
                    (r.whatsapp ? ' <span style="color:#34d399;font-size:11px;">' + r.whatsapp + '</span>': '') +
                    '</div>';
                }).join(""),
                '</div>'
            ].join("");

            importBtn.style.display = "block";
            importBtn.textContent = "✅ Importar " + parsedRows.length + " participantes";
        });

    // Import
    document.getElementById("csvImportBtn").addEventListener("click",
        async function() {
            if (!parsedRows.length) return;

            document.getElementById("csvImportBtn").textContent = "Importando...";
            document.getElementById("csvImportBtn").disabled = true;

            var inserted = 0;
            var failed = 0;

            for (var i = 0; i < parsedRows.length; i++) {
                var row = parsedRows[i];
                var {
                    error
                } = await supabaseClient.from("participants").insert({
                        name: row.name,
                        area: row.area || null,
                        whatsapp: row.whatsapp || null,
                        is_active: true
                    });
                if (error) failed++;
                else inserted++;
            }

            modal.remove();
            showAlert("Importados: " + inserted + (failed ? " | Fallidos: " + failed: "") + " ✅", "ok");
            resetTabLoaded("tab-participants");
            await loadParticipants();
            await fillEntryParticipantsSelect();
            await fillPickParticipantsSelect();
            await loadDashboardSummary();
        });
}



// ═══════════════════════════════════════════════
// MODO CAPTURA RÁPIDA — teclas 1=L 2=E 3=V
// ═══════════════════════════════════════════════
var _fastModeActive = false;
var _fastModeMatchIndex = 0;

function toggleFastMode() {
    _fastModeActive = !_fastModeActive;
    var btn = $("btnFastMode");
    if (_fastModeActive) {
        _fastModeMatchIndex = 0;
        if (btn) {
            btn.textContent = "⚡ Modo rápido: ON"; btn.style.background = "linear-gradient(135deg,#059669,#10b981)"; btn.style.color = "#fff";
        }
        showAlert("Modo rápido activado. Teclas: 1=LOCAL  2=EMPATE  3=VISITA  →=Siguiente  Esc=Salir", "ok");
        highlightCurrentFastMatch();
    } else {
        if (btn) {
            btn.textContent = "⚡ Modo rápido"; btn.style.background = ""; btn.style.color = "";
        }
        clearFastModeHighlight();
    }
}

function highlightCurrentFastMatch() {
    clearFastModeHighlight();
    var matches = document.querySelectorAll("#pickMatches > div");
    if (!matches.length) return;
    var curr = matches[_fastModeMatchIndex];
    if (!curr) return;
    curr.style.outline = "2px solid #10b981";
    curr.style.borderRadius = "12px";
    curr.scrollIntoView({
        behavior: "smooth", block: "center"
    });
}

function clearFastModeHighlight() {
    document.querySelectorAll("#pickMatches > div").forEach(function(m) {
        m.style.outline = "";
    });
}

function fastModeSelectPick(pickValue) {
    var matches = document.querySelectorAll("#pickMatches > div");
    if (!matches.length || _fastModeMatchIndex >= matches.length) return;
    var curr = matches[_fastModeMatchIndex];
    var btns = curr.querySelectorAll(".pick-btn");
    btns.forEach(function(b) {
        var isMatch = b.getAttribute("data-pick") === pickValue;
        b.classList.remove("bg-emerald-600", "border-emerald-500", "text-white");
        b.classList.add("bg-zinc-900", "border-zinc-700", "text-zinc-200");
        b.dataset.selected = "";
        if (isMatch) {
            b.classList.remove("bg-zinc-900", "border-zinc-700", "text-zinc-200");
            b.classList.add("bg-emerald-600", "border-emerald-500", "text-white");
            b.dataset.selected = "1";
            schedulePicksDraftSave();
        }
    });
    // Auto-advance to next match
    _fastModeMatchIndex++;
    if (_fastModeMatchIndex < matches.length) {
        highlightCurrentFastMatch();
    } else {
        // All picks done
        showAlert("Todos los pronósticos seleccionados. Presiona Guardar para confirmar.", "ok");
        clearFastModeHighlight();
    }
}

function fastModeBack() {
    if (_fastModeMatchIndex > 0) _fastModeMatchIndex--;
    highlightCurrentFastMatch();
}

// Global keydown listener
document.addEventListener("keydown", function(e) {
    if (!_fastModeActive || !currentPickEntryId) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

    switch (e.key) {
    case "1": e.preventDefault(); fastModeSelectPick("H"); break;
    case "2": e.preventDefault(); fastModeSelectPick("D"); break;
    case "3": e.preventDefault(); fastModeSelectPick("A"); break;
    case "ArrowRight":
    case "ArrowDown": e.preventDefault(); _fastModeMatchIndex = Math.min(_fastModeMatchIndex + 1, document.querySelectorAll("#pickMatches > div").length - 1); highlightCurrentFastMatch(); break;
    case "ArrowLeft":
    case "ArrowUp": e.preventDefault(); fastModeBack(); break;
    case "Escape": toggleFastMode(); break;
    }
});


// ═══════════════════════════════════════════════
// GUARDAR RESULTADOS Y CALCULAR ACIERTOS EN UN TAP
// ═══════════════════════════════════════════════
async function saveResultsAndCalc() {
    hideAlert();
    var pool_id = $("resultsPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada.", "error");

    // 1. Save results (reuse existing logic)
    await saveResultsMatches();

    // 2. Switch to standings tab and load for this pool
    showAlert("Guardando y calculando aciertos...", "ok");

    // Brief delay to let DB settle
    await new Promise(function(r) {
        setTimeout(r, 800);
    });

    // Navigate to standings
    await showAppTab("tab-standings");

    // Select the same pool in standings
    var standingsSel = $("standingsPool");
    if (standingsSel) {
        standingsSel.value = pool_id;
        // If not found, try to reload the select
        if (!standingsSel.value) {
            await fillStandingsPoolsSelect();
            standingsSel.value = pool_id;
        }
    }

    // Load standings
    await loadStandings();
    showAlert("Resultados guardados y aciertos calculados ✅", "ok");
}


// ═══════════════════════════════════════════════
// CARTEL TOP 3 — Visual para grupo WA
// ═══════════════════════════════════════════════
/** Escapa texto para insertar en HTML del cartel. */
function escapeHtmlCard(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Iniciales (máx. 2) a partir del nombre. */
function nameInitials(name) {
    var parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Cartel Top 3 premium para WhatsApp.
 * opts: { jornada, competition, season, totalGoals, ranked:[{name,area,points}], logoUrl }
 */
function makeTop3Card(opts) {
    opts = opts || {};
    var ranked = (opts.ranked || []).slice(0, 3);
    var jornada = opts.jornada || "Jornada";
    var competition = opts.competition || "Liga MX";
    var season = opts.season || "";
    var totalGoals = opts.totalGoals != null ? opts.totalGoals : 0;
    var logoUrl = opts.logoUrl || "";

    var METAL = {
        1: {
            ring: "#fbbf24",
            ring2: "#f59e0b",
            glow: "rgba(251,191,36,.45)",
            fill: "linear-gradient(145deg,#fef3c7 0%,#f59e0b 45%,#b45309 100%)",
            avatarBg: "linear-gradient(145deg,#292524 0%,#1c1917 100%)",
            podium: "linear-gradient(180deg,#fbbf24 0%,#d97706 55%,#92400e 100%)",
            podiumSide: "linear-gradient(180deg,#b45309 0%,#78350f 100%)",
            label: "#fde68a",
            rank: "1"
        },
        2: {
            ring: "#e5e7eb",
            ring2: "#9ca3af",
            glow: "rgba(229,231,235,.28)",
            fill: "linear-gradient(145deg,#f9fafb 0%,#9ca3af 50%,#6b7280 100%)",
            avatarBg: "linear-gradient(145deg,#27272a 0%,#18181b 100%)",
            podium: "linear-gradient(180deg,#e5e7eb 0%,#9ca3af 55%,#6b7280 100%)",
            podiumSide: "linear-gradient(180deg,#6b7280 0%,#3f3f46 100%)",
            label: "#e5e7eb",
            rank: "2"
        },
        3: {
            ring: "#fdba74",
            ring2: "#c2410c",
            glow: "rgba(234,88,12,.28)",
            fill: "linear-gradient(145deg,#ffedd5 0%,#ea580c 50%,#9a3412 100%)",
            avatarBg: "linear-gradient(145deg,#292524 0%,#1c1917 100%)",
            podium: "linear-gradient(180deg,#fdba74 0%,#c2410c 55%,#7c2d12 100%)",
            podiumSide: "linear-gradient(180deg,#9a3412 0%,#7c2d12 100%)",
            label: "#fdba74",
            rank: "3"
        }
    };

    // Orden visual del podio: 2º | 1º | 3º
    var visual = [];
    if (ranked.length === 1) {
        visual = [{ player: ranked[0], place: 1 }];
    } else if (ranked.length === 2) {
        visual = [
            { player: ranked[1], place: 2 },
            { player: ranked[0], place: 1 }
        ];
    } else {
        visual = [
            { player: ranked[1], place: 2 },
            { player: ranked[0], place: 1 },
            { player: ranked[2], place: 3 }
        ];
    }

    var PODIUM_H = { 1: 118, 2: 86, 3: 64 };
    var AVATAR = { 1: 112, 2: 92, 3: 84 };
    var COL_W = { 1: 220, 2: 190, 3: 180 };

    var card = document.createElement("div");
    card.style.cssText = [
        "width:900px",
        "box-sizing:border-box",
        "background:radial-gradient(ellipse 120% 80% at 50% -10%,#0c1a2e 0%,#050810 45%,#03060c 100%)",
        "color:#f0f4f8",
        "border-radius:28px",
        "padding:40px 36px 32px",
        "font-family:Arial,Helvetica,sans-serif",
        "position:relative",
        "overflow:hidden"
    ].join(";");

    // Capas decorativas
    var decor = document.createElement("div");
    decor.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    decor.innerHTML = [
        // Glow oro centro (1er lugar)
        '<div style="position:absolute;top:18%;left:50%;transform:translateX(-50%);width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.14) 0%,transparent 68%);"></div>',
        // Glow emerald esquina
        '<div style="position:absolute;top:-80px;left:-80px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.16) 0%,transparent 70%);"></div>',
        // Glow cyan
        '<div style="position:absolute;bottom:-60px;right:-50px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,.12) 0%,transparent 70%);"></div>',
        // Grid sutil
        '<div style="position:absolute;inset:0;opacity:.35;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:48px 48px;"></div>',
        // Línea acento superior
        '<div style="position:absolute;top:0;left:12%;right:12%;height:3px;background:linear-gradient(90deg,transparent,#10b981 20%,#fbbf24 50%,#10b981 80%,transparent);border-radius:0 0 4px 4px;"></div>',
        // Viñeta inferior
        '<div style="position:absolute;bottom:0;left:0;right:0;height:140px;background:linear-gradient(transparent,rgba(0,0,0,.35));"></div>'
    ].join("");
    card.appendChild(decor);

    // ── HEADER ──
    var header = document.createElement("div");
    header.style.cssText = "position:relative;text-align:center;margin-bottom:8px;";
    var logoHtml = logoUrl
        ? '<img src="' + logoUrl + '" crossorigin="anonymous" onerror="this.style.display=\'none\'" style="width:52px;height:52px;object-fit:contain;border-radius:12px;box-shadow:0 0 20px rgba(16,185,129,.35);margin-bottom:10px;" />'
        : '<div style="font-size:28px;margin-bottom:6px;">🏆</div>';
    header.innerHTML = [
        logoHtml,
        '<div style="font-size:12px;font-weight:800;letter-spacing:3.5px;color:#34d399;text-transform:uppercase;">Quiniela Arcángel</div>',
        '<div style="font-size:40px;font-weight:900;color:#fff;line-height:1.15;margin-top:8px;letter-spacing:-0.5px;">Top 3</div>',
        '<div style="display:inline-flex;align-items:center;gap:8px;margin-top:10px;padding:6px 16px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);">',
        '<span style="font-size:14px;font-weight:800;color:#f0f4f8;">' + escapeHtmlCard(jornada) + '</span>',
        '<span style="color:#4b5563;">·</span>',
        '<span style="font-size:12px;color:#9ca3af;">' + escapeHtmlCard(competition) + (season ? " · " + escapeHtmlCard(season) : "") + '</span>',
        '<span style="color:#4b5563;">·</span>',
        '<span style="font-size:12px;font-weight:700;color:#34d399;">⚽ ' + totalGoals + ' goles</span>',
        '</div>'
    ].join("");
    card.appendChild(header);

    // ── PODIO ──
    var podiumWrap = document.createElement("div");
    podiumWrap.style.cssText = [
        "display:flex",
        "align-items:flex-end",
        "justify-content:center",
        "gap:18px",
        "margin-top:28px",
        "margin-bottom:8px",
        "position:relative",
        "min-height:340px",
        "padding:0 8px"
    ].join(";");

    visual.forEach(function(item) {
        var place = item.place;
        var player = item.player;
        var m = METAL[place];
        var avSize = AVATAR[place];
        var pH = PODIUM_H[place];
        var colW = COL_W[place];
        var initials = nameInitials(player.name);
        var isFirst = place === 1;

        var col = document.createElement("div");
        col.style.cssText = [
            "display:flex",
            "flex-direction:column",
            "align-items:center",
            "width:" + colW + "px",
            "position:relative",
            "z-index:" + (isFirst ? "3" : "2")
        ].join(";");

        // Corona solo 1º (sin filter: html2canvas falla con blur/drop-shadow en móvil)
        var crownHtml = isFirst
            ? '<div style="font-size:26px;line-height:1;margin-bottom:6px;">👑</div>'
            : '<div style="height:32px;"></div>';

        // Avatar — sin filter:blur ni background-clip:text (incompatibles con html2canvas)
        var avatarHtml = [
            '<div style="position:relative;width:' + avSize + 'px;height:' + avSize + 'px;margin-bottom:14px;">',
            '<div style="position:absolute;inset:0;border-radius:50%;padding:4px;background:' + m.fill + ';box-shadow:0 0 24px ' + m.glow + ',0 8px 20px rgba(0,0,0,.45);">',
            '<div style="width:100%;height:100%;border-radius:50%;background:' + m.avatarBg + ';display:flex;align-items:center;justify-content:center;border:2px solid rgba(0,0,0,.35);">',
            '<span style="font-size:' + (isFirst ? 36 : 28) + 'px;font-weight:900;color:' + m.ring + ';letter-spacing:-1px;">' + escapeHtmlCard(initials) + '</span>',
            '</div></div>',
            '<div style="position:absolute;bottom:-2px;right:-2px;width:32px;height:32px;border-radius:50%;background:' + m.fill + ';display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.45);border:2px solid #050810;">',
            '<span style="font-size:14px;font-weight:900;color:#111;">' + m.rank + '</span>',
            '</div>',
            '</div>'
        ].join("");

        var infoHtml = [
            '<div style="text-align:center;margin-bottom:14px;min-height:72px;display:flex;flex-direction:column;justify-content:flex-end;">',
            '<div style="font-size:' + (isFirst ? 18 : 15) + 'px;font-weight:800;color:#fff;line-height:1.25;max-width:' + (colW - 8) + 'px;">' + escapeHtmlCard(player.name) + '</div>',
            '<div style="font-size:11px;color:#8a94a6;margin-top:3px;font-weight:600;">' + escapeHtmlCard(player.area || "Sin área") + '</div>',
            '<div style="margin-top:8px;">',
            '<span style="font-size:' + (isFirst ? 42 : 32) + 'px;font-weight:900;color:' + m.label + ';line-height:1;">' + Number(player.points || 0) + '</span>',
            '</div>',
            '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-top:2px;">aciertos</div>',
            '</div>'
        ].join("");

        var podiumHtml = [
            '<div style="width:100%;position:relative;">',
            '<div style="height:' + pH + 'px;border-radius:12px 12px 4px 4px;background:' + m.podium + ';box-shadow:0 10px 24px rgba(0,0,0,.4);position:relative;overflow:hidden;">',
            '<div style="position:absolute;top:0;left:10%;right:10%;height:40%;background:linear-gradient(180deg,rgba(255,255,255,.28),transparent);border-radius:12px 12px 0 0;"></div>',
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">',
            '<span style="font-size:' + (isFirst ? 48 : 36) + 'px;font-weight:900;color:rgba(0,0,0,.22);letter-spacing:-2px;">' + m.rank + '</span>',
            '</div>',
            '</div>',
            '<div style="height:8px;margin:0 10px;border-radius:0 0 6px 6px;background:rgba(0,0,0,.28);"></div>',
            '</div>'
        ].join("");

        col.innerHTML = crownHtml + avatarHtml + infoHtml + podiumHtml;
        podiumWrap.appendChild(col);
    });

    card.appendChild(podiumWrap);

    // ── FOOTER ──
    var footer = document.createElement("div");
    footer.style.cssText = "position:relative;text-align:center;margin-top:20px;padding-top:18px;";
    footer.innerHTML = [
        '<div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);margin-bottom:16px;"></div>',
        '<div style="font-size:17px;font-weight:800;color:#fff;">¡Gracias por participar! 🏆</div>',
        '<div style="font-size:13px;color:#8a94a6;margin-top:5px;font-weight:600;">Quiniela Arcángel — Pasión X Ganar</div>'
    ].join("");
    card.appendChild(footer);

    return card;
}

async function exportTop3Card() {
    hideAlert();
    var pool_id = $("standingsPool").value;
    if (!pool_id) return showAlert("Selecciona una jornada primero.", "error");

    var poolRes = await supabaseClient.from("pools")
        .select("id, name, round, competition, season, mode_code")
        .eq("id", pool_id).maybeSingle();
    var pool = poolRes.data || {};
    var isGoleo = String(pool.mode_code || "").toUpperCase() === "GOLEO";

    var goalsRes = await supabaseClient.from("pool_goals_total")
        .select("total_goals").eq("pool_id", pool_id).maybeSingle();
    var totalGoals = goalsRes.data ? Number(goalsRes.data.total_goals) : 0;
    var hasActual = goalsRes.data && goalsRes.data.total_goals != null;

    var ranked = [];

    if (isGoleo) {
        // Ranking por cercanía al total real (exacto primero)
        var [paidRes, predsRes] = await Promise.all([
            supabaseClient.from("entries").select("id, participant_id, paid").eq("pool_id", pool_id).eq("paid", true),
            supabaseClient.from("predictions_goals_total").select("entry_id, predicted_goals").eq("pool_id", pool_id)
        ]);
        var paidMap = {};
        (paidRes.data || []).forEach(function(e) { paidMap[e.id] = e; });
        var partIds = [...new Set((paidRes.data || []).map(function(e) { return e.participant_id; }))];
        if (!partIds.length) return showAlert("No hay boletos pagados en Goleó.", "error");
        var partRes = await supabaseClient.from("participants").select("id, name, area").in("id", partIds);
        var partMap = {};
        (partRes.data || []).forEach(function(p) { partMap[p.id] = p; });

        ranked = (predsRes.data || []).map(function(pred) {
            var entry = paidMap[pred.entry_id];
            if (!entry) return null;
            var p = partMap[entry.participant_id] || {};
            var predGoals = Number(pred.predicted_goals);
            var diff = hasActual ? Math.abs(predGoals - totalGoals) : null;
            return {
                name: p.name || "?",
                area: p.area || "",
                points: predGoals,
                predicted: predGoals,
                diff: diff,
                isExact: diff === 0
            };
        }).filter(Boolean).sort(function(a, b) {
            if (a.diff === null && b.diff === null) return a.name.localeCompare(b.name);
            if (a.diff === null) return 1;
            if (b.diff === null) return -1;
            return a.diff - b.diff || a.name.localeCompare(b.name);
        }).slice(0, 3);
    } else {
        var [paidRes2, ptRes] = await Promise.all([
            supabaseClient.from("entries").select("id, participant_id").eq("pool_id", pool_id).eq("paid", true),
            supabaseClient.from("entry_points").select("entry_id, participant_id, points, played_matches").eq("pool_id", pool_id)
        ]);
        var paid = new Set((paidRes2.data || []).map(function(e) { return e.id; }));
        var points = (ptRes.data || []).filter(function(r) { return paid.has(r.entry_id); });
        if (!points.length) return showAlert("No hay boletos pagados con aciertos.", "error");
        var partIds2 = [...new Set(points.map(function(r) { return r.participant_id; }))];
        var partRes2 = await supabaseClient.from("participants").select("id, name, area").in("id", partIds2);
        var partMap2 = {};
        (partRes2.data || []).forEach(function(p) { partMap2[p.id] = p; });
        ranked = points.map(function(r) {
            var p = partMap2[r.participant_id] || {};
            return {
                name: p.name || "?",
                area: p.area || "",
                points: Number(r.points || 0)
            };
        }).sort(function(a, b) {
            return b.points - a.points || a.name.localeCompare(b.name);
        }).slice(0, 3);
    }

    if (!ranked.length) return showAlert("Sin datos para el cartel.", "error");

    var jornada = pool.round != null && pool.round !== "" ? ("Jornada " + pool.round) : (pool.name || "Jornada");
    var competition = pool.competition || "Liga MX";
    var season = pool.season || "";

    var logoImg = null;
    try {
        logoImg = typeof loadLogoImage === "function" ? await loadLogoImage() : null;
    } catch (e) {
        logoImg = null;
    }

    try {
        var canvas = drawTop3Canvas({
            ranked: ranked,
            jornada: jornada,
            competition: competition,
            season: season,
            totalGoals: totalGoals,
            logoImg: logoImg,
            isGoleo: isGoleo
        });

        var a = document.createElement("a");
        var safeName = (jornada || "top3").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
        a.download = safeName + (isGoleo ? "-top3-goleo.png" : "-top3.png");
        a.href = canvas.toDataURL("image/png");
        a.click();
        showAlert(isGoleo ? "Cartel Top 3 Goleó exportado ✅" : "Cartel Top 3 premium exportado ✅", "ok");
    } catch (err) {
        showAlert("Error: " + (err && err.message ? err.message : String(err)), "error");
    }
}

/**
 * Dibuja el cartel Top 3 en un <canvas> nativo (sin html2canvas).
 * Fiable en Chrome/Android donde html2canvas falla con createPattern.
 */
function drawTop3Canvas(opts) {
    opts = opts || {};
    var ranked = (opts.ranked || []).slice(0, 3);
    var jornada = opts.jornada || "Jornada";
    var competition = opts.competition || "Liga MX";
    var season = opts.season || "";
    var totalGoals = opts.totalGoals != null ? opts.totalGoals : 0;
    var logoImg = opts.logoImg || null;
    var isGoleo = !!opts.isGoleo;

    var W = 900;
    var H = 1020;
    var scale = 2;
    var canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el canvas");
    ctx.scale(scale, scale);

    // Fondo
    var bg = ctx.createRadialGradient(W / 2, 80, 30, W / 2, H * 0.45, H * 0.85);
    bg.addColorStop(0, "#0c1a2e");
    bg.addColorStop(0.5, "#050810");
    bg.addColorStop(1, "#03060c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    function softGlow(x, y, r, color) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    softGlow(W / 2, 380, 200, "rgba(251,191,36,0.12)");
    softGlow(70, 40, 140, "rgba(16,185,129,0.12)");
    softGlow(W - 50, H - 60, 120, "rgba(6,182,212,0.09)");

    // Línea superior
    var lg = ctx.createLinearGradient(W * 0.12, 0, W * 0.88, 0);
    lg.addColorStop(0, "rgba(16,185,129,0)");
    lg.addColorStop(0.2, "#10b981");
    lg.addColorStop(0.5, "#fbbf24");
    lg.addColorStop(0.8, "#10b981");
    lg.addColorStop(1, "rgba(16,185,129,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(W * 0.12, 0, W * 0.76, 3);

    // ── HEADER con espaciado generoso ──
    var hy = 36;
    if (logoImg && logoImg.naturalWidth > 0) {
        try {
            ctx.drawImage(logoImg, W / 2 - 28, hy, 56, 56);
            hy += 56 + 14;
        } catch (e) {
            hy += 8;
        }
    } else {
        ctx.font = "28px Arial";
        ctx.textAlign = "center";
        ctx.fillText("🏆", W / 2, hy + 26);
        hy += 48;
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#34d399";
    ctx.font = "800 13px Arial";
    ctx.fillText("QUINIELA ARCÁNGEL", W / 2, hy);
    hy += 36;

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 42px Arial";
    ctx.fillText(isGoleo ? "Top 3 Goleó" : "Top 3", W / 2, hy);
    hy += 28;

    var meta = jornada + "  ·  " + competition + (season ? "  ·  " + season : "") + "  ·  ⚽ " + totalGoals + " goles";
    ctx.font = "700 15px Arial";
    var metaW = Math.min(ctx.measureText(meta).width + 48, W - 48);
    var chipX = (W - metaW) / 2;
    var chipY = hy;
    var chipH = 36;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(52,211,153,0.28)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, chipX, chipY, metaW, chipH, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d1d5db";
    ctx.font = "700 14px Arial";
    ctx.fillText(meta, W / 2, chipY + 23);

    var headerBottom = chipY + chipH;

    // ── PODIO + PERSONAS ──
    // Layout de abajo hacia arriba para que los aciertos NUNCA se metan en el bloque
    var visual = [];
    if (ranked.length === 1) visual = [{ p: ranked[0], place: 1 }];
    else if (ranked.length === 2) visual = [{ p: ranked[1], place: 2 }, { p: ranked[0], place: 1 }];
    else visual = [{ p: ranked[1], place: 2 }, { p: ranked[0], place: 1 }, { p: ranked[2], place: 3 }];

    var METAL = {
        1: { ring: "#fbbf24", label: "#fde68a", podiumTop: "#fbbf24", podiumBot: "#92400e", av: 54, ph: 130, colW: 230 },
        2: { ring: "#e5e7eb", label: "#e5e7eb", podiumTop: "#d1d5db", podiumBot: "#6b7280", av: 46, ph: 96, colW: 200 },
        3: { ring: "#fdba74", label: "#fdba74", podiumTop: "#fb923c", podiumBot: "#7c2d12", av: 42, ph: 74, colW: 190 }
    };

    var gapCols = 20;
    var totalColsW = visual.reduce(function(s, v) { return s + METAL[v.place].colW; }, 0) + (visual.length - 1) * gapCols;
    var startX = (W - totalColsW) / 2;

    // Base del podio: anclada para llenar el centro (header ~170 → avatares ~300)
    var footerY = H - 52;
    var baseY = 820;

    var xCursor = startX;
    visual.forEach(function(item) {
        var place = item.place;
        var player = item.p;
        var m = METAL[place];
        var cx = xCursor + m.colW / 2;
        var isFirst = place === 1;
        var ph = m.ph;
        var podiumTop = baseY - ph;
        var avR = m.av;

        // Stack vertical FIJO encima del podio (de abajo a arriba):
        // podiumTop
        //   ↑ gap 14
        //   "aciertos"
        //   ↑ 6
        //   POINTS (grande)
        //   ↑ 14
        //   área
        //   ↑ 6
        //   nombre
        //   ↑ 14
        //   avatar
        //   ↑ 8
        //   corona (solo 1º)

        var yAciertos = podiumTop - 16;
        var yPoints = yAciertos - 18;
        var yArea = yPoints - (isFirst ? 48 : 40);
        var yName = yArea - 16;
        var avCy = yName - 20 - avR;
        var yCrown = avCy - avR - 10;

        // Si el 1º queda demasiado cerca del header, no importa; priorizamos no solapar podio.
        // Subir todo el grupo si hay mucho aire: anclar al header cuando sobre espacio.
        var minAvTop = headerBottom + 36;
        if (avCy - avR < minAvTop) {
            // Empujar hacia abajo no — ya estamos anclados al podio. El vacío superior se reduce
            // porque header es compacto y H es menor.
        }

        // Corona
        if (isFirst) {
            ctx.font = "28px Arial";
            ctx.textAlign = "center";
            ctx.fillText("👑", cx, yCrown);
        }

        // Avatar
        ctx.beginPath();
        ctx.arc(cx, avCy, avR + 5, 0, Math.PI * 2);
        ctx.fillStyle = m.ring;
        ctx.globalAlpha = 0.22;
        ctx.fill();
        ctx.globalAlpha = 1;

        var ringGrad = ctx.createLinearGradient(cx - avR, avCy - avR, cx + avR, avCy + avR);
        ringGrad.addColorStop(0, m.podiumTop);
        ringGrad.addColorStop(1, m.podiumBot);

        ctx.beginPath();
        ctx.arc(cx, avCy, avR + 3, 0, Math.PI * 2);
        ctx.fillStyle = ringGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, avCy, avR, 0, Math.PI * 2);
        ctx.fillStyle = "#1c1917";
        ctx.fill();

        var initials = nameInitials(player.name);
        ctx.fillStyle = m.ring;
        ctx.font = "900 " + (isFirst ? 32 : 24) + "px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, cx, avCy + 1);
        ctx.textBaseline = "alphabetic";

        // Badge rank
        var bx = cx + avR * 0.72;
        var by = avCy + avR * 0.72;
        ctx.beginPath();
        ctx.arc(bx, by, 14, 0, Math.PI * 2);
        ctx.fillStyle = ringGrad;
        ctx.fill();
        ctx.strokeStyle = "#050810";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#111";
        ctx.font = "900 12px Arial";
        ctx.textBaseline = "middle";
        ctx.fillText(String(place), bx, by + 1);
        ctx.textBaseline = "alphabetic";

        // Nombre
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 " + (isFirst ? 16 : 14) + "px Arial";
        ctx.textAlign = "center";
        wrapText(ctx, player.name || "?", cx, yName, m.colW - 16, 17);

        // Área
        ctx.fillStyle = "#8a94a6";
        ctx.font = "600 11px Arial";
        ctx.fillText(player.area || "Sin área", cx, yArea);

        // Puntos / goles predichos — bien visibles, encima del podio
        ctx.fillStyle = m.label;
        ctx.font = "900 " + (isFirst ? 44 : 34) + "px Arial";
        ctx.fillText(String(Number(player.points || 0)), cx, yPoints);

        ctx.fillStyle = "#6b7280";
        ctx.font = "700 10px Arial";
        if (isGoleo) {
            var goleoLabel = player.isExact
                ? "EXACTO ✅"
                : (player.diff != null ? ("±" + player.diff + " GOLES") : "GOLES PRED.");
            ctx.fillStyle = player.isExact ? "#34d399" : "#6b7280";
            ctx.fillText(goleoLabel, cx, yAciertos);
        } else {
            ctx.fillText("ACIERTOS", cx, yAciertos);
        }

        // Bloque podio
        var podiumGrad = ctx.createLinearGradient(cx, podiumTop, cx, baseY);
        podiumGrad.addColorStop(0, m.podiumTop);
        podiumGrad.addColorStop(1, m.podiumBot);
        ctx.fillStyle = podiumGrad;
        roundRect(ctx, xCursor + 10, podiumTop, m.colW - 20, ph, 12);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.22)";
        roundRect(ctx, xCursor + 20, podiumTop + 3, m.colW - 40, Math.max(16, ph * 0.25), 8);
        ctx.fill();

        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.font = "900 " + (isFirst ? 52 : 38) + "px Arial";
        ctx.textBaseline = "middle";
        ctx.fillText(String(place), cx, podiumTop + ph / 2);
        ctx.textBaseline = "alphabetic";

        xCursor += m.colW + gapCols;
    });

    // Footer
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.18, footerY - 8);
    ctx.lineTo(W * 0.82, footerY - 8);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("¡Gracias por participar! 🏆", W / 2, footerY + 14);

    ctx.fillStyle = "#8a94a6";
    ctx.font = "600 12px Arial";
    ctx.fillText("Quiniela Arcángel — Pasión X Ganar", W / 2, footerY + 34);

    return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = String(text).split(/\s+/);
    var line = "";
    var lines = [];
    for (var n = 0; n < words.length; n++) {
        var test = line ? (line + " " + words[n]) : words[n];
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = words[n];
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    // max 2 lines
    if (lines.length > 2) {
        lines = lines.slice(0, 2);
        lines[1] = lines[1].substring(0, Math.max(1, lines[1].length - 1)) + "…";
    }
    var startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach(function(ln, i) {
        ctx.fillText(ln, x, startY + i * lineHeight);
    });
}


// ═══════════════════════════════════════════════════════
// ACCESO RÁPIDO MUNDIAL — pre-llenar formulario
// ═══════════════════════════════════════════════════════
function quickFillPool(round, competition, price, season, mode) {
    var roundInput = $("poolRound");
    var compInput = $("poolCompetition");
    var seasInput = $("poolSeason");
    var priceInput = $("poolPrice");
    var modeInput = $("poolMode");
    var commInput = $("poolCommission");

    if (roundInput) roundInput.value = round || "";
    if (compInput) compInput.value = competition || "Mundial 2026";
    if (seasInput) seasInput.value = season || "";
    if (priceInput) priceInput.value = price || "";
    if (commInput) commInput.value = "15";
    if (modeInput && mode) modeInput.value = mode;
    else if (modeInput) modeInput.value = "SENCILLA";

    // Scroll to form
    var form = $("formPool");
    if (form) form.scrollIntoView({
        behavior: "smooth", block: "start"
    });
}

// Fix poolRound validation to accept text (J1, J2, etc.) or number
// The round field now accepts text for Mundial-style labeling

// ═══════════════════════════════════════════════════════
// CAMPEÓN DE GOLEO — Captura y cálculo
// ═══════════════════════════════════════════════════════

/** Estado del opt-in Goleó cuando se capturan picks de Sencilla */
var _goleoOptIn = {
    siblingPoolId: null,
    siblingPrice: null,
    siblingOpen: false,
    goleoEntryId: null,
    sencillaEntryId: null,
    boletaIndex: 0
};

function resetGoleoOptInState() {
    _goleoOptIn = {
        siblingPoolId: null,
        siblingPrice: null,
        siblingOpen: false,
        goleoEntryId: null,
        sencillaEntryId: null,
        boletaIndex: 0
    };
}

/**
 * Empareja boletas Sencilla ↔ Goleó 1:1 por orden de creación.
 * Así 2 boletas Sencilla pueden tener 2 Goleó distintos del mismo participante.
 * @returns {{ index: number, sencillaEntries: Array, goleoEntries: Array, pairedGoleo: object|null }}
 */
async function getGoleoPairingForSencilla(sencillaPoolId, goleoPoolId, participantId, sencillaEntryId) {
    var empty = { index: 0, sencillaEntries: [], goleoEntries: [], pairedGoleo: null };
    if (!sencillaPoolId || !goleoPoolId || !participantId) return empty;

    var [sencRes, golRes] = await Promise.all([
        supabaseClient.from("entries")
            .select("id, paid, created_at")
            .eq("pool_id", sencillaPoolId)
            .eq("participant_id", participantId)
            .order("created_at", { ascending: true }),
        supabaseClient.from("entries")
            .select("id, paid, created_at")
            .eq("pool_id", goleoPoolId)
            .eq("participant_id", participantId)
            .order("created_at", { ascending: true })
    ]);

    var sencillaEntries = sencRes.data || [];
    var goleoEntries = golRes.data || [];
    var index = 0;
    if (sencillaEntryId) {
        var found = sencillaEntries.findIndex(function(e) { return e.id === sencillaEntryId; });
        if (found >= 0) index = found;
    }
    var pairedGoleo = goleoEntries[index] || null;
    return { index: index, sencillaEntries: sencillaEntries, goleoEntries: goleoEntries, pairedGoleo: pairedGoleo };
}

function hideGoalChampionSection() {
    var goalSection = $("goalChampionSection");
    if (goalSection) goalSection.classList.add("hidden");
    var pure = $("goalChampionPureBlock");
    var opt = $("goalChampionOptInBlock");
    if (pure) pure.classList.remove("hidden");
    if (opt) opt.classList.add("hidden");
    var fields = $("goalChampionOptInFields");
    if (fields) fields.classList.add("hidden");
    var chk = $("goalChampionOptIn");
    if (chk) chk.checked = false;
    var pureIn = $("goalChampionInput");
    if (pureIn) pureIn.value = "";
    var optIn = $("goalChampionOptInInput");
    if (optIn) optIn.value = "";
    var st = $("goalChampionOptInStatus");
    if (st) st.textContent = "";
    resetGoleoOptInState();
}

function wireGoleoOptInToggle() {
    var chk = $("goalChampionOptIn");
    var fields = $("goalChampionOptInFields");
    if (!chk || !fields) return;
    if (chk._goleoWired) return;
    chk._goleoWired = true;
    chk.addEventListener("change", function() {
        if (chk.checked) {
            fields.classList.remove("hidden");
            var inp = $("goalChampionOptInInput");
            if (inp) setTimeout(function() { inp.focus(); }, 50);
        } else {
            fields.classList.add("hidden");
        }
    });
}

// Show goals champion UI for current entry (pool GOLEO puro u opt-in desde Sencilla)
async function loadGoalChampionPick() {
    hideGoalChampionSection();

    var pool_id = currentPickPoolId || $("pickPool").value;
    var entry_id = currentPickEntryId;
    var participant_id = currentPickParticipantId || ($("pickParticipant") && $("pickParticipant").value);
    if (!pool_id || !entry_id) return;

    var poolRes = await supabaseClient.from("pools")
        .select("id, mode_code, status, round, competition, season, price, name")
        .eq("id", pool_id)
        .maybeSingle();
    if (!poolRes.data) return;

    var pool = poolRes.data;
    var mode = String(pool.mode_code || "SENCILLA").toUpperCase();
    var goalSection = $("goalChampionSection");
    if (!goalSection) return;

    var pureBlock = $("goalChampionPureBlock");
    var optBlock = $("goalChampionOptInBlock");

    // ── Caso 1: el pool actual ES Goleó ──
    if (mode === "GOLEO") {
        if (pureBlock) pureBlock.classList.remove("hidden");
        if (optBlock) optBlock.classList.add("hidden");
        goalSection.classList.remove("hidden");

        var { data: existing } = await supabaseClient.from("predictions_goals_total")
            .select("predicted_goals").eq("entry_id", entry_id).maybeSingle();

        var input = $("goalChampionInput");
        if (input) {
            input.value = existing && existing.predicted_goals != null ? existing.predicted_goals : "";
            input.disabled = pool.status !== "open";
        }
        var saveBtn = $("btnSaveGoalChampion");
        if (saveBtn) saveBtn.disabled = pool.status !== "open";
        return;
    }

    // ── Caso 2: Sencilla (u otro modo) → buscar Goleó hermano ──
    var sibling = null;
    try {
        sibling = await findSiblingGoleoPool(pool);
    } catch (e) {
        console.warn("loadGoalChampionPick sibling", e);
    }
    if (!sibling) return;

    _goleoOptIn.siblingPoolId = sibling.id;
    _goleoOptIn.siblingPrice = sibling.price;
    _goleoOptIn.siblingOpen = sibling.status === "open";
    _goleoOptIn.goleoEntryId = null;
    _goleoOptIn.sencillaEntryId = entry_id;
    _goleoOptIn.boletaIndex = 0;

    if (pureBlock) pureBlock.classList.add("hidden");
    if (optBlock) optBlock.classList.remove("hidden");
    goalSection.classList.remove("hidden");
    wireGoleoOptInToggle();

    var hint = $("goalChampionOptInHint");
    if (hint) {
        var priceTxt = sibling.price != null ? (" · $" + sibling.price) : "";
        var stTxt = sibling.status === "open" ? "abierto" : "cerrado";
        hint.textContent = "Misma jornada · Goleó " + stTxt + priceTxt;
    }

    // Emparejar esta boleta Sencilla con su Goleó (1:1 por orden de creación)
    var pairing = { index: 0, sencillaEntries: [], goleoEntries: [], pairedGoleo: null };
    if (participant_id) {
        try {
            pairing = await getGoleoPairingForSencilla(pool_id, sibling.id, participant_id, entry_id);
        } catch (e) {
            console.warn("getGoleoPairingForSencilla", e);
        }
    }
    _goleoOptIn.boletaIndex = pairing.index;
    var goleoEntry = pairing.pairedGoleo;
    var boletaLabel = pairing.sencillaEntries.length > 1
        ? ("Boleta " + (pairing.index + 1) + "/" + pairing.sencillaEntries.length + " · ")
        : "";

    if (goleoEntry) {
        _goleoOptIn.goleoEntryId = goleoEntry.id;
        var { data: gPred } = await supabaseClient.from("predictions_goals_total")
            .select("predicted_goals")
            .eq("entry_id", goleoEntry.id)
            .maybeSingle();

        var chk = $("goalChampionOptIn");
        var fields = $("goalChampionOptInFields");
        var optIn = $("goalChampionOptInInput");
        var st = $("goalChampionOptInStatus");
        if (chk) chk.checked = true;
        if (fields) fields.classList.remove("hidden");
        if (optIn) {
            optIn.value = gPred && gPred.predicted_goals != null ? gPred.predicted_goals : "";
            optIn.disabled = !_goleoOptIn.siblingOpen;
        }
        if (st) {
            st.textContent = boletaLabel + (goleoEntry.paid
                ? "Goleó emparejado · Pagado ✅"
                : "Goleó emparejado · Pendiente de pago ⏳");
        }
    } else {
        var chk2 = $("goalChampionOptIn");
        var fields2 = $("goalChampionOptInFields");
        var optIn2 = $("goalChampionOptInInput");
        var st2 = $("goalChampionOptInStatus");
        if (chk2) chk2.checked = false;
        if (fields2) fields2.classList.add("hidden");
        if (optIn2) {
            optIn2.value = "";
            optIn2.disabled = !_goleoOptIn.siblingOpen;
        }
        if (st2) st2.textContent = _goleoOptIn.siblingOpen
            ? (boletaLabel + "Al guardar picks se creará un boleto Goleó nuevo para esta boleta.")
            : "El Goleó de esta jornada ya está cerrado.";
    }

    // Si Goleó cerrado y no tenía boleto, deshabilitar opt-in
    var chk3 = $("goalChampionOptIn");
    if (chk3 && !_goleoOptIn.siblingOpen && !_goleoOptIn.goleoEntryId) {
        chk3.disabled = true;
    } else if (chk3) {
        chk3.disabled = false;
    }
}

async function saveGoalChampionPick() {
    var entry_id = currentPickEntryId;
    var pool_id = currentPickPoolId || $("pickPool").value;
    var input = $("goalChampionInput");

    if (!entry_id || !pool_id || !input) return;
    var predicted = parseInt(input.value, 10);
    if (isNaN(predicted) || predicted < 0)
        return showAlert("Ingresa un número de goles válido.", "error");

    var {
        error
    } = await supabaseClient.from("predictions_goals_total")
    .upsert([{
        entry_id: entry_id, pool_id: pool_id, predicted_goals: predicted
    }],
        {
            onConflict: "entry_id"
        });

    if (error) return showAlert(error.message, "error");
    showAlert("Pronóstico de goles guardado ✅ (" + predicted + " goles)", "ok");
    try {
        if (typeof loadPickStatusList === "function") await loadPickStatusList();
    } catch (e) { /* ignore */ }
}

/**
 * Si el usuario marcó "También jugar Campeón de Goleó" en picks de Sencilla:
 * crea/usa boleto en el pool GOLEO hermano y guarda predicted_goals.
 * @returns {{ ok: boolean, msg?: string, created?: boolean, predicted?: number }}
 */
async function saveGoleoOptInFromSencilla() {
    var chk = $("goalChampionOptIn");
    if (!chk || !chk.checked) return { ok: true, skipped: true };
    if (!_goleoOptIn.siblingPoolId) return { ok: true, skipped: true };

    if (!_goleoOptIn.siblingOpen && !_goleoOptIn.goleoEntryId) {
        return { ok: false, msg: "El Goleó de esta jornada está cerrado." };
    }

    var optIn = $("goalChampionOptInInput");
    var predicted = optIn ? parseInt(optIn.value, 10) : NaN;
    if (isNaN(predicted) || predicted < 0) {
        return { ok: false, msg: "Marca Campeón de Goleó e ingresa un total de goles válido." };
    }

    var participant_id = currentPickParticipantId || ($("pickParticipant") && $("pickParticipant").value);
    if (!participant_id) {
        return { ok: false, msg: "Falta el participante para registrar Goleó." };
    }

    var sencillaPoolId = currentPickPoolId || $("pickPool").value;
    var sencillaEntryId = currentPickEntryId || _goleoOptIn.sencillaEntryId;
    var goleoEntryId = _goleoOptIn.goleoEntryId;
    var created = false;

    // Emparejar 1:1 con la boleta Sencilla actual (no reutilizar siempre el mismo Goleó)
    try {
        var pairing = await getGoleoPairingForSencilla(
            sencillaPoolId,
            _goleoOptIn.siblingPoolId,
            participant_id,
            sencillaEntryId
        );
        _goleoOptIn.boletaIndex = pairing.index;
        if (pairing.pairedGoleo && pairing.pairedGoleo.id) {
            goleoEntryId = pairing.pairedGoleo.id;
        } else {
            goleoEntryId = null;
        }
    } catch (e) {
        console.warn("pairing saveGoleoOptIn", e);
    }

    if (!goleoEntryId) {
        if (!_goleoOptIn.siblingOpen) {
            return { ok: false, msg: "El Goleó está cerrado; no se puede crear boleto nuevo." };
        }
        var { data: createdEnt, error: insErr } = await supabaseClient.from("entries")
            .insert({
                pool_id: _goleoOptIn.siblingPoolId,
                participant_id: participant_id,
                paid: false,
                paid_at: null
            })
            .select("id")
            .single();
        if (insErr) return { ok: false, msg: "Goleó: " + insErr.message };
        goleoEntryId = createdEnt.id;
        created = true;
    }
    _goleoOptIn.goleoEntryId = goleoEntryId;

    var { error: predErr } = await supabaseClient.from("predictions_goals_total")
        .upsert([{
            entry_id: goleoEntryId,
            pool_id: _goleoOptIn.siblingPoolId,
            predicted_goals: predicted
        }], { onConflict: "entry_id" });

    if (predErr) return { ok: false, msg: "Goleó: " + predErr.message };

    return {
        ok: true,
        created: created,
        predicted: predicted,
        entryId: goleoEntryId,
        boletaIndex: _goleoOptIn.boletaIndex
    };
}

// ═══════════════════════════════════════════════════════
// CAMPEÓN DE GOLEO — Tabla de resultados + bolsa
// Regla: solo gana quien acierta EXACTO el total de goles.
// Si nadie acierta, la bolsa se acumula a la siguiente jornada Goleó.
// ═══════════════════════════════════════════════════════

/** Cuenta jornadas GOLEO cerradas consecutivas (hacia atrás) sin acertante exacto. */
async function countConsecutiveDryGoleoJornadas(referencePool) {
    if (!referencePool) return { dry: 0, pools: [] };
    var q = supabaseClient.from("pools")
        .select("id, name, round, status, carryover_amount, competition, season, mode_code")
        .eq("mode_code", "GOLEO")
        .eq("status", "closed")
        .order("round", { ascending: false })
        .limit(30);
    if (referencePool.competition) q = q.eq("competition", referencePool.competition);
    if (referencePool.season) q = q.eq("season", referencePool.season);
    var { data: closedPools } = await q;
    var list = closedPools || [];
    var dry = 0;
    var dryPools = [];
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var goalsRes = await supabaseClient.from("pool_goals_total")
            .select("total_goals").eq("pool_id", p.id).maybeSingle();
        var actual = goalsRes.data ? Number(goalsRes.data.total_goals) : null;
        if (actual === null || isNaN(actual)) break;

        var predsRes = await supabaseClient.from("predictions_goals_total")
            .select("entry_id, predicted_goals").eq("pool_id", p.id);
        var preds = predsRes.data || [];
        if (!preds.length) {
            dry++;
            dryPools.push(p);
            continue;
        }
        var entRes = await supabaseClient.from("entries")
            .select("id, paid").eq("pool_id", p.id).eq("paid", true);
        var paidIds = {};
        (entRes.data || []).forEach(function(e) { paidIds[e.id] = true; });
        var hasExact = preds.some(function(pr) {
            return paidIds[pr.entry_id] && Number(pr.predicted_goals) === actual;
        });
        if (hasExact) break;
        dry++;
        dryPools.push(p);
    }
    return { dry: dry, pools: dryPools };
}

/** Bolsa efectiva de un pool GOLEO = prize_pool (vista) + carryover_amount entrante. */
async function getGoleoBagAmount(pool_id) {
    var statsRes = await supabaseClient.from("pool_stats")
        .select("prize_pool, total_collected, commission_amount, paid_count")
        .eq("pool_id", pool_id).maybeSingle();
    var poolRes = await supabaseClient.from("pools")
        .select("carryover_amount, carryover_enabled, status, name")
        .eq("id", pool_id).maybeSingle();
    var prize = statsRes.data ? Number(statsRes.data.prize_pool || 0) : 0;
    var carry = poolRes.data ? Number(poolRes.data.carryover_amount || 0) : 0;
    return {
        prize_pool: prize,
        carryover_amount: carry,
        total_bag: prize + carry,
        paid_count: statsRes.data ? Number(statsRes.data.paid_count || 0) : 0,
        total_collected: statsRes.data ? Number(statsRes.data.total_collected || 0) : 0,
        commission_amount: statsRes.data ? Number(statsRes.data.commission_amount || 0) : 0
    };
}

async function loadGoalChampionStandings() {
    var pool_id = $("standingsPool").value;
    var goalWrap = $("goalChampionResults");
    if (!goalWrap) return;

    if (!pool_id) {
        goalWrap.classList.add("hidden");
        goalWrap.innerHTML = "";
        return;
    }

    var poolRes = await supabaseClient.from("pools")
        .select("id, mode_code, name, round, status, competition, season, carryover_amount, carryover_enabled, price")
        .eq("id", pool_id).maybeSingle();

    if (!poolRes.data || String(poolRes.data.mode_code || "").toUpperCase() !== "GOLEO") {
        goalWrap.classList.add("hidden");
        goalWrap.innerHTML = "";
        return;
    }

    var pool = poolRes.data;
    goalWrap.classList.remove("hidden");

    var goalsRes = await supabaseClient.from("pool_goals_total")
        .select("total_goals").eq("pool_id", pool_id).maybeSingle();
    var actualGoals = goalsRes.data ? Number(goalsRes.data.total_goals) : null;

    var predsRes = await supabaseClient.from("predictions_goals_total")
        .select("entry_id, pool_id, predicted_goals").eq("pool_id", pool_id);
    var preds = predsRes.data || [];

    var entRes = await supabaseClient.from("entries")
        .select("id, participant_id, paid").eq("pool_id", pool_id);
    var entMap = {};
    (entRes.data || []).forEach(function(e) { entMap[e.id] = e; });

    var partIds = [...new Set((entRes.data || []).map(function(e) { return e.participant_id; }))];
    var partMap = {};
    if (partIds.length) {
        var partRes = await supabaseClient.from("participants")
            .select("id, name, area").in("id", partIds);
        (partRes.data || []).forEach(function(p) { partMap[p.id] = p; });
    }

    // Solo boletos pagados. Ganador = acierto EXACTO (diff === 0).
    var rows = preds.map(function(pred) {
        var entry = entMap[pred.entry_id] || {};
        var part = partMap[entry.participant_id] || { name: "?", area: "" };
        var diff = actualGoals !== null ? Math.abs(Number(pred.predicted_goals) - actualGoals) : null;
        var isExact = diff === 0;
        return {
            name: part.name,
            area: part.area || "",
            predicted: pred.predicted_goals,
            diff: diff,
            isExact: isExact,
            isWinner: isExact,
            paid: !!entry.paid
        };
    }).filter(function(r) {
        return r.paid;
    }).sort(function(a, b) {
        if (a.diff === null && b.diff === null) return a.name.localeCompare(b.name);
        if (a.diff === null) return 1;
        if (b.diff === null) return -1;
        return a.diff - b.diff || a.name.localeCompare(b.name);
    });

    var exactWinners = rows.filter(function(r) { return r.isExact; });
    var hasExact = exactWinners.length > 0;
    var bag = await getGoleoBagAmount(pool_id);
    var dryInfo = { dry: 0, pools: [] };
    try {
        dryInfo = await countConsecutiveDryGoleoJornadas(pool);
    } catch (e) {
        console.warn("countConsecutiveDryGoleoJornadas", e);
    }

    var jornada = pool.round != null && pool.round !== "" ? ("Jornada " + pool.round) : pool.name;
    var ruleText = actualGoals !== null
        ? (hasExact
            ? ("✅ " + exactWinners.length + " acertante" + (exactWinners.length > 1 ? "s" : "") + " exacto" + (exactWinners.length > 1 ? "s" : "") + " · se reparte la bolsa")
            : "❌ Sin acertante exacto · la bolsa se acumula a la próxima jornada Goleó")
        : "Captura los resultados para definir ganador (solo acierto exacto)";

    var bagHtml = [
        '<div class="grid grid-cols-2 gap-2 mb-3">',
        '<div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">',
        '<div class="text-[10px] text-zinc-500 uppercase tracking-wide">Bolsa total</div>',
        '<div class="text-lg font-black text-amber-400">' + money(bag.total_bag) + '</div>',
        '<div class="text-[10px] text-zinc-500 mt-0.5">premio ' + money(bag.prize_pool) + ' + acum. ' + money(bag.carryover_amount) + '</div>',
        '</div>',
        '<div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">',
        '<div class="text-[10px] text-zinc-500 uppercase tracking-wide">Sin acertante</div>',
        '<div class="text-lg font-black text-sky-400">' + dryInfo.dry + ' jornada' + (dryInfo.dry === 1 ? "" : "s") + '</div>',
        '<div class="text-[10px] text-zinc-500 mt-0.5">consecutivas cerradas</div>',
        '</div>',
        '</div>'
    ].join("");

    // Herramientas de bolsa (solo si hay algo que mover)
    var toolsHtml = [
        '<div class="mt-3 p-3 bg-zinc-950/80 border border-amber-500/20 rounded-xl space-y-2">',
        '<div class="text-xs font-bold text-amber-400">Bolsa acumulada · acciones</div>',
        '<div class="text-[11px] text-zinc-400 leading-relaxed">',
        'Si nadie acierta exacto, la bolsa pasa al siguiente Goleó. ',
        'Tras varias jornadas en seco puedes transferirla a una <b>Sencilla en borrador</b>.',
        '</div>',
        '<button type="button" id="btnGoleoCarryToNext" class="w-full bg-sky-700 hover:bg-sky-600 rounded-xl font-semibold py-2.5 text-sm">',
        '📦 Acumular bolsa de esta jornada → siguiente Goleó',
        '</button>',
        '<div class="grid gap-2">',
        '<select id="goleoTransferTarget" class="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm"></select>',
        '<button type="button" id="btnGoleoTransferToSencilla" class="w-full bg-amber-700 hover:bg-amber-600 rounded-xl font-semibold py-2.5 text-sm">',
        '➡️ Transferir bolsa acumulada a Sencilla (borrador)',
        '</button>',
        '</div>',
        '<div id="goleoBagActionMsg" class="text-[11px] text-zinc-500"></div>',
        '</div>'
    ].join("");

    goalWrap.innerHTML = [
        '<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mt-4">',
        '<div class="flex items-center justify-between mb-3 gap-2 flex-wrap">',
        '<h3 class="font-semibold">⚽ Campeón de Goleo \u2014 ' + jornada + '</h3>',
        actualGoals !== null
            ? '<span class="text-sm font-black text-emerald-400">' + actualGoals + ' goles reales</span>'
            : '<span class="text-xs text-zinc-400">Sin goles capturados aún</span>',
        '</div>',
        '<div class="text-xs mb-3 ' + (hasExact ? "text-emerald-400" : (actualGoals !== null ? "text-amber-400" : "text-zinc-400")) + '">' + ruleText + '</div>',
        bagHtml,
        rows.length
            ? rows.map(function(r, i) {
                var bg = r.isExact
                    ? "bg-emerald-500/20 border-emerald-500/40"
                    : "bg-zinc-950 border-zinc-800";
                var badge = r.isExact
                    ? '<span class="text-xs text-emerald-400 font-bold">EXACTO ✅</span>'
                    : (r.diff !== null ? '<span class="text-xs text-zinc-500">±' + r.diff + '</span>' : '');
                return [
                    '<div class="flex items-center justify-between p-3 border rounded-xl mb-2 ' + bg + '">',
                    '<div>',
                    '<div class="font-semibold text-sm">' + (i + 1) + '. ' + r.name + '</div>',
                    '<div class="text-xs text-zinc-400">' + r.area + '</div>',
                    '</div>',
                    '<div class="text-right flex items-center gap-3">',
                    '<div>',
                    '<div class="text-lg font-black">' + r.predicted + '</div>',
                    '<div class="text-xs text-zinc-400">goles pred.</div>',
                    '</div>',
                    badge,
                    '</div>',
                    '</div>'
                ].join("");
            }).join("")
            : '<div class="text-sm text-zinc-400">Sin pronósticos registrados aún.</div>',
        toolsHtml,
        '</div>'
    ].join("");

    // Llenar select de destinos: Sencillas en borrador
    await fillGoleoTransferTargets();

    var btnCarry = $("btnGoleoCarryToNext");
    if (btnCarry) {
        btnCarry.onclick = function() {
            processGoleoCarryToNext(pool_id);
        };
    }
    var btnTransfer = $("btnGoleoTransferToSencilla");
    if (btnTransfer) {
        btnTransfer.onclick = function() {
            processGoleoTransferToSencilla(pool_id);
        };
    }
}

async function fillGoleoTransferTargets() {
    var sel = $("goleoTransferTarget");
    if (!sel) return;
    var { data } = await supabaseClient.from("pools")
        .select("id, name, mode_code, status, round, carryover_amount")
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(40);
    var drafts = (data || []).filter(function(p) {
        return String(p.mode_code || "SENCILLA").toUpperCase() !== "GOLEO";
    });
    if (!drafts.length) {
        sel.innerHTML = '<option value="">No hay Sencillas en borrador</option>';
        return;
    }
    sel.innerHTML = '<option value="">Elige Sencilla (borrador) destino…</option>' +
        drafts.map(function(p) {
            var label = (p.name || p.id) + (p.carryover_amount ? (" · acum. " + money(Number(p.carryover_amount))) : "");
            return '<option value="' + p.id + '">' + label + '</option>';
        }).join("");
}

/**
 * Núcleo: acumula bolsa de un Goleó sin acertante exacto hacia el siguiente Goleó.
 * @param {string} sourcePoolId
 * @param {{ silent?: boolean, preferTargetId?: string|null }} opts
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, amount?: number, toName?: string, toId?: string }>}
 */
async function tryAutoCarryGoleoBag(sourcePoolId, opts) {
    opts = opts || {};
    var { data: source } = await supabaseClient.from("pools")
        .select("id, name, round, status, competition, season, mode_code, carryover_amount")
        .eq("id", sourcePoolId).maybeSingle();

    if (!source) return { ok: false, reason: "Pool no encontrado" };
    if (String(source.mode_code || "").toUpperCase() !== "GOLEO") {
        return { ok: true, skipped: true, reason: "no_goleo" };
    }

    var goalsRes = await supabaseClient.from("pool_goals_total")
        .select("total_goals").eq("pool_id", sourcePoolId).maybeSingle();
    var actual = goalsRes.data ? Number(goalsRes.data.total_goals) : null;
    if (actual === null || isNaN(actual)) {
        return { ok: false, skipped: true, reason: "sin_goles", msg: "Sin total de goles; no se pudo acumular automáticamente." };
    }

    var predsRes = await supabaseClient.from("predictions_goals_total")
        .select("entry_id, predicted_goals").eq("pool_id", sourcePoolId);
    var entRes = await supabaseClient.from("entries")
        .select("id").eq("pool_id", sourcePoolId).eq("paid", true);
    var paidIds = {};
    (entRes.data || []).forEach(function(e) { paidIds[e.id] = true; });
    var hasExact = (predsRes.data || []).some(function(pr) {
        return paidIds[pr.entry_id] && Number(pr.predicted_goals) === actual;
    });
    if (hasExact) {
        return { ok: true, skipped: true, reason: "hay_acertante", msg: "Hay acertante exacto; la bolsa se reparte." };
    }

    var bag = await getGoleoBagAmount(sourcePoolId);
    var already = null;
    try {
        var flags0 = JSON.parse(localStorage.getItem("qa_goleo_carried") || "{}");
        already = flags0[sourcePoolId] || null;
    } catch (e) { already = null; }

    var amountToMove = bag.total_bag;
    if (already && already.amount) {
        amountToMove = bag.carryover_amount;
        if (amountToMove <= 0) {
            return { ok: true, skipped: true, reason: "ya_transferido", msg: "Bolsa ya acumulada antes." };
        }
    }
    if (amountToMove <= 0) {
        return { ok: true, skipped: true, reason: "bolsa_cero", msg: "Bolsa en 0." };
    }

    var next = null;
    if (opts.preferTargetId) {
        var { data: pref } = await supabaseClient.from("pools")
            .select("id, name, round, status, carryover_amount, mode_code")
            .eq("id", opts.preferTargetId).maybeSingle();
        if (pref && String(pref.mode_code || "").toUpperCase() === "GOLEO") next = pref;
    }
    if (!next) {
        var q = supabaseClient.from("pools")
            .select("id, name, round, status, carryover_amount")
            .eq("mode_code", "GOLEO")
            .neq("id", sourcePoolId)
            .in("status", ["draft", "open"])
            .order("round", { ascending: true })
            .limit(20);
        if (source.competition) q = q.eq("competition", source.competition);
        if (source.season) q = q.eq("season", source.season);
        var { data: candidates } = await q;
        var srcRound = source.round;
        if (candidates && candidates.length) {
            if (srcRound != null && srcRound !== "" && !isNaN(Number(srcRound))) {
                next = candidates.find(function(c) {
                    return !isNaN(Number(c.round)) && Number(c.round) > Number(srcRound);
                }) || null;
            }
            if (!next) next = candidates[0];
        }
    }
    if (!next) {
        return {
            ok: false,
            skipped: true,
            reason: "sin_destino",
            msg: "No hay Goleó borrador/activo para recibir la bolsa. Crea la próxima jornada Goleó."
        };
    }

    var newCarry = Number(next.carryover_amount || 0) + amountToMove;
    var { error: e1 } = await supabaseClient.from("pools")
        .update({ carryover_amount: newCarry })
        .eq("id", next.id);
    if (e1) return { ok: false, reason: "error", msg: e1.message };

    var { error: e2 } = await supabaseClient.from("pools")
        .update({ carryover_amount: 0 })
        .eq("id", sourcePoolId);
    if (e2) return { ok: false, reason: "error", msg: e2.message };

    try {
        var flags = JSON.parse(localStorage.getItem("qa_goleo_carried") || "{}");
        var prevAmt = (flags[sourcePoolId] && flags[sourcePoolId].amount) ? Number(flags[sourcePoolId].amount) : 0;
        flags[sourcePoolId] = {
            to: next.id,
            amount: prevAmt + amountToMove,
            at: new Date().toISOString(),
            auto: !!opts.silent
        };
        localStorage.setItem("qa_goleo_carried", JSON.stringify(flags));
    } catch (e) { /* ignore */ }

    return {
        ok: true,
        amount: amountToMove,
        toId: next.id,
        toName: next.name || next.id,
        fromName: source.name || source.id
    };
}

/**
 * Valida si se puede acumular (sin escribir). Luego processGoleoCarryToNext confirma y llama try.
 */
async function previewGoleoCarry(sourcePoolId) {
    var { data: source } = await supabaseClient.from("pools")
        .select("id, name, round, competition, season, mode_code, carryover_amount")
        .eq("id", sourcePoolId).maybeSingle();
    if (!source || String(source.mode_code || "").toUpperCase() !== "GOLEO") {
        return { ok: false, msg: "Pool origen no es Goleó." };
    }
    var goalsRes = await supabaseClient.from("pool_goals_total")
        .select("total_goals").eq("pool_id", sourcePoolId).maybeSingle();
    var actual = goalsRes.data ? Number(goalsRes.data.total_goals) : null;
    if (actual === null || isNaN(actual)) {
        return { ok: false, msg: "Aún no hay total de goles capturado en esta jornada." };
    }
    var predsRes = await supabaseClient.from("predictions_goals_total")
        .select("entry_id, predicted_goals").eq("pool_id", sourcePoolId);
    var entRes = await supabaseClient.from("entries")
        .select("id").eq("pool_id", sourcePoolId).eq("paid", true);
    var paidIds = {};
    (entRes.data || []).forEach(function(e) { paidIds[e.id] = true; });
    var hasExact = (predsRes.data || []).some(function(pr) {
        return paidIds[pr.entry_id] && Number(pr.predicted_goals) === actual;
    });
    if (hasExact) return { ok: false, msg: "Hay acertante(s) exacto(s). La bolsa se reparte; no se acumula." };

    var bag = await getGoleoBagAmount(sourcePoolId);
    var already = null;
    try {
        already = JSON.parse(localStorage.getItem("qa_goleo_carried") || "{}")[sourcePoolId] || null;
    } catch (e) { already = null; }
    var amountToMove = bag.total_bag;
    if (already && already.amount) amountToMove = bag.carryover_amount;
    if (amountToMove <= 0) {
        return { ok: false, msg: already ? "Esta jornada ya transfirió su bolsa." : "No hay bolsa que acumular (0)." };
    }

    var q = supabaseClient.from("pools")
        .select("id, name, round, status, carryover_amount")
        .eq("mode_code", "GOLEO")
        .neq("id", sourcePoolId)
        .in("status", ["draft", "open"])
        .order("round", { ascending: true })
        .limit(20);
    if (source.competition) q = q.eq("competition", source.competition);
    if (source.season) q = q.eq("season", source.season);
    var { data: candidates } = await q;
    var next = null;
    if (candidates && candidates.length) {
        if (source.round != null && source.round !== "" && !isNaN(Number(source.round))) {
            next = candidates.find(function(c) {
                return !isNaN(Number(c.round)) && Number(c.round) > Number(source.round);
            }) || null;
        }
        if (!next) next = candidates[0];
    }
    if (!next) {
        return { ok: false, msg: "No hay otro Goleó en borrador/activo. Crea la próxima jornada Goleó primero." };
    }
    return { ok: true, amount: amountToMove, source: source, next: next };
}

async function processGoleoCarryToNext(sourcePoolId) {
    hideAlert();
    var msgEl = $("goleoBagActionMsg");
    if (msgEl) msgEl.textContent = "Procesando…";

    var prev = await previewGoleoCarry(sourcePoolId);
    if (!prev.ok) {
        if (msgEl) msgEl.textContent = prev.msg || "";
        return showAlert(prev.msg || "No se puede acumular.", "error");
    }

    var ok = window.confirm(
        "¿Acumular " + money(prev.amount) + " de «" + (prev.source.name || "") + "»\n" +
        "hacia «" + (prev.next.name || "") + "»?\n\n" +
        "Se sumará a su carryover_amount y se limpiará el acum. de origen."
    );
    if (!ok) {
        if (msgEl) msgEl.textContent = "Cancelado.";
        return;
    }

    var result = await tryAutoCarryGoleoBag(sourcePoolId, { silent: false, preferTargetId: prev.next.id });
    if (!result.ok) {
        if (msgEl) msgEl.textContent = result.msg || result.reason || "";
        return showAlert(result.msg || "Error al acumular.", "error");
    }
    if (result.skipped) {
        if (msgEl) msgEl.textContent = result.msg || result.reason || "";
        return showAlert(result.msg || "Nada que acumular.", "error");
    }

    showAlert("Bolsa " + money(result.amount) + " acumulada en «" + result.toName + "» ✅", "ok");
    if (msgEl) msgEl.textContent = "Listo → " + result.toName;
    await loadGoalChampionStandings();
}

/**
 * Llamar al cerrar un pool: si es GOLEO sin acertante exacto, acumula sola.
 * @returns {Promise<string>} texto corto para el alert (puede ser "").
 */
async function onGoleoPoolClosed(poolId) {
    if (!poolId) return "";
    try {
        var result = await tryAutoCarryGoleoBag(poolId, { silent: true });
        if (result && result.ok && !result.skipped && result.amount) {
            return " · Bolsa Goleó " + money(result.amount) + " → «" + result.toName + "»";
        }
        if (result && result.reason === "sin_destino") {
            return " · ⚠️ Goleó sin acertante: crea la próxima jornada para acumular la bolsa";
        }
        if (result && result.reason === "sin_goles") {
            return " · Goleó cerrado sin goles capturados (acumula manual luego en Aciertos)";
        }
        return "";
    } catch (e) {
        console.warn("onGoleoPoolClosed", e);
        return "";
    }
}

/**
 * Transfiere la bolsa acumulada (carryover del origen + prize si sin acertante)
 * a una Sencilla en borrador elegida.
 */
async function processGoleoTransferToSencilla(sourcePoolId) {
    hideAlert();
    var targetId = $("goleoTransferTarget") && $("goleoTransferTarget").value;
    if (!targetId) return showAlert("Elige una Sencilla en borrador como destino.", "error");

    var { data: source } = await supabaseClient.from("pools")
        .select("id, name, mode_code, status, carryover_amount, competition, season, round")
        .eq("id", sourcePoolId).maybeSingle();
    if (!source || String(source.mode_code || "").toUpperCase() !== "GOLEO") {
        return showAlert("Origen no es Goleó.", "error");
    }

    var { data: target } = await supabaseClient.from("pools")
        .select("id, name, mode_code, status, carryover_amount")
        .eq("id", targetId).maybeSingle();
    if (!target || target.status !== "draft") {
        return showAlert("El destino debe ser una jornada en borrador.", "error");
    }
    if (String(target.mode_code || "").toUpperCase() === "GOLEO") {
        return showAlert("El destino debe ser Sencilla (u otro modo no Goleó).", "error");
    }

    var bag = await getGoleoBagAmount(sourcePoolId);

    // Si hay goles y acertante exacto, solo transferimos el carryover entrante (no el prize a repartir)
    var goalsRes = await supabaseClient.from("pool_goals_total")
        .select("total_goals").eq("pool_id", sourcePoolId).maybeSingle();
    var actual = goalsRes.data ? Number(goalsRes.data.total_goals) : null;
    var transferAmount = bag.carryover_amount;
    if (actual !== null && !isNaN(actual)) {
        var predsRes = await supabaseClient.from("predictions_goals_total")
            .select("entry_id, predicted_goals").eq("pool_id", sourcePoolId);
        var entRes = await supabaseClient.from("entries")
            .select("id").eq("pool_id", sourcePoolId).eq("paid", true);
        var paidIds = {};
        (entRes.data || []).forEach(function(e) { paidIds[e.id] = true; });
        var hasExact = (predsRes.data || []).some(function(pr) {
            return paidIds[pr.entry_id] && Number(pr.predicted_goals) === actual;
        });
        if (!hasExact) {
            // Sin acertante: se puede mover toda la bolsa (prize + carry)
            transferAmount = bag.total_bag;
        }
    } else {
        // Sin resultados aún: solo carryover explícito
        transferAmount = bag.carryover_amount;
    }

    if (transferAmount <= 0) {
        return showAlert("No hay monto acumulado para transferir.", "error");
    }

    var ok = window.confirm(
        "¿Transferir " + money(transferAmount) + " desde Goleó «" + (source.name || "") + "»\n" +
        "hacia Sencilla borrador «" + (target.name || "") + "»?\n\n" +
        "Se sumará al carryover_amount del destino."
    );
    if (!ok) return;

    var newCarry = Number(target.carryover_amount || 0) + transferAmount;
    var { error: e1 } = await supabaseClient.from("pools")
        .update({ carryover_amount: newCarry, carryover_enabled: true })
        .eq("id", target.id);
    if (e1) return showAlert(e1.message, "error");

    var { error: e2 } = await supabaseClient.from("pools")
        .update({ carryover_amount: 0 })
        .eq("id", sourcePoolId);
    if (e2) return showAlert(e2.message, "error");

    try {
        var flags = JSON.parse(localStorage.getItem("qa_goleo_transferred") || "{}");
        flags[sourcePoolId] = { to: target.id, amount: transferAmount, at: new Date().toISOString() };
        localStorage.setItem("qa_goleo_transferred", JSON.stringify(flags));
    } catch (e) { /* ignore */ }

    showAlert("Transferidos " + money(transferAmount) + " a «" + target.name + "» ✅", "ok");
    await loadGoalChampionStandings();
}



// ═══════════════════════════════════════════════════════
// TABLA MUNDIAL 2026 — EN TIEMPO REAL
// ═══════════════════════════════════════════════════════
var _mundialRefreshTimer = null;
var _mundialCountdownTimer = null;
var _mundialRefreshSecs = 60;

async function loadMundialStandings() {
    var wrap = $("mundialStandingsWrap");
    if (!wrap) return;
    wrap.innerHTML = '<div class="text-sm text-zinc-400 text-center p-6">Cargando...</div>';

    // 1. Get all Mundial 2026 pools
    var {
        data: pools,
        error: poolsErr
    } = await supabaseClient
    .from("pools")
    .select("id, round, name, status, competition, season, price, mode_code")
    .ilike("competition", "%Mundial%")
    .order("created_at", {
        ascending: true
    });

    if (poolsErr) {
        wrap.innerHTML = '<div class="text-sm text-red-400 p-4">Error: ' + poolsErr.message + '</div>'; return;
    }
    if (!pools || !pools.length) {
        wrap.innerHTML = '<div class="text-sm text-zinc-400 text-center p-6">No hay jornadas de Mundial 2026 creadas aún.</div>';
        return;
    }

    var poolIds = pools.map(function(p) {
        return p.id;
    });

    // 2. Load all data in parallel
    var [entRes,
        ptRes,
        matchRes,
        goalsRes,
        partRes] = await Promise.all([
            supabaseClient.from("entries").select("id, participant_id, paid, pool_id").in("pool_id", poolIds),
            supabaseClient.from("entry_points").select("entry_id, pool_id, participant_id, points, played_matches, captured_picks").in("pool_id", poolIds),
            supabaseClient.from("matches").select("id, pool_id, home_goals, away_goals").in("pool_id", poolIds),
            supabaseClient.from("pool_goals_total").select("pool_id, total_goals").in("pool_id", poolIds),
            supabaseClient.from("participants").select("id, name, area").eq("is_active", true)
        ]);

    var entries = entRes.data || [];
    var points = ptRes.data || [];
    var matches = matchRes.data || [];
    var goalsData = goalsRes.data || [];
    var parts = partRes.data || [];

    var partMap = {};
    parts.forEach(function(p) {
        partMap[p.id] = p;
    });

    var goalsMap = {};
    goalsData.forEach(function(g) {
        goalsMap[g.pool_id] = g.total_goals;
    });

    // Paid entries per pool
    var paidByPool = {};
    entries.forEach(function(e) {
        if (!e.paid) return;
        if (!paidByPool[e.pool_id]) paidByPool[e.pool_id] = new Set();
        paidByPool[e.pool_id].add(e.id);
    });

    // Completed matches per pool
    var completedByPool = {};
    var totalByPool = {};
    matches.forEach(function(m) {
        if (!totalByPool[m.pool_id]) totalByPool[m.pool_id] = 0;
        totalByPool[m.pool_id]++;
        if (m.home_goals !== null && m.away_goals !== null) {
            if (!completedByPool[m.pool_id]) completedByPool[m.pool_id] = 0;
            completedByPool[m.pool_id]++;
        }
    });

    // ── BUILD ACCUMULATED LEADERBOARD ──
    var accumulatedPts = {}; // participantId → { name, area, totalPts, poolBreakdown[] }

    points.forEach(function(r) {
        var pool = pools.find(function(p) {
            return p.id === r.pool_id;
        });
        if (!pool) return;
        var paidSet = paidByPool[r.pool_id] || new Set();
        if (!paidSet.has(r.entry_id)) return; // only paid

        var pid = r.participant_id;
        var part = partMap[pid] || {};
        if (!accumulatedPts[pid]) {
            accumulatedPts[pid] = {
                name: part.name || "?",
                area: part.area || "",
                totalPts: 0,
                pools: {}
            };
        }
        accumulatedPts[pid].totalPts += Number(r.points || 0);
        accumulatedPts[pid].pools[pool.id] = {
            pts: Number(r.points || 0),
            label: pool.round ? "J" + pool.round: pool.name,
            played: Number(r.played_matches || 0),
            totalMatches: totalByPool[pool.id] || 0
        };
    });

    var ranked = Object.values(accumulatedPts)
    .sort(function(a, b) {
        return b.totalPts - a.totalPts || a.name.localeCompare(b.name);
    });

    var medals = ["🥇", "🥈", "🥉"];

    // ── RENDER ──
    var html = [];

    // Header with auto-refresh countdown
    html.push('<div class="flex items-center justify-between mb-3">');
    html.push('  <div>');
    html.push('    <div class="text-xs text-zinc-500">Actualización en: <span id="mundialCountdown" class="text-emerald-400 font-bold">60s</span></div>');
    html.push('  </div>');
    html.push('  <button onclick="refreshMundialNow()" class="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold">🔄 Ahora</button>');
    html.push('</div>');

    // Pool status cards
    html.push('<div class="grid gap-2 mb-4">');
    pools.forEach(function(pool) {
        var completed = completedByPool[pool.id] || 0;
        var total = totalByPool[pool.id] || 0;
        var pct = total > 0 ? Math.round(completed / total * 100): 0;
        var barColor = pct === 100 ? "bg-emerald-500": pct > 50 ? "bg-amber-400": "bg-zinc-600";
        var statusDot = pool.status === "open" ? "🟢": pool.status === "draft" ? "🔵": "🔴";
        var goles = goalsMap[pool.id] || 0;
        var label = pool.round ? (isNaN(pool.round) ? pool.round: "Jornada " + pool.round): pool.name;
        var price = pool.price ? "$" + pool.price: "";
        html.push([
            '<div class="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">',
            '<div class="flex items-center justify-between mb-1.5">',
            '<div class="font-semibold text-sm">' + statusDot + ' ' + label + ' <span class="text-xs text-zinc-400">' + price + '</span></div>',
            '<div class="text-xs text-zinc-400">' + completed + '/' + total + ' partidos</div>',
            '</div>',
            '<div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">',
            '<div class="h-full rounded-full transition-all ' + barColor + '" style="width:' + pct + '%"></div>',
            '</div>',
            goles ? '<div class="text-xs text-emerald-400 mt-1">⚽ ' + goles + ' goles</div>': '',
            '</div>'
        ].join(""));
    });
    html.push('</div>');

    // Accumulated standings
    if (!ranked.length) {
        html.push('<div class="text-sm text-zinc-400 text-center p-4 bg-zinc-900 border border-zinc-800 rounded-xl">Sin boletos pagados aún.</div>');
    } else {
        html.push('<div class="font-semibold text-sm mb-2">🏆 Tabla Acumulada — Mundial 2026</div>');
        html.push('<div class="space-y-2">');
        ranked.forEach(function(p, i) {
            var medal = i < 3 ? medals[i]: '<span class="text-zinc-500 font-bold text-sm">' + (i+1) + '</span>';
            var isTop = i === 0;
            var bg = isTop ? "bg-zinc-900 border-emerald-500/30": "bg-zinc-950 border-zinc-800";
            // Pool breakdown pills
            var pills = Object.values(p.pools).map(function(pp) {
                return '<span class="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">' +
                pp.label + ': <span class="font-bold text-emerald-400">' + pp.pts + '</span>' +
                '</span>';
            }).join(" ");

            html.push([
                '<div class="flex items-center gap-3 p-3 border rounded-xl ' + bg + '">',
                '<div class="text-xl w-8 text-center flex-shrink-0">' + medal + '</div>',
                '<div class="flex-1 min-w-0">',
                '<div class="font-bold text-sm">' + p.name + '</div>',
                '<div class="text-xs text-zinc-400 mt-0.5">' + (p.area || "Sin área") + '</div>',
                '<div class="flex flex-wrap gap-1 mt-1">' + pills + '</div>',
                '</div>',
                '<div class="text-right flex-shrink-0">',
                '<div class="text-xl font-black ' + (isTop ? "text-emerald-400": "text-white") + '">' + p.totalPts + '</div>',
                '<div class="text-xs text-zinc-400">pts</div>',
                '</div>',
                '</div>'
            ].join(""));
        });
        html.push('</div>');
    }

    wrap.innerHTML = html.join("\n");
    startMundialCountdown();
}

function startMundialCountdown() {
    if (_mundialCountdownTimer) clearInterval(_mundialCountdownTimer);
    _mundialRefreshSecs = 60;
    _mundialCountdownTimer = setInterval(function() {
        _mundialRefreshSecs--;
        var el = $("mundialCountdown");
        if (el) el.textContent = _mundialRefreshSecs + "s";
        if (_mundialRefreshSecs <= 0) {
            clearInterval(_mundialCountdownTimer);
            loadMundialStandings();
        }
    },
        1000);
}

function refreshMundialNow() {
    if (_mundialCountdownTimer) clearInterval(_mundialCountdownTimer);
    loadMundialStandings();
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
        .order("created_at", {
            ascending: false
        }).limit(1).maybeSingle();
        if (entRes.error || !entRes.data) return showAlert("No tiene boleto en esta jornada.", "error");
        eid = entRes.data.id;
    }

    var matchRes = await supabaseClient.from("matches")
    .select("id, match_no, home_team, away_team")
    .eq("pool_id", poolId).order("match_no", {
        ascending: true
    });
    if (matchRes.error) return showAlert(matchRes.error.message, "error");
    var matches = matchRes.data || [];

    var picksRes = await supabaseClient.from("predictions_1x2")
    .select("match_id, pick").eq("entry_id", eid);
    if (picksRes.error) return showAlert(picksRes.error.message, "error");
    var pickMap = {};
    (picksRes.data || []).forEach(function(p) {
        pickMap[p.match_id] = p.pick;
    });

    if (!Object.keys(pickMap).length) return showAlert("Sin pronosticos capturados.", "error");

    function pickLabel(c) {
        return c === "H" ? "LOCAL": c === "D" ? "EMPATE": c === "A" ? "VISITA": "?";
    }
    function pickArrow(c) {
        return c === "H" ? "->": c === "A" ? "<-": c === "D" ? "=": "?";
    }

    var jornada = pool && pool.round ? "Jornada " + pool.round: (pool && pool.name ? pool.name: "Jornada");
    var fechas = pool && pool.date_label ? pool.date_label: "";

    var lines = [
        "Quiniela Arcangel - " + jornada,
        "Pronostico de: " + part.name + (part.area ? " (" + part.area + ")": ""),
    ];
    if (fechas) lines.push("Fechas: " + fechas);
    lines.push("");
    matches.forEach(function(m) {
        var pick = pickMap[m.id];
        lines.push(m.match_no + ". " + m.home_team + " vs " + m.away_team);
        lines.push("   " + pickArrow(pick) + " " + (pick ? pickLabel(pick): "Sin pick"));
    });
    lines.push("");
    lines.push("Boleto pagado, boleto jugado. Suerte!");

    var text = lines.join("\n");
    var clean = String(part.whatsapp).replace(/\D/g, "");
    window.open("https://wa.me/52" + clean + "?text=" + encodeURIComponent(text), "_blank");
}


supabaseClient.auth.onAuthStateChange(function(event, session) {
    var newUserId = session && session.user ? session.user.id: null;

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

    const {
        data: sessionData
    } = await supabaseClient.auth.getSession();
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

    const firstStart = !appInitialized;

    if (firstStart) {
        setView("viewDash");
        resetAllTabs();
        initBottomNav();
        initPicksSearch();
        initPremiumSelects();
    }

    const now = new Date();
    const saludo = getGreetingByHour(getMonterreyHour(now));
    const fecha = formatMxHeader(now);
    $("greetingMain").textContent = `👋 ${saludo}, ${profile.display_name}`;
    $("greetingDate").textContent = fecha;

    // La pantalla aparece de inmediato. Cada módulo consulta sus datos al abrirse.
    if (firstStart) {
        await showAppTab("tab-home");
        appInitialized = true;

        // Notificaciones después del primer render, nunca durante la ruta crítica.
        if (typeof requestPushPermission === "function") {
            runWhenBrowserIdle(function() {
                window.setTimeout(requestPushPermission, 1500);
            }, 2500);
        }
    } else {
        // Reinicios reales de sesión: solo refrescar el resumen visible.
        await loadDashboardSummary();
        scheduleDashboardExtras( {
            force: true
        });
        updateNavBadges( {
            force: true
        }).catch(function(err) {
            console.warn("Badges al reiniciar:", err?.message || err);
        });
    }
}

// Arranque
setView("viewLogin");
safeInit();

// Errores globales — ya registrados arriba (eliminado duplicado)

// DOMContentLoaded eliminado — safeInit() ya se llama en línea 'Arranque'