# Zain Team Tasks

A task tracker for team leaders and their team members, with deadline reminders.

- **Team leaders** sign up, add their team members, assign tasks with a deadline and priority, edit or delete them, and see the whole team's progress.
- **Team members** sign in with the details their leader gave them, see only their own tasks, and mark each one done or not done. They can also **edit** their tasks (title, details, priority, deadline). The leader sees "✎ Edited by …" on the task. Only the person who assigned a task can give it to someone else or delete it, and a cascaded copy can't be moved past the original deadline.
- Each leader's team and tasks are private. Other leaders can't see them.
- **Sub-leaders and cascading:** in **My team**, click **Make team leader** on a member. They can then add their own team. When you give them a task, they click **Cascade** to send a copy to some or all of their people, optionally with an earlier deadline. Your task shows "2 of 5 done" with each person's status and completes by itself when every copy is done. This works through any number of levels (you → supervisors → staff → …).
- **Gifts stock:** the **Gifts stock** tab keeps a private list of gifts and giveaways with photos and the quantity in each location (it starts with HQ Store, Yadaodeh Store, Marketing Store and Marketing Office, which you can rename or add to). In **Locations & people**, tick the team members who fill in each location; they only see the locations you give them and can add items, photos and counts, but not delete. Every quantity change is logged. **Share with manager** creates a read-only link (no sign-in needed) that you can replace or turn off any time. **⬇ Excel** downloads the list as a CSV.
- **Search:** find tasks by title, details or person (press `/` to jump to the search box). Search looks through every status, including done tasks.
- **Stay signed in:** sign-ins last about a year and renew themselves while the app is used, so nobody is signed out unless they click **Sign out** (or their password is reset).
- **Zain look:** colors come from the Zain Branding Kit 2026 (teal, navy, deep navy, magenta, yellow) and follow the device's light or dark mode.
- **Reminders:** the app shows a banner and a counter for tasks due within 24 hours or overdue. Once a user turns on reminders, it also sends a desktop notification while the app is open. Data refreshes every minute.

## Run it

Needs only Python 3.9+, which comes with macOS. Nothing to install.

```bash
cd team-tasks
python3 server.py
```

Open http://127.0.0.1:8000, choose **New team leader**, and create your account.

### Let your team use it on the same network

```bash
HOST=0.0.0.0 python3 server.py
```

Team members then open `http://<your-computer's-IP>:8000`.

## Settings (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Address to listen on (`0.0.0.0` for your network) |
| `PORT` | `8000` | Port |
| `TEAM_TASKS_DB` | `data/team_tasks.db` | SQLite database file |
| `SECURE_COOKIES` | off | Set to `1` when serving over HTTPS |
| `LEADER_SIGNUP_CODE` | none | If set, new team leaders must enter this invite code to sign up |

## Host it online on Railway

The repo includes a `Dockerfile` and `railway.json`, so Railway builds it with no extra setup.

1. **Put the code on GitHub.** Create an empty **private** repository at https://github.com/new (no README), then from this folder run:
   ```bash
   git remote add origin https://github.com/<your-username>/team-tasks.git
   git push -u origin main
   ```
2. **Create the Railway service.** At https://railway.com/new choose **Deploy from GitHub repo** and pick `team-tasks`.
3. **Add a volume (required, or your data is wiped on every deploy).** In the service, right-click the canvas (or press ⌘K), choose **Add Volume**, attach it to the service, and set the mount path to **`/data`**.
4. **Set variables.** Under the service's **Variables** tab, add:
   - `LEADER_SIGNUP_CODE` set to a secret phrase you share only with team leaders
   - `PORT` set to `8000`
5. **Get a public URL.** Under **Settings → Networking**, click **Generate Domain** (target port `8000`). Railway gives you an `https://….up.railway.app` address with HTTPS.
6. Open the URL, choose **New team leader**, enter the invite code, and create your account. Share the URL with your team.

Every `git push` to `main` redeploys automatically. Your data stays on the `/data` volume.

## Forgot a password?

- **Team members:** their team leader resets it from **My team → Reset password**.
- **Team leaders:** run the reset tool where the database lives. On Railway, open the service's **Console** tab; locally, use this folder. Then run:
  ```bash
  python reset_password.py
  ```
  It asks for the email and a new password (typing is hidden), and signs that account out everywhere.
- **Team leaders, without a console:** in Railway's **Variables** tab add `RESET_ACCOUNT_EMAIL` (the account email) and `RESET_ACCOUNT_PASSWORD` (the new password), and deploy. After you sign in, **delete both variables**.

## Files

- `server.py`: HTTP server, JSON API, SQLite storage, sign-in sessions
- `static/`: the web app (`index.html`, `app.js`, `style.css`)
- `data/`: the database, created on first run locally (back this folder up)
- `Dockerfile`, `railway.json`: production build and Railway deploy settings

## Security notes

Passwords are hashed with PBKDF2-SHA256. Sessions use HttpOnly, SameSite cookies, and the API accepts only JSON requests (this blocks cross-site form posts). Before putting it on the internet, run it behind HTTPS (for example a reverse proxy or a hosting platform) with `SECURE_COOKIES=1`.
