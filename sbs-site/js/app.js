/* Customer ordering flow */
(function () {
  const C = window.SBS_CONFIG, SBS = window.SBS, R = SBS.Render, Store = SBS.Store;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const peso = n => "₱" + Number(n).toLocaleString("en-PH");

  const STEPS = ["Size", "Template", "Photo", "Design", "Details", "Preview", "Pay"];
  const now = new Date();

  const S = {
    step: 0, maxStep: 0,
    size: null, framed: null, template: null,
    photo: null,
    colors: [C.threads[1].id],
    items: [], selected: null, nextId: 1,
    cal: { month: now.getMonth(), year: now.getFullYear() },
    mode: "text",
    d: { name: "", ig: "", gift: false, rname: "", rphone: "", raddr: "", track: null },
    agree: false, proof: null, code: null, busy: false
  };

  /* ---------------- pricing ---------------- */
  function countParts() {
    let letters = 0, symbols = 0;
    for (const it of S.items) {
      if (it.kind === "custom") letters += ((it.text || "").match(/[A-Za-z0-9]/g) || []).length;
      else if (it.kind === "symbol") symbols += 1;
    }
    return { letters, symbols, n: letters + symbols };
  }
  function customCount() { return countParts().n; }
  function tierFee(n) {
    if (!n) return 0;
    if (n > C.extraLetterFrom) {
      const last = C.customTiers[C.customTiers.length - 1];
      return last.fee + (n - C.extraLetterFrom) * C.extraLetterFee;
    }
    const t = C.customTiers.find(t => n >= t.min && n <= t.max);
    return t ? t.fee : C.customTiers[C.customTiers.length - 1].fee;
  }
  function pricing() {
    const base = S.size ? C.prices[S.size][S.framed ? "framed" : "plain"] : 0;
    const extraColors = Math.max(0, S.colors.length - C.includedColors);
    const colorFee = extraColors * C.thirdColorFee;
    const n = customCount(), textFee = tierFee(n);
    const total = S.size ? base + colorFee + textFee : 0;
    const down = Math.round(total * C.downpaymentRate);
    return { base, colorFee, textFee, n, total, down, balance: total - down };
  }

  /* ---------------- navigation ---------------- */
  function canGo(step) {
    switch (step) {
      case 0: return S.size && S.framed !== null;
      case 1: return !!S.template;
      case 2: return !!(S.photo && S.photo.src) && !(S.photo.busy);
      case 3: return true;
      case 4: {
        const d = S.d;
        return d.name.trim() && d.ig.trim().replace(/^@/, "") && d.rname.trim() && d.rphone.trim().length >= 7 && d.raddr.trim().length >= 10 && d.track;
      }
      case 5: return S.agree;
      case 6: return !!S.proof;
    }
    return true;
  }
  function renderStepper() {
    const ol = $("#stepper");
    ol.innerHTML = "";
    STEPS.forEach((n, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<i>${i < S.step ? "✓" : i + 1}</i><span>${n}</span>`;
      if (i === S.step) li.classList.add("on");
      else if (i < S.step) { li.classList.add("done"); li.setAttribute("role", "button"); li.tabIndex = 0; li.onclick = () => go(i); }
      if (S.step === 7) li.classList.add("done");
      ol.appendChild(li);
    });
    if (S.step === 7) ol.hidden = true; else ol.hidden = false;
  }
  function go(n) {
    S.step = n;
    $$("section[data-step]").forEach(s => s.hidden = Number(s.dataset.step) !== n);
    renderStepper();
    refreshNav();
    if (n === 1) buildTemplateCards();
    if (n === 2) refreshPhotoStep();
    if (n === 3) enterEditor();
    if (n === 5) buildReview();
    if (n === 6) buildPay();
    renderSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function refreshNav() {
    const sec = $(`section[data-step="${S.step}"]`);
    const nx = $("[data-next]", sec);
    if (nx) nx.disabled = !canGo(S.step);
    if (S.step === 6) $("#submit-btn").disabled = !canGo(6) || S.busy;
  }
  $$("[data-next]").forEach(b => b.addEventListener("click", () => { if (canGo(S.step)) go(S.step + 1); }));
  $$("[data-back]").forEach(b => b.addEventListener("click", () => go(S.step - 1)));

  /* ---------------- summary ---------------- */
  function renderSummary() {
    const p = pricing(), el = $("#summary");
    if (!S.size) { el.innerHTML = `<h3>Your order</h3><p class="sub">Pick a size to see the price.</p>`; return; }
    el.innerHTML = `
      <h3>Your order</h3>
      <dl>
        <dt>${S.size}${S.framed ? " · framed" : ""}</dt><dd>${peso(p.base)}</dd>
        ${p.colorFee ? `<dt>Extra thread color</dt><dd>+${peso(p.colorFee)}</dd>` : ""}
        ${p.textFee ? `<dt>Customized text (${p.n} letters)</dt><dd>+${peso(p.textFee)}</dd>` : ""}
      </dl>
      <div class="total"><span>Total</span><span>${peso(p.total)}</span></div>
      <div class="down"><span>Pay now (70%)</span><b>${peso(p.down)}</b></div>
      <p class="ship">Delivery fee is not included. The 30% balance (${peso(p.balance)}) plus delivery fee is paid before we ship.</p>`;
  }

  /* ---------------- step 0: size / frame ---------------- */
  function buildSizeCards() {
    const box = $("#size-cards");
    box.innerHTML = "";
    [["5R", "5 × 7 in", 50, 70], ["A4", "8.3 × 11.7 in", 62, 88]].forEach(([id, dim, w, h]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "card"; b.dataset.id = id;
      b.innerHTML = `<span class="sizebox" style="width:${w}px;height:${h}px"></span><h4>${id}</h4><p>${dim}</p><div class="price">${peso(C.prices[id].plain)}</div>`;
      b.onclick = () => { S.size = id; refreshCards(); afterChoice(); };
      box.appendChild(b);
    });
    const fb = $("#frame-cards"); fb.innerHTML = "";
    [[false, "No frame", "Print only"], [true, "With frame", `${C.frameName} wood`]].forEach(([v, h, p]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "card"; b.dataset.id = String(v);
      b.innerHTML = `<div class="frame-demo paper-frame ${v ? "walnut" : ""}" style="${v ? "" : "box-shadow:0 0 0 1px var(--line)"}"></div><h4>${h}</h4><p>${p}</p><div class="price" data-fp></div>`;
      b.onclick = () => { S.framed = v; refreshCards(); afterChoice(); };
      fb.appendChild(b);
    });
    refreshCards();
  }
  function refreshCards() {
    $$("#size-cards .card").forEach(c => c.classList.toggle("sel", c.dataset.id === S.size));
    $$("#frame-cards .card").forEach(c => {
      c.classList.toggle("sel", S.framed !== null && c.dataset.id === String(S.framed));
      const fp = $("[data-fp]", c), v = c.dataset.id === "true";
      const sz = S.size;
      fp.textContent = sz ? peso(C.prices[sz][v ? "framed" : "plain"]) : "Pick a size first";
    });
  }
  function afterChoice() { refreshNav(); renderSummary(); }

  /* ---------------- step 1: template ---------------- */
  let sample = null;
  function sampleCanvas() {
    if (sample) return sample;
    const c = document.createElement("canvas"); c.width = 700; c.height = 700;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(350, 300, 40, 350, 330, 320);
    g.addColorStop(0, "#9a9a9a"); g.addColorStop(1, "#3a3a3a");
    x.fillStyle = g;
    x.beginPath(); x.arc(350, 280, 150, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(110, 700); x.quadraticCurveTo(130, 470, 350, 470); x.quadraticCurveTo(570, 470, 590, 700); x.closePath(); x.fill();
    sample = c;
    return c;
  }
  function buildTemplateCards() {
    const box = $("#template-cards");
    box.innerHTML = "";
    const r = R.pageRatio(S.size || "5R");
    const defs = [
      [1, "Template 1", "Cut-out portrait in a halftone box with a monthly calendar underneath."],
      [2, "Template 2", "Your whole photo, untouched, with stitched words on top."]
    ];
    for (const [id, h, p] of defs) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "card"; b.dataset.id = id;
      const cv = document.createElement("canvas");
      cv.width = 360; cv.height = Math.round(360 * r);
      const st = {
        size: S.size || "5R", template: id, colors: ["3685", "3833"], cal: { month: 10, year: 2026 },
        photo: { src: id === 1 ? null : photoDemo(), zoom: 1, ox: 0, oy: 0 },
        items: [], selected: null
      };
      if (id === 1) {
        const tmp = sampleCanvas();
        st.photo.halftone = R.makeHalftone(tmp, C.template1.ink, 700);
        st.items = [{ id: 1, kind: "preset", text: "with love", x: .5, y: .33, size: .0075, color: "3833" }];
      } else {
        st.items = [{ id: 1, kind: "preset", text: "i love you", x: .5, y: .72, size: .011, color: "3685" }];
      }
      R.drawDesign(cv.getContext("2d"), cv.width, cv.height, st, { hideSelection: true });
      b.appendChild(cv);
      b.insertAdjacentHTML("beforeend", `<h4>${h}</h4><p>${p}</p>`);
      b.onclick = () => { S.template = id; refreshTplSel(); refreshNav(); };
      box.appendChild(b);
    }
    refreshTplSel();
  }
  function photoDemo() {
    const c = document.createElement("canvas"); c.width = 800; c.height = 600;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 800, 600); g.addColorStop(0, "#cfd8e6"); g.addColorStop(1, "#8fa0b8");
    x.fillStyle = g; x.fillRect(0, 0, 800, 600);
    x.fillStyle = "#e8d7c4"; x.beginPath(); x.arc(400, 270, 120, 0, 7); x.fill();
    x.fillStyle = "#fbfaf5"; x.beginPath(); x.moveTo(190, 600); x.quadraticCurveTo(220, 400, 400, 400); x.quadraticCurveTo(580, 400, 610, 600); x.fill();
    return c;
  }
  function refreshTplSel() { $$("#template-cards .card").forEach(c => c.classList.toggle("sel", Number(c.dataset.id) === S.template)); }

  /* ---------------- step 2: photo ---------------- */
  async function loadFile(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }
  function setStatus(msg, kind, bar) {
    const el = $("#photo-status");
    if (!msg) { el.hidden = true; return; }
    el.hidden = false; el.className = "photo-status" + (kind === "err" ? " err" : "");
    el.innerHTML = msg + (bar ? `<div class="bar"><i></i></div>` : "");
  }
  function showCutTools() {
    const ph = S.photo, on = S.template === 1 && ph && ph.useCut !== false && ph.cut;
    $("#cut-tools").hidden = !on;
    $("#touchup-btn2").hidden = !on;
    if (ph) $("#cut-keep").value = ph.keep == null ? 0.55 : ph.keep;
  }
  function refreshPhotoStep() {
    $("#photo-sub").textContent = S.template === 1
      ? "Portraits with a clear face work best. We'll remove the background for you."
      : "Clear, bright photos stitch up best. Your photo stays as it is.";
    $("#cut-toggle-wrap").hidden = !(S.template === 1 && S.photo);
    $("#cut-toggle").checked = S.photo ? S.photo.useCut !== false : true;
    $("#photo-preview").hidden = !S.photo;
    if (S.photo) {
      const showCut = S.template === 1 && S.photo.useCut !== false && S.photo.cut;
      $("#photo-preview").classList.toggle("checker", !!showCut);
      $("#photo-thumb").src = (showCut ? S.photo.cut : S.photo.src).toDataURL(showCut ? "image/png" : "image/jpeg", 0.7);
    }
    if (S.photo && S.template === 1) {
      if (!S.photo.halftone) refreshHalftone(true);
      if (S.photo.useCut !== false && !S.photo.mask && !S.photo.tried && !S.photo.busy) runCutout();
    }
    showCutTools();
    refreshNav();
  }
  function inkHex() { return C.template1.ink; }
  let htTimer = null;
  function refreshHalftone(immediate) {
    const ph = S.photo; if (!ph || S.template !== 1) return;
    const run = () => {
      const src = ph.useCut !== false && ph.cut ? ph.cut : ph.src;
      ph.halftone = R.makeHalftone(src, inkHex(), 1400);
      redraw();
    };
    clearTimeout(htTimer);
    if (immediate) run(); else htTimer = setTimeout(run, 160);
  }
  function rebuildCut(immediate) {
    const ph = S.photo; if (!ph || !ph.mask) return;
    ph.cut = SBS.applyCut(ph);
    refreshHalftone(immediate);
    if (S.step === 2) refreshPhotoStep();
  }
  async function runCutout() {
    const ph = S.photo; if (!ph) return;
    ph.busy = true; ph.tried = true; refreshNav();
    setStatus("Preparing the cut-out helper...", "", true);
    try {
      ph.mask = await SBS.cutoutMask(ph.src, msg => setStatus(msg, "", true));
      ph.useCut = true;
      ph.cut = SBS.applyCut(ph);
      setStatus("Background removed. Check it below and adjust if you need to.");
    } catch (e) {
      console.error(e);
      ph.mask = null; ph.cut = null; ph.useCut = false;
      $("#cut-toggle").checked = false;
      setStatus("We couldn't remove the background automatically (this needs an internet connection). We'll use your whole photo instead. You can try again by ticking the box below.", "err");
    }
    ph.busy = false;
    refreshHalftone(true); refreshPhotoStep();
  }
  $("#photo-input").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const src = await loadFile(f);
      S.photo = { src, cut: null, mask: null, manual: null, keep: 0.55, halftone: null, zoom: 1, ox: 0, oy: 0, useCut: true, busy: false, tried: false };
      refreshPhotoStep();
      if (S.template === 1) { refreshHalftone(true); runCutout(); }
      else setStatus(null);
    } catch (err) { setStatus("That file couldn't be opened. Please try a JPG or PNG.", "err"); }
  });
  $("#cut-toggle").addEventListener("change", e => {
    const ph = S.photo; if (!ph) return;
    if (e.target.checked) { ph.useCut = true; if (ph.mask) { rebuildCut(true); } else { ph.tried = false; runCutout(); } }
    else { ph.useCut = false; refreshHalftone(true); setStatus(null); refreshPhotoStep(); }
  });
  let keepTimer = null;
  $("#cut-keep").addEventListener("input", e => {
    const ph = S.photo; if (!ph || !ph.mask) return;
    ph.keep = Number(e.target.value);
    clearTimeout(keepTimer); keepTimer = setTimeout(() => rebuildCut(true), 120);
  });

  /* hand touch-up of the cut-out */
  const tdlg = $("#touch-modal"), tcv = $("#touch-canvas"), tctx = tcv.getContext("2d");
  let tmode = "erase", tstroke = null;
  function openTouch() {
    const ph = S.photo; if (!ph) return;
    if (!ph.mask) { ph.mask = new Uint8ClampedArray(ph.src.width * ph.src.height).fill(255); ph.useCut = true; ph.cut = SBS.applyCut(ph); }
    if (!ph.manual) { ph.manual = document.createElement("canvas"); ph.manual.width = ph.src.width; ph.manual.height = ph.src.height; }
    tdlg.showModal();
    const w = Math.min(560, tdlg.clientWidth - 40);
    tcv.width = Math.round(w); tcv.height = Math.round(w * ph.src.height / ph.src.width);
    paintTouch();
  }
  function paintTouch() {
    const ph = S.photo;
    tctx.clearRect(0, 0, tcv.width, tcv.height);
    tctx.drawImage(ph.cut, 0, 0, tcv.width, tcv.height);
  }
  function brushPx() { return Number($("#brush").value); }
  function tpos(e) {
    const r = tcv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * tcv.width, y: (e.clientY - r.top) / r.height * tcv.height };
  }
  tcv.addEventListener("pointerdown", e => { tstroke = [tpos(e)]; tcv.setPointerCapture(e.pointerId); drawStroke(); });
  tcv.addEventListener("pointermove", e => { if (!tstroke) return; tstroke.push(tpos(e)); drawStroke(); });
  function drawStroke() {
    tctx.save();
    tctx.lineCap = "round"; tctx.lineJoin = "round"; tctx.lineWidth = brushPx();
    tctx.strokeStyle = tmode === "erase" ? "rgba(228,35,26,.55)" : "rgba(40,170,80,.55)";
    tctx.beginPath(); tstroke.forEach((p, i) => i ? tctx.lineTo(p.x, p.y) : tctx.moveTo(p.x, p.y));
    if (tstroke.length === 1) tctx.lineTo(tstroke[0].x + 0.01, tstroke[0].y);
    tctx.stroke(); tctx.restore();
  }
  function endStroke() {
    if (!tstroke) return;
    const ph = S.photo, k = ph.src.width / tcv.width;
    const x = ph.manual.getContext("2d");
    x.save(); x.lineCap = "round"; x.lineJoin = "round"; x.lineWidth = brushPx() * k;
    x.strokeStyle = tmode === "erase" ? "rgb(255,0,0)" : "rgb(0,255,0)";
    x.beginPath(); tstroke.forEach((p, i) => i ? x.lineTo(p.x * k, p.y * k) : x.moveTo(p.x * k, p.y * k));
    if (tstroke.length === 1) x.lineTo(tstroke[0].x * k + 0.01, tstroke[0].y * k);
    x.stroke(); x.restore();
    tstroke = null;
    ph.cut = SBS.applyCut(ph); paintTouch();
  }
  tcv.addEventListener("pointerup", endStroke); tcv.addEventListener("pointercancel", endStroke);
  $$("[data-tmode]").forEach(b => b.addEventListener("click", () => { tmode = b.dataset.tmode; $$("[data-tmode]").forEach(x => x.classList.toggle("on", x === b)); }));
  $("#touch-reset").addEventListener("click", () => { const ph = S.photo; ph.manual.getContext("2d").clearRect(0, 0, ph.manual.width, ph.manual.height); ph.cut = SBS.applyCut(ph); paintTouch(); });
  $("#touch-done").addEventListener("click", () => { tdlg.close(); refreshHalftone(true); if (S.step === 2) refreshPhotoStep(); redraw(); });
  $("#touchup-btn").addEventListener("click", openTouch);
  $("#touchup-btn2").addEventListener("click", openTouch);

  /* ---------------- step 3: editor ---------------- */
  const cv = $("#editor-canvas"), ctx = cv.getContext("2d");
  let raf = 0;
  function dims() {
    const ratio = R.pageRatio(S.size || "5R");
    const w = cv.clientWidth || 360;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * ratio * dpr);
    cv.style.height = (w * ratio) + "px";
  }
  function redraw() {
    if (S.step !== 3) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (cv.width < 10) dims();
      R.drawDesign(ctx, cv.width, cv.height, st(), {});
    });
  }
  function st() { return { size: S.size, template: S.template, photo: S.photo, colors: S.colors, items: S.items, cal: S.cal, selected: S.selected }; }
  new ResizeObserver(() => { if (S.step === 3) { dims(); redraw(); } }).observe($("#paper"));

  function setFrameClass(el) { el.classList.toggle("walnut", !!S.framed); }

  function enterEditor() {
    setFrameClass($("#paper-frame"));
    $("#photo-tools").open = S.template === 1;
    $("#cal-tools").hidden = S.template !== 1;
    if (!S.items.length) addDefaultSuggestion();
    buildThreads(); buildAddChips(); buildSymbols(); renderItems();
    $("#zoom").value = S.photo ? S.photo.zoom : 1;
    showCutTools();
    buildCalendarSelects();
    dims(); redraw();
    updateHint();
  }
  function addDefaultSuggestion() { /* start with an empty canvas so customers choose */ }

  function updateHint() {
    $("#editor-hint").textContent = S.mode === "photo"
      ? "Drag on the picture to move your photo. Use the zoom slider to fit it."
      : "Drag your text to where you want it.";
  }
  $$(".seg").forEach(b => b.addEventListener("click", () => {
    S.mode = b.dataset.mode;
    $$(".seg").forEach(x => x.classList.toggle("on", x === b));
    updateHint();
  }));

  /* thread colors */
  function buildThreads() {
    const box = $("#threads"); box.innerHTML = "";
    C.threads.forEach(t => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "thread" + (S.colors.includes(t.id) ? " sel" : "");
      b.innerHTML = `<span class="sw" style="background:${t.hex}"></span><b>№${t.id}</b>`;
      b.title = t.name;
      b.onclick = () => {
        const i = S.colors.indexOf(t.id);
        if (i >= 0) { if (S.colors.length > 1) S.colors.splice(i, 1); }
        else if (S.colors.length < C.maxColors) S.colors.push(t.id);
        else { toast(`You can pick up to ${C.maxColors} colors.`); return; }
        S.items.forEach(it => { if (!S.colors.includes(it.color)) it.color = S.colors[0]; });
        buildThreads(); renderItems(); redraw(); renderSummary();
      };
      box.appendChild(b);
    });
    $("#thread-sub").innerHTML = `Pick 1 to ${C.maxColors}. First ${C.includedColors} are included, each extra color is +${peso(C.thirdColorFee)}. Thread colors are for your stitched text.`;
  }

  /* add text */
  function newItem(o) {
    const base = S.template === 1 ? 0.3 : 0.74;
    const y = Math.min(0.94, base + (S.items.length % 4) * 0.075);
    const it = Object.assign({ id: S.nextId++, x: 0.5, y, size: 0.0095, color: S.colors[S.colors.length - 1] }, o);
    it.base = it.size; it.auto = true; autoFit(it);
    S.items.push(it); S.selected = it.id;
    renderItems(); redraw(); renderSummary();
    return it;
  }
  function autoFit(it) {
    if (!it.auto || it.kind === "symbol") return;
    const g = R.itemGrid(it);
    it.size = Math.max(0.003, Math.min(it.base, 0.8 / Math.max(1, g.cols)));
  }
  function buildAddChips() {
    const box = $("#add-chips"); box.innerHTML = "";
    C.freePresets.forEach(t => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip";
      b.innerHTML = `${t}<em>+${peso(0)}</em>`;
      b.onclick = () => newItem({ kind: "preset", text: t });
      box.appendChild(b);
    });
    const ini = document.createElement("button"); ini.type = "button"; ini.className = "chip";
    ini.innerHTML = `Initials (1–2)<em>+${peso(0)}</em>`;
    ini.onclick = () => newItem({ kind: "initials", text: "A", caseMode: "upper", size: 0.016 });
    box.appendChild(ini);
    const cu = document.createElement("button"); cu.type = "button"; cu.className = "chip";
    cu.innerHTML = `Customized text<em>from +${peso(C.customTiers[0].fee)}</em>`;
    cu.onclick = () => newItem({ kind: "custom", text: "Your text" });
    box.appendChild(cu);
  }
  function buildSymbols() {
    const box = $("#symbols"); box.innerHTML = "";
    Object.keys(window.SBS_SYMBOLS).forEach(k => {
      const g = R.itemGrid({ kind: "symbol", symbol: k });
      const c = document.createElement("canvas");
      const s = Math.max(1, Math.min(4, Math.floor(30 / Math.max(g.cols, g.rows))));
      c.width = g.cols * s; c.height = g.rows * s;
      const x = c.getContext("2d"); x.fillStyle = "#6f1230";
      g.cells.forEach(([r, cc]) => x.fillRect(cc * s, r * s, s - (s > 2 ? 1 : 0), s - (s > 2 ? 1 : 0)));
      const b = document.createElement("button"); b.type = "button"; b.className = "sym"; b.title = k; b.appendChild(c);
      b.onclick = () => newItem({ kind: "symbol", symbol: k, size: k === "heart" || k === "swirl" ? 0.011 : 0.014 });
      box.appendChild(b);
    });
  }
  function itemLabel(it) {
    return it.kind === "symbol" ? it.symbol : it.text || "(empty)";
  }
  function renderItems() {
    const list = $("#item-list"); list.innerHTML = "";
    S.items.forEach(it => {
      const d = document.createElement("div"); d.className = "item-pill" + (it.id === S.selected ? " sel" : "");
      d.innerHTML = `<button type="button" class="pick">${itemLabel(it)}</button><button type="button" class="rm" aria-label="Remove">×</button>`;
      $(".pick", d).onclick = () => { S.selected = it.id; renderItems(); redraw(); };
      $(".rm", d).onclick = () => { S.items = S.items.filter(x => x.id !== it.id); if (S.selected === it.id) S.selected = null; renderItems(); redraw(); renderSummary(); };
      list.appendChild(d);
    });
    renderItemEditor();
    updateCountLine();
  }
  function updateCountLine() {
    const p = pricing(), c = countParts();
    $("#count-line").innerHTML = p.n
      ? `Customized: <b>${c.letters}</b> letter${c.letters === 1 ? "" : "s"}${c.symbols ? ` + <b>${c.symbols}</b> symbol${c.symbols === 1 ? "" : "s"}` : ""} = <b>${p.n}</b> → <b>+${peso(p.textFee)}</b><br><small>Spaces don't count.</small>`
      : `No customized text yet. Free texts and initials cost nothing.`;
  }
  function renderItemEditor() {
    const el = $("#item-editor");
    const it = S.items.find(i => i.id === S.selected);
    if (!it) { el.hidden = true; return; }
    el.hidden = false;
    let h = `<h4>Selected: ${it.kind === "symbol" ? "symbol" : it.kind === "preset" ? "free text" : it.kind === "initials" ? "initials (free)" : "customized text"}</h4>`;
    if (it.kind === "initials") {
      h += `<label class="field"><span>Letters (max 2)</span><input id="ie-text" maxlength="2" value="${it.text}"></label>
            <div class="mode-toggle" style="margin:.4rem 0"><button type="button" class="seg ${it.caseMode === "upper" ? "on" : ""}" data-case="upper">CAPITAL</button><button type="button" class="seg ${it.caseMode === "lower" ? "on" : ""}" data-case="lower">small</button></div>`;
    } else if (it.kind === "custom") {
      h += `<label class="field"><span>Your text</span><input id="ie-text" maxlength="${C.maxCustomChars}" value="${it.text.replace(/"/g, "&quot;")}"></label>`;
    }
    h += `<label class="field"><span>Size</span><input id="ie-size" type="range" min="0.004" max="0.024" step="0.0002" value="${it.size}"></label>
          <div class="field"><span>Thread color</span><div class="dots">${S.colors.map(id => `<button type="button" class="dot ${it.color === id ? "sel" : ""}" data-c="${id}" style="background:${R.thread(id).hex}" aria-label="${id}"></button>`).join("")}</div></div>`;
    el.innerHTML = h;
    const ti = $("#ie-text", el);
    if (ti) ti.oninput = () => {
      let v = ti.value;
      if (it.kind === "initials") { v = v.replace(/[^A-Za-z]/g, "").slice(0, 2); v = it.caseMode === "upper" ? v.toUpperCase() : v.toLowerCase(); ti.value = v; }
      else { v = v.replace(/[^A-Za-z0-9 ]/g, ""); if (v !== ti.value) ti.value = v; }
      it.text = v; autoFit(it); const sl = $("#ie-size"); if (sl) sl.value = it.size; redraw(); renderSummary();
      updateCountLine();
      $$("#item-list .pick")[S.items.indexOf(it)].textContent = itemLabel(it);
    };
    $$("[data-case]", el).forEach(b => b.onclick = () => {
      it.caseMode = b.dataset.case; it.text = it.caseMode === "upper" ? it.text.toUpperCase() : it.text.toLowerCase();
      renderItems(); redraw();
    });
    $("#ie-size", el).oninput = e => { it.size = Number(e.target.value); it.auto = false; redraw(); };
    $$(".dot", el).forEach(b => b.onclick = () => { it.color = b.dataset.c; renderItemEditor(); redraw(); });
  }

  /* photo + calendar tools */
  $("#zoom").addEventListener("input", e => { if (S.photo) { S.photo.zoom = Number(e.target.value); redraw(); } });
  function buildCalendarSelects() {
    const m = $("#cal-month"), y = $("#cal-year");
    if (m.options.length) { m.value = S.cal.month; y.value = S.cal.year; return; }
    R.MONTHS.forEach((n, i) => m.add(new Option(n[0] + n.slice(1).toLowerCase(), i)));
    for (let yr = now.getFullYear(); yr <= now.getFullYear() + 2; yr++) y.add(new Option(yr, yr));
    m.value = S.cal.month; y.value = S.cal.year;
    m.onchange = () => { S.cal.month = Number(m.value); redraw(); };
    y.onchange = () => { S.cal.year = Number(y.value); redraw(); };
  }

  /* dragging */
  let drag = null;
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height };
  }
  cv.addEventListener("pointerdown", e => {
    const p = pos(e);
    if (S.mode === "text") {
      const hit = R.hitTest(S.items, cv.width, cv.height, p.x, p.y);
      if (hit) {
        S.selected = hit.id; drag = { type: "item", it: hit, dx: hit.x - p.x / cv.width, dy: hit.y - p.y / cv.height };
        cv.setPointerCapture(e.pointerId); renderItems();
      } else { S.selected = null; renderItems(); }
    } else if (S.photo) {
      drag = { type: "photo", sx: p.x, sy: p.y, ox: S.photo.ox || 0, oy: S.photo.oy || 0 };
      cv.setPointerCapture(e.pointerId);
    }
    redraw();
  });
  cv.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = pos(e);
    if (drag.type === "item") {
      drag.it.x = Math.min(1, Math.max(0, p.x / cv.width + drag.dx));
      drag.it.y = Math.min(1, Math.max(0, p.y / cv.height + drag.dy));
    } else {
      const B = R.photoBox(st(), cv.width, cv.height);
      S.photo.ox = drag.ox + (p.x - drag.sx) / B.w; S.photo.oy = drag.oy + (p.y - drag.sy) / B.h;
    }
    redraw();
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);

  /* ---------------- step 4: details ---------------- */
  function buildDetails() {
    const map = { "f-name": "name", "f-ig": "ig", "f-rname": "rname", "f-rphone": "rphone", "f-raddr": "raddr" };
    Object.entries(map).forEach(([id, k]) => $("#" + id).addEventListener("input", e => {
      S.d[k] = e.target.value;
      if (k === "name" && !S.d.gift) { S.d.rname = e.target.value; $("#f-rname").value = e.target.value; }
      refreshNav();
    }));
    $("#f-gift").addEventListener("change", e => {
      S.d.gift = e.target.checked;
      $("#gift-note").hidden = !S.d.gift;
      $("#l-rname").textContent = S.d.gift ? "Recipient name (who is it for?)" : "Recipient name";
      if (!S.d.gift) { S.d.rname = S.d.name; $("#f-rname").value = S.d.name; } else { S.d.rname = ""; $("#f-rname").value = ""; }
      refreshNav();
    });
    const box = $("#track-cards");
    [["show", "Show me the tracking number", "We'll send it to you on Instagram once it ships."],
     ["surprise", "Keep it a surprise", "No tracking number for you. Perfect for gifts."]].forEach(([id, h, p]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "card"; b.dataset.id = id;
      b.innerHTML = `<h4>${h}</h4><p>${p}</p>`;
      b.onclick = () => { S.d.track = id; $$("#track-cards .card").forEach(c => c.classList.toggle("sel", c === b)); refreshNav(); };
      box.appendChild(b);
    });
  }

  /* ---------------- step 5: review ---------------- */
  function renderFinal(canvas, cssW) {
    const ratio = R.pageRatio(S.size);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssW * ratio * dpr);
    canvas.style.height = cssW * ratio + "px";
    R.drawDesign(canvas.getContext("2d"), canvas.width, canvas.height, st(), { hideSelection: true });
  }
  function buildReview() {
    const frame = $("#review-frame"); setFrameClass(frame);
    const cvr = $("#review-canvas");
    const w = Math.min(340, $(".review-art").clientWidth || 340);
    renderFinal(cvr, Math.max(220, w - (S.framed ? w * 0.11 : 0)));
    const p = pricing();
    const texts = S.items.map(i => i.kind === "symbol" ? `symbol: ${i.symbol}` : i.text).filter(Boolean);
    $("#review-info").innerHTML = `
      <dl>
        <dt>Size</dt><dd>${S.size}</dd>
        <dt>Frame</dt><dd>${S.framed ? C.frameName : "None"}</dd>
        <dt>Template</dt><dd>${S.template}</dd>
        <dt>Product price</dt><dd>${peso(p.base)}</dd>
        ${p.colorFee ? `<dt>Extra thread color</dt><dd>+${peso(p.colorFee)}</dd>` : ""}
        ${p.textFee ? `<dt>Customized text (${p.n} letters)</dt><dd>+${peso(p.textFee)}</dd>` : ""}
      </dl>
      <div class="total"><span>Total</span><span>${peso(p.total)}</span></div>
      <p class="sub" style="margin-top:.6rem">Downpayment 70%: <b>${peso(p.down)}</b> · Balance 30%: <b>${peso(p.balance)}</b> + delivery fee</p>
      <div>${S.colors.map(id => `<span class="tag">№${id} ${R.thread(id).name}</span>`).join("")}${texts.map(t => `<span class="tag">${t}</span>`).join("")}</div>
      <p class="sub" style="margin-top:.8rem">Ship to: ${esc(S.d.rname)}${S.d.gift ? " (gift)" : ""} · Tracking: ${S.d.track === "show" ? "show me" : "surprise"}</p>`;
    $("#f-agree").checked = S.agree;
    refreshNav();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  $("#f-agree").addEventListener("change", e => { S.agree = e.target.checked; refreshNav(); });

  /* ---------------- step 6: pay ---------------- */
  function buildPay() {
    const p = pricing();
    $("#pay-down").textContent = peso(p.down);
    $("#pay-rest").innerHTML = `Total ${peso(p.total)}. The balance of <b>${peso(p.balance)}</b> plus the delivery fee is paid after your order is done, before we ship it out.`;
    refreshNav();
  }
  async function shrink(file, max, q) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, "image/jpeg", q));
  }
  $("#proof-input").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      S.proof = await shrink(f, 1400, 0.85);
      const t = $("#proof-thumb"); t.src = URL.createObjectURL(S.proof); t.hidden = false;
      $("#proof-label").textContent = "Change screenshot";
    } catch (err) { S.proof = null; toast("Couldn't read that image."); }
    refreshNav();
  });
  $("#submit-btn").addEventListener("click", async () => {
    if (S.busy || !canGo(6)) return;
    S.busy = true; refreshNav();
    const btn = $("#submit-btn"), errEl = $("#submit-error"); errEl.hidden = true;
    btn.textContent = "Sending...";
    try {
      const code = Store.makeCode();
      const W = 1800, H = Math.round(W * R.pageRatio(S.size));
      const ec = document.createElement("canvas"); ec.width = W; ec.height = H;
      R.drawDesign(ec.getContext("2d"), W, H, st(), { hideSelection: true });
      const previewBlob = await new Promise(r => ec.toBlob(r, "image/jpeg", 0.92));
      const photoBlob = await new Promise(r => S.photo.src.toBlob(r, "image/jpeg", 0.88));
      const [pp, ph, pr] = [
        await Store.uploadBlob(code, "design.jpg", previewBlob),
        await Store.uploadBlob(code, "photo.jpg", photoBlob),
        await Store.uploadBlob(code, "payment-proof.jpg", S.proof)
      ];
      const p = pricing();
      await Store.createOrder({
        code, size: S.size, framed: S.framed, template: S.template,
        colors: S.colors,
        items: S.items.map(i => ({ kind: i.kind, text: i.text || null, symbol: i.symbol || null, color: i.color })),
        calendar: S.template === 1 ? S.cal : null,
        customer_name: S.d.name.trim(), ig: S.d.ig.trim().replace(/^@/, ""),
        recipient_name: S.d.rname.trim(), recipient_phone: S.d.rphone.trim(), recipient_address: S.d.raddr.trim(),
        is_gift: S.d.gift, tracking_pref: S.d.track,
        price_base: p.base, price_extras: { colors: p.colorFee, text: p.textFee, custom_chars: p.n },
        total: p.total, downpayment: p.down, balance: p.balance,
        preview_path: pp, photo_path: ph, proof_path: pr
      });
      S.code = code;
      $("#done-code").textContent = code;
      $("#done-msg").textContent = C.igHandle ? `Message us on Instagram @${C.igHandle} if you have questions.` : "";
      go(7);
    } catch (e) {
      console.error(e);
      errEl.hidden = false;
      errEl.textContent = "Sorry, we couldn't send your order: " + (e.message || e) + ". Please try again, or message us on Instagram with your payment screenshot.";
    }
    S.busy = false; btn.textContent = "Submit my order"; refreshNav();
  });
  $("#copy-code").addEventListener("click", () => { navigator.clipboard && navigator.clipboard.writeText(S.code || ""); toast("Code copied"); });
  $("#new-order").addEventListener("click", () => location.reload());
  $("#done-track").addEventListener("click", () => { openTrack(S.code, S.d.ig); });

  /* ---------------- tracking modal ---------------- */
  const dlg = $("#track-modal");
  function openTrack(code, ig) {
    $("#t-code").value = code || ""; $("#t-ig").value = ig || ""; $("#t-result").innerHTML = "";
    dlg.showModal();
    if (code && ig) lookup();
  }
  $("#track-open").addEventListener("click", () => openTrack());
  async function lookup() {
    const out = $("#t-result");
    const code = $("#t-code").value, ig = $("#t-ig").value;
    if (!code.trim() || !ig.trim()) { out.textContent = "Please enter both your order code and Instagram username."; return; }
    out.textContent = "Checking...";
    try {
      const o = await Store.lookup(code, ig);
      if (!o) { out.innerHTML = `<div class="photo-status err">We couldn't find that order. Check the code and username.</div>`; return; }
      const order = ["pending_verification", "in_progress", "awaiting_balance", "ready_to_ship", "shipped"];
      const idx = order.indexOf(o.status);
      const steps = order.map((s, i) => `<li class="${i < idx ? "done" : i === idx ? "now" : ""}"><i>${i < idx ? "✓" : i + 1}</i>${Store.statusLabel(s, "customer")}</li>`).join("");
      let extra = "";
      if (o.status === "awaiting_balance") extra = `<p><b>Please send ${peso(o.balance)} + delivery fee</b> via GCash and message us your screenshot.</p>`;
      if (o.status === "shipped" && o.tracking_pref === "show" && o.tracking_number) extra = `<p>Tracking number: <b>${esc(o.tracking_number)}</b></p>`;
      if (o.status === "shipped" && o.tracking_pref === "surprise") extra = `<p>Your parcel is on its way. It's a surprise, so no tracking number.</p>`;
      out.innerHTML = o.status === "cancelled"
        ? `<div class="t-box">This order was cancelled.</div>`
        : `<div class="t-box"><b>${esc(o.code)}</b> · ${esc(o.size)}${o.framed ? " framed" : ""} · ${peso(o.total)}<ul class="t-steps">${steps}</ul>${extra}</div>`;
    } catch (e) { out.innerHTML = `<div class="photo-status err">Couldn't check right now. Please try again.</div>`; }
  }
  $("#t-go").addEventListener("click", lookup);

  /* ---------------- misc ---------------- */
  let tt;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2200); }

  buildSizeCards(); buildDetails(); renderSummary();
  SBS.fontsReady.then(() => { go(0); });
  go(0);
  window.SBS_APP = { S, go, pricing, redraw };
})();
