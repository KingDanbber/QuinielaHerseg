# Análisis Técnico y Arquitectónico — Quiniela Arcángel

**Sistema unificado:** Admin (`QuinielaHerseg`) + Resultados para participantes (`Resultados-Quiniela-Arcangel`)

Fecha del análisis: Agosto 2026

---

## 1. Visión general del sistema

| Componente | Repositorio | Propósito | Acceso |
|------------|-------------|-----------|--------|
| **Admin** | `KingDanbber/QuinielaHerseg` | Gestión completa (CRUD, resultados, pagos, WhatsApp, exports) | Login (Supabase Auth) |
| **Resultados** | `KingDanbber/Resultados-Quiniela-Arcangel` | Visualización en vivo para participantes | **Sin login** (público) |

Ambas apps comparten la **misma base de datos Supabase** y se sincronizan a través de las tablas de pools, matches, entries, predictions y pool_results.

---

## 2. Stack tecnológico (común)

| Capa | Tecnología |
|------|------------|
| Frontend | **Vanilla JS SPA** (monolito en `index.html` + JS embebido / `app.js`) |
| Estilos | Tailwind CSS (CDN) + CSS custom muy extenso |
| Backend / DB | **Supabase** (Auth, Postgres, RLS, Realtime, REST) |
| PWA | `manifest.json` + `sw.js` (Service Worker) |
| Exportes | html2canvas + jsPDF (+ autoTable) |
| Gráficos | Chart.js |
| Celebraciones | canvas-confetti |
| 3D (solo Resultados) | Three.js (lazy-load) — trofeo + globo mundial |
| Logos | Mapas locales de equipos Liga MX + banderas Mundial 2026 |

---

## 3. Arquitectura de datos (Supabase)

Tablas principales detectadas (usadas por ambas apps):

- `pools` → jornadas / competiciones (status, lock_at, reveal_pronostics_at, price, commission_pct…)
- `matches` → partidos (home/away, scores, kickoff, logos)
- `participants` → catálogo de jugadores
- `entries` → boletas por pool + participante (paid, snapshots de nombre/área)
- `predictions_1x2` → pronósticos 1/X/2
- `predictions_total_goals` → total de goles (opcional)
- `pool_results` → cierre de jornada (bolsa, ganadores, outcome)

La app de **Resultados** lee todo vía REST (`/rest/v1/...`) con la **anon key** hardcodeada. No usa el cliente oficial de Supabase JS, solo `fetch`.

---

## 4. App de Resultados (participantes) — puntos clave

### Características principales
- **Sin autenticación**. Cualquiera con el link ve todo.
- Selector de jornada + pestañas de competición (multi-quiniela).
- Auto-refresh cada 60 s + detección de goles en vivo (animaciones + toasts + notificaciones del navegador).
- Tabs:
  - ⚽ **Partidos** (grid + modal de detalle con % de picks)
  - 🏆 **Clasificación** (lista / tarjetas, podio 3D, narrador en vivo, badges automáticos)
  - 📊 **Estadísticas** (Chart.js: barras, donut, goles, radar, perfiles)
  - 🏅 **Historial** acumulado
  - 👑 **Hall of Fame** (ganadores históricos + trofeo Three.js)
  - 📅 **Calendario** de jornadas
  - ⚡ **Comparador** 1 vs 1
- **Modo Mundial 2026**: Grupos oficiales, Fixture completo, Bracket eliminatorio (R32 → Final) calculado desde resultados.
- Temas visuales múltiples (Oscuro, Claro, Estadio, Copa, Champions, Santos, América, Clásico).
- Share de imagen PNG + WhatsApp text + link directo `?p=Nombre`.
- Export PDF completo (clasificación + matriz de picks + resultados).
- PWA instalable + atajos (Ranking, Partidos, Ganadores).

### Fortalezas UX
- Extremadamente rica visualmente.
- Narrador dinámico que comenta cambios de ranking.
- Animaciones de gol, confetti al finalizar, badges (En Racha, Novato, Veterano…).
- Soporte multi-boleta por participante.
- Aviso claro de “boleto no pagado no juega”.

### Debilidades técnicas
- **Monolito gigante** (\~359 KB solo el `index.html`).
- Toda la lógica en un solo `<script>` (difícil de mantener).
- Anon key y URL de Supabase hardcodeadas.
- No hay Realtime subscriptions (solo polling).
- Mucha lógica duplicada entre tabs (historial, stats generales, etc.).
- Three.js + Chart.js + confetti + jsPDF cargados siempre (aunque Three es lazy).

---

## 5. App Admin (QuinielaHerseg) — resumen

- SPA con login Supabase Auth.
- CRUD completo de participantes, pools, matches, picks, pagos, resultados.
- Integración WhatsApp (links / plantillas).
- Exports visuales PDF/PNG.
- Modo Mundial 2026 (grupos + bracket).
- También monolítico (`app.js` \~375 KB).

---

## 6. Seguridad y riesgos

| Riesgo | Severidad | Comentario |
|--------|-----------|------------|
| Anon key pública | Media | Normal en SPAs, **pero depende totalmente de RLS** |
| Sin login en Resultados | Baja-Media | Diseño intencional; cualquiera ve picks y pagos |
| Signup abierto en Admin | Alta | Debe desactivarse en producción |
| Polling vs Realtime | Baja | Funciona, pero consume más requests |
| Lógica de negocio en cliente | Media | Cálculo de ganadores, bolsas, etc. está en JS |

**Recomendación crítica**: verificar que las políticas RLS de Supabase bloqueen escrituras y limiten lecturas según necesidad. La app de Resultados solo debería poder **leer**.

---

## 7. Mantenibilidad y deuda técnica

- **Dos monolitos** casi independientes → cualquier cambio de schema hay que tocar ambos.
- Duplicación de:
  - Mapas de logos
  - Lógica de ranking / aciertos
  - Cálculo de bolsas
  - Helpers de fechas / normalización
- No hay tests, no hay TypeScript, no hay módulos.
- CSS enorme embebido (temas + responsive).
- Buena base para refactorizar hacia:
  - Shared package (utils + types + logo map)
  - Componentes o al menos módulos ES
  - Realtime subscriptions
  - Edge Functions para lógica sensible (cierre de jornada, cálculo de premios)

---

## 8. Resumen ejecutivo

**Quiniela Arcángel** es un sistema completo y muy maduro en funcionalidad:

- Admin potente para operar la quiniela.
- Front de resultados de nivel “producto” (PWA, temas, 3D, narrador, Mundial 2026, share, PDF…).

Es un excelente ejemplo de lo que se puede lograr con **Vanilla JS + Supabase** cuando se prioriza la experiencia del usuario.  
El principal reto a futuro es la **mantenibilidad**: los dos monolitos grandes y la lógica de negocio en el cliente.

---

*Documento generado a partir del análisis estático del código fuente de ambos repositorios.*
