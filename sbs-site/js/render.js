/* Drawing engine: photo, halftone, calendar, cross-stitch text.
   The same code draws the live editor, the preview, and the exported image. */
(function () {
  const C = window.SBS_CONFIG;
  const SYM = window.SBS_SYMBOLS;
  const SBS = (window.SBS = window.SBS || {});

  const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

  function pageRatio(size) { return size === "A4" ? 297 / 210 : 7 / 5; } // height / width
  function thread(id) { return C.threads.find(t => t.id === id) || C.threads[1]; }
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function textOn(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.6 ? "#ffffff" : "#1c1c1c";
  }

  /* ---------- fonts ---------- */
  SBS.fontsReady = (async function () {
    try {
      await Promise.all([
        document.fonts.load('40px "Great Vibes"'),
        document.fonts.load('40px "Anton"'),
        document.fonts.load('500 40px "Bodoni Moda"'),
        document.fonts.load('400 16px "DM Sans"')
      ]);
    } catch (e) { /* fall back to system fonts */ }
  })();

  /* ---------- cross-stitch text -> grid (the shop's own alphabet) ---------- */
  const ALPHA = window.SBS_ALPHABET || {};
  const BASE = 10;                                   // rows from the top of a capital to the baseline
  const TOP = { g: 4, p: 4, q: 4, y: 4, f: 0, j: 2 }; // letters that hang below the baseline
  const gridCache = new Map();

  function textGrid(text) {
    if (gridCache.has(text)) return gridCache.get(text);
    const cells = [];
    let x = 0;
    for (const ch of text) {
      if (ch === " ") { x += 4; continue; }
      const gl = ALPHA[ch];
      if (!gl) continue;
      const top = TOP[ch] !== undefined ? TOP[ch] : BASE - gl.length;
      for (let r = 0; r < gl.length; r++) for (let c = 0; c < gl[r].length; c++) if (gl[r][c] === "1") cells.push([top + r, x + c]);
      x += gl[0].length + 1;
    }
    let g = { cols: 1, rows: 1, cells: [] };
    if (cells.length) {
      let minR = 1e9, maxR = -1e9, minC = 1e9, maxC = -1e9;
      for (const [r, c] of cells) { if (r < minR) minR = r; if (r > maxR) maxR = r; if (c < minC) minC = c; if (c > maxC) maxC = c; }
      g = { cols: maxC - minC + 1, rows: maxR - minR + 1, cells: cells.map(([r, c]) => [r - minR, c - minC]) };
    }
    gridCache.set(text, g);
    return g;
  }

  function symbolGrid(key) {
    const rows = SYM[key] || SYM.heart;
    const cells = [];
    rows.forEach((row, r) => { for (let cc = 0; cc < row.length; cc++) if (row[cc] === "1") cells.push([r, cc]); });
    return { cols: rows[0].length, rows: rows.length, cells };
  }

  function itemGrid(item) {
    return item.kind === "symbol" ? symbolGrid(item.symbol) : textGrid(item.text || " ");
  }

  // Bounding box of an item on a page of width W / height H (pixels)
  function itemBox(item, W, H) {
    const g = itemGrid(item);
    const s = item.size * W;
    const w = g.cols * s, h = g.rows * s;
    return { x: item.x * W - w / 2, y: item.y * H - h / 2, w, h, s, g };
  }

  function drawItem(ctx, item, W, H) {
    const b = itemBox(item, W, H);
    const col = thread(item.color).hex;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, b.s * 0.24);
    const m = b.s * 0.12;
    ctx.beginPath();
    for (const [r, c] of b.g.cells) {
      const x0 = b.x + c * b.s + m, y0 = b.y + r * b.s + m, x1 = x0 + b.s - 2 * m, y1 = y0 + b.s - 2 * m;
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y0); ctx.lineTo(x0, y1);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- halftone ---------- */
  function makeHalftone(src, inkHex, maxSide) {
    maxSide = maxSide || 1400;
    const sc = Math.min(1, maxSide / Math.max(src.width, src.height));
    const w = Math.round(src.width * sc), h = Math.round(src.height * sc);
    const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
    const tx = tmp.getContext("2d", { willReadFrequently: true });
    tx.drawImage(src, 0, 0, w, h);
    const d = tx.getImageData(0, 0, w, h).data;
    const out = document.createElement("canvas"); out.width = w; out.height = h;
    const ox = out.getContext("2d");
    ox.fillStyle = inkHex;
    const pitch = Math.max(5, w / 105);
    const ang = Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
    const diag = Math.hypot(w, h);
    for (let gy = -diag / 2; gy < diag / 2; gy += pitch) {
      for (let gx = -diag / 2; gx < diag / 2; gx += pitch) {
        const px = w / 2 + gx * ca - gy * sa, py = h / 2 + gx * sa + gy * ca;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        // average a small neighbourhood
        let lum = 0, al = 0, n = 0;
        const rad = Math.max(1, Math.round(pitch * 0.35));
        for (let dy = -rad; dy <= rad; dy += rad) {
          for (let dx = -rad; dx <= rad; dx += rad) {
            const xx = Math.min(w - 1, Math.max(0, Math.round(px + dx))), yy = Math.min(h - 1, Math.max(0, Math.round(py + dy)));
            const i = (yy * w + xx) * 4;
            lum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; al += d[i + 3] / 255; n++;
          }
        }
        lum /= n; al /= n;
        if (al < 0.5) continue;
        let dark = 1 - lum;
        dark = Math.min(1, Math.max(0, (dark - 0.08) * 1.55));
        if (dark < 0.04) continue;
        const r = pitch * 0.62 * Math.sqrt(dark) * al;
        ox.beginPath(); ox.arc(px, py, r, 0, Math.PI * 2); ox.fill();
      }
    }
    return out;
  }

  /* ---------- layout ---------- */
  function layoutT1(W, H) {
    const m = W * 0.045;
    return { m, box: { x: m, y: m, w: W - 2 * m, h: H * 0.37 }, calTop: m + H * 0.37 + H * 0.028, calBottom: H - m };
  }
  function layoutT2(W, H, aspect) {
    const w = W * 0.82;
    let h = w / aspect;
    h = Math.min(Math.max(h, w * 0.7), H * 0.62);
    return { x: (W - w) / 2, y: H * 0.13, w, h };
  }

  function drawPhotoInBox(ctx, img, box, p) {
    const sw = img.width, sh = img.height;
    const scale = Math.max(box.w / sw, box.h / sh) * (p.zoom || 1);
    const dw = sw * scale, dh = sh * scale;
    const dx = box.x + (box.w - dw) / 2 + (p.ox || 0) * box.w;
    const dy = box.y + (box.h - dh) / 2 + (p.oy || 0) * box.h;
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function drawPlaceholder(ctx, box, label) {
    ctx.save();
    ctx.fillStyle = "#f1efe6"; ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = "#b9b6a6";
    ctx.font = `${box.w * 0.045}px "DM Sans", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label || "Your photo here", box.x + box.w / 2, box.y + box.h / 2);
    ctx.restore();
  }

  /* ---------- calendar (template 1) ---------- */
  function drawCalendar(ctx, W, H, L, cal, c1, c2) {
    const left = L.m, right = W - L.m, top = L.calTop, bottom = L.calBottom;
    const width = right - left;
    const first = new Date(cal.year, cal.month, 1).getDay();
    const days = new Date(cal.year, cal.month + 1, 0).getDate();
    const weeks = Math.ceil((first + days) / 7);
    const avail = bottom - top;
    const gap = W * 0.008;
    const hh = Math.min(avail * 0.17, W * 0.11);
    const wh = hh * 0.42;
    const gh = avail - hh - wh - gap * 2;
    const cellH = gh / weeks, cellW = width / 7;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ff = '"Anton", "Impact", "Arial Narrow", sans-serif';

    // header: YEAR | MONTH | YEAR
    const yw = width * 0.27, mw = width - yw * 2 - gap * 2;
    const boxes = [
      [left, yw, c1, String(cal.year)],
      [left + yw + gap, mw, c2, MONTHS[cal.month]],
      [left + yw + gap + mw + gap, yw, c1, String(cal.year)]
    ];
    for (const [bx, bw, col, label] of boxes) {
      ctx.fillStyle = col; ctx.fillRect(bx, top, bw, hh);
      ctx.fillStyle = textOn(col);
      let fs = hh * 0.74;
      ctx.font = `${fs}px ${ff}`;
      const maxW = bw * 0.92;
      const mw2 = ctx.measureText(label).width;
      if (mw2 > maxW) { fs *= maxW / mw2; ctx.font = `${fs}px ${ff}`; }
      ctx.fillText(label, bx + bw / 2, top + hh / 2 + fs * 0.04);
    }

    // weekday row
    const wy = top + hh + gap;
    for (let i = 0; i < 7; i++) {
      const col = i === 0 ? c2 : c1;
      ctx.fillStyle = col; ctx.fillRect(left + i * cellW + gap / 2, wy, cellW - gap, wh);
      ctx.fillStyle = textOn(col);
      ctx.font = `${wh * 0.68}px ${ff}`;
      ctx.fillText(DOW[i], left + i * cellW + cellW / 2, wy + wh / 2 + wh * 0.03);
    }

    // grid
    const gy = wy + wh + gap;
    ctx.strokeStyle = c1; ctx.lineWidth = Math.max(1, W * 0.0035);
    ctx.strokeRect(left, gy, width, cellH * weeks);
    ctx.beginPath();
    for (let r = 1; r < weeks; r++) { ctx.moveTo(left, gy + r * cellH); ctx.lineTo(right, gy + r * cellH); }
    for (let c = 1; c < 7; c++) { ctx.moveTo(left + c * cellW, gy); ctx.lineTo(left + c * cellW, gy + cellH * weeks); }
    ctx.stroke();
    const nfs = Math.min(cellH * 0.62, cellW * 0.7);
    ctx.font = `${nfs}px ${ff}`;
    for (let d = 1; d <= days; d++) {
      const idx = first + d - 1, r = Math.floor(idx / 7), c = idx % 7;
      ctx.fillStyle = c === 0 ? c2 : c1;
      ctx.fillText(String(d), left + c * cellW + cellW / 2, gy + r * cellH + cellH / 2 + nfs * 0.04);
    }
    ctx.restore();
  }

  /* ---------- the whole design ---------- */
  // state: {size, template, photo, colors[], items[], cal, selected}
  function drawDesign(ctx, W, H, st, opts) {
    opts = opts || {};
    const T1 = C.template1;
    ctx.save();
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

    const ph = st.photo;
    if (st.template === 1) {
      const L = layoutT1(W, H);
      const bw = Math.max(2, W * 0.012);
      if (ph && (ph.halftone || ph.src)) {
        drawPhotoInBox(ctx, ph.halftone || ph.src, L.box, ph);
      } else {
        drawPlaceholder(ctx, L.box);
      }
      ctx.strokeStyle = T1.frame; ctx.lineWidth = bw;
      ctx.strokeRect(L.box.x - bw / 2, L.box.y - bw / 2, L.box.w + bw, L.box.h + bw);
      drawCalendar(ctx, W, H, L, st.cal, T1.frame, T1.accent);
    } else {
      const aspect = ph && ph.src ? ph.src.width / ph.src.height : 4 / 3;
      const B = layoutT2(W, H, aspect);
      if (ph && ph.src) drawPhotoInBox(ctx, ph.src, B, ph); else drawPlaceholder(ctx, B);
    }

    for (const it of st.items) drawItem(ctx, it, W, H);

    if (!opts.hideSelection && st.selected) {
      const it = st.items.find(i => i.id === st.selected);
      if (it) {
        const b = itemBox(it, W, H);
        ctx.save();
        ctx.setLineDash([W * 0.012, W * 0.01]);
        ctx.strokeStyle = "rgba(60,80,40,.8)"; ctx.lineWidth = Math.max(1, W * 0.003);
        const p = W * 0.01;
        ctx.strokeRect(b.x - p, b.y - p, b.w + p * 2, b.h + p * 2);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function photoBox(st, W, H) {
    if (st.template === 1) return layoutT1(W, H).box;
    const ph = st.photo;
    return layoutT2(W, H, ph && ph.src ? ph.src.width / ph.src.height : 4 / 3);
  }

  function hitTest(items, W, H, px, py) {
    for (let i = items.length - 1; i >= 0; i--) {
      const b = itemBox(items[i], W, H), p = W * 0.02;
      if (px >= b.x - p && px <= b.x + b.w + p && py >= b.y - p && py <= b.y + b.h + p) return items[i];
    }
    return null;
  }

  function stitchCount(item) { return itemGrid(item).cells.length; }

  SBS.Render = { drawDesign, photoBox, hitTest, itemBox, itemGrid, makeHalftone, pageRatio, thread, MONTHS, textGrid, stitchCount, textOn };
})();
