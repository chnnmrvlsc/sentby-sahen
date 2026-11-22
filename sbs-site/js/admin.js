/* Owner dashboard */
(function () {
  const C = window.SBS_CONFIG, Store = window.SBS.Store;
  const app = document.getElementById("app");
  const peso = n => "₱" + Number(n || 0).toLocaleString("en-PH");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let orders = [], filter = "all", openId = null;

  async function start() {
    let sess = null;
    try { sess = await Store.admin.session(); } catch (e) { /* ignore */ }
    if (!sess) return loginView();
    dashboard();
  }

  function loginView(msg) {
    app.innerHTML = `<form class="login" id="lf">
      <img src="assets/logo.png" alt="" style="height:70px;display:block;margin:0 auto 1rem">
      <h3 style="text-align:center">Owner login</h3>
      <label class="field"><span>Email</span><input id="em" type="email" autocomplete="username" required></label>
      <label class="field"><span>Password</span><input id="pw" type="password" autocomplete="current-password" required></label>
      ${msg ? `<div class="error">${esc(msg)}</div>` : ""}
      <button class="btn" style="width:100%;margin-top:1rem">Log in</button></form>`;
    document.getElementById("lf").onsubmit = async e => {
      e.preventDefault();
      try { await Store.admin.signIn(document.getElementById("em").value, document.getElementById("pw").value); dashboard(); }
      catch (err) { loginView("Wrong email or password."); }
    };
  }

  async function dashboard() {
    app.innerHTML = `<div class="admin-wrap">
      <div class="admin-top">
        <div><h2 style="margin:0">Orders</h2><small id="mode">${Store.live ? "Live" : "Demo mode: orders are saved in this browser only"}</small></div>
        <div style="display:flex;gap:.5rem"><button class="btn ghost small" id="refresh">Refresh</button>${Store.live ? `<button class="btn ghost small" id="out">Log out</button>` : `<button class="btn ghost small" id="clear">Clear demo orders</button>`}</div>
      </div>
      <div class="filters" id="filters"></div>
      <div class="orders" id="orders">Loading...</div></div>`;
    document.getElementById("refresh").onclick = load;
    const o = document.getElementById("out"); if (o) o.onclick = async () => { await Store.admin.signOut(); start(); };
    const c = document.getElementById("clear"); if (c) c.onclick = async () => { if (confirm("Delete all demo orders?")) { await Store.admin.clearDemo(); load(); } };
    load();
  }

  async function load() {
    try { orders = await Store.admin.list(); } catch (e) { document.getElementById("orders").innerHTML = `<div class="error">Couldn't load orders: ${esc(e.message)}</div>`; return; }
    drawFilters(); drawOrders();
  }

  function drawFilters() {
    const box = document.getElementById("filters");
    const counts = {}; orders.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1);
    const list = [{ id: "all", admin: "All" }, ...Store.STATUSES];
    box.innerHTML = list.map(s => `<button class="chip ${filter === s.id ? "on" : ""}" data-f="${s.id}">${s.admin}${s.id === "all" ? ` (${orders.length})` : counts[s.id] ? ` (${counts[s.id]})` : ""}</button>`).join("");
    box.querySelectorAll("button").forEach(b => b.onclick = () => { filter = b.dataset.f; drawFilters(); drawOrders(); });
  }

  function drawOrders() {
    const box = document.getElementById("orders");
    const list = orders.filter(o => filter === "all" || o.status === filter);
    if (!list.length) { box.innerHTML = `<p class="sub">No orders here yet.</p>`; return; }
    box.innerHTML = list.map(o => `
      <article class="order ${openId === o.id ? "open" : ""}" data-id="${o.id}">
        <div class="order-head" data-toggle>
          <div><b>${esc(o.code)}</b> <span class="sub" style="margin-left:.5rem">${esc(o.customer_name)} · @${esc(o.ig)}</span></div>
          <div><span class="sub" style="margin-right:.6rem">${esc(o.size)}${o.framed ? " framed" : ""} · ${peso(o.total)}</span><span class="pill s-${o.status}">${Store.statusLabel(o.status)}</span></div>
        </div>
        <div class="order-body"><div class="media">Loading...</div><div class="info"></div></div>
      </article>`).join("");
    box.querySelectorAll("[data-toggle]").forEach(h => h.onclick = () => {
      const id = h.parentElement.dataset.id; openId = openId === id ? null : id; drawOrders();
    });
    if (openId) fillOpen();
  }

  async function fillOpen() {
    const o = orders.find(x => x.id === openId); if (!o) return;
    const el = document.querySelector(`.order[data-id="${CSS.escape(o.id)}"]`); if (!el) return;
    const [design, photo, proof] = await Promise.all([o.preview_path, o.photo_path, o.proof_path].map(p => Store.admin.fileUrl(p)));
    const items = (o.items || []).map(i => i.kind === "symbol" ? `[${i.symbol}]` : `"${i.text}"`).join(", ") || "none";
    const cal = o.calendar ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][o.calendar.month]} ${o.calendar.year}` : "n/a";
    el.querySelector(".media").innerHTML = `
      ${design ? `<a href="${design}" target="_blank" rel="noopener"><img src="${design}" alt="Design"></a><div class="admin-actions"><a class="btn small" href="${design}" download="${esc(o.code)}-design.jpg">Download design</a></div>` : ""}`;
    el.querySelector(".info").innerHTML = `
      <dl class="kv">
        <dt>Size</dt><dd>${esc(o.size)} ${o.framed ? "· framed (dark walnut)" : "· no frame"}</dd>
        <dt>Template</dt><dd>${o.template}${o.template === 1 ? " · calendar " + cal : ""}</dd>
        <dt>Thread colors</dt><dd>${(o.colors || []).map(c => "№" + c).join(", ")}</dd>
        <dt>Stitched text</dt><dd>${esc(items)}</dd>
        <dt>Total</dt><dd>${peso(o.total)} (70% ${peso(o.downpayment)} · 30% ${peso(o.balance)} · + delivery fee)</dd>
        <dt>Tracking</dt><dd>${o.tracking_pref === "show" ? "Customer wants the tracking number" : "Surprise: do NOT send tracking"}</dd>
      </dl>
      <h5>Customer</h5>
      <p>${esc(o.customer_name)} · <a href="https://ig.me/m/${encodeURIComponent(o.ig)}" target="_blank" rel="noopener">@${esc(o.ig)}</a></p>
      <h5>Ship to ${o.is_gift ? "(gift)" : ""}</h5>
      <p>${esc(o.recipient_name)} · ${esc(o.recipient_phone)}</p><p>${esc(o.recipient_address)}</p>
      <h5>Files</h5>
      <div class="admin-actions">
        ${proof ? `<a class="btn ghost small" href="${proof}" target="_blank" rel="noopener">Payment proof</a>` : ""}
        ${photo ? `<a class="btn ghost small" href="${photo}" download="${esc(o.code)}-photo.jpg">Original photo</a>` : ""}
      </div>
      <h5>Status</h5>
      <div class="row"><select id="st">${Store.STATUSES.map(s => `<option value="${s.id}" ${s.id === o.status ? "selected" : ""}>${s.admin}</option>`).join("")}</select>
      <input id="trk" placeholder="Tracking number (optional)" value="${esc(o.tracking_number || "")}"></div>
      <label class="field"><span>Your notes (private)</span><textarea id="nt" rows="2">${esc(o.owner_note || "")}</textarea></label>
      <div class="admin-actions"><button class="btn small" id="save">Save</button><button class="btn ghost small" id="del">Delete order</button></div>`;
    el.querySelector("#save").onclick = async () => {
      await Store.admin.update(o.id, { status: el.querySelector("#st").value, tracking_number: el.querySelector("#trk").value.trim() || null, owner_note: el.querySelector("#nt").value.trim() || null });
      await load();
    };
    el.querySelector("#del").onclick = async () => { if (confirm("Delete this order? This can't be undone.")) { await Store.admin.remove(o.id); openId = null; await load(); } };
  }

  start();
})();
