/*
 * Cumbre · capa de analítica (intercambiable)
 * ------------------------------------------------------------
 * Envía SOLO acciones y categorías (qué distancia, si hubo éxito, tipo de
 * punto…). NUNCA envía contenido del GPX: coordenadas, nombres de archivo
 * personales, ni nombres/notas de waypoints. Esto respeta la promesa de que
 * "todo se procesa en tu navegador".
 *
 * Hoy usa Vercel Web Analytics (same-origin, compatible con el CSP estricto).
 * Si algún día migras a Plausible/Umami, solo cambia el cuerpo de
 * `window.cumbreTrack`; los puntos de llamada en index.js / visor.js no cambian.
 */
(() => {
  "use strict";

  // Cola de Vercel Web Analytics: captura eventos disparados antes de que
  // el script de insights termine de cargar. (Definir aquí, no inline en el
  // HTML, para no violar `script-src 'self'`.)
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  // API única que usa el resto de la app.
  window.cumbreTrack = function (name, data) {
    try {
      window.va("event", { name: name, data: data || {} });
    } catch (_) {
      /* la analítica nunca debe romper la app */
    }
  };
})();
