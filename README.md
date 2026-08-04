# Quiniela Arcángel — Panel Administrativo

Aplicación web **privada** para administrar quinielas de fútbol: jornadas, participantes, boletos, pronósticos 1X2, resultados, aciertos y modos especiales (Sencilla, Goleo, etc.).

Solo usuarios con rol de administrador (RPC `is_admin` en Supabase) pueden entrar al panel.

---

## Stack

| Capa | Tecnología |
|------|------------|
| UI | HTML + Tailwind CDN + `styles.css` (tema dark premium) |
| Lógica | JavaScript (`app.js`) en el cliente |
| Backend / datos | [Supabase](https://supabase.com) (Auth, Postgres, RLS, vistas) |
| Exportes | html2canvas, jsPDF |
| Hosting típico | GitHub Pages / cualquier static host apuntando al repo |

No hay servidor Node propio: el panel habla directo con Supabase desde el navegador (anon key + políticas RLS).

---

## Características principales

### Dashboard (Inicio)
- Jornadas activas (pueden coexistir **varios modos**, p. ej. Sencilla + Goleo)
- Bolsas, boletos pagados / pendientes y resumen por modo
- Extras diferidos: historial de ganadores, tabla histórica, gráfica de aciertos, resumen semanal

### Participantes
- Alta, edición, archivar / restaurar
- WhatsApp, área, historial de picks y de boletos
- Importación CSV y cambio de área en bloque

### Jornadas (pools)
- Crear en borrador → activar → cerrar
- Campos: round, competencia, temporada, fechas, precio, comisión, **mode_code**
- Al activar, solo se cierran otras jornadas del **mismo modo** (Sencilla y Goleo pueden estar activas a la vez)
- Copiar plantilla de partidos entre jornadas, editar precio/comisión/fechas

### Plantillas
- Editor de partidos (local / visita) por jornada
- Preview, PNG, PDF, historia 9:16 y hojas para imprimir

### Pagos / boletos
- Registrar boleto (y opcionalmente marcar pagado en un paso)
- Filtros por estado de pago, picks y área
- Exportar pendientes por WhatsApp

### Pronósticos (Picks)
- Captura 1X2 por boleto
- Auto-guardado de borrador, vista previa, modo rápido (teclas 1/2/3)
- Estado de captura: completos / incompletos / pendientes
- Exportar boleto imagen, WhatsApp, vista compacta, recordatorios

### Resultados
- Captura de goles partido a partido o en lote
- **Sincronización entre jornadas hermanas** (mismo `round` + `competition` + `season`, distinto modo): al guardar en Sencilla se propagan goles a Goleo y viceversa

### Aciertos / standings
- Tabla oficial solo con boletos **pagados**
- Podio, cartel de ganador, top 3, CSV, comparativa picks vs resultados
- Soporte de vista **Campeón de Goleo** cuando `mode_code = GOLEO`

### Mundial 2026
- Pestaña de tabla acumulada en tiempo real para jornadas con competencia tipo Mundial

---

## Modos de juego (`mode_code`)

| Código | Etiqueta corta | Notas |
|--------|----------------|--------|
| `SENCILLA` | Sencilla | Quiniela 1X2 clásica |
| `GOLEO` | Goleo | Pronóstico de goles totales (+ plantilla de partidos) |
| `ACUMULADA` | Acumulada | Carryover habilitado |
| `CAMPEON_CAMPEONES` | C. Campeones | Modo especial |

Los selectores de jornadas muestran **nombre · modo · estado** para distinguir, por ejemplo, dos “Jornada 3” (Sencilla vs Goleo).

---

## Estructura del proyecto

```
.
├── index.html      # Shell UI (tabs, formularios, nav inferior)
├── app.js          # Toda la lógica del panel
├── styles.css      # Tema premium + selectores custom
├── manifest.json   # PWA
├── assets/         # Logos de equipos / mundial
└── img/            # Logo de la quiniela
```

### Selectores premium
Los `<select>` nativos se ocultan y se reemplazan por un **bottom sheet** al estilo de la app (sin picker del sistema operativo). El valor real sigue en el `<select>` original para no romper listeners `change` existentes.

---

## Configuración

1. Crea un proyecto Supabase con tablas/vistas usadas por el panel (`pools`, `matches`, `participants`, `entries`, `predictions_1x2`, `entry_points`, `pool_stats`, etc.) y la RPC `is_admin`.
2. En `app.js`, constantes al inicio:

```js
const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "tu_anon_key";
```

3. Activa RLS de forma que solo admins lean/escriban datos sensibles.
4. Publica los archivos estáticos (o usa GitHub Pages desde la rama `main`).

### Auth
- Login con email/contraseña (Supabase Auth).
- Tras login se exige perfil (`profiles.display_name`) y `is_admin() === true`.

---

## Uso rápido (admin)

1. **Participantes** → dar de alta con área y WhatsApp.
2. **Jornadas** → crear borrador (elige modo) → guardar **plantilla** de partidos → **Activar**.
3. **Pagos** → registrar boletos (pagados o pendientes).
4. **Picks** → cargar boleto y capturar 1X2 (o goles en modo Goleo).
5. **Resultados** → capturar marcadores (se sincronizan a la jornada hermana si existe).
6. **Aciertos** → revisar tabla, exportar carteles / CSV / WhatsApp.

---

## Notas técnicas

- Caché local de badges y tabs para no reconsultar de más.
- Badges del menú inferior: picks pendientes, pagos, resultados y standings listos, **multi-jornada activa**.
- Exportaciones usan librerías cargadas bajo demanda cuando hace falta PDF.
- Horarios límite de picks/pago editables desde Configuración (localStorage).

---

## Seguridad

- No compartas la service role key en el front.
- La anon key es pública por diseño; la seguridad depende de **RLS** y de `is_admin`.
- Desactiva signups públicos en Supabase cuando ya existan las cuentas de admin.

---

## Licencia / uso

Panel interno de **Quiniela Arcángel**. Uso administrativo privado; no es un producto multi-tenant público.
