(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".dist-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const { ruta, carrera, distancia } = btn.dataset;
      const url = `visor.html?ruta=${encodeURIComponent(ruta)}&carrera=${encodeURIComponent(carrera)}&distancia=${encodeURIComponent(distancia)}`;
      location.href = url;
    });
  });

  const dropzone = $("#uploadCard");
  const fileInput = $("#uploadInput");

  function goWithFile(file){
    if (!file) return;
    if (!/\.gpx$/i.test(file.name)){ alert("Elige un archivo .gpx"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try{
        sessionStorage.setItem("cumbre_gpx_text", reader.result);
        sessionStorage.setItem("cumbre_gpx_name", file.name.replace(/\.gpx$/i, ""));
        location.href = "visor.html?fuente=upload";
      }catch(err){
        alert("No se pudo cargar el archivo: " + err.message);
      }
    };
    reader.onerror = () => alert("No se pudo leer el archivo.");
    reader.readAsText(file);
  }

  $("#uploadBtn").addEventListener("click", ()=> fileInput.click());
  fileInput.addEventListener("change", e=> goWithFile(e.target.files[0]));

  ["dragenter","dragover"].forEach(ev=> dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.add("over"); }));
  ["dragleave","drop"].forEach(ev=> dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.remove("over"); }));
  dropzone.addEventListener("drop", e=> goWithFile(e.dataTransfer.files[0]));

  $("#scrollCta").addEventListener("click", e=>{
    e.preventDefault();
    document.querySelector("#elegir").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
})();
