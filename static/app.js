"use strict";

// ---------- utilities ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const APP_NAME = "Zain Team Tasks";
const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const SOON_WINDOW = DAY; // tasks due within 24h count as "due soon"

async function api(method, url, body) {
  const opts = { method, headers: {}, credentials: "same-origin" };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function taskState(t) {
  if (t.status === "done") return "done";
  const ms = new Date(t.due_at) - Date.now();
  if (ms < 0) return "overdue";
  if (ms <= SOON_WINDOW) return "soon";
  return "open";
}

function relTime(isoStr) {
  const ms = new Date(isoStr) - Date.now();
  const abs = Math.abs(ms);
  if (abs < MIN) return ms >= 0 ? "due now" : "just passed";
  const span = abs < HOUR ? `${Math.round(abs / MIN)}m`
    : abs < DAY ? `${Math.round(abs / HOUR)}h`
    : `${Math.round(abs / DAY)}d`;
  return ms >= 0 ? `in ${span}` : `${span} overdue`;
}

function ago(isoStr) {
  const ms = Date.now() - new Date(isoStr);
  if (ms < MIN) return "just now";
  if (ms < HOUR) return `${Math.round(ms / MIN)}m ago`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h ago`;
  return `${Math.round(ms / DAY)}d ago`;
}

const fmtDate = (isoStr) => new Date(isoStr).toLocaleString(undefined,
  { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function toLocalInput(date) {
  const d = new Date(date);
  return new Date(d - d.getTimezoneOffset() * MIN).toISOString().slice(0, 16);
}

function defaultDeadline() {
  const d = new Date(Date.now() + DAY);
  d.setHours(17, 0, 0, 0);
  return toLocalInput(d);
}

let toastTimer;
function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `show ${isError ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 3200);
}

function formError(form, msg) {
  let el = $(".form-error", form);
  if (!el) {
    el = document.createElement("p");
    el.className = "error form-error";
    el.setAttribute("aria-live", "polite");
    form.querySelector("[type=submit]").before(el);
  }
  el.textContent = msg;
}

// ---------- state ----------
const state = {
  me: null,
  members: [],
  tasks: [],
  view: "open",
  memberFilter: "all",
  query: "",
  authMode: "login",
  signupCodeRequired: false,
  page: location.hash === "#stock" ? "stock" : "tasks", // "tasks" or "stock" (gifts & giveaways)
};
const app = $("#app");
const isLeader = () => state.me?.role === "leader" || !!state.me?.can_lead; // sub-leaders lead a team too

// ---------- sign in / sign up ----------
function renderAuth() {
  const signup = state.authMode === "signup";
  document.title = APP_NAME;
  app.innerHTML = `
  <main class="auth">
    <div class="auth-card">
      <div class="brand"><span class="logo" aria-hidden="true">✓</span> <span class="brand-name"><span class="brand-zain">Zain</span> Team Tasks</span></div>
      <p class="muted">${signup
        ? "Create a manager account. You'll add your team leaders after you sign in."
        : "Sign in to see your tasks and deadlines."}</p>
      <div class="seg full" role="tablist">
        <button type="button" class="${signup ? "" : "active"}" data-action="auth-mode" data-mode="login">Sign in</button>
        <button type="button" class="${signup ? "active" : ""}" data-action="auth-mode" data-mode="signup">New manager</button>
      </div>
      <form data-form="${signup ? "signup" : "login"}" class="stack">
        ${signup && state.signupCodeRequired ? `<label>Invite code<input name="invite_code" required autocomplete="off"
          placeholder="Given to you by the app owner"></label>` : ""}
        ${signup ? `<label>Your name<input name="name" required maxlength="80" autocomplete="name"></label>` : ""}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Password<input name="password" type="password" required minlength="6"
          autocomplete="${signup ? "new-password" : "current-password"}"></label>
        <button class="btn primary" type="submit">${signup ? "Create account" : "Sign in"}</button>
      </form>
      ${signup ? "" : `<p class="muted small">Team leader or team member? The person you report to creates your account and gives you your sign-in details.</p>`}
    </div>
  </main>`;
  $("input", app)?.focus();
}

// ---------- main app shell ----------
function taskFields() {
  return `
  <label>Title<input name="title" required maxlength="140" placeholder="What needs to be done?"></label>
  <label>Assign to<select name="assignee_id" class="assignee-select" required></select></label>
  <div class="row2">
    <label>Deadline<input name="due_at" type="datetime-local" required></label>
    <label>Priority<select name="priority">
      <option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option>
    </select></label>
  </div>
  <label>Details <span class="muted">(optional)</span><textarea name="description" rows="3" maxlength="2000"></textarea></label>`;
}

function roleLabel() {
  const me = state.me;
  if (me.role === "leader") return "Manager";
  if (me.can_lead) return `Team leader · reports to ${esc(me.leader_name || "your leader")}`;
  return `Team of ${esc(me.leader_name || "your leader")}`;
}

function topbar() {
  const nav = state.me.stock_access ? `
    <nav class="pages" aria-label="Sections">
      <button type="button" data-action="page" data-page="tasks" class="${state.page === "tasks" ? "active" : ""}"
        aria-current="${state.page === "tasks" ? "page" : "false"}">Tasks</button>
      <button type="button" data-action="page" data-page="stock" class="${state.page === "stock" ? "active" : ""}"
        aria-current="${state.page === "stock" ? "page" : "false"}">Gifts stock</button>
    </nav>` : "";
  return `
  <header class="topbar">
    <div class="brand"><span class="logo" aria-hidden="true">✓</span> <span class="brand-name"><span class="brand-zain">Zain</span> Team Tasks</span></div>
    ${nav}
    <div class="who">
      <span class="who-name">${esc(state.me.name)}</span>
      <span class="chip">${roleLabel()}</span>
      <button type="button" class="btn ghost" data-action="logout">Sign out</button>
    </div>
  </header>`;
}

function renderShell() {
  if (!state.me.stock_access) state.page = "tasks";
  if (state.page === "stock") return renderStockShell(); // stock.js
  document.title = APP_NAME;
  const leader = isLeader();
  app.innerHTML = `
  ${topbar()}
  <main class="wrap">
    <div id="notify-prompt"></div>
    <div id="banner"></div>
    <section id="stats" class="stats" aria-label="Summary"></section>
    <div class="layout ${leader ? "" : "single"}">
      <section class="panel">
        <div class="panel-head">
          <h2>${leader ? "Team tasks" : "My tasks"}</h2>
          <div class="filters">
            <div class="seg" id="view-tabs" role="tablist"></div>
            ${leader ? `<select id="member-filter" aria-label="Filter by team member"></select>` : ""}
          </div>
        </div>
        <div class="search">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>
          <input id="task-search" type="search" placeholder="Search tasks${leader ? ", people" : ""} or details…  ( / )"
            aria-label="Search tasks" autocomplete="off">
          <button type="button" class="search-clear" data-action="clear-search" aria-label="Clear search" hidden>✕</button>
        </div>
        <p id="search-info" class="muted small search-info" hidden></p>
        <ul id="task-list" class="tasks"></ul>
      </section>
      ${leader ? `
      <aside class="side">
        <section class="panel">
          <h2>Assign a task</h2>
          <form data-form="task-create" class="stack">
            ${taskFields()}
            <button class="btn primary" type="submit">Add task</button>
          </form>
        </section>
        <section class="panel">
          <h2>My team</h2>
          <ul id="team-list" class="team"></ul>
          <details class="add-member" id="add-member">
            <summary>+ Add ${state.me.role === "leader" ? "team leader" : "team member"}</summary>
            <form data-form="member-create" class="stack">
              <label>Name<input name="name" required maxlength="80"></label>
              <label>Email<input name="email" type="email" required autocomplete="off"></label>
              <label>Temporary password<input name="password" type="text" required minlength="6" autocomplete="off"></label>
              <label class="check"><input type="checkbox" name="can_lead" ${state.me.role === "leader" ? "checked" : ""}>
                Team leader (adds their own team and assigns tasks)</label>
              <button class="btn" type="submit">Add member</button>
              <p class="muted small">Share the email and password with them so they can sign in.</p>
            </form>
          </details>
        </section>
      </aside>
      <dialog id="cascade-dialog">
        <form data-form="cascade" class="stack">
          <h2>Cascade to my team</h2>
          <p class="muted small cascade-intro"></p>
          <div class="cascade-head">
            <span class="small"><strong>Who gets a copy?</strong></span>
            <button type="button" class="btn ghost small" data-action="cascade-all">Select all</button>
          </div>
          <ul class="cascade-list"></ul>
          <label>Deadline for your team
            <input name="due_at" type="datetime-local" required>
            <span class="muted small hint">Can be earlier than yours, not later.</span>
          </label>
          <div class="dialog-actions">
            <button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>
            <button type="submit" class="btn primary">Send</button>
          </div>
        </form>
      </dialog>` : ""}
      <dialog id="edit-dialog">
        <form data-form="task-edit" class="stack">
          <h2>Edit task</h2>
          ${taskFields()}
          <label class="check"><input type="checkbox" name="done"> Marked as done</label>
          <p class="muted small edit-note"></p>
          <div class="dialog-actions">
            <button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>
            <button type="submit" class="btn primary">Save changes</button>
          </div>
        </form>
      </dialog>
    </div>
  </main>`;

  const search = $("#task-search");
  search.value = state.query;
  search.addEventListener("input", () => {
    state.query = search.value;
    renderTasks();
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { search.value = ""; state.query = ""; renderTasks(); }
  });

  if (leader) {
    $('[data-form="task-create"] [name="due_at"]').value = defaultDeadline();
    $("#member-filter").addEventListener("change", (e) => {
      state.memberFilter = e.target.value;
      renderTasks();
    });
  }
}

// ---------- data-driven sections ----------
function counts() {
  const c = { open: 0, soon: 0, overdue: 0, done: 0 };
  for (const t of state.tasks) {
    const s = taskState(t);
    if (s === "done") c.done++;
    else {
      c.open++;
      if (s === "soon") c.soon++;
      if (s === "overdue") c.overdue++;
    }
  }
  return c;
}

function renderStats(c) {
  $("#stats").innerHTML = [
    ["Open", c.open, "open"],
    ["Due in 24h", c.soon, "soon"],
    ["Overdue", c.overdue, "overdue"],
    ["Done", c.done, "done"],
  ].map(([label, n, view]) => `
    <button type="button" class="stat ${view} ${state.view === view ? "active" : ""}" data-action="view" data-view="${view}">
      <span class="stat-n">${n}</span><span class="stat-l">${label}</span>
    </button>`).join("");
}

function renderBanner(c) {
  const parts = [];
  if (c.overdue) parts.push(`<strong>${c.overdue}</strong> overdue`);
  if (c.soon) parts.push(`<strong>${c.soon}</strong> due in the next 24 hours`);
  $("#banner").innerHTML = parts.length ? `
    <div class="banner ${c.overdue ? "overdue" : "soon"}" role="alert">
      <span class="bell" aria-hidden="true">🔔</span>
      <span>Reminder: ${parts.join(" and ")}.</span>
      <button type="button" class="btn small" data-action="view" data-view="${c.overdue ? "overdue" : "soon"}">Show</button>
    </div>` : "";
  document.title = c.overdue + c.soon ? `(${c.overdue + c.soon}) ${APP_NAME}` : APP_NAME;
}

function renderNotifyPrompt() {
  const el = $("#notify-prompt");
  if (!("Notification" in window) || Notification.permission !== "default") {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div class="notice">
      <span>Get a desktop alert when a task is due within 24 hours or becomes overdue.</span>
      <button type="button" class="btn small" data-action="enable-notify">Turn on reminders</button>
    </div>`;
}

const VIEWS = [["open", "Open"], ["soon", "Due soon"], ["overdue", "Overdue"], ["done", "Done"], ["all", "All"]];

function renderViewTabs() {
  $("#view-tabs").innerHTML = VIEWS.map(([v, label]) =>
    `<button type="button" role="tab" aria-selected="${state.view === v}" class="${state.view === v ? "active" : ""}"
      data-action="view" data-view="${v}">${label}</button>`).join("");
}

const norm = (s) => String(s ?? "").toLocaleLowerCase();
const searchTerms = () => norm(state.query).split(/\s+/).filter(Boolean);

function matchesSearch(t, terms) {
  const haystack = norm(`${t.title} ${t.description} ${t.assignee_name} ${t.priority}`);
  return terms.every((term) => haystack.includes(term));
}

// Escape text and wrap search matches in <mark>.
function hl(text) {
  const terms = searchTerms();
  const raw = String(text ?? "");
  if (!terms.length) return esc(raw);
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return raw.split(pattern).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join("");
}

function visibleTasks() {
  const terms = searchTerms();
  return state.tasks
    .filter((t) => state.memberFilter === "all" || String(t.assignee_id) === state.memberFilter)
    .filter((t) => !terms.length || matchesSearch(t, terms))
    .filter((t) => {
      if (terms.length) return true; // a search looks through every status
      const s = taskState(t);
      switch (state.view) {
        case "open": return s !== "done";
        case "soon": return s === "soon";
        case "overdue": return s === "overdue";
        case "done": return s === "done";
        default: return true;
      }
    })
    .sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
      if (a.status === "done") return (b.done_at || "").localeCompare(a.done_at || "");
      return a.due_at.localeCompare(b.due_at);
    });
}

function childStatus(c) {
  if (c.status === "done") return "done";
  return new Date(c.due_at) < Date.now() ? "overdue" : "open";
}

function cascadeProgress(t) {
  const kids = t.children || [];
  if (!kids.length) return "";
  const done = kids.filter((c) => c.status === "done").length;
  const pct = Math.round((done / kids.length) * 100);
  return `
      <div class="cascade-progress" aria-label="${done} of ${kids.length} cascaded copies done">
        <div class="cp-top">
          <span class="cp-label">⤵ Cascaded · <strong>${done} of ${kids.length} done</strong></span>
          <span class="cp-bar"><span data-pct="${pct}"></span></span>
        </div>
        <div class="cp-people">${kids.map((c) => {
          const cs = childStatus(c);
          return `<span class="cp-person ${cs}" title="${cs === "done" ? "Done" : cs === "overdue" ? "Overdue" : "Open"}">${cs === "done" ? "✓" : cs === "overdue" ? "!" : "•"} ${hl(c.assignee_name)}</span>`;
        }).join("")}</div>
      </div>`;
}

function taskItem(t) {
  const s = taskState(t);
  const leader = isLeader();
  const done = t.status === "done";
  const forSelf = t.assignee_id === state.me.id;
  const mine = t.leader_id === state.me.id;              // I assigned it, so I can edit or delete it
  const received = forSelf && !mine;                     // someone above me assigned it
  const kids = t.children || [];
  const auto = kids.length > 0;                           // completes by itself from its cascaded copies
  const canCascade = received && leader && state.members.length > 0;
  const dueText = done
    ? `Done${t.done_at ? ` ${esc(fmtDate(t.done_at))}` : ""} · deadline was ${esc(fmtDate(t.due_at))}`
    : `Due ${esc(fmtDate(t.due_at))} · <strong>${relTime(t.due_at)}</strong>`;
  const checkTitle = auto ? "Completes automatically when everyone it was cascaded to is done"
    : done ? "Mark as not done" : "Mark as done";
  return `
  <li class="task ${s}" data-id="${t.id}">
    <button type="button" class="check-btn ${done ? "checked" : ""} ${auto ? "auto" : ""}" data-action="toggle"
      aria-label="${checkTitle}" title="${checkTitle}" ${auto ? "disabled" : ""}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7"/></svg>
    </button>
    <div class="task-body">
      <div class="task-title">${hl(t.title)}
        ${t.priority !== "normal" ? `<span class="prio ${t.priority}">${t.priority}</span>` : ""}
      </div>
      ${t.description ? `<p class="task-desc">${hl(t.description)}</p>` : ""}
      <div class="task-meta">
        ${received && leader ? `<span class="from">From ${hl(t.leader_name)}</span>` : ""}
        ${leader && mine ? `<span class="person">${forSelf ? "Me" : hl(t.assignee_name)}</span>` : ""}
        <span class="due">${dueText}</span>
        ${t.updated_by && t.updated_by !== state.me.id && t.updated_by_name ? `
        <span class="edited" title="Last edited ${esc(fmtDate(t.updated_at))}">✎ Edited by ${hl(t.updated_by_name)} · ${ago(t.updated_at)}</span>` : ""}
      </div>
      ${cascadeProgress(t)}
    </div>
    <div class="task-actions">
      ${canCascade ? `<button type="button" class="btn small cascade-btn" data-action="cascade">⤵ ${auto ? "Cascade more" : "Cascade"}</button>` : ""}
      ${mine || forSelf ? `<button type="button" class="btn ghost small" data-action="edit">Edit</button>` : ""}
      ${mine ? `<button type="button" class="btn ghost small danger" data-action="delete">Delete</button>` : ""}
    </div>
  </li>`;
}

function renderTasks() {
  const list = visibleTasks();
  const empty = {
    open: isLeader() ? "No open tasks. Use “Assign a task” to add one." : "You're all caught up. No open tasks.",
    soon: "Nothing due in the next 24 hours.",
    overdue: "Nothing overdue. Nice work.",
    done: "No completed tasks yet.",
    all: "No tasks yet.",
  }[state.view];
  const searching = searchTerms().length > 0;
  const info = $("#search-info");
  info.hidden = !searching;
  $(".search-clear").hidden = !searching;
  $("#view-tabs").classList.toggle("dimmed", searching);
  if (searching) {
    info.textContent = `${list.length} ${list.length === 1 ? "task matches" : "tasks match"} “${state.query.trim()}” across all statuses`;
  }
  const emptyText = searching ? "No tasks match your search." : empty;
  $("#task-list").innerHTML = list.length ? list.map(taskItem).join("") : `<li class="empty">${emptyText}</li>`;
  // Inline style attributes are blocked by the page's security policy, so size the bars here.
  for (const bar of $$(".cp-bar span[data-pct]")) bar.style.width = `${bar.dataset.pct}%`;
}

function renderTeam() {
  $("#team-list").innerHTML = state.members.length ? state.members.map((m) => `
    <li data-member-id="${m.id}">
      <div class="avatar" aria-hidden="true">${esc(m.name.trim().charAt(0).toUpperCase())}</div>
      <div class="member-info">
        <div class="member-name">${esc(m.name)}
          ${m.can_lead ? `<span class="lead-badge">Team leader${m.team_size ? ` · leads ${m.team_size}` : ""}</span>` : ""}</div>
        <div class="muted small">${esc(m.email)}</div>
        <div class="member-counts small">
          <span>${m.open_count} open</span>
          ${m.overdue_count ? `<span class="bad">${m.overdue_count} overdue</span>` : ""}
          <span class="muted">${m.done_count} done</span>
        </div>
      </div>
      <div class="member-actions">
        <button type="button" class="btn ghost small" data-action="toggle-lead"
          title="${m.can_lead ? "Stop them from leading their own team" : "Let them add their own team and cascade your tasks to it"}">
          ${m.can_lead ? "Remove leader role" : "Make team leader"}</button>
        <button type="button" class="btn ghost small" data-action="reset-pw">Reset password</button>
        <button type="button" class="btn ghost small danger" data-action="remove-member">Remove</button>
      </div>
    </li>`).join("") : `<li class="empty small">No team members yet. Add your first one below.</li>`;
  if (!state.members.length) $("#add-member").open = true;
}

function fillAssignees() {
  const options = [`<option value="${state.me.id}">Me (${esc(state.me.name)})</option>`]
    .concat(state.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`)).join("");
  for (const sel of $$(".assignee-select")) {
    const prev = sel.value;
    sel.innerHTML = options;
    if (prev && $$("option", sel).some((o) => o.value === prev)) sel.value = prev;
    else if (state.members.length && sel.closest('[data-form="task-create"]')) sel.value = String(state.members[0].id);
  }
  const filter = $("#member-filter");
  filter.innerHTML = `<option value="all">Everyone</option>` +
    `<option value="${state.me.id}">Me</option>` +
    state.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
  if (![...filter.options].some((o) => o.value === state.memberFilter)) state.memberFilter = "all";
  filter.value = state.memberFilter;
}

function renderData() {
  const c = counts();
  renderNotifyPrompt();
  renderBanner(c);
  renderStats(c);
  renderViewTabs();
  if (isLeader()) {
    renderTeam();
    fillAssignees();
  }
  renderTasks();
}

// ---------- reminders (desktop notifications while the app is open) ----------
function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem("tt_notified") || "{}"); } catch { /* storage unavailable */ }
  for (const t of state.tasks) {
    const s = taskState(t);
    if (s !== "soon" && s !== "overdue") continue;
    const key = `${state.me.id}:${t.id}:${s}:${t.due_at}`;
    if (seen[key]) continue;
    seen[key] = Date.now();
    const who = isLeader() && t.assignee_id !== state.me.id ? ` · ${t.assignee_name}` : "";
    try {
      new Notification(s === "overdue" ? "Task overdue" : "Task due soon", {
        body: `${t.title}${who} (${relTime(t.due_at)})`,
        tag: key,
      });
    } catch { /* some browsers only allow notifications from a service worker */ }
  }
  // forget entries older than 30 days
  const cutoff = Date.now() - 30 * DAY;
  for (const k of Object.keys(seen)) if (seen[k] < cutoff) delete seen[k];
  try { localStorage.setItem("tt_notified", JSON.stringify(seen)); } catch { /* ignore */ }
}

// ---------- loading ----------
async function refresh() {
  try {
    const { user } = await api("GET", "/api/me");
    const wasLeader = isLeader();
    const hadStock = state.me?.stock_access;
    state.me = user;
    if (isLeader() !== wasLeader || user.stock_access !== hadStock) renderShell(); // access changed since the page was drawn
    if (state.page === "stock") return await refreshStock(); // stock.js
    const [{ tasks }, members] = await Promise.all([
      api("GET", "/api/tasks"),
      isLeader() ? api("GET", "/api/members") : Promise.resolve(null),
    ]);
    state.tasks = tasks;
    if (members) state.members = members.members;
    renderData();
    checkReminders();
  } catch (err) {
    if (err.status === 401) {
      state.me = null;
      renderAuth();
    } else {
      toast(err.message, true);
    }
  }
}

function enterApp(user) {
  state.me = user;
  state.view = "open";
  state.memberFilter = "all";
  renderShell();
  return refresh();
}

async function boot() {
  if (location.hash.startsWith("#share=")) return bootShared(location.hash.slice(7)); // manager's read-only link
  try {
    state.signupCodeRequired = (await api("GET", "/api/config")).signup_code_required;
  } catch { /* older server or offline: show the default sign-up form */ }
  try {
    const { user } = await api("GET", "/api/me");
    await enterApp(user);
  } catch (err) {
    if (err.status === 401) renderAuth();
    else app.innerHTML = `<p class="error loading">Could not reach the server: ${esc(err.message)}</p>`;
  }
}

// ---------- events ----------
function openEdit(task) {
  const dialog = $("#edit-dialog");
  const form = $("form", dialog);
  const mine = task.leader_id === state.me.id;   // only the assigner can hand it to someone else
  const auto = (task.children || []).length > 0; // completes from its cascaded copies
  form.dataset.taskId = task.id;
  form.elements.title.value = task.title;
  const assignee = form.elements.assignee_id;
  assignee.disabled = !mine;                      // disabled fields aren't sent
  assignee.closest("label").hidden = !mine;
  if (mine) assignee.value = String(task.assignee_id);
  form.elements.due_at.value = toLocalInput(task.due_at);
  form.elements.priority.value = task.priority;
  form.elements.description.value = task.description;
  form.elements.done.checked = task.status === "done";
  form.elements.done.disabled = auto;
  form.elements.done.closest("label").title = auto ? "Completes automatically when everyone it was cascaded to is done" : "";
  $(".edit-note", form).textContent = mine ? "" :
    `Assigned by ${task.leader_name}. They'll see that you edited it.`;
  $(".form-error", form)?.remove();
  dialog.showModal();
}

function updateCascadeButton() {
  const n = $$('#cascade-dialog input[name="member"]:checked:not(:disabled)').length;
  const btn = $('#cascade-dialog [type="submit"]');
  btn.textContent = n ? `Send to ${n} ${n === 1 ? "person" : "people"}` : "Send";
  btn.disabled = n === 0;
}

function openCascade(task) {
  const dialog = $("#cascade-dialog");
  const form = $("form", dialog);
  form.dataset.taskId = task.id;
  const has = new Set((task.children || []).map((c) => c.assignee_id));
  $(".cascade-intro", dialog).innerHTML =
    `<strong>${esc(task.title)}</strong> from ${esc(task.leader_name)}, due ${esc(fmtDate(task.due_at))}. ` +
    "Each person gets their own copy. Your task completes when all of them are done.";
  $(".cascade-list", dialog).innerHTML = state.members.map((m) => `
    <li><label class="check">
      <input type="checkbox" name="member" value="${m.id}" ${has.has(m.id) ? "checked disabled" : ""}>
      <span>${esc(m.name)}</span>
      ${has.has(m.id) ? `<span class="muted small">already has it</span>` : ""}
    </label></li>`).join("");
  const due = form.elements.due_at;
  due.value = toLocalInput(task.due_at);
  due.max = toLocalInput(task.due_at);
  $(".form-error", form)?.remove();
  updateCascadeButton();
  dialog.showModal();
}

app.addEventListener("change", (e) => {
  if (e.target.matches('#cascade-dialog input[name="member"]')) updateCascadeButton();
});

app.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const taskId = Number(el.closest("[data-id]")?.dataset.id);
  const task = state.tasks.find((t) => t.id === taskId);
  const memberId = Number(el.closest("[data-member-id]")?.dataset.memberId);
  const member = state.members.find((m) => m.id === memberId);

  try {
    switch (action) {
      case "auth-mode":
        state.authMode = el.dataset.mode;
        renderAuth();
        break;
      case "page":
        state.page = el.dataset.page;
        history.replaceState(null, "", state.page === "stock" ? "#stock" : location.pathname);
        renderShell();
        await refresh();
        break;
      case "logout":
        await api("POST", "/api/logout", {});
        state.me = null;
        state.tasks = [];
        state.members = [];
        state.authMode = "login";
        renderAuth();
        break;
      case "clear-search":
        state.query = "";
        $("#task-search").value = "";
        renderTasks();
        $("#task-search").focus();
        break;
      case "view":
        state.view = el.dataset.view;
        if (state.query) { state.query = ""; $("#task-search").value = ""; }
        renderData();
        break;
      case "enable-notify":
        await Notification.requestPermission();
        renderNotifyPrompt();
        checkReminders();
        break;
      case "toggle": {
        if (!task) return;
        const status = task.status === "done" ? "open" : "done";
        el.disabled = true;
        const { task: updated } = await api("PATCH", `/api/tasks/${task.id}`, { status });
        Object.assign(task, updated);
        renderData();
        toast(status === "done" ? "Marked as done ✓" : "Marked as not done");
        if (isLeader()) refresh();
        break;
      }
      case "edit":
        if (task) openEdit(task);
        break;
      case "delete":
        if (task && confirm(`Delete "${task.title}"? This can't be undone.`)) {
          await api("DELETE", `/api/tasks/${task.id}`);
          toast("Task deleted");
          await refresh();
        }
        break;
      case "close-dialog":
        el.closest("dialog")?.close();
        break;
      case "cascade":
        if (task) openCascade(task);
        break;
      case "cascade-all":
        for (const box of $$('#cascade-dialog input[name="member"]:not(:disabled)')) box.checked = true;
        updateCascadeButton();
        break;
      case "toggle-lead": {
        if (!member) return;
        const makeLead = !member.can_lead;
        if (makeLead && !confirm(`Make ${member.name} a team leader?\n\nThey'll be able to add their own team members, assign tasks to themselves and their team, and cascade the tasks you give them.`)) return;
        await api("PATCH", `/api/members/${member.id}`, { can_lead: makeLead });
        toast(makeLead ? `${member.name} can now lead a team` : `${member.name} is no longer a team leader`);
        await refresh();
        break;
      }
      case "reset-pw": {
        if (!member) return;
        const pw = prompt(`New password for ${member.name} (at least 6 characters):`);
        if (pw === null) return;
        await api("PATCH", `/api/members/${member.id}`, { password: pw });
        toast(`Password updated for ${member.name}`);
        break;
      }
      case "remove-member":
        if (member && confirm(`Remove ${member.name} from your team? Their account and all their tasks will be deleted.` +
            (member.team_size ? `\n\n${member.name} leads ${member.team_size} ${member.team_size === 1 ? "person" : "people"}. Their whole team will be removed too.` : ""))) {
          await api("DELETE", `/api/members/${member.id}`);
          toast(`${member.name} removed`);
          await refresh();
        }
        break;
    }
  } catch (err) {
    if (err.status === 401) { state.me = null; renderAuth(); }
    else toast(err.message, true);
    if (el.isConnected) el.disabled = false;
  }
});

function taskPayload(fd) {
  const payload = {
    title: fd.title,
    due_at: new Date(fd.due_at).toISOString(), // datetime-local is local time → send UTC
    priority: fd.priority,
    description: fd.description || "",
  };
  if (fd.assignee_id) payload.assignee_id = Number(fd.assignee_id); // absent when the field is locked
  return payload;
}

app.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(form));
  const btn = $("[type=submit]", form);
  btn.disabled = true;
  try {
    switch (form.dataset.form) {
      case "login":
      case "signup": {
        const { user } = await api("POST", `/api/${form.dataset.form}`, fd);
        await enterApp(user);
        break;
      }
      case "task-create": {
        const { task } = await api("POST", "/api/tasks", taskPayload(fd));
        form.elements.title.value = "";
        form.elements.description.value = "";
        form.elements.priority.value = "normal";
        form.elements.due_at.value = defaultDeadline();
        toast(`Task assigned to ${task.assignee_id === state.me.id ? "you" : task.assignee_name}`);
        await refresh();
        form.elements.title.focus();
        break;
      }
      case "task-edit": {
        const id = form.dataset.taskId;
        const changes = taskPayload(fd);
        if (!form.elements.done.disabled) changes.status = form.elements.done.checked ? "done" : "open";
        await api("PATCH", `/api/tasks/${id}`, changes);
        $("#edit-dialog").close();
        toast("Task updated");
        await refresh();
        break;
      }
      case "cascade": {
        const ids = $$('input[name="member"]:checked:not(:disabled)', form).map((b) => Number(b.value));
        const { created } = await api("POST", `/api/tasks/${form.dataset.taskId}/cascade`, {
          assignee_ids: ids,
          due_at: new Date(form.elements.due_at.value).toISOString(),
        });
        $("#cascade-dialog").close();
        toast(`Cascaded to ${created} ${created === 1 ? "person" : "people"}`);
        await refresh();
        break;
      }
      case "member-create": {
        fd.can_lead = form.elements.can_lead.checked;
        const { member } = await api("POST", "/api/members", fd);
        form.reset();
        toast(`${member.name} added to your team${member.can_lead ? " as a team leader" : ""}`);
        await refresh();
        break;
      }
    }
  } catch (err) {
    if (err.status === 401 && state.me) { state.me = null; renderAuth(); return; }
    if (form.isConnected) formError(form, err.message);
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
});

// Press "/" anywhere (outside a text field) to jump to search.
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest?.("input, textarea, select, [contenteditable]");
  if (e.key === "/" && !typing && $("#task-search") && !$("dialog[open]")) {
    e.preventDefault();
    $("#task-search").focus();
  }
});

// Keep data and reminders fresh: poll every minute and when the tab regains focus.
setInterval(() => { if (state.me) refresh(); }, 60_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.me) refresh(); });

// stock.js loads after this file; wait for it before starting.
document.addEventListener("DOMContentLoaded", boot);
