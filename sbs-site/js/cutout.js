/* Background removal that runs inside the customer's browser (free, no server).
   Uses the open-source MODNet portrait model through transformers.js.
   We keep the raw "confidence mask" so the cut can be tuned (keep more / less) and touched up by hand. */
(function () {
  const SBS = (window.SBS = window.SBS || {});
  let loading = null;

  function load(onStatus) {
    if (loading) return loading;
    loading = (async () => {
      onStatus && onStatus("Loading the cut-out helper (first time only, about 25 MB)...");
      const T = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0");
      let model;
      try { model = await T.AutoModel.from_pretrained("Xenova/modnet", { dtype: "fp32" }); }
      catch (e) { model = await T.AutoModel.from_pretrained("Xenova/modnet"); }
      const processor = await T.AutoProcessor.from_pretrained("Xenova/modnet");
      return { T, model, processor };
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }

  function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // Runs the model. Returns a Uint8ClampedArray mask (0-255) the same size as srcCanvas.
  SBS.cutoutMask = async function (srcCanvas, onStatus) {
    const { T, model, processor } = await load(onStatus);
    onStatus && onStatus("Cutting out the background...");
    const blob = await new Promise(r => srcCanvas.toBlob(r, "image/jpeg", 0.92));
    const url = URL.createObjectURL(blob);
    try {
      const image = await T.RawImage.fromURL(url);
      const { pixel_values } = await processor(image);
      const out = await model({ input: pixel_values });
      const t = out.output || Object.values(out)[0];
      const mask = await T.RawImage.fromTensor(t[0].mul(255).to("uint8")).resize(srcCanvas.width, srcCanvas.height);
      const ch = mask.channels || 1, n = srcCanvas.width * srcCanvas.height;
      const m = new Uint8ClampedArray(n);
      for (let i = 0; i < n; i++) m[i] = mask.data[i * ch];
      return m;
    } finally { URL.revokeObjectURL(url); }
  };

  // Build the cut-out canvas from photo + mask + sensitivity + hand touch-ups.
  // ph = { src, mask, keep (0..1), manual (canvas|null) }
  SBS.applyCut = function (ph) {
    const w = ph.src.width, h = ph.src.height;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(ph.src, 0, 0);
    const id = x.getImageData(0, 0, w, h);
    const keep = ph.keep == null ? 0.55 : ph.keep;
    const t = 0.7 - 0.6 * keep, lo = t - 0.15, hi = t + 0.15;
    const m = ph.mask;
    for (let i = 0; i < w * h; i++) id.data[i * 4 + 3] = Math.round(255 * smooth(lo, hi, m[i] / 255));
    if (ph.manual) {
      const md = ph.manual.getContext("2d").getImageData(0, 0, w, h).data;
      for (let i = 0; i < w * h; i++) {
        if (md[i * 4 + 3] > 128) id.data[i * 4 + 3] = md[i * 4 + 1] > md[i * 4] ? 255 : 0;
      }
    }
    x.putImageData(id, 0, 0);
    return c;
  };
})();
