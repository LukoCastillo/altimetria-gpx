(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const canvas = $("#chart"), ctx = canvas.getContext("2d");
  const overlay = $("#overlay"), tip = $("#tip");

  // ---- state ----
  let profile = [];          // {d:meters, e:meters}
  let markers = [];          // {d:meters, name, type}
  let plot = null;           // pixel rect of plot area (css px)
  let hoverIdx = -1;
  let mkDots = [];           // {x,y,mk,color} posiciones de waypoints sobre la curva
  let hoverDot = null;
  let touchLocked = false;
  let lastPointerType = "mouse";
  let activeEditorMarkerId = null;
  let sourceGPX = "";        // XML original para poder exportar el track completo
  let sourceRaw = [];         // {lat,lon,e}, alineado con profile
  let sourceFileName = "recorrido.gpx";
  let sourceUsesWptAsTrack = false;
  let currentCatalogRoute = null;
  let coachHideTimer = null;
  let markerToastTimer = null;
  let markerToastHideTimer = null;
  let markerHighlightTimer = null;
  let highlightedMarkerRow = null;

  const handoffPayload = window.__cumbreHandoff || (() => {
    try { return sessionStorage.getItem("cumbre_export_handoff"); }
    catch (_) { return null; }
  })();
  window.__cumbreHandoff = null;
  try { sessionStorage.removeItem("cumbre_export_handoff"); } catch (_) {}

  const TYPES = {
    food:   { color:"#ef8a2b", es:"Abasto",           icon:"aid"    },
    water:  { color:"#37a9e0", es:"Agua",            icon:"water"  },
    meal:   { color:"#dc7623", es:"Comida",          icon:"meal"   },
    gel:    { color:"#d99b20", es:"Gel",             icon:"gel"    },
    drink:  { color:"#258bbd", es:"Bebida",          icon:"drink"  },
    summit: { color:"#7d5fd0", es:"Cumbre",          icon:"summit" },
    point:  { color:"#8cc63f", es:"Otro",            badge:"A"     },
    start:  { color:"#63bb43", es:"Salida",          flag:true },
    finish: { color:"#e23b3b", es:"Meta",            flag:true },
  };
  const TYPE_ORDER = ["food", "water", "meal", "gel", "drink", "summit", "point", "start", "finish"];
  // GPX <wpt><type> → tipo interno
  const WPT_MAP = {
    AID_STATION:"food", FOOD:"meal", WATER:"water", ENERGY_GEL:"gel", SPORTS_DRINK:"drink",
    FIRST_AID:"point", DRINK:"drink", SUMMIT:"summit",
    LEFT:"point", RIGHT:"point", STRAIGHT:"point", GENERIC:"point"
  };

  function iconSVG(name){
    const st = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    switch(name){
      case "aid":    return `<svg viewBox="0 0 24 24" ${st}><path d="M4 8h16L18 4H6L4 8Z"/><path d="M6 8v12M18 8v12M9 13h6v4H9z"/></svg>`;
      case "water":  return `<svg viewBox="0 0 24 24" ${st}><path d="M12 3.5s5.5 6 5.5 10.3a5.5 5.5 0 0 1-11 0C6.5 9.5 12 3.5 12 3.5z"/></svg>`;
      case "meal":   return `<svg viewBox="0 0 24 24" ${st}><path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11"/><path d="M17 3c-1.6 1-2.2 3-2.2 5.2S15.5 11 17 11v10"/></svg>`;
      case "gel":    return `<svg viewBox="0 0 24 24" ${st}><path d="M7 4h10l1 16H6L7 4Z"/><path d="m13 7-3 5h3l-2 5"/></svg>`;
      case "drink":  return `<svg viewBox="0 0 24 24" ${st}><path d="M8 7h8l-1 13H9L8 7Z"/><path d="M7 4h7M14 4l3 5"/></svg>`;
      case "summit": return `<svg viewBox="0 0 24 24" ${st}><path d="M3 20 L10 6 L13.5 12 L16 8.5 L21 20 Z"/></svg>`;
      default: return "";
    }
  }
  const FLAG_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M7 21V4"/><path d="M7 5h9l-2 3 2 3H7"/></svg>`;

  // ---------- GPX parsing ----------
  const MAX_GPX_BYTES = 20 * 1024 * 1024;   // 20 MB — evita colgar el navegador
  const MAX_GPX_POINTS = 300000;            // nº máx. de puntos a procesar
  function parseGPX(text) {
    if (typeof text !== "string" || text.length > MAX_GPX_BYTES)
      throw new Error("El archivo es demasiado grande (máx. 20 MB).");
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("El archivo no es un XML válido.");
    let pts = [...doc.getElementsByTagName("trkpt")], usedWptAsTrack = false;
    if (!pts.length) pts = [...doc.getElementsByTagName("rtept")];
    if (!pts.length) { pts = [...doc.getElementsByTagName("wpt")]; usedWptAsTrack = true; }
    if (!pts.length) throw new Error("No se encontraron puntos con coordenadas en el GPX.");
    if (pts.length > MAX_GPX_POINTS) throw new Error("El recorrido tiene demasiados puntos (máx. 300 000).");
    const raw = pts.map(p => {
      const lat = parseFloat(p.getAttribute("lat"));
      const lon = parseFloat(p.getAttribute("lon"));
      const eEl = p.getElementsByTagName("ele")[0];
      const e = eEl ? parseFloat(eEl.textContent) : NaN;
      return { lat, lon, e };
    }).filter(p => isFinite(p.lat) && isFinite(p.lon));
    // fill missing elevations by carrying last known
    let last = null;
    for (const p of raw) { if (isFinite(p.e)) last = p.e; else if (last !== null) p.e = last; }
    if (!raw.some(p => isFinite(p.e))) throw new Error("El GPX no contiene datos de elevación.");
    const first = raw.find(p => isFinite(p.e))?.e ?? 0;
    for (const p of raw) if (!isFinite(p.e)) p.e = first;
    const name = doc.querySelector("trk > name, rte > name, metadata > name, name")?.textContent?.trim();
    const waypoints = usedWptAsTrack ? [] : [...doc.getElementsByTagName("wpt")].map(w=>({
      lat: parseFloat(w.getAttribute("lat")),
      lon: parseFloat(w.getAttribute("lon")),
      name: (w.getElementsByTagName("name")[0]?.textContent||"").trim(),
      type: (w.getElementsByTagName("type")[0]?.textContent||"").trim().toUpperCase(),
    })).filter(w=>isFinite(w.lat)&&isFinite(w.lon));
    return { raw, name, waypoints, usedWptAsTrack };
  }

  // km del nombre ("KM5.5 GOLF" → 5.5), o null
  function parseKm(name){ const m=/km\s*([\d]+(?:[.,]\d+)?)/i.exec(name||""); return m?parseFloat(m[1].replace(",",".")):null; }
  function cleanName(name){ return (name||"").replace(/^\s*km\s*[\d.,]+\s*/i,"").trim() || name || "Punto"; }
  function nearestDist(raw, prof, w){
    let bi=0, bd=Infinity;
    for (let i=0;i<raw.length;i++){ const d=haversine(raw[i], w); if(d<bd){bd=d;bi=i;} }
    return prof[bi].d;
  }
  function markersFromWpts(prof, raw, waypoints){
    const end = prof[prof.length-1].d;
    const mks = [{ id:mkSeq++, d:0, type:"start", name:"Salida" }];
    for (const w of waypoints){
      const km = parseKm(w.name);
      const d = km!=null ? Math.max(0, Math.min(km*1000, end)) : nearestDist(raw, prof, w);
      mks.push({ id:mkSeq++, d, type: WPT_MAP[w.type] || "point", name: cleanName(w.name) });
    }
    mks.push({ id:mkSeq++, d:end, type:"finish", name:"Meta" });
    return mks;
  }

  function haversine(a, b) {
    const R = 6371000, toR = Math.PI/180;
    const dLat = (b.lat-a.lat)*toR, dLon = (b.lon-a.lon)*toR;
    const la1 = a.lat*toR, la2 = b.lat*toR;
    const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function buildProfile(raw) {
    const out = [{ d:0, e:raw[0].e }];
    let d = 0;
    for (let i=1;i<raw.length;i++){
      d += haversine(raw[i-1], raw[i]);
      out.push({ d, e: raw[i].e });
    }
    return out;
  }

  function stats(prof) {
    let gain=0, loss=0, min=Infinity, max=-Infinity;
    const TH = 1.5; // metros, filtra ruido del GPS
    let ref = prof[0].e;
    for (const p of prof){
      min=Math.min(min,p.e); max=Math.max(max,p.e);
      const diff = p.e - ref;
      if (diff > TH){ gain += diff; ref = p.e; }
      else if (diff < -TH){ loss += -diff; ref = p.e; }
    }
    return { dist: prof[prof.length-1].d, gain, loss, min, max };
  }

  // ---------- ticks ----------
  function niceStep(range, target){
    const raw = range/target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw/mag;
    let step = norm>=5?5:norm>=2?2:norm>=1?1:0.5;
    return step*mag;
  }
  function ticks(min, max, target){
    const step = niceStep(max-min, target);
    const start = Math.ceil(min/step)*step;
    const t=[];
    for (let v=start; v<=max+1e-6; v+=step) t.push(Math.round(v*1000)/1000);
    return { step, t };
  }

  // ---------- rendering ----------
  function draw(){
    if (!profile.length) return;
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio||1, 2.5);
    canvas.width = cssW*dpr; canvas.height = cssH*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssW,cssH);

    const distKm = profile[profile.length-1].d/1000;
    const elev = profile.map(p=>p.e);
    let eMin = Math.min(...elev), eMax = Math.max(...elev);
    const pad = Math.max((eMax-eMin)*0.12, 10);
    const yTk = ticks(eMin-pad*0.4, eMax+pad, 5);
    const yLo = Math.min(yTk.t[0], eMin-pad*0.4);
    const yHi = Math.max(yTk.t[yTk.t.length-1], eMax+pad*0.4);
    const xTk = ticks(0, distKm, Math.min(8, Math.max(4, Math.round(distKm/5))));

    const m = { l: 58, r: 18, t: cssH<=320 ? 72 : 84, b: 34 };
    plot = { x:m.l, y:m.t, w:cssW-m.l-m.r, h:cssH-m.t-m.b, distKm, yLo, yHi };

    const X = km => plot.x + (km/distKm)*plot.w;
    const Xm = mm => X(mm/1000);
    const Y = e => plot.y + plot.h - ((e-yLo)/(yHi-yLo))*plot.h;
    plot.X=X; plot.Xm=Xm; plot.Y=Y;

    const cs = getComputedStyle(document.documentElement);
    const grid = cs.getPropertyValue("--grid").trim();
    const gridS = cs.getPropertyValue("--grid-strong").trim();
    const inkMute = cs.getPropertyValue("--poster-mute").trim();
    const ink = cs.getPropertyValue("--poster-ink").trim();

    // horizontal grid + Y labels
    ctx.lineWidth = 1;
    ctx.font = "700 12px "+cs.getPropertyValue("--font");
    ctx.textBaseline = "middle";
    for (const v of yTk.t){
      const y = Y(v);
      if (y < plot.y-2 || y > plot.y+plot.h+2) continue;
      ctx.strokeStyle = grid;
      ctx.beginPath(); ctx.moveTo(plot.x, y+.5); ctx.lineTo(plot.x+plot.w, y+.5); ctx.stroke();
      ctx.fillStyle = inkMute; ctx.textAlign = "right";
      ctx.fillText(Math.round(v).toString(), plot.x-10, y);
    }
    // vertical grid + X labels
    ctx.textBaseline = "top"; ctx.textAlign = "center";
    const xLabels = new Set(xTk.t.map(v=>Math.round(v)));
    for (const km of xTk.t){
      const x = X(km);
      ctx.strokeStyle = grid;
      ctx.beginPath(); ctx.moveTo(x+.5, plot.y); ctx.lineTo(x+.5, plot.y+plot.h); ctx.stroke();
    }
    // baseline + final vertical line
    ctx.strokeStyle = gridS; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(plot.x+.5, plot.y); ctx.lineTo(plot.x+.5, plot.y+plot.h);
    ctx.moveTo(plot.x, plot.y+plot.h+.5); ctx.lineTo(plot.x+plot.w, plot.y+plot.h+.5); ctx.stroke();

    // area fill
    const ridge = cs.getPropertyValue("--ridge").trim();
    const grad = ctx.createLinearGradient(0, plot.y, 0, plot.y+plot.h);
    grad.addColorStop(0,   cs.getPropertyValue("--area-top").trim());
    grad.addColorStop(0.5, cs.getPropertyValue("--area-mid").trim());
    grad.addColorStop(1,   cs.getPropertyValue("--area-bot").trim());
    ctx.beginPath();
    ctx.moveTo(Xm(profile[0].d), plot.y+plot.h);
    for (const p of profile) ctx.lineTo(Xm(p.d), Y(p.e));
    ctx.lineTo(Xm(profile[profile.length-1].d), plot.y+plot.h);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // stroke line on top (cresta)
    ctx.beginPath();
    profile.forEach((p,i)=> i?ctx.lineTo(Xm(p.d),Y(p.e)):ctx.moveTo(Xm(p.d),Y(p.e)));
    ctx.strokeStyle = ridge;
    ctx.lineWidth = 1.6; ctx.lineJoin="round"; ctx.stroke();

    // X labels (draw after area so they sit on axis)
    ctx.fillStyle = ink; ctx.font = "800 13px "+cs.getPropertyValue("--font");
    ctx.textBaseline = "top"; ctx.textAlign = "center";
    const drawnX = [];
    for (const km of xTk.t){
      const x = X(km);
      if (drawnX.some(px=>Math.abs(px-x)<26)) continue;
      drawnX.push(x);
      ctx.fillText(Math.round(km)+"K", x, plot.y+plot.h+9);
    }
    // ensure final distance labelled
    const xEnd = X(distKm);
    if (!drawnX.some(px=>Math.abs(px-xEnd)<26)){
      ctx.fillText(Math.round(distKm)+"K", xEnd, plot.y+plot.h+9);
    }

    // waypoint dots on the curve (mismo color del banderín)
    mkDots = [];
    const endD = profile[profile.length-1].d;
    const orderedMarkers = [...markers].sort((a,b)=>a.d-b.d);
    for (let markerIndex=0; markerIndex<orderedMarkers.length; markerIndex++){
      const mk = orderedMarkers[markerIndex];
      const t = TYPES[mk.type] || TYPES.point;
      const dm = Math.max(0, Math.min(mk.d, endD));
      const x = Xm(dm), y = Y(eleAt(dm));
      mkDots.push({ x, y, mk, color:t.color });
      const active = (hoverDot && hoverDot.mk === mk) || activeEditorMarkerId === mk.id;
      const isEdge = t.flag;
      ctx.beginPath(); ctx.arc(x, y, isEdge?(active?7:5.5):(active?11:9), 0, 7);
      ctx.fillStyle = t.color; ctx.fill();
      ctx.lineWidth = active?3:2; ctx.strokeStyle = "#fff"; ctx.stroke();
      if (!isEdge){
        ctx.fillStyle = "#fff"; ctx.font = "800 9px "+cs.getPropertyValue("--font");
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(markerIndex+1), x, y+.5);
      }
    }

    // hover crosshair
    if (hoverIdx>=0 && hoverIdx<profile.length){
      const p = profile[hoverIdx];
      const x=Xm(p.d), y=Y(p.e);
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth=1;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(x, plot.y); ctx.lineTo(x, plot.y+plot.h); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x,y,4.5,0,7); ctx.fillStyle="#fff"; ctx.fill();
      ctx.lineWidth=2.5; ctx.strokeStyle=ridge; ctx.stroke();
    }

    renderFlags();
  }

  function eleAt(meters){
    // linear interp elevation at a given distance
    if (meters<=profile[0].d) return profile[0].e;
    const last=profile[profile.length-1];
    if (meters>=last.d) return last.e;
    let lo=0, hi=profile.length-1;
    while (hi-lo>1){ const mid=(lo+hi)>>1; if(profile[mid].d<meters) lo=mid; else hi=mid; }
    const a=profile[lo], b=profile[hi];
    const t=(meters-a.d)/(b.d-a.d||1);
    return a.e+(b.e-a.e)*t;
  }

  function renderFlags(){
    if (!plot) return;
    overlay.innerHTML = "";
    const sorted = [...markers].sort((a,b)=>a.d-b.d);
    for (let markerIndex=0; markerIndex<sorted.length; markerIndex++){
      const mk = sorted[markerIndex];
      const t = TYPES[mk.type] || TYPES.point;
      const x = plot.Xm(mk.d);
      const el = document.createElement("div");
      el.className = "flag "+(t.flag?"edge":"poi")+(activeEditorMarkerId===mk.id?" editing":"");
      el.style.left = x+"px";
      el.style.top = "0px";
      el.style.height = (plot.y+plot.h)+"px";
      let inner = "";
      if (mk.note) inner += `<div class="note">${escapeHTML(mk.note)}</div>`;
      const pinContent = t.flag
        ? FLAG_ICON
        : t.icon ? iconSVG(t.icon) : String(markerIndex+1);
      inner += `<div class="pin" style="background:${t.color}">${pinContent}</div>`;
      if (t.flag) inner += `<div class="name">${escapeHTML(mk.name)}</div>`;
      el.innerHTML = inner;
      overlay.appendChild(el);
    }
  }
  const escapeHTML = s => String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  // ---------- stats UI ----------
  function renderStats(){
    const s = stats(profile);
    const km = (s.dist/1000);
    const items = [
      { k:"Distancia", v: km.toFixed(km<100?1:0), u:"km" },
      { k:"Desnivel +", v: Math.round(s.gain).toLocaleString("es"), u:"m", cls:"gain" },
      { k:"Desnivel −", v: Math.round(s.loss).toLocaleString("es"), u:"m", cls:"loss" },
      { k:"Altitud máx.", v: Math.round(s.max).toLocaleString("es"), u:"m" },
      { k:"Altitud mín.", v: Math.round(s.min).toLocaleString("es"), u:"m" },
    ];
    $("#stats").innerHTML = items.map(i=>`
      <div class="stat ${i.cls||""}">
        <div class="k">${i.k}</div>
        <div class="v">${i.v}<small>${i.u}</small></div>
      </div>`).join("");
  }

  // ---------- markers UI ----------
  function renderMkList(){
    const list = $("#mkList");
    const sorted = [...markers].sort((a,b)=>a.d-b.d);
    if (!sorted.length){ list.innerHTML = `<div class="mk-empty">Sin puntos. Haz clic en el perfil o pulsa “Añadir punto”.</div>`; return; }
    const maxKm = profile[profile.length-1].d/1000;
    const hasStrategyPoints = markers.some(mk=>!(TYPES[mk.type]||TYPES.point).flag);
    const guideAction = usesCoarsePointer()
      ? "Toca cualquier punto del perfil"
      : "Haz clic en cualquier punto del perfil";
    const emptyGuide = hasStrategyPoints ? "" : `
      <div class="mk-guide" role="status">
        <p><strong>Aún no tienes puntos de abasto.</strong> ${guideAction} o usa <b>+ Añadir punto</b>.</p>
      </div>`;
    list.innerHTML = emptyGuide + sorted.map((mk,index)=>{
      const t = TYPES[mk.type]||TYPES.point;
      const km = (mk.d/1000).toFixed(1);
      const opts = TYPE_ORDER.map(k=>
        `<option value="${k}" ${k===mk.type?"selected":""}>${TYPES[k].es}</option>`).join("");
      const typeIcon = t.flag ? FLAG_ICON : t.icon ? iconSVG(t.icon) : `<span class="type-generic" aria-hidden="true">•••</span>`;
      const lockedDistance = t.flag;
      return `<div class="mk-row${activeEditorMarkerId===mk.id?" editing":""}" data-id="${mk.id}">
        <span class="sw" style="background:${t.color}" title="Punto ${index+1}">${index+1}</span>
        <label class="mk-field mk-name-field"><span>Nombre o acción</span><input type="text" class="mk-name" value="${escapeHTML(mk.name)}" placeholder="Ej. Tomar agua y gel"></label>
        <label class="mk-field mk-type-field"><span>Tipo de punto</span><span class="mk-type-control"><span class="type-preview" style="background:${t.color}" aria-hidden="true">${typeIcon}</span><select class="mk-type">${opts}</select></span></label>
        <label class="mk-field mk-dist-field"><span>Kilómetro de la ruta</span><span class="km-input-wrap"><input type="number" class="mk-dist" value="${km}" min="0" max="${maxKm.toFixed(1)}" step="0.1" ${lockedDistance?'readonly aria-readonly="true"':''}><span class="km-unit">km</span></span></label>
        <button class="del" title="Eliminar" aria-label="Eliminar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        </button>
      </div>`;
    }).join("");

    list.querySelectorAll(".mk-row").forEach(row=>{
      const id = +row.dataset.id;
      const mk = markers.find(m=>m.id===id);
      row.addEventListener("focusin", ()=>{
        activeEditorMarkerId = id;
        row.classList.add("editing");
        draw();
      });
      row.addEventListener("focusout", e=>{
        if (row.contains(e.relatedTarget)) return;
        activeEditorMarkerId = null;
        row.classList.remove("editing");
        draw();
      });
      row.querySelector(".mk-name").addEventListener("input", e=>{ mk.name=e.target.value; renderFlags(); });
      row.querySelector(".mk-type").addEventListener("change", e=>{
        mk.type=e.target.value; activeEditorMarkerId=null; draw(); renderMkList();
      });
      const distInput = row.querySelector(".mk-dist");
      distInput.addEventListener("input", e=>{
        if ((TYPES[mk.type]||TYPES.point).flag || e.target.value==="") return;
        const km = parseFloat(e.target.value);
        if (!isFinite(km)) return;
        mk.d = Math.max(0, Math.min(km, maxKm))*1000;
        draw();
      });
      distInput.addEventListener("change", e=>{
        if ((TYPES[mk.type]||TYPES.point).flag) return;
        let km = parseFloat(e.target.value); if(!isFinite(km)) km=0;
        km = Math.max(0, Math.min(km, maxKm));
        mk.d = km*1000; activeEditorMarkerId=null; draw(); renderMkList();
      });
      row.querySelector(".del").addEventListener("click", ()=>{
        markers=markers.filter(m=>m.id!==id); activeEditorMarkerId=null; draw(); renderMkList();
      });
    });
  }

  function openAddedMarkerEditor(markerId){
    const row = $("#mkList").querySelector(`.mk-row[data-id="${markerId}"]`);
    if (!row) return;

    clearTimeout(markerHighlightTimer);
    highlightedMarkerRow?.classList.remove("just-added");
    highlightedMarkerRow = row;
    row.classList.add("just-added");

    const nameInput = row.querySelector(".mk-name");
    try { nameInput.focus({preventScroll:true}); }
    catch (_) { nameInput.focus(); }
    nameInput.select();
    requestAnimationFrame(()=>{
      row.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: usesCoarsePointer() ? "center" : "nearest",
      });
    });

    markerHighlightTimer = setTimeout(()=>{
      row.classList.remove("just-added");
      if (highlightedMarkerRow === row) highlightedMarkerRow = null;
    }, 3000);

    const toast = $("#markerToast");
    clearTimeout(markerToastTimer);
    clearTimeout(markerToastHideTimer);
    toast.hidden = false;
    toast.classList.remove("hiding");
    markerToastTimer = setTimeout(()=>{
      toast.classList.add("hiding");
      markerToastHideTimer = setTimeout(()=>{
        toast.hidden = true;
        toast.classList.remove("hiding");
        markerToastHideTimer = null;
      }, 220);
      markerToastTimer = null;
    }, 3200);
  }

  let mkSeq = 1;
  function addMarker(meters, type="water", name, metodo="otro"){
    const defaultName = type==="start" ? "Salida" : type==="finish" ? "Meta" : TYPES[type]?.es || "Punto";
    const marker = { id:mkSeq++, d:meters, type, name:name || defaultName };
    markers.push(marker);
    dismissChartCoach();
    draw(); renderMkList();
    if (metodo === "click_perfil" || metodo === "tooltip") openAddedMarkerEditor(marker.id);
    window.cumbreTrack?.("marker_added", { tipo: type, metodo });
    return marker;
  }

  // ---------- exports ----------
  function safeBaseName(name){
    return (name || "recorrido").replace(/\.gpx$/i, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "recorrido";
  }

  function isAndroidInstagram(){
    const ua = navigator.userAgent || "";
    return /Android/i.test(ua) && /Instagram/i.test(ua);
  }

  function encodeHandoff(value){
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = "";
    for (let i=0; i<bytes.length; i+=8192){
      binary += String.fromCharCode(...bytes.subarray(i, i+8192));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeHandoff(value){
    if (!value || value.length > 24000) throw new Error("Transferencia demasiado grande.");
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4-base64.length%4)%4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char=>char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function readHandoffState(){
    if (!handoffPayload) return null;
    const state = decodeHandoff(handoffPayload);
    if (
      !state ||
      state.v !== 1 ||
      !["gpx", "pdf"].includes(state.f) ||
      !Array.isArray(state.m) ||
      state.m.length < 2 ||
      state.m.length > 150
    ) throw new Error("La transferencia a Chrome no es válida.");

    const restored = state.m.map(item=>{
      if (!Array.isArray(item) || item.length < 3) throw new Error("Punto transferido no válido.");
      const d = Number(item[0]);
      const type = TYPE_ORDER.includes(item[1]) ? item[1] : "point";
      const name = String(item[2] || TYPES[type]?.es || "Punto")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 100);
      if (!isFinite(d)) throw new Error("Distancia transferida no válida.");
      return {d, type, name:name || TYPES[type]?.es || "Punto"};
    });
    return {format:state.f, markers:restored};
  }

  function buildChromeIntent(format){
    if (!currentCatalogRoute) return null;
    if (markers.length > 150) throw new Error("Hay demasiados puntos para transferir a Chrome.");

    const state = {
      v: 1,
      f: format,
      m: markers.map(marker=>[
        Math.round(marker.d*10)/10,
        TYPE_ORDER.includes(marker.type) ? marker.type : "point",
        String(marker.name || TYPES[marker.type]?.es || "Punto").slice(0, 100),
      ]),
    };
    const payload = encodeHandoff(state);
    if (payload.length > 18000) throw new Error("La estrategia es demasiado grande para transferir a Chrome.");

    const target = new URL(window.location.href);
    target.searchParams.delete("fuente");
    target.searchParams.set("ruta", currentCatalogRoute);
    target.searchParams.set("handoff", payload);
    const scheme = target.protocol.replace(":", "");
    const fallback = encodeURIComponent(target.href);
    return `intent://${target.host}${target.pathname}${target.search}`+
      `#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  }

  function handoffExportToChrome(format){
    if (!isAndroidInstagram() || !currentCatalogRoute) return false;
    try{
      const intent = buildChromeIntent(format);
      if (!intent) return false;
      window.location.href = intent;
      return true;
    }catch(err){
      alert("No se pudo preparar la descarga en Chrome:\n"+err.message);
      return true;
    }
  }

  function downloadBlob(blob, fileName){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 1500);
  }

  async function shareBlobIfPossible(blob, fileName){
    if (
      !isAndroidInstagram() ||
      typeof File !== "function" ||
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function"
    ) return false;
    const file = new File([blob], fileName, {type:blob.type});
    if (!navigator.canShare({files:[file]})) return false;
    try{
      await navigator.share({files:[file]});
      return true;
    }catch(err){
      if (err?.name === "AbortError") return true;
      throw err;
    }
  }

  function trackPositionAt(meters){
    const end = profile[profile.length-1].d;
    const d = Math.max(0, Math.min(meters, end));
    if (d <= 0) return { ...sourceRaw[0], e:profile[0].e };
    if (d >= end) return { ...sourceRaw[sourceRaw.length-1], e:profile[profile.length-1].e };
    let lo=0, hi=profile.length-1;
    while (hi-lo>1){ const mid=(lo+hi)>>1; if(profile[mid].d<d) lo=mid; else hi=mid; }
    const span = profile[hi].d-profile[lo].d;
    const t = span ? (d-profile[lo].d)/span : 0;
    return {
      lat: sourceRaw[lo].lat+(sourceRaw[hi].lat-sourceRaw[lo].lat)*t,
      lon: sourceRaw[lo].lon+(sourceRaw[hi].lon-sourceRaw[lo].lon)*t,
      e: profile[lo].e+(profile[hi].e-profile[lo].e)*t,
    };
  }

  function buildGPXWithMarkers(){
    const doc = new DOMParser().parseFromString(sourceGPX, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("No se pudo reconstruir el GPX original.");
    const root = doc.documentElement;
    const ns = root.namespaceURI || "http://www.topografix.com/GPX/1/1";
    // En un GPX normal reemplazamos sus waypoints por el estado actual del editor.
    // Si el archivo usa <wpt> como única geometría, se conservan para no borrar la ruta.
    if (!sourceUsesWptAsTrack) [...root.children].filter(el=>el.localName==="wpt").forEach(el=>el.remove());
    const firstRoute = [...root.children].find(el=>el.localName==="rte" || el.localName==="trk") || null;
    // Tipos de course point de FIT en minúsculas snake_case: es la convención (estilo
    // Ride with GPS) que Garmin Connect convierte de <wpt> a course points sobre el curso.
    const typeMap = { food:"aid_station", meal:"food", gel:"energy_gel", water:"water", drink:"sports_drink", summit:"summit",
      start:"generic", finish:"generic", point:"generic" };
    const sorted = [...markers].sort((a,b)=>a.d-b.d);
    for (const mk of sorted){
      const pos = trackPositionAt(mk.d);
      const wpt = doc.createElementNS(ns, "wpt");
      wpt.setAttribute("lat", pos.lat.toFixed(7));
      wpt.setAttribute("lon", pos.lon.toFixed(7));
      const ele = doc.createElementNS(ns, "ele"); ele.textContent = pos.e.toFixed(1); wpt.appendChild(ele);
      const name = doc.createElementNS(ns, "name"); name.textContent = mk.name || TYPES[mk.type]?.es || "Punto"; wpt.appendChild(name);
      const desc = doc.createElementNS(ns, "desc");
      desc.textContent = `Km ${(mk.d/1000).toFixed(2)} · ${TYPES[mk.type]?.es || "Punto"}`;
      wpt.appendChild(desc);
      const fitType = typeMap[mk.type] || "generic";
      const type = doc.createElementNS(ns, "type"); type.textContent = fitType; wpt.appendChild(type);
      // <sym> con el mismo valor: cubre el camino de importación (estilo Gaia GPS) que lee <sym>.
      const sym = doc.createElementNS(ns, "sym"); sym.textContent = fitType; wpt.appendChild(sym);
      root.insertBefore(wpt, firstRoute);
    }
    const serialized = new XMLSerializer().serializeToString(doc)
      .replace(/^\s*<\?xml[^?]*\?>\s*/i, "");
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+serialized;
  }

  function makeGPXExport(){
    const xml = buildGPXWithMarkers();
    const fileName = safeBaseName(sourceFileName)+"-con-puntos.gpx";
    return {
      blob:new Blob([xml], {type:"application/gpx+xml;charset=utf-8"}),
      fileName,
    };
  }

  function downloadGPXDirect(){
    try{
      const {blob, fileName} = makeGPXExport();
      downloadBlob(blob, fileName);
      window.cumbreTrack?.("export_gpx", { puntos: markers.length });
    }catch(err){ alert("No se pudo crear el GPX:\n"+err.message); }
  }

  async function exportGPX(){
    if (handoffExportToChrome("gpx")) return;
    if (isAndroidInstagram() && !currentCatalogRoute){
      try{
        const {blob, fileName} = makeGPXExport();
        if (await shareBlobIfPossible(blob, fileName)){
          window.cumbreTrack?.("export_gpx", { puntos: markers.length });
          return;
        }
        alert("Instagram no puede guardar este GPX importado. Ábrelo en Chrome y vuelve a importar el archivo.");
      }catch(err){ alert("No se pudo crear el GPX:\n"+err.message); }
      return;
    }
    downloadGPXDirect();
  }

  function makeExportChart(){
    const out = document.createElement("canvas"), w=1400, h=650;
    out.width=w; out.height=h;
    const c=out.getContext("2d");
    c.fillStyle="#f7f5ee"; c.fillRect(0,0,w,h);
    c.fillStyle="#2b2a24"; c.font="800 30px system-ui, sans-serif";
    c.fillText($("#trackName").textContent || "Perfil del recorrido", 72, 48);
    c.fillStyle="#6b6758"; c.font="600 17px system-ui, sans-serif";
    c.fillText($("#trackSub").textContent+" · Los números corresponden a la tabla de acciones", 72, 76);

    const m={l:82,r:38,t:125,b:55}, pw=w-m.l-m.r, ph=h-m.t-m.b;
    const end=profile[profile.length-1].d, distKm=end/1000;
    const elev=profile.map(p=>p.e), min=Math.min(...elev), max=Math.max(...elev);
    const pad=Math.max((max-min)*.12,10), yLo=min-pad, yHi=max+pad;
    const X=d=>m.l+(d/end)*pw, Y=e=>m.t+ph-((e-yLo)/(yHi-yLo))*ph;

    c.strokeStyle="rgba(74,66,40,.16)"; c.lineWidth=1;
    c.font="600 14px system-ui, sans-serif"; c.fillStyle="#6b6758";
    c.textAlign="right"; c.textBaseline="middle";
    const yStep=niceStep(yHi-yLo,5);
    for(let v=Math.ceil(yLo/yStep)*yStep;v<=yHi;v+=yStep){
      const y=Y(v); c.beginPath(); c.moveTo(m.l,y); c.lineTo(m.l+pw,y); c.stroke(); c.fillText(Math.round(v)+" m",m.l-10,y);
    }
    const xStep=niceStep(distKm,8);
    c.textAlign="center"; c.textBaseline="top";
    for(let km=0;km<=distKm+.0001;km+=xStep){
      const x=X(km*1000); c.beginPath(); c.moveTo(x,m.t); c.lineTo(x,m.t+ph); c.stroke(); c.fillText(Math.round(km)+" km",x,m.t+ph+12);
    }
    const grad=c.createLinearGradient(0,m.t,0,m.t+ph);
    grad.addColorStop(0,"#79542e"); grad.addColorStop(.5,"#6d6134"); grad.addColorStop(1,"#5c6a33");
    c.beginPath(); c.moveTo(X(0),m.t+ph);
    profile.forEach(p=>c.lineTo(X(p.d),Y(p.e)));
    c.lineTo(X(end),m.t+ph); c.closePath(); c.fillStyle=grad; c.fill();
    c.beginPath(); profile.forEach((p,i)=>i?c.lineTo(X(p.d),Y(p.e)):c.moveTo(X(p.d),Y(p.e)));
    c.strokeStyle="#3f4a23"; c.lineWidth=3; c.lineJoin="round"; c.stroke();

    const sorted=[...markers].sort((a,b)=>a.d-b.d);
    sorted.forEach((mk,i)=>{
      const x=X(Math.max(0,Math.min(mk.d,end))), y=Y(eleAt(mk.d));
      const color=(TYPES[mk.type]||TYPES.point).color;
      c.beginPath(); c.arc(x,y,13,0,Math.PI*2); c.fillStyle=color; c.fill();
      c.lineWidth=3; c.strokeStyle="#fff"; c.stroke();
      c.fillStyle="#fff"; c.font="800 13px system-ui, sans-serif"; c.textAlign="center"; c.textBaseline="middle";
      c.fillText(String(i+1),x,y+.5);
    });
    return out;
  }

  function pdfText(value){
    const replacements={"–":"-","—":"-","‘":"'","’":"'","“":'"',"”":'"',"…":"..."};
    let out="";
    for(const ch of String(value).replace(/[–—‘’“”…]/g,c=>replacements[c])){
      const code=ch.charCodeAt(0), safe=code<=255?ch:"?";
      out += safe==="\\"?"\\\\":safe==="("?"\\(":safe===")"?"\\)":safe;
    }
    return out;
  }
  const pdfLabel = (text,x,y,size=11,bold=false) =>
    `BT /${bold?"F2":"F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(text)}) Tj ET\n`;

  function wrapAction(text, max=105){
    const words=String(text||"Punto").split(/\s+/), lines=[];
    let line="";
    for(const word of words){
      if(!line){ line=word; continue; }
      if((line+" "+word).length<=max) line+=" "+word;
      else { lines.push(line); line=word; }
    }
    if(line) lines.push(line);
    return lines.length ? lines : ["Punto"];
  }

  function tableCommands(rows, yTop, continued=false){
    let s=pdfLabel(continued?"Tabla de acciones (continuación)":"Tabla de acciones",46,yTop+24,14,true);
    const x0=46, x1=82, x2=158, x3=796, headerH=18;
    s += "0.91 g "+x0+" "+(yTop-headerH)+" "+(x3-x0)+" "+headerH+" re f 0 g\n";
    s += pdfLabel("#",58,yTop-13,9,true)+pdfLabel("Kilómetro",91,yTop-13,9,true)+pdfLabel("Acción",168,yTop-13,9,true);
    let y=yTop-headerH;
    rows.forEach(row=>{
      const rh=Math.max(18,row.lines.length*12+6);
      s += `0.82 G 0.5 w ${x0} ${y-rh} m ${x3} ${y-rh} l S\n`;
      s += pdfLabel(row.num,58,y-13,9)+pdfLabel(row.km,91,y-13,9);
      row.lines.forEach((line,i)=>{ s+=pdfLabel(line,168,y-13-i*12,9); });
      y-=rh;
    });
    s += `0.72 G 0.7 w ${x0} ${yTop} m ${x3} ${yTop} l ${x3} ${y} l ${x0} ${y} l h S\n`;
    [x1,x2].forEach(x=>{s+=`${x} ${yTop} m ${x} ${y} l S\n`;});
    return s;
  }

  function buildPDF(jpegBinary, imageWidth, imageHeight){
    const rows=[...markers].sort((a,b)=>a.d-b.d).map((mk,i)=>({
      num:String(i+1), km:(mk.d/1000).toFixed(2)+" km",
      lines:wrapAction(mk.name || TYPES[mk.type]?.es || "Punto")
    }));
    const groups=[];
    let capacity=7, group=[], used=0;
    for(const row of rows){
      const units=Math.max(1,row.lines.length);
      if(group.length && used+units>capacity){ groups.push(group); group=[]; used=0; capacity=25; }
      group.push(row); used+=units;
    }
    groups.push(group);
    const pageCount=groups.length, objects=[];
    objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
    const kids=groups.map((_,i)=>(5+i*2)+" 0 R").join(" ");
    objects[2]=`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
    objects[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    const imageId=5+pageCount*2;
    objects[imageId]=`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBinary.length} >>\nstream\n${jpegBinary}\nendstream`;
    groups.forEach((group,i)=>{
      const pageId=5+i*2, contentId=pageId+1;
      let content;
      if(i===0){
        content=`q 750 0 0 348 46 235 cm /Im1 Do Q\n`+tableCommands(group,205,false);
      }else{
        content=pdfLabel($("#trackName").textContent || "Perfil del recorrido",46,562,18,true)+tableCommands(group,530,true);
      }
      objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId]=`<< /Length ${content.length} >>\nstream\n${content}endstream`;
    });
    let pdf="%PDF-1.4\n%âãÏÓ\n", offsets=[0];
    for(let i=1;i<objects.length;i++){
      if(!objects[i]) continue;
      offsets[i]=pdf.length;
      pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xref=pdf.length;
    pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for(let i=1;i<objects.length;i++) pdf+=(offsets[i]||0).toString().padStart(10,"0")+" 00000 n \n";
    pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes=new Uint8Array(pdf.length);
    for(let i=0;i<pdf.length;i++) bytes[i]=pdf.charCodeAt(i)&255;
    return new Blob([bytes],{type:"application/pdf"});
  }

  function makePDFExport(){
    const chart=makeExportChart();
    const data=chart.toDataURL("image/jpeg",.92).split(",")[1];
    const jpeg=atob(data);
    return {
      blob:buildPDF(jpeg,chart.width,chart.height),
      fileName:safeBaseName(sourceFileName)+"-altimetria.pdf",
    };
  }

  async function downloadPDFDirect(){
    const btn=$("#downloadPdf"), original=btn.innerHTML;
    try{
      btn.disabled=true; btn.textContent="Preparando PDF…";
      const {blob, fileName}=makePDFExport();
      downloadBlob(blob,fileName);
      window.cumbreTrack?.("export_pdf", { puntos: markers.length });
    }catch(err){ alert("No se pudo crear el PDF:\n"+err.message); }
    finally{ btn.disabled=false; btn.innerHTML=original; }
  }

  async function exportPDF(){
    if (handoffExportToChrome("pdf")) return;
    if (isAndroidInstagram() && !currentCatalogRoute){
      const btn=$("#downloadPdf"), original=btn.innerHTML;
      try{
        btn.disabled=true; btn.textContent="Preparando PDF…";
        const {blob, fileName}=makePDFExport();
        if (await shareBlobIfPossible(blob, fileName)){
          window.cumbreTrack?.("export_pdf", { puntos: markers.length });
          return;
        }
        alert("Instagram no puede guardar este PDF. Ábrelo en Chrome para descargarlo.");
      }catch(err){ alert("No se pudo crear el PDF:\n"+err.message); }
      finally{ btn.disabled=false; btn.innerHTML=original; }
      return;
    }
    await downloadPDFDirect();
  }

  // ---------- load ----------
  function usesCoarsePointer(){
    return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  }

  function showChartCoach(){
    const coach = $("#chartCoach");
    clearTimeout(coachHideTimer);
    coachHideTimer = null;
    coach.textContent = `${usesCoarsePointer() ? "Toca" : "Haz clic en"} cualquier punto del perfil para marcar dónde comerás o beberás`;
    coach.hidden = false;
    coach.classList.remove("hiding");
  }

  function dismissChartCoach(){
    const coach = $("#chartCoach");
    if (coach.hidden) return;
    clearTimeout(coachHideTimer);
    coach.classList.add("hiding");
    coachHideTimer = setTimeout(()=>{
      coach.hidden = true;
      coach.classList.remove("hiding");
      coachHideTimer = null;
    }, 220);
  }

  function load(prof, name, mks){
    profile = prof;
    markers = mks || [
      { id:mkSeq++, d:0, type:"start", name:"Salida" },
      { id:mkSeq++, d:prof[prof.length-1].d, type:"finish", name:"Meta" },
    ];
    $("#drop").classList.add("hidden");
    $("#result").classList.remove("hidden");
    $("#exportActions").classList.remove("hidden");
    $("#viewerSub").textContent = `${usesCoarsePointer() ? "Toca" : "Haz clic en"} el perfil para añadir un punto`;
    $("#trackName").textContent = name || "Perfil del recorrido";
    const s = stats(prof);
    $("#trackSub").textContent = `${(s.dist/1000).toFixed(1)} km · +${Math.round(s.gain)} m`;
    renderStats(); renderMkList();
    requestAnimationFrame(draw);
    requestAnimationFrame(showChartCoach);
  }

  function loadFromGPXText(text, fallbackName, titleOverride, fileName, markerOverride){
    const { raw, name, waypoints, usedWptAsTrack } = parseGPX(text);
    const prof = buildProfile(raw);
    if (prof[prof.length-1].d < 1) throw new Error("El recorrido no tiene distancia (¿coordenadas iguales?).");
    sourceGPX = text;
    sourceRaw = raw;
    sourceFileName = fileName || fallbackName || name || "recorrido.gpx";
    sourceUsesWptAsTrack = usedWptAsTrack;
    mkSeq = 1;
    const end = prof[prof.length-1].d;
    const mks = markerOverride
      ? markerOverride.map(marker=>({
          id:mkSeq++,
          d:Math.max(0, Math.min(Number(marker.d), end)),
          type:TYPE_ORDER.includes(marker.type) ? marker.type : "point",
          name:String(marker.name || TYPES[marker.type]?.es || "Punto").slice(0, 100),
        }))
      : markersFromWpts(prof, raw, waypoints);
    load(prof, titleOverride || name || fallbackName, mks);
  }

  async function handleFile(file){
    try{
      const text = await file.text();
      currentCatalogRoute = null;
      loadFromGPXText(text, file.name.replace(/\.gpx$/i,""), null, file.name);
      window.cumbreTrack?.("profile_rendered", { fuente: "import_viewer", distancia: "custom" });
    }catch(err){
      window.cumbreTrack?.("profile_load_failed", { fuente: "import_viewer", razon: String(err && err.message || "error").slice(0, 80) });
      alert("No se pudo leer el GPX:\n"+err.message);
    }
  }

  // ---------- interaction ----------
  function pointerToIdx(clientX){
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left;
    if (!plot) return -1;
    const km = ((x-plot.x)/plot.w)*plot.distKm;
    const meters = km*1000;
    // nearest sample
    let lo=0, hi=profile.length-1;
    if (meters<=profile[0].d) return 0;
    if (meters>=profile[hi].d) return hi;
    while (hi-lo>1){ const mid=(lo+hi)>>1; if(profile[mid].d<meters) lo=mid; else hi=mid; }
    return (meters-profile[lo].d < profile[hi].d-meters)?lo:hi;
  }

  function markerNear(clientX, clientY, radius=18){
    const r = canvas.getBoundingClientRect();
    const px = clientX-r.left, py = clientY-r.top;
    let near=null, best=radius;
    for (const d of mkDots){
      const dist=Math.hypot(d.x-px, d.y-py);
      if(dist<best){best=dist;near=d;}
    }
    return near;
  }

  function showTooltip(idx, near, locked=false){
    const anchorX = near ? near.x : plot.Xm(profile[idx].d);
    const anchorY = near ? near.y : plot.Y(profile[idx].e);
    const safePad = locked ? Math.min(115, canvas.clientWidth/2) : 74;
    const safeX = Math.max(safePad, Math.min(anchorX, canvas.clientWidth-safePad));
    tip.classList.toggle("locked", locked);
    tip.setAttribute("role", locked ? "dialog" : "status");
    tip.style.left = safeX+"px";
    tip.style.top = anchorY+"px";
    tip.style.opacity = 1;
    if (near){
      const t = TYPES[near.mk.type] || TYPES.point;
      tip.innerHTML =
        `<div class="tw" style="color:${t.color}"><span class="dotc" style="background:${t.color}"></span>${escapeHTML(near.mk.name)}</div>`+
        `<div class="r"><span>Tipo</span><b>${t.es}</b></div>`+
        `<div class="r"><span>Kilómetro</span><b>${(near.mk.d/1000).toFixed(2)} km</b></div>`+
        `<div class="r"><span>Altitud</span><b>${Math.round(eleAt(near.mk.d))} m</b></div>`+
        (near.mk.note?`<div class="r"><span>Nota</span><b>${escapeHTML(near.mk.note)}</b></div>`:"");
    } else {
      const p = profile[idx];
      tip.innerHTML = `<div class="r"><span>Distancia</span><b>${(p.d/1000).toFixed(2)} km</b></div>`+
                      `<div class="r"><span>Altitud</span><b>${Math.round(p.e)} m</b></div>`+
                      (locked ? `<button type="button" class="tip-add" data-meters="${p.d}">+ Añadir punto aquí</button>` : "");
    }
  }

  function clearTouchInspect(){
    if (!touchLocked) return;
    touchLocked=false; hoverIdx=-1; hoverDot=null;
    tip.classList.remove("locked"); tip.setAttribute("role","status");
    tip.style.opacity=0; canvas.style.cursor="default"; draw();
  }

  canvas.addEventListener("pointerdown", e=>{ lastPointerType=e.pointerType || "mouse"; });
  canvas.addEventListener("pointermove", e=>{
    if (e.pointerType === "touch") return;
    touchLocked = false; tip.classList.remove("locked"); tip.setAttribute("role","status");
    const idx = pointerToIdx(e.clientX);
    if (idx<0){ hoverIdx=-1; hoverDot=null; tip.style.opacity=0; canvas.style.cursor="default"; draw(); return; }
    const near = markerNear(e.clientX, e.clientY);
    hoverIdx = idx; hoverDot = near; draw();
    canvas.style.cursor = near ? "pointer" : "crosshair";
    showTooltip(idx, near, false);
  });
  canvas.addEventListener("pointerleave", ()=>{
    if (touchLocked) return;
    hoverIdx=-1; hoverDot=null; tip.style.opacity=0; canvas.style.cursor="default"; draw();
  });
  canvas.addEventListener("click", e=>{
    if (!plot) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX-r.left, y = e.clientY-r.top;
    if (x<plot.x-6 || x>plot.x+plot.w+6 || y<plot.y || y>plot.y+plot.h+6) return;
    const isTouch = e.pointerType === "touch" || lastPointerType === "touch";
    if (isTouch){
      const idx = pointerToIdx(e.clientX);
      if (idx<0) return;
      const near = markerNear(e.clientX, e.clientY, 28);
      touchLocked=true; hoverIdx=idx; hoverDot=near; draw();
      showTooltip(idx, near, true);
      return;
    }
    if (mkDots.some(d=>Math.hypot(d.x-x, d.y-y)<15)) return; // ya hay un punto aquí
    const km = Math.max(0, Math.min(((x-plot.x)/plot.w)*plot.distKm, plot.distKm));
    addMarker(km*1000, "water", undefined, "click_perfil");
  });

  tip.addEventListener("click", e=>{
    const btn = e.target.closest(".tip-add");
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const meters = parseFloat(btn.dataset.meters);
    if (!isFinite(meters)) return;
    touchLocked=false; tip.classList.remove("locked"); tip.style.opacity=0;
    addMarker(meters, "water", undefined, "tooltip");
  });
  document.addEventListener("pointerdown", e=>{
    if (touchLocked && e.pointerType==="touch" && !e.target.closest(".chart-stage")) clearTouchInspect();
  });

  // ---------- wiring ----------
  $("#importBtn").addEventListener("click", ()=>$("#fileInput").click());
  $("#fileInput").addEventListener("change", e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); e.target.value=""; });
  $("#addMk").addEventListener("click", ()=> addMarker(profile[profile.length-1].d*0.5, "water", undefined, "boton"));
  $("#downloadGpx").addEventListener("click", exportGPX);
  $("#downloadPdf").addEventListener("click", exportPDF);

  const drop = $("#drop");
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault();drop.classList.add("over");}));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault();drop.classList.remove("over");}));
  drop.addEventListener("drop", e=>{ const f=e.dataTransfer.files[0]; if(f) handleFile(f); });
  // allow dropping anywhere on window once a track is loaded
  window.addEventListener("dragover", e=>e.preventDefault());
  window.addEventListener("drop", e=>{ e.preventDefault(); const f=e.dataTransfer?.files?.[0]; if(f && f.name.match(/\.gpx$/i)) handleFile(f); });

  // tema claro fijo
  document.documentElement.setAttribute("data-theme", "light");

  let rz; window.addEventListener("resize", ()=>{ clearTimeout(rz); rz=setTimeout(draw, 80); });

  // ---------- autoload desde Cumbre (carrera del catálogo o GPX subido en el inicio) ----------
  // Solo se permiten los GPX del catálogo incluidos en el sitio (evita cargar URLs arbitrarias / phishing).
  const CATALOGO = new Set([
    "data/ultra-coah-campeonato-continental-de-las-americas-2026-12k-ultra-coah-2026.gpx",
    "data/ultra-coah-campeonato-continental-de-las-americas-2026-30k-ultra-coah-2026.gpx",
    "data/ultra-coah-campeonato-continental-de-las-americas-2026-50k-ultra-coah-2026.gpx",
    "data/ultra-coah-campeonato-continental-de-las-americas-2026-80k-ultra-coah-2026.gpx",
    "data/ultra-coah-campeonato-continental-de-las-americas-2026-100k-ultra-coah-2026.gpx",
    "data/ultra-coah-campeonato-continental-de-las-americas-2026-100-millas-ultra-coah-2026-2-0.gpx",
  ]);

  // deja que el navegador pinte antes de un bloque de trabajo síncrono pesado
  const yieldToPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  (async function autoload(){
    const params = new URLSearchParams(location.search);
    const ruta = params.get("ruta");
    const fuente = params.get("fuente");
    if (!ruta && fuente !== "upload") return;

    const carrera = params.get("carrera");
    const distancia = params.get("distancia");
    const titulo = (carrera && distancia) ? `${carrera} · ${distancia}` : (carrera || distancia || null);
    const cargandoTxt = titulo ? `Cargando ${titulo}…` : "Cargando recorrido…";
    let handoffState = null;
    if (handoffPayload){
      try { handoffState = readHandoffState(); }
      catch (_) { handoffState = null; }
    }

    const drop = $("#drop");
    drop.classList.add("loading");
    drop.setAttribute("aria-busy", "true");
    drop.innerHTML =
      `<div class="loader" role="status" aria-live="polite">` +
        `<div class="spinner" aria-hidden="true"></div>` +
        `<h2>${escapeHTML(cargandoTxt)}</h2>` +
        `<p>Preparando tu perfil de altimetría…</p>` +
      `</div>`;

    try{
      if (fuente === "upload"){
        currentCatalogRoute = null;
        const text = sessionStorage.getItem("cumbre_gpx_text");
        const name = sessionStorage.getItem("cumbre_gpx_name") || "Recorrido";
        sessionStorage.removeItem("cumbre_gpx_text");
        sessionStorage.removeItem("cumbre_gpx_name");
        if (!text) throw new Error("No se encontró el archivo cargado. Vuelve a intentarlo desde el inicio.");
        await yieldToPaint();               // que el spinner se vea antes de parsear/dibujar
        loadFromGPXText(text, name, null, name);
        window.cumbreTrack?.("profile_rendered", { fuente: "upload_home", distancia: "custom" });
      } else {
        if (!CATALOGO.has(ruta)) throw new Error("Ruta de carrera no reconocida.");
        currentCatalogRoute = ruta;
        const res = await fetch(ruta);
        if (!res.ok) throw new Error("No se pudo cargar el recorrido (código "+res.status+").");
        const text = await res.text();
        await yieldToPaint();               // que el spinner se vea durante el parseo del GPX (p. ej. 80K)
        loadFromGPXText(text, null, titulo, ruta.split("/").pop(), handoffState?.markers);
        window.cumbreTrack?.("profile_rendered", { fuente: "catalog", distancia: distancia || "?" });
        if (handoffState){
          await yieldToPaint();
          $("#viewerSub").textContent = "Descarga automática iniciada en Chrome";
          if (handoffState.format === "pdf") await downloadPDFDirect();
          else downloadGPXDirect();
        }
      }
    }catch(err){
      window.cumbreTrack?.("profile_load_failed", {
        fuente: fuente === "upload" ? "upload_home" : "catalog",
        distancia: distancia || "?",
        razon: String(err && err.message || "error").slice(0, 80),
      });
      drop.classList.remove("loading");
      drop.removeAttribute("aria-busy");
      drop.innerHTML = `<h2>No se pudo cargar el recorrido</h2><p>${escapeHTML(err.message)}</p>`+
        `<div class="fmt">Vuelve a <a href="index.html">Cumbre</a> e inténtalo de nuevo, o importa tu GPX manualmente.</div>`;
    }
  })();
})();
