/* Data layer. If Supabase keys are set in config.js it uses Supabase (free tier).
   If not, it runs in DEMO mode and keeps orders in this browser only. */
(function () {
  const C = window.SBS_CONFIG;
  const SBS = (window.SBS = window.SBS || {});
  const live = !!(C.supabaseUrl && C.supabaseAnonKey);

  const STATUSES = [
    { id: "pending_verification", admin: "Downpayment to verify", customer: "We're checking your downpayment" },
    { id: "in_progress",          admin: "In progress",           customer: "Your order is being made" },
    { id: "awaiting_balance",     admin: "Done, waiting for 30% + delivery fee", customer: "Done! Waiting for your 30% balance and the delivery fee" },
    { id: "ready_to_ship",        admin: "Paid in full, ready to ship", customer: "Paid in full, getting ready to ship" },
    { id: "shipped",              admin: "Shipped",               customer: "Shipped" },
    { id: "cancelled",            admin: "Cancelled",             customer: "Cancelled" }
  ];

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }
  let sb = null;
  async function client() {
    if (sb) return sb;
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
    sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
    return sb;
  }

  function blobToDataURL(b) {
    return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  }
  function demoGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function demoSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function makeCode() {
    const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let s = "SBS-";
    for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  const Store = {
    live, STATUSES, makeCode,
    statusLabel(id, who) { const s = STATUSES.find(x => x.id === id); return s ? s[who || "admin"] : id; },

    async uploadBlob(code, name, blob) {
      const path = `${code}/${name}`;
      if (!live) {
        const files = demoGet("sbs_demo_files") || {};
        files[path] = await blobToDataURL(blob);
        try { demoSet("sbs_demo_files", files); } catch (e) { throw new Error("Demo storage is full. Clear old demo orders in the admin page."); }
        return path;
      }
      const c = await client();
      const { error } = await c.storage.from("orders").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (error) throw error;
      return path;
    },

    async createOrder(o) {
      if (!live) {
        const list = demoGet("sbs_demo_orders") || [];
        const row = Object.assign({ id: "demo-" + Date.now(), created_at: new Date().toISOString(), status: "pending_verification" }, o);
        list.unshift(row); demoSet("sbs_demo_orders", list);
        return row;
      }
      const c = await client();
      const { error } = await c.from("orders").insert(o);
      if (error) throw error;
      return o;
    },

    // customer: look up by code + IG username
    async lookup(code, ig) {
      code = (code || "").trim().toUpperCase(); ig = (ig || "").trim().replace(/^@/, "").toLowerCase();
      if (!live) {
        const o = (demoGet("sbs_demo_orders") || []).find(x => x.code === code && (x.ig || "").toLowerCase() === ig);
        return o || null;
      }
      const c = await client();
      const { data, error } = await c.rpc("order_status", { p_code: code, p_ig: ig });
      if (error) throw error;
      return data && data.length ? data[0] : null;
    },

    admin: {
      async session() {
        if (!live) return { demo: true };
        const c = await client();
        const { data } = await c.auth.getSession();
        return data.session;
      },
      async signIn(email, password) {
        const c = await client();
        const { error } = await c.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signOut() { if (live) { const c = await client(); await c.auth.signOut(); } },
      async list() {
        if (!live) return demoGet("sbs_demo_orders") || [];
        const c = await client();
        const { data, error } = await c.from("orders").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      },
      async update(id, patch) {
        if (!live) {
          const list = demoGet("sbs_demo_orders") || [];
          const i = list.findIndex(x => x.id === id);
          if (i >= 0) Object.assign(list[i], patch);
          demoSet("sbs_demo_orders", list); return;
        }
        const c = await client();
        const { error } = await c.from("orders").update(patch).eq("id", id);
        if (error) throw error;
      },
      async remove(id) {
        if (!live) { demoSet("sbs_demo_orders", (demoGet("sbs_demo_orders") || []).filter(x => x.id !== id)); return; }
        const c = await client();
        const { error } = await c.from("orders").delete().eq("id", id);
        if (error) throw error;
      },
      async fileUrl(path) {
        if (!path) return null;
        if (!live) { const f = demoGet("sbs_demo_files") || {}; return f[path] || null; }
        const c = await client();
        const { data, error } = await c.storage.from("orders").createSignedUrl(path, 3600);
        if (error) return null;
        return data.signedUrl;
      },
      async clearDemo() { localStorage.removeItem("sbs_demo_orders"); localStorage.removeItem("sbs_demo_files"); }
    }
  };
  SBS.Store = Store;
})();
