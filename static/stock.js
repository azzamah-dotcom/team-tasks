"use strict";
// Gifts & giveaways stock. Uses helpers and state from app.js ($, $$, esc, api, toast, formError, state, app).
//
// - A team leader owns a private stock list with several locations (stores).
// - They assign team members to fill in each location. Those members only see their own locations.
// - The leader can turn on a read-only link for their manager (#share=<token>), no sign-in needed.

const stock = {
  lists: [],
  listIdx: 0,
  loc: "all",          // location filter: "all" or a location id
  cat: "all",          // "all" | "gift" | "giveaway"
  query: "",
  showEmpty: false,    // with a location picked, also show items that have none there
  shared: null,        // share token when viewing the manager's read-only link
  photoData: null,     // new photo (data URL) chosen in the item dialog
  removePhoto: false,
  upload: null,        // {file, filename, sheets} while the upload dialog is open
};

const CAT_LABEL = { gift: "Gift", giveaway: "Giveaway" };
const curList = () => stock.lists[stock.listIdx] || null;
const canEditLoc = (list, locId) => !stock.shared && (list.editable_ids || []).includes(locId);
const canEditList = (list) => !stock.shared && (list.editable_ids || []).length > 0;
const qtyAt = (item, locId) => item.qty[String(locId)] || 0;
const totalQty = (item, list) => list.locations.reduce((n, l) => n + qtyAt(item, l.id), 0);
// The alert is for the total across every location, so only the owner and the shared view (which see all) use it.
const seesAll = (list) => list.is_owner || !!stock.shared;
const isLow = (item, list) => seesAll(list) && item.min_qty > 0 && totalQty(item, list) <= item.min_qty;
const nf = (n) => Number(n).toLocaleString();
const plural = (n, word) => `${nf(n)} ${word}${n === 1 ? "" : "s"}`;

function photoUrl(list, item) {
  const base = stock.shared ? `/api/stock/shared/${stock.shared}/items/${item.id}/photo`
    : `/api/stock/items/${item.id}/photo`;
  return `${base}?v=${item.photo_version}`;
}

const PLACEHOLDER = `<svg viewBox="0 0 48 48" aria-hidden="true" class="ph"><rect x="8" y="18" width="32" height="22" rx="3"/>
  <path d="M6 12h36v6H6zM24 12v28M24 12c-3-6-11-6-10-1 1 3 7 1 10 1zm0 0c3-6 11-6 10-1-1 3-7 1-10 1z"/></svg>`;

// ---------- page skeleton ----------
function stockMarkup(readOnly) {
  return `
  <main class="wrap">
    <section class="panel stock-panel">
      <div class="panel-head">
        <div>
          <h2>Gifts &amp; giveaways stock</h2>
          <p class="muted small stock-sub" id="stock-sub"></p>
        </div>
        <div class="filters" id="stock-actions"></div>
      </div>
      <div id="stock-lists"></div>
      <div class="loc-cards" id="loc-cards" role="tablist" aria-label="Locations"></div>
      <div class="stock-tools">
        <div class="search">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>
          <input id="stock-search" type="search" placeholder="Search items…" aria-label="Search items" autocomplete="off">
        </div>
        <div class="seg" id="cat-tabs" role="tablist" aria-label="Type"></div>
      </div>
      <p class="muted small" id="stock-info"></p>
      <div class="stock-grid" id="stock-grid"></div>
    </section>
  </main>
  <dialog id="photo-dialog" class="photo-dialog">
    <img alt="">
    <div class="dialog-actions"><button type="button" class="btn" data-action="close-dialog">Close</button></div>
  </dialog>
  ${readOnly ? "" : `
  <dialog id="item-dialog">
    <form data-form="stock-item" class="stack">
      <h2 class="item-dialog-title">Add item</h2>
      <div class="photo-pick">
        <div class="photo-preview"></div>
        <div class="photo-buttons">
          <label class="btn small file-btn">
            <span class="photo-btn-text">Add photo</span>
            <input type="file" name="photo_file" accept="image/*" class="visually-hidden">
          </label>
          <button type="button" class="btn ghost small danger" data-action="stock-remove-photo">Remove photo</button>
          <span class="muted small">Take a picture or choose one.</span>
        </div>
      </div>
      <div class="row2">
        <label>Item name<input name="name" required maxlength="120" placeholder="e.g. Zain mug, power bank"></label>
        <label>Item code <span class="muted">(optional)</span><input name="code" maxlength="40" placeholder="e.g. GIV-001-0263"></label>
      </div>
      <div class="row2">
        <label>Type<select name="category">
          <option value="giveaway">Giveaway</option><option value="gift">Gift</option>
        </select></label>
      </div>
      <fieldset class="qty-set">
        <legend>Quantity in each location</legend>
        <div class="qty-grid"></div>
      </fieldset>
      <label>Low stock alert at <span class="muted">(optional)</span>
        <input name="min_qty" type="number" min="0" max="1000000" inputmode="numeric" placeholder="e.g. 20">
        <span class="muted small hint">The item is flagged when the total reaches this number or less.</span>
      </label>
      <label>Notes <span class="muted">(optional)</span><textarea name="notes" rows="2" maxlength="1000"
        placeholder="Size, color, supplier, campaign…"></textarea></label>
      <div class="history"></div>
      <div class="dialog-actions">
        <button type="button" class="btn ghost danger stock-delete" data-action="stock-delete-item">Delete item</button>
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>
  </dialog>
  <dialog id="locations-dialog">
    <form data-form="stock-locations" class="stack">
      <h2>Locations &amp; who fills them in</h2>
      <p class="muted small">Tick the team members who count and update each location. They only see the
        locations you give them. Nobody else sees this list unless you share it.</p>
      <ul class="loc-edit"></ul>
      <label>Add a location<input name="new_location" maxlength="80" placeholder="e.g. Events storage"></label>
      <div class="dialog-actions">
        <button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>
  </dialog>
  <dialog id="upload-dialog">
    <form data-form="stock-upload" class="stack">
      <h2>Upload stock from Excel</h2>
      <p class="muted small upload-intro"></p>
      <ul class="upload-sheets"></ul>
      <p class="muted small">Items are matched by their code, so uploading an updated file later changes the
        quantities instead of adding the items again. Each quantity replaces what that location had, and every
        change is kept in the item's history. Items not in the file aren't touched.</p>
      <div class="dialog-actions">
        <button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>
        <button type="submit" class="btn primary">Upload</button>
      </div>
    </form>
  </dialog>
  <dialog id="share-dialog">
    <div class="stack">
      <h2>Share with your manager</h2>
      <div class="share-body"></div>
      <div class="dialog-actions"><button type="button" class="btn" data-action="close-dialog">Done</button></div>
    </div>
  </dialog>`}`;
}

function renderStockShell() {
  document.title = "Gifts stock · Zain Team Tasks";
  app.innerHTML = topbar() + stockMarkup(false);
  bindStockSearch();
}

function bindStockSearch() {
  const search = $("#stock-search");
  search.value = stock.query;
  search.addEventListener("input", () => { stock.query = search.value; renderStockGrid(); });
}

// ---------- loading ----------
async function refreshStock() {
  const { lists } = await api("GET", "/api/stock");
  stock.lists = lists;
  if (stock.listIdx >= lists.length) stock.listIdx = 0;
  if (isLeader() && !state.members.length) {
    try { state.members = (await api("GET", "/api/members")).members; } catch { /* shown as empty */ }
  }
  renderStock();
}

async function bootShared(token) {
  stock.shared = token;
  document.title = "Gifts stock · Zain";
  const load = async () => {
    try {
      const { list } = await api("GET", `/api/stock/shared/${encodeURIComponent(token)}`);
      stock.lists = [list];
      renderStock();
    } catch (err) {
      app.innerHTML = `<main class="auth"><div class="auth-card"><div class="brand">${ZAIN_LOGO}<span class="brand-sep" aria-hidden="true"></span>
        <span class="brand-name">Gifts stock</span></div>
        <p>${esc(err.message)}</p></div></main>`;
    }
  };
  app.innerHTML = `
  <header class="topbar">
    <div class="brand">${ZAIN_LOGO}<span class="brand-sep" aria-hidden="true"></span><span class="brand-name">Gifts stock</span></div>
    <div class="who"><span class="chip">Read only</span></div>
  </header>` + stockMarkup(true);
  bindStockSearch();
  await load();
  setInterval(load, 60_000);
}

// ---------- rendering ----------
function renderStock() {
  const list = curList();
  if (!$("#stock-grid")) return;
  if (!list) {
    $("#stock-grid").innerHTML = `<p class="empty">You haven't been given any stock to fill in yet.</p>`;
    return;
  }
  if (stock.loc !== "all" && !list.locations.some((l) => String(l.id) === stock.loc)) stock.loc = "all";

  const sub = stock.shared ? `Shared by ${esc(list.owner_name)} · read only · updates every minute`
    : list.is_owner ? "Private to you. Only the team members you assign can fill in their locations."
    : `${esc(list.owner_name)}'s list · you fill in: ${list.locations.map((l) => esc(l.name)).join(", ")}`;
  $("#stock-sub").innerHTML = sub;

  const actions = [];
  if (canEditList(list)) actions.push(`<button type="button" class="btn primary" data-action="stock-add">+ Add item</button>`);
  if (list.is_owner) {
    actions.push(`<label class="btn file-btn" title="Add or update items from an Excel (.xlsx) or CSV file">⬆ Upload Excel
      <input type="file" id="stock-upload-file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" class="visually-hidden"></label>`);
    actions.push(`<button type="button" class="btn" data-action="stock-locations">Locations &amp; people</button>`);
    actions.push(`<button type="button" class="btn" data-action="stock-share">${list.share_token ? "🔗 Shared" : "Share with manager"}</button>`);
  }
  actions.push(`<button type="button" class="btn ghost" data-action="stock-csv" title="Download as a spreadsheet (CSV)">⬇ Excel</button>`);
  $("#stock-actions").innerHTML = actions.join("");

  $("#stock-lists").innerHTML = stock.lists.length > 1 ? `
    <div class="seg list-pick" role="tablist" aria-label="Stock lists">${stock.lists.map((l, i) => `
      <button type="button" class="${i === stock.listIdx ? "active" : ""}" data-action="stock-list" data-idx="${i}">
        ${l.is_owner ? "My list" : `${esc(l.owner_name)}'s list`}</button>`).join("")}</div>` : "";

  const allTotal = list.items.reduce((n, it) => n + totalQty(it, list), 0);
  const lowCount = list.items.filter((it) => isLow(it, list)).length;
  $("#loc-cards").innerHTML = [
    { id: "all", name: list.locations.length > 1 ? "All locations" : "Total", total: allTotal,
      extra: `${plural(list.items.length, "item")}${lowCount ? ` · <span class="bad">${lowCount} low</span>` : ""}` },
    ...(list.locations.length > 1 ? list.locations.map((l) => ({
      id: String(l.id), name: l.name, total: list.items.reduce((n, it) => n + qtyAt(it, l.id), 0),
      extra: list.is_owner ? editorNames(l) : plural(list.items.filter((it) => qtyAt(it, l.id) > 0).length, "item"),
    })) : []),
  ].map((c) => `
    <button type="button" role="tab" aria-selected="${stock.loc === c.id}" class="loc-card ${stock.loc === c.id ? "active" : ""}"
      data-action="stock-loc" data-loc="${c.id}">
      <span class="loc-name">${esc(c.name)}</span>
      <span class="loc-total">${nf(c.total)}</span>
      <span class="loc-extra small">${c.extra}</span>
    </button>`).join("");

  $("#cat-tabs").innerHTML = [["all", "All"], ["gift", "Gifts"], ["giveaway", "Giveaways"]].map(([v, label]) => `
    <button type="button" role="tab" aria-selected="${stock.cat === v}" class="${stock.cat === v ? "active" : ""}"
      data-action="stock-cat" data-cat="${v}">${label}</button>`).join("");

  renderStockGrid();
}

function editorNames(loc) {
  const names = (loc.editor_ids || []).map((id) => state.members.find((m) => m.id === id)?.name).filter(Boolean);
  return names.length ? `👤 ${names.map(esc).join(", ")}` : `<span class="muted">No one assigned</span>`;
}

function filteredItems(list) {
  const terms = norm(stock.query).split(/\s+/).filter(Boolean);
  let hiddenEmpty = 0;
  const items = list.items.filter((it) => {
    if (stock.cat !== "all" && it.category !== stock.cat) return false;
    if (terms.length && !terms.every((t) => norm(`${it.name} ${it.code || ""} ${it.notes} ${CAT_LABEL[it.category]}`).includes(t))) return false;
    if (stock.loc !== "all" && !stock.showEmpty && qtyAt(it, stock.loc) === 0) { hiddenEmpty++; return false; }
    return true;
  });
  return { items, hiddenEmpty };
}

function itemCard(it, list) {
  const here = stock.loc !== "all" ? list.locations.find((l) => String(l.id) === stock.loc) : null;
  const shownQty = here ? qtyAt(it, here.id) : totalQty(it, list);
  const low = isLow(it, list);
  const locs = list.locations.length > 1 ? `
      <ul class="item-locs">${list.locations.map((l) => `
        <li class="${here && here.id === l.id ? "here" : ""} ${qtyAt(it, l.id) ? "" : "zero"}">
          <span>${esc(l.name)}</span><strong>${nf(qtyAt(it, l.id))}</strong></li>`).join("")}</ul>` : "";
  return `
  <article class="item-card ${low ? "low" : ""}" data-item-id="${it.id}">
    <button type="button" class="item-photo" data-action="stock-photo" ${it.has_photo ? "" : "disabled"}
      aria-label="${it.has_photo ? `View photo of ${esc(it.name)}` : "No photo"}">
      ${it.has_photo ? `<img src="${photoUrl(list, it)}" alt="" loading="lazy">` : PLACEHOLDER}
    </button>
    <div class="item-body">
      <div class="item-top">
        <h3>${esc(it.name)}</h3>
        <span class="cat ${it.category}">${CAT_LABEL[it.category]}</span>
      </div>
      <div class="item-total"><strong>${nf(shownQty)}</strong> ${here ? `at ${esc(here.name)}` : "in stock"}
        ${low ? `<span class="low-badge" title="Alert set at ${nf(it.min_qty)}">Low stock</span>` : ""}</div>
      ${it.code ? `<p class="item-code small muted">${esc(it.code)}</p>` : ""}
      ${locs}
      ${it.notes ? `<p class="item-notes small">${esc(it.notes)}</p>` : ""}
      <div class="item-foot">
        <span class="muted small">${it.updated_at ? `Updated${it.updated_by_name ? ` by ${esc(it.updated_by_name)}` : ""} · ${ago(it.updated_at)}` : ""}</span>
        ${canEditList(list) ? `<button type="button" class="btn small" data-action="stock-edit">Update</button>` : ""}
      </div>
    </div>
  </article>`;
}

function renderStockGrid() {
  const list = curList();
  if (!list || !$("#stock-grid")) return;
  const { items, hiddenEmpty } = filteredItems(list);
  const info = [];
  if (hiddenEmpty) info.push(`${hiddenEmpty} item${hiddenEmpty === 1 ? " has" : "s have"} none here.
    <button type="button" class="linkish" data-action="stock-show-empty">Show ${hiddenEmpty === 1 ? "it" : "them"}</button>`);
  else if (stock.loc !== "all" && stock.showEmpty) info.push(`<button type="button" class="linkish" data-action="stock-show-empty">Hide items with none here</button>`);
  $("#stock-info").innerHTML = info.join(" ");
  let empty = "No items match.";
  if (!list.items.length) {
    empty = canEditList(list) ? "No items yet. Click “+ Add item” to add the first gift or giveaway with its photo."
      : "No items yet.";
  }
  $("#stock-grid").innerHTML = items.length ? items.map((it) => itemCard(it, list)).join("")
    : `<p class="empty">${empty}</p>`;
}

// ---------- item dialog ----------
function openItem(item) {
  const list = curList();
  const dialog = $("#item-dialog");
  const form = $("form", dialog);
  form.reset();
  $(".form-error", form)?.remove();
  form.dataset.itemId = item ? item.id : "";
  stock.photoData = null;
  stock.removePhoto = false;
  $(".item-dialog-title", form).textContent = item ? "Update item" : "Add item";
  if (item) {
    form.elements.name.value = item.name;
    form.elements.code.value = item.code || "";
    form.elements.category.value = item.category;
    form.elements.notes.value = item.notes;
    form.elements.min_qty.value = item.min_qty || "";
  } else if (stock.cat !== "all") {
    form.elements.category.value = stock.cat;
  }
  $(".qty-grid", form).innerHTML = list.locations.map((l) => {
    const editable = canEditLoc(list, l.id);
    return `
    <label class="qty-row ${editable ? "" : "readonly"}">
      <span>${esc(l.name)}</span>
      <span class="stepper">
        <button type="button" class="btn small" data-action="stock-step" data-step="-1" ${editable ? "" : "disabled"} aria-label="One less">−</button>
        <input type="number" name="qty_${l.id}" data-loc="${l.id}" min="0" max="1000000" inputmode="numeric"
          value="${item ? qtyAt(item, l.id) : 0}" ${editable ? "" : "disabled"}>
        <button type="button" class="btn small" data-action="stock-step" data-step="1" ${editable ? "" : "disabled"} aria-label="One more">+</button>
      </span>
    </label>`;
  }).join("");
  $(".stock-delete", form).hidden = !(item && list.is_owner);
  form.elements.min_qty.closest("label").hidden = !list.is_owner;
  renderPhotoPreview(item);
  const hist = $(".history", form);
  hist.innerHTML = "";
  if (item) loadHistory(item, hist);
  dialog.showModal();
  if (!item) form.elements.name.focus();
}

function renderPhotoPreview(item) {
  const form = $("#item-dialog form");
  const box = $(".photo-preview", form);
  const src = stock.photoData || (!stock.removePhoto && item?.has_photo ? photoUrl(curList(), item) : null);
  box.innerHTML = src ? `<img src="${src}" alt="Item photo">` : PLACEHOLDER;
  $(".photo-btn-text", form).textContent = src ? "Change photo" : "Add photo";
  $('[data-action="stock-remove-photo"]', form).hidden = !src;
}

async function loadHistory(item, el) {
  try {
    const { history } = await api("GET", `/api/stock/items/${item.id}/history`);
    if (!history.length) return;
    el.innerHTML = `<details><summary>Recent changes (${history.length})</summary><ul>${history.map((h) => `
      <li><strong>${esc(h.location_name)}</strong>: ${nf(h.old_qty)} → ${nf(h.new_qty)}
        <span class="muted">${h.new_qty > h.old_qty ? `(+${nf(h.new_qty - h.old_qty)})` : `(−${nf(h.old_qty - h.new_qty)})`}
        · ${esc(h.user_name)} · ${esc(fmtDate(h.at))}</span></li>`).join("")}</ul></details>`;
  } catch { /* history is optional */ }
}

// Shrink photos in the browser before upload (phone photos are often 3–8 MB).
function resizePhoto(file, maxSide = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That photo couldn't be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a photo this browser can read. Try a JPG or PNG."));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- locations dialog ----------
function openLocations() {
  const list = curList();
  const form = $("#locations-dialog form");
  form.reset();
  $(".form-error", form)?.remove();
  const people = state.members;
  $(".loc-edit", form).innerHTML = list.locations.map((l) => `
    <li data-loc-id="${l.id}">
      <div class="loc-edit-head">
        <input name="loc_name_${l.id}" value="${esc(l.name)}" maxlength="80" required aria-label="Location name">
        <button type="button" class="btn ghost small danger" data-action="stock-delete-loc">Delete</button>
      </div>
      <div class="loc-people">${people.length ? people.map((m) => `
        <label class="check pill"><input type="checkbox" name="loc_${l.id}_editor" value="${m.id}"
          ${(l.editor_ids || []).includes(m.id) ? "checked" : ""}> ${esc(m.name)}</label>`).join("")
        : `<span class="muted small">Add team members on the Tasks page first, then assign them here.</span>`}</div>
    </li>`).join("") || `<li class="muted small">No locations yet. Add one below.</li>`;
  if (!$("#locations-dialog").open) $("#locations-dialog").showModal();
}

async function saveLocations(form) {
  const list = curList();
  for (const l of list.locations) {
    const name = form.elements[`loc_name_${l.id}`].value.trim();
    const ids = $$(`input[name="loc_${l.id}_editor"]:checked`, form).map((b) => Number(b.value));
    const before = [...(l.editor_ids || [])].sort().join(",");
    if (name !== l.name || [...ids].sort().join(",") !== before) {
      await api("PATCH", `/api/stock/locations/${l.id}`, { name, editor_ids: ids });
    }
  }
  const added = form.elements.new_location.value.trim();
  if (added) await api("POST", "/api/stock/locations", { name: added, editor_ids: [] });
}

// ---------- share dialog ----------
const shareLink = (token) => `${location.origin}/#share=${token}`;

function renderShare() {
  const list = curList();
  const body = $("#share-dialog .share-body");
  body.innerHTML = list.share_token ? `
    <p class="small">Anyone with this link can <strong>view</strong> the full stock list with photos. They can't change anything
      and don't need an account.</p>
    <div class="share-row">
      <input readonly value="${esc(shareLink(list.share_token))}" aria-label="Share link" class="share-input">
      <button type="button" class="btn primary" data-action="stock-copy-link">Copy</button>
    </div>
    <div class="share-more">
      <button type="button" class="btn ghost small" data-action="stock-share-set" data-on="1">Make a new link</button>
      <button type="button" class="btn ghost small danger" data-action="stock-share-set" data-on="0">Turn off link</button>
    </div>
    <p class="muted small">Making a new link or turning it off stops the old link from working.</p>` : `
    <p class="small">Create a private, read-only link to send your manager. They'll see every location, quantity and photo,
      always up to date, without signing in. You can turn it off at any time.</p>
    <div><button type="button" class="btn primary" data-action="stock-share-set" data-on="1">Create link</button></div>`;
}

// ---------- upload from Excel ----------
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function startUpload(file) {
  if (file.size > 5_000_000) throw new Error("That file is too large (5 MB at most).");
  const data = await readAsDataUrl(file);
  const { sheets } = await api("POST", "/api/stock/import", { file: data, filename: file.name });
  stock.upload = { file: data, filename: file.name, sheets };
  const list = curList();
  const form = $("#upload-dialog form");
  $(".form-error", form)?.remove();
  $(".upload-intro", form).textContent =
    `${file.name}: choose where each sheet's quantities go. Nothing is saved until you click Upload.`;
  $(".upload-sheets", form).innerHTML = sheets.map((s) => {
    const options = list.locations.map((l) =>
      `<option value="${l.id}" ${s.suggested_location_id === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("");
    const sample = s.sample.map((r) => `${esc(r.name)}${r.code ? ` <span class="muted">(${esc(r.code)})</span>` : ""}: ${nf(r.qty)}`).join(" · ");
    return `
    <li class="upload-sheet">
      <div class="upload-sheet-head">
        <strong>${esc(s.name)}</strong>
        <span class="muted small">${plural(s.count, "row")} · ${nf(s.total)} pieces${s.skipped ? ` · <span class="bad">${s.skipped} skipped (quantity not a number)</span>` : ""}</span>
      </div>
      ${s.count ? `
      <label>Goes into
        <select name="sheet_${s.index}" data-sheet="${s.index}">
          ${options}
          <option value="new" ${s.suggested_location_id ? "" : "selected"}>New location: ${esc(s.name)}</option>
          <option value="skip">Don't upload this sheet</option>
        </select>
      </label>
      <p class="muted small upload-sample">${sample}${s.count > s.sample.length ? " …" : ""}</p>`
      : `<p class="muted small">No items found in this sheet.</p>`}
    </li>`;
  }).join("");
  $("#upload-dialog").showModal();
}

async function finishUpload(form) {
  const up = stock.upload;
  const choices = [];
  for (const sel of $$("select[data-sheet]", form)) {
    const sheet = up.sheets.find((s) => s.index === Number(sel.dataset.sheet));
    if (sel.value === "skip") continue;
    choices.push(sel.value === "new" ? { index: sheet.index, new_location: sheet.name }
      : { index: sheet.index, location_id: Number(sel.value) });
  }
  if (!choices.length) throw new Error("Choose at least one sheet to upload.");
  const r = await api("POST", "/api/stock/import", { file: up.file, filename: up.filename, sheets: choices });
  stock.upload = null;
  $("#upload-dialog").close();
  const parts = [`${plural(r.created, "new item")}`, `${plural(r.updated, "item")} updated`];
  if (r.new_locations) parts.push(`${plural(r.new_locations, "new location")}`);
  toast(`Uploaded: ${parts.join(", ")}`);
}

// ---------- CSV export ----------
function downloadCsv() {
  const list = curList();
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Item", "Code", "Type", ...list.locations.map((l) => l.name), "Total", "Low stock alert at", "Notes", "Last updated"];
  const rows = list.items.map((it) => [
    it.name, it.code || "", CAT_LABEL[it.category], ...list.locations.map((l) => qtyAt(it, l.id)), totalQty(it, list),
    it.min_qty || "", it.notes, it.updated_at ? fmtDate(it.updated_at) : "",
  ]);
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n"); // BOM so Excel reads Arabic
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `gifts-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- events ----------
app.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action^='stock-']");
  if (!el) return;
  const list = curList();
  const itemId = Number(el.closest("[data-item-id]")?.dataset.itemId);
  const item = list?.items.find((it) => it.id === itemId);
  try {
    switch (el.dataset.action) {
      case "stock-list": stock.listIdx = Number(el.dataset.idx); stock.loc = "all"; renderStock(); break;
      case "stock-loc": stock.loc = el.dataset.loc; stock.showEmpty = false; renderStock(); break;
      case "stock-cat": stock.cat = el.dataset.cat; renderStock(); break;
      case "stock-show-empty": stock.showEmpty = !stock.showEmpty; renderStockGrid(); break;
      case "stock-add": openItem(null); break;
      case "stock-edit": if (item) openItem(item); break;
      case "stock-photo": {
        if (!item?.has_photo) return;
        const d = $("#photo-dialog");
        $("img", d).src = photoUrl(list, item);
        $("img", d).alt = item.name;
        d.showModal();
        break;
      }
      case "stock-step": {
        const input = $("input", el.closest(".stepper"));
        input.value = Math.max(0, (Number(input.value) || 0) + Number(el.dataset.step));
        break;
      }
      case "stock-remove-photo": {
        stock.photoData = null;
        stock.removePhoto = true;
        const id = Number($("#item-dialog form").dataset.itemId);
        renderPhotoPreview(list.items.find((it) => it.id === id));
        break;
      }
      case "stock-delete-item": {
        const id = Number($("#item-dialog form").dataset.itemId);
        const it = list.items.find((x) => x.id === id);
        if (it && confirm(`Delete "${it.name}" and its quantities in every location? This can't be undone.`)) {
          await api("DELETE", `/api/stock/items/${id}`);
          $("#item-dialog").close();
          toast("Item deleted");
          await refreshStock();
        }
        break;
      }
      case "stock-locations": openLocations(); break;
      case "stock-delete-loc": {
        const locId = Number(el.closest("[data-loc-id]").dataset.locId);
        const loc = list.locations.find((l) => l.id === locId);
        if (loc && confirm(`Delete the location "${loc.name}"?`)) {
          await api("DELETE", `/api/stock/locations/${locId}`);
          toast(`${loc.name} deleted`);
          await refreshStock();
          openLocations();
        }
        break;
      }
      case "stock-share": renderShare(); $("#share-dialog").showModal(); break;
      case "stock-share-set": {
        const on = el.dataset.on === "1";
        if (!on && !confirm("Turn off the link? Your manager won't be able to open it anymore.")) return;
        if (on && list.share_token && !confirm("Make a new link? The current link will stop working.")) return;
        const { share_token } = await api("POST", "/api/stock/share", { enabled: on });
        list.share_token = share_token;
        renderShare();
        renderStock();
        toast(on ? "Link ready. Copy it and send it to your manager." : "Link turned off");
        break;
      }
      case "stock-copy-link": {
        const input = $(".share-input");
        try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand("copy"); }
        toast("Link copied");
        break;
      }
      case "stock-csv": downloadCsv(); break;
    }
  } catch (err) {
    if (err.status === 401 && !stock.shared) { state.me = null; renderAuth(); }
    else toast(err.message, true);
  }
});

app.addEventListener("change", async (e) => {
  if (e.target.id === "stock-upload-file") {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) startUpload(file).catch((err) => toast(err.message, true));
    return;
  }
  if (!e.target.matches('#item-dialog input[name="photo_file"]')) return;
  const file = e.target.files[0];
  if (!file) return;
  try {
    stock.photoData = await resizePhoto(file);
    stock.removePhoto = false;
    const id = Number($("#item-dialog form").dataset.itemId);
    renderPhotoPreview(curList().items.find((it) => it.id === id));
  } catch (err) {
    toast(err.message, true);
  }
  e.target.value = "";
});

app.addEventListener("submit", async (e) => {
  const form = e.target.closest('form[data-form^="stock-"]');
  if (!form) return;
  e.preventDefault();
  const btn = $("[type=submit]", form);
  btn.disabled = true;
  try {
    if (form.dataset.form === "stock-item") {
      const list = curList();
      const qty = {};
      for (const input of $$(".qty-grid input:not(:disabled)", form)) qty[input.dataset.loc] = Number(input.value) || 0;
      const payload = {
        name: form.elements.name.value,
        code: form.elements.code.value,
        category: form.elements.category.value,
        notes: form.elements.notes.value,
        qty,
      };
      if (list.is_owner) payload.min_qty = Number(form.elements.min_qty.value) || 0;
      if (stock.photoData) payload.photo = stock.photoData;
      else if (stock.removePhoto) payload.remove_photo = true;
      const id = form.dataset.itemId;
      if (id) await api("PATCH", `/api/stock/items/${id}`, payload);
      else await api("POST", "/api/stock/items", { ...payload, owner_id: list.owner_id });
      $("#item-dialog").close();
      toast(id ? "Item updated" : `${payload.name.trim()} added`);
    } else if (form.dataset.form === "stock-upload") {
      await finishUpload(form);
    } else if (form.dataset.form === "stock-locations") {
      await saveLocations(form);
      $("#locations-dialog").close();
      toast("Locations saved");
    }
    await refreshStock();
  } catch (err) {
    if (err.status === 401) { state.me = null; renderAuth(); return; }
    if (form.isConnected) formError(form, err.message);
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
});
