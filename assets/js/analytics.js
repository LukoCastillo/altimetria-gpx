/*
 * Cumbre · capa de analítica (intercambiable) — PostHog
 * ------------------------------------------------------------
 * Envía SOLO acciones y categorías (qué distancia, si hubo éxito, tipo de
 * punto…). NUNCA envía contenido del GPX: coordenadas, nombres de archivo
 * personales, ni nombres/notas de waypoints. Respeta la promesa de que
 * "todo se procesa en tu navegador".
 *
 * El resto de la app solo usa `window.cumbreTrack(name, data)`. Para cambiar de
 * proveedor (Vercel, Umami, Plausible…), edita SOLO este archivo; los puntos de
 * llamada en index.js / visor.js no cambian.
 *
 * PostHog se carga con <script src="…/array.js"> en el HTML (define window.posthog).
 */
(() => {
  "use strict";

  // ⚠️ Pega aquí tu "Project API Key" de PostHog (es pública, segura en el cliente).
  //    PostHog → Settings → Project → Project API Key (empieza con "phc_").
  const POSTHOG_KEY  = "phc_zUzbBZJ43BVm9ERGpqxXkh7WSdmi6v49zEZjS27Mv5FN";
  const POSTHOG_HOST = "https://us.i.posthog.com";   // UE: https://eu.i.posthog.com

  // válida = empieza con "phc_" y no es el placeholder
  const keyListo = /^phc_[A-Za-z0-9]{20,}$/.test(POSTHOG_KEY) && POSTHOG_KEY.indexOf("REEMPLAZA") === -1;

  if (keyListo && window.posthog && typeof window.posthog.init === "function") {
    window.posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false,               // solo los eventos que definimos nosotros
      capture_pageview: true,           // pageviews automáticos (adquisición)
      disable_session_recording: true,  // sin grabación de sesión
      persistence: "localStorage",      // sin cookies (no requiere banner)
    });
  }

  // API única que usa el resto de la app.
  window.cumbreTrack = function (name, data) {
    try {
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture(name, data || {});
      }
    } catch (_) {
      /* la analítica nunca debe romper la app */
    }
  };
})();
