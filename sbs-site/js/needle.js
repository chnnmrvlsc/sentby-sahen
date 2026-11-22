/* Needle cursor: a sewing needle follows the pointer, trailing thread and leaving little cross-stitches. */
(function () {
  if (!window.matchMedia("(pointer: fine)").matches) { tapStitches(); return; }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const C = window.SBS_CONFIG;
  const cols = C.threads.map(t => t.hex);
  const cv = document.createElement("canvas");
  cv.id = "thread-layer";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");
  function size() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  size(); addEventListener("resize", size);

  const nd = document.createElement("div");
  nd.id = "needle";
  nd.innerHTML = '<svg viewBox="0 0 40 40" width="34" height="34"><g transform="rotate(-45 20 20)"><rect x="18.6" y="2" width="2.8" height="34" rx="1.4" fill="#d9d9d4" stroke="#8b8b85" stroke-width=".6"/><ellipse cx="20" cy="6.2" rx="0.9" ry="2.4" fill="#fbf7ec" stroke="#8b8b85" stroke-width=".5"/><path d="M18.6 36 L20 40 L21.4 36Z" fill="#b8b8b2"/></g></svg>';
  document.body.appendChild(nd);
  document.documentElement.classList.add("has-needle");

  const trail = [], stitches = [];
  let mx = -100, my = -100, lastX = null, lastY = null, dist = 0, ci = 1;
  addEventListener("mousemove", e => {
    mx = e.clientX; my = e.clientY;
    nd.style.transform = `translate(${mx - 3}px, ${my - 31}px)`;
    trail.push({ x: mx, y: my, t: performance.now() });
    if (trail.length > 28) trail.shift();
    if (lastX !== null) {
      dist += Math.hypot(mx - lastX, my - lastY);
      if (dist > 26) { dist = 0; stitches.push({ x: mx, y: my, t: performance.now(), c: cols[ci++ % cols.length], r: 3 + Math.random() * 2 }); }
    }
    lastX = mx; lastY = my;
    const el = e.target.closest && e.target.closest("button, a, label, input, select, textarea, canvas, [data-hover]");
    nd.classList.toggle("hot", !!el);
  });
  addEventListener("mousedown", () => nd.classList.add("press"));
  addEventListener("mouseup", () => nd.classList.remove("press"));
  document.addEventListener("mouseleave", () => { nd.style.opacity = 0; });
  document.addEventListener("mouseenter", () => { nd.style.opacity = 1; });

  function frame(now) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    while (trail.length && now - trail[0].t > 650) trail.shift();
    if (trail.length > 1) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = 1 - (now - trail[i].t) / 650;
        ctx.strokeStyle = `rgba(111,18,48,${Math.max(0, a) * 0.75})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
    }
    for (let i = stitches.length - 1; i >= 0; i--) {
      const s = stitches[i], age = now - s.t;
      if (age > 1400) { stitches.splice(i, 1); continue; }
      const a = age < 900 ? 1 : 1 - (age - 900) / 500;
      ctx.globalAlpha = a; ctx.strokeStyle = s.c; ctx.lineWidth = 1.7; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x - s.r, s.y - s.r); ctx.lineTo(s.x + s.r, s.y + s.r);
      ctx.moveTo(s.x + s.r, s.y - s.r); ctx.lineTo(s.x - s.r, s.y + s.r);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function tapStitches() {
    // touch screens: a little stitch pops where you tap
    const C = window.SBS_CONFIG;
    addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse") return;
      const s = document.createElement("span");
      s.className = "tap-stitch";
      s.textContent = "×";
      s.style.left = e.clientX + "px"; s.style.top = e.clientY + "px";
      s.style.color = C.threads[Math.floor(Math.random() * C.threads.length)].hex;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }, { passive: true });
  }
})();
