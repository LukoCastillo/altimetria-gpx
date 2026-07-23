(() => {
  "use strict";

  try {
    const url = new URL(window.location.href);
    const payload = url.searchParams.get("handoff");
    if (!payload) return;

    // Se conserva solo dentro del navegador y se retira de la URL antes de
    // inicializar PostHog, para que los nombres de los puntos no lleguen a analítica.
    window.__cumbreHandoff = payload;
    try {
      sessionStorage.setItem("cumbre_export_handoff", payload);
    } catch (_) {
      /* window.__cumbreHandoff cubre navegadores con storage restringido */
    }

    url.searchParams.delete("handoff");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  } catch (_) {
    /* Un handoff inválido nunca debe impedir que el visor cargue normalmente. */
  }
})();
