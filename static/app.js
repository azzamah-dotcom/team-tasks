"use strict";
// Official Zain logo (Brand Guidelines 2025), white via currentColor.
const ZAIN_LOGO = `<svg class="zn-logo" viewBox="153 226 530 142" fill="currentColor" role="img" aria-label="Zain"><title>Zain</title><path d="M561.94,359.04v-81.45c0-6.35-1.68-10.64-4.8-13.8c-3.34-3.38-8.27-5.21-14.2-5.21c-0.45,0-1.03,0-1.46,0.06v81.45 c0,6.3,1.66,10.62,4.8,13.77c3.3,3.36,8.27,5.22,14.16,5.22C560.9,359.08,561.45,359.08,561.94,359.04L561.94,359.04z M563.81,238.86c0-6.65-5.42-12.06-12.1-12.06c-6.67,0-12.09,5.41-12.09,12.06c0,6.7,5.42,12.13,12.09,12.13 C558.39,250.99,563.81,245.55,563.81,238.86L563.81,238.86z M502.48,319.57v20.52c0,6.3,1.66,10.62,4.82,13.77 c3.31,3.36,8.3,5.22,14.19,5.22c0.48,0,1.01,0,1.49-0.04v-43.76c0-18.83-5.13-31.5-14.27-41.36c-9.41-10.12-23.49-15.98-39.78-15.98 c-31.27,0-52.93,22.89-52.93,52.71c0,29.3,20.06,48.85,46.08,48.85c20.06,0,32.11-11.93,32.11-25.92c0-5.22-1.64-10.82-5.21-16.14 c-2.89,15.04-11.21,23.31-24.6,23.31c-14.3,0-26.88-10.85-26.88-30.62c0-19.44,12.61-32.73,31.5-32.73c9.46,0,17.06,3.3,22.81,8.95 C498.54,293.06,502.48,303.33,502.48,319.57L502.48,319.57z M662.35,332.14c-0.23,0-0.42-0.13-0.62-0.39 c-14.69-19.13-41.67-54.39-47.52-62.09c-6.19-8.05-11.03-10.7-17.43-10.7c-4.73,0-8.55,1.74-11.18,4.53 c-2.94,3.14-4.41,8-4.41,13.52v63.08c0,6.3,1.63,10.62,4.8,13.77c3.33,3.36,8.08,5.22,13.84,5.22c0.45,0,0.75,0,1.16-0.04v-72.32 c0-0.52,0.23-0.81,0.58-0.81c0.26,0,0.42,0.12,0.62,0.42c8.62,11.21,41.32,53.97,47.58,62.01c6.19,8.04,11.01,10.75,17.37,10.75 c4.76,0,8.59-1.72,11.19-4.5c2.92-3.15,4.42-7.95,4.42-13.52v-63.1c0-6.3-1.68-10.63-4.82-13.82c-3.34-3.33-8.05-5.18-13.87-5.18 c-0.4,0-0.71,0-1.14,0.03v72.37C662.93,331.88,662.69,332.14,662.35,332.14L662.35,332.14z M340.21,339.69 c-0.81,0-1.27-0.27-1.27-0.81c0-0.29,0.23-0.65,0.69-1.01c6.29-5.09,47.9-38.66,54.25-43.88c11.03-8.88,13.35-13.22,13.35-19.52 c0-3.93-1.84-7.72-4.61-10.04c-3.34-2.83-8.33-4.37-16.4-4.37h-70.88c0,0.35,0,0.75,0,1.13c0,3.67,0.8,7.67,2.62,10.3 c2.86,4.11,8.27,6.48,15.58,6.48h46.52c0.82,0,1.27,0.25,1.27,0.67c0,0.36-0.2,0.61-0.72,1c-6.58,5.34-44.99,36.33-54.57,43.98 c-11.06,8.88-13.26,13.3-13.26,19.6c0,3.91,1.85,7.69,4.63,9.99c3.34,2.85,8.34,4.41,16.44,4.41h74.13c0-0.3,0-0.48,0-0.71 c0-5.26-1.49-9.79-4.64-12.65c-3.62-3.34-8.3-4.56-17.08-4.56H340.21L340.21,339.69z"/><path d="M266.3,279.57c0-11.8-9.08-20.74-22.04-19.74c-27.5,2.11-31.05,33.39-13.15,35.39c18.71,2.09,25.41-17.7,25.77-18.81 c0-0.01,0.02-0.01,0.02,0c0.04,1.34,1.04,28.57-26.73,28.57c-14.43,0-21.86-11.79-21.86-22.01c0-15.15,14.74-30.22,35.53-31.02 c11.65-0.45,19.32,2.3,25.33,8.31c12.25,12.25,8.72,35.22-1.19,46.56c-15.74,18-37.86,22.58-58.47,13.34s-28-36-15.51-58.39 c4.59-8.23,21.28-26.58,49.95-26.58c36.4,0,54.86,25.8,51.53,56.11c-2.55,23.22-16.66,40.05-23.2,47.15 c-28.73,31.23-70.96,37.45-97.56,21.21c-14.64-8.94-23.16-24.98-21.27-43.14c1.62,13.11,8.16,24.46,19.04,31.87 c21.75,14.83,58.11,16.87,84.4-12.04c-26.42,19.73-57.28,19.44-78.36,5.7c-19.34-12.6-24.66-37.75-15.19-62.63 c-4.75,22.18,2.88,42.74,19.66,53.46c26.15,16.7,64.24,7.1,88.24-19.8c8.18-9.17,12.87-21.53,12.72-32.81 c-0.25-18.81-13.36-35.7-39.83-35.7c-27.17,0-45.83,21-45.83,38.48c0,19.4,13.32,30.48,30.69,30.48 C246.17,313.54,266.3,302.7,266.3,279.57z"/></svg>`;


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
      <div class="brand">${ZAIN_LOGO}<span class="brand-sep" aria-hidden="true"></span><span class="brand-name">Team Tasks</span></div>
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
    <div class="brand">${ZAIN_LOGO}<span class="brand-sep" aria-hidden="true"></span><span class="brand-name">Team Tasks</span></div>
    ${nav}
    <div class="who">
      <span class="who-name">${esc(state.me.name)}</span>
      <span class="chip">${roleLabel()}</span>
      <button type="button" class="btn ghost bell-btn ${push.subscribed ? "on" : ""}" data-action="push-open"
        aria-label="Phone notifications${push.subscribed ? " (on)" : ""}" title="Phone notifications">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>
      </button>
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
  if (!el) return;
  let dismissed = false;
  try { dismissed = localStorage.getItem("tt_push_prompt") === "no"; } catch { /* storage unavailable */ }
  const what = isLeader() ? "you get a new task, or your team finishes, reschedules or edits one"
                          : "you get a new task or one of yours is changed";
  if (push.serverEnabled && !push.subscribed && !dismissed && push.needsInstall) {
    el.innerHTML = `
      <div class="notice">
        <span>Get a notification on your iPhone when ${what}: tap <strong>Share</strong>, then
          <strong>Add to Home Screen</strong>, and open Team Tasks from your home screen.</span>
        <button type="button" class="btn small ghost" data-action="push-dismiss">Not now</button>
      </div>`;
  } else if (push.serverEnabled && push.supported && !push.subscribed && !dismissed
             && Notification.permission !== "denied") {
    el.innerHTML = `
      <div class="notice">
        <span>Get a notification on this device when ${what}.</span>
        <button type="button" class="btn small primary" data-action="push-on">Turn on notifications</button>
        <button type="button" class="btn small ghost" data-action="push-dismiss">Not now</button>
      </div>`;
  } else if (!push.supported && "Notification" in window && Notification.permission === "default") {
    el.innerHTML = `
      <div class="notice">
        <span>Get a desktop alert when a task is due within 24 hours or becomes overdue.</span>
        <button type="button" class="btn small" data-action="enable-notify">Turn on reminders</button>
      </div>`;
  } else {
    el.innerHTML = "";
  }
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
  const canCascade = forSelf && leader;                  // any task on my plate can go down to my team
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

// ---------- phone push notifications ----------
// The server sends a push when someone finishes, reopens, reschedules or edits a task you share.
// On iPhone this only works once Team Tasks is added to the Home Screen (iOS 16.4 or later).
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const push = {
  supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
  needsInstall: false,  // iPhone Safari tab: must be added to the Home Screen first
  serverEnabled: false,
  publicKey: null,
  subscribed: false,
};
push.needsInstall = isIOS && !isStandalone();

function keyBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function pushRegistration() {
  if (!push.supported) return null;
  try {
    await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  } catch { return null; }
}

// Check this device's state, and keep the server's copy of the subscription up to date.
async function syncPush() {
  try {
    const info = await api("GET", "/api/push/key");
    push.serverEnabled = info.enabled;
    push.publicKey = info.public_key || null;
  } catch { push.serverEnabled = false; }
  const reg = push.serverEnabled ? await pushRegistration() : null;
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  push.subscribed = Boolean(sub) && Notification.permission === "granted";
  if (push.subscribed) {
    try { await saveSubscription(sub); } catch { /* try again next time */ }
  }
  updateBell();
  renderNotifyPrompt();
}

function saveSubscription(sub) {
  return api("POST", "/api/push/subscribe", { ...sub.toJSON(), tz_offset: -new Date().getTimezoneOffset() });
}

async function pushTurnOn() {
  if (push.needsInstall) throw new Error("On iPhone, add Team Tasks to your Home Screen first, then open it from there.");
  if (!push.supported) throw new Error("This browser can't receive notifications.");
  const permission = await Notification.requestPermission();  // must come first, straight from the tap
  if (permission !== "granted") {
    throw new Error("Notifications are blocked. Allow them for Team Tasks in your phone or browser settings.");
  }
  const reg = await pushRegistration();
  if (!reg || !push.publicKey) throw new Error("Couldn't set up notifications. Reload and try again.");
  let sub = await reg.pushManager.getSubscription();
  try {
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(push.publicKey) });
  } catch (err) {
    if (err.name !== "InvalidStateError") throw err;   // an old subscription made with a different key
    await sub?.unsubscribe();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(push.publicKey) });
  }
  await saveSubscription(sub);
  push.subscribed = true;
  updateBell();
  renderNotifyPrompt();
}

async function pushTurnOff() {
  const reg = await pushRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await api("POST", "/api/push/unsubscribe", { endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  push.subscribed = false;
  updateBell();
  renderNotifyPrompt();
}

function updateBell() {
  const bell = $(".bell-btn");
  if (!bell) return;
  bell.classList.toggle("on", push.subscribed);
  bell.setAttribute("aria-label", `Phone notifications${push.subscribed ? " (on)" : ""}`);
}

function pushDialog() {
  let dialog = $("#push-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "push-dialog";
    document.body.append(dialog);
    dialog.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-push]");
      if (!btn) return;
      const action = btn.dataset.push;
      if (action === "close") return dialog.close();
      btn.disabled = true;
      try {
        if (action === "on") { await pushTurnOn(); toast("Notifications are on for this device."); }
        if (action === "off") { await pushTurnOff(); toast("Notifications are off for this device."); }
        if (action === "test") { await api("POST", "/api/push/test", {}); toast("Test sent. It should arrive in a few seconds."); }
      } catch (err) {
        toast(err.message, true);
      }
      fillPushDialog();
    });
  }
  return dialog;
}

function fillPushDialog() {
  const dialog = pushDialog();
  const what = isLeader()
    ? "when you're given a new task, and when someone on your team finishes a task, reopens it, moves its deadline or edits it"
    : "when you're given a new task, and when the person who gave it to you changes its deadline or details";
  let status, buttons;
  if (!push.serverEnabled) {
    status = "Phone notifications aren't available on this server yet.";
    buttons = "";
  } else if (push.needsInstall) {
    status = `To get notifications on iPhone, add Team Tasks to your Home Screen: tap <strong>Share</strong>
      <span aria-hidden="true">(the square with an arrow)</span>, then <strong>Add to Home Screen</strong>.
      Open Team Tasks from the new icon and turn notifications on there. Needs iOS 16.4 or later.`;
    buttons = "";
  } else if (!push.supported) {
    status = "This browser can't receive notifications. Try Chrome, Edge, Firefox or Safari.";
    buttons = "";
  } else if (push.subscribed) {
    status = `<strong>On for this device.</strong> You'll get a notification ${what}.`;
    buttons = `<button type="button" class="btn ghost" data-push="off">Turn off</button>
      <button type="button" class="btn primary" data-push="test">Send a test</button>`;
  } else if (Notification.permission === "denied") {
    status = "Notifications are blocked for Team Tasks. Allow them in your phone or browser settings, then come back here.";
    buttons = "";
  } else {
    status = `Get a notification on this device ${what}. Turn it on for each phone or computer you use.`;
    buttons = `<button type="button" class="btn primary" data-push="on">Turn on notifications</button>`;
  }
  dialog.innerHTML = `
    <div class="stack">
      <h2>Phone notifications</h2>
      <p class="push-status">${status}</p>
      <div class="dialog-actions">
        <button type="button" class="btn ghost" data-push="close">Close</button>
        ${buttons}
      </div>
    </div>`;
  return dialog;
}

if (push.supported) {
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "refresh" && state.me) refresh();  // a notification was tapped
  });
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
  syncPush();  // in the background: notification status for this device
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
  if (!state.members.length) {
    toast("Add people to your team first, then cascade this task to them.");
    const add = $("#add-member");
    add.open = true;
    add.scrollIntoView({ behavior: "smooth", block: "center" });
    $("input", add)?.focus();
    return;
  }
  const dialog = $("#cascade-dialog");
  const form = $("form", dialog);
  form.dataset.taskId = task.id;
  const has = new Set((task.children || []).map((c) => c.assignee_id));
  $(".cascade-intro", dialog).innerHTML =
    `<strong>${esc(task.title)}</strong>${task.leader_id === state.me.id ? "" : ` from ${esc(task.leader_name)}`}, due ${esc(fmtDate(task.due_at))}. ` +
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
        if (push.subscribed) {  // stop this person's notifications on this device; signing in again restores them
          try {
            const sub = await (await pushRegistration())?.pushManager.getSubscription();
            if (sub) await api("POST", "/api/push/unsubscribe", { endpoint: sub.endpoint });
          } catch { /* signing out still works */ }
          push.subscribed = false;
        }
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
      case "push-open":
        fillPushDialog().showModal();
        break;
      case "push-on":
        el.disabled = true;
        try {
          await pushTurnOn();
          toast("Notifications are on for this device.");
        } finally { el.disabled = false; }
        break;
      case "push-dismiss":
        try { localStorage.setItem("tt_push_prompt", "no"); } catch { /* storage unavailable */ }
        renderNotifyPrompt();
        toast("You can turn notifications on any time from the bell at the top.");
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
