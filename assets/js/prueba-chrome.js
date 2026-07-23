(() => {
  "use strict";

  function buildTestPdf() {
    const content = "BT /F1 18 Tf 36 72 Td (Prueba Cumbre PDF) Tj ET\n";
    const objects = [
      "",
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      `<< /Length ${content.length} >>\nstream\n${content}endstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let index = 1; index < objects.length; index++) {
      offsets[index] = pdf.length;
      pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index++) {
      pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

    return new File([pdf], "prueba-cumbre.pdf", { type: "application/pdf" });
  }

  function buildTestGpx() {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Cumbre" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="25.2265300" lon="-100.4071300">
    <ele>2758.0</ele>
    <name>Abasto de prueba</name>
    <type>aid_station</type>
  </wpt>
  <trk>
    <name>Prueba Cumbre</name>
    <trkseg>
      <trkpt lat="25.2265300" lon="-100.4071300"><ele>2758.0</ele></trkpt>
      <trkpt lat="25.2271000" lon="-100.4078000"><ele>2764.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    return new File([gpx], "prueba-cumbre.gpx", {
      type: "application/gpx+xml",
    });
  }

  function setResult(element, message, state) {
    element.textContent = message;
    element.dataset.state = state;
  }

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 5000);
  }

  async function testShare(button, result, createFile) {
    if (
      typeof File !== "function" ||
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function"
    ) {
      setResult(
        result,
        "No compatible: este navegador no ofrece Web Share para archivos.",
        "warning",
      );
      return;
    }

    const file = createFile();
    let canShare = false;
    try {
      canShare = navigator.canShare({ files: [file] });
    } catch (error) {
      setResult(
        result,
        `No se pudo comprobar el formato: ${error?.message || "error desconocido"}.`,
        "error",
      );
      return;
    }

    if (!canShare) {
      setResult(
        result,
        `No compatible: Instagram rechazó el formato ${file.name.split(".").pop().toUpperCase()}.`,
        "warning",
      );
      return;
    }

    button.disabled = true;
    setResult(result, "Abriendo el panel de Android…", "success");

    try {
      await navigator.share({ files: [file] });
      setResult(result, "El panel aceptó el archivo correctamente.", "success");
    } catch (error) {
      if (error?.name === "AbortError") {
        setResult(
          result,
          "Prueba cancelada: el panel sí pudo abrirse.",
          "warning",
        );
      } else if (error?.name === "NotAllowedError") {
        setResult(
          result,
          "Acción bloqueada por Instagram o por el navegador.",
          "error",
        );
      } else {
        setResult(
          result,
          `No se pudo compartir: ${error?.message || "error desconocido"}.`,
          "error",
        );
      }
    } finally {
      button.disabled = false;
    }
  }

  const pdfButton = document.querySelector("#sharePdf");
  const gpxButton = document.querySelector("#shareGpx");
  const pdfResult = document.querySelector("#pdfResult");
  const gpxResult = document.querySelector("#gpxResult");
  const autoGpxIntent = document.querySelector("#autoGpxIntent");
  const autoDownloadStatus = document.querySelector("#autoDownloadStatus");
  const autoResult = document.querySelector("#autoResult");
  const manualAutoGpx = document.querySelector("#manualAutoGpx");

  pdfButton.addEventListener("click", () => {
    testShare(pdfButton, pdfResult, buildTestPdf);
  });

  gpxButton.addEventListener("click", () => {
    testShare(gpxButton, gpxResult, buildTestGpx);
  });

  manualAutoGpx.addEventListener("click", () => {
    downloadFile(buildTestGpx());
    setResult(
      autoResult,
      "Descarga manual iniciada. Revisa la carpeta Descargas.",
      "success",
    );
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("auto") === "gpx") {
    autoGpxIntent.classList.add("hidden");
    autoDownloadStatus.classList.remove("hidden");
    setResult(
      autoResult,
      "Chrome abierto. Intentando descargar el GPX automáticamente…",
      "success",
    );

    window.setTimeout(() => {
      downloadFile(buildTestGpx());
      setResult(
        autoResult,
        "Intento automático ejecutado. Revisa la carpeta Descargas; si no aparece, usa el botón manual.",
        "success",
      );
    }, 300);
  }
})();
