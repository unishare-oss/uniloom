# Local setup

This guide takes you from a fresh computer to a running Uniloom, with your own uniAuth for
sign-in. It works on Windows, macOS and Linux and takes about 30 to 45 minutes, most of it
waiting for installs.

You can follow it yourself, or give this whole file to an AI coding agent and let it do
the steps. Either way, you need a GitHub account that has access to the private
`unishare-oss/uniAuth` repo.

Everything runs on your computer. Nothing here needs Tailscale, the Oracle server, SSH, or
anyone else's server.

## Before you start

**Open a terminal.** Every command in this guide is typed into a terminal and run with
Enter.

- Windows: open the Start menu, type `PowerShell`, and open **Windows PowerShell**. Not
  "Command Prompt".
- macOS: press `Cmd+Space`, type `Terminal`, press Enter.
- Linux: press `Ctrl+Alt+T`, or open "Terminal" from your apps.

Some steps start a server that keeps running. For those, open a **new terminal** the same
way and leave the old one open.

**Commands are the same on every system**, except in step 1 and step 9. Those show a
**Windows** block and a **macOS and Linux** block: run only the one for your system.

**Creating a file.** Some steps say "create the file ... with this content". Open the
folder in a code editor such as [VS Code](https://code.visualstudio.com), create a new
file with exactly that name, paste the content and save. File names like `.env` start with
a dot and have nothing after it. If you use Notepad on Windows, pick **Save as type: All
files**, or it saves `.env.txt`, which doesn't work.

## For AI agents following this guide

1. Do the steps in order. Don't skip a step, don't add steps, and don't change the
   commands. Run each step's **Check** before moving on.
2. If a check fails, find the error in [When something goes wrong](#when-something-goes-wrong)
   and do what it says. If it isn't there, or the fix doesn't work, stop and show the
   person the exact error text.
3. On Windows, run everything in PowerShell, not cmd, Git Bash or WSL.
4. Only create the files this guide describes. Don't change any other file, don't edit
   `bun.lock`, don't run `npm`, `yarn` or `pnpm`, and don't run `git commit` or `git push`.
5. Copy every address exactly. `localhost` and `127.0.0.1` are not the same thing in this
   setup (see the next section).
6. Steps marked **Person** need the human: logging in to GitHub, using the browser, typing
   a password. Tell them exactly what to do, then wait for them.
7. The servers in steps 7 and 13 keep running. Start each one in its own terminal, or as a
   background process with its output saved to a log file, and leave it running. To stop
   them, use [Stopping servers](#stopping-servers).
8. Never repeat a secret back to the person once it is in a file. Never write a password
   into a file.

## The one thing to get right: 127.0.0.1 and localhost

| What                | Address                 |
| ------------------- | ----------------------- |
| Uniloom (open this) | `http://127.0.0.1:3013` |
| Uniloom API         | `http://127.0.0.1:3011` |
| uniAuth (sign-in)   | `http://localhost:3002` |

- **Always open Uniloom at `http://127.0.0.1:3013`, never `http://localhost:3013`.**
  uniAuth only sends you back to the exact address it has on file, and that is
  `http://127.0.0.1:3013`. With `localhost`, sign-in fails or loops back to the login page.
- **uniAuth is the one exception: it stays on `http://localhost:3002`.** Uniloom checks
  uniAuth's address letter for letter, so don't change it to `127.0.0.1`.

Copy the files in this guide as they are and both rules are already taken care of.

## Step 1. Install the tools

You need Git, Bun (1.4.2 or newer), Node.js (22.18 or newer), Docker, and the GitHub CLI
(`gh`). Install them for your system:

**Windows:**

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id GitHub.cli -e
winget install --id Docker.DockerDesktop -e
powershell -c "irm bun.sh/install.ps1 | iex"
git config --global core.longpaths true
```

Docker Desktop needs WSL 2. If the installer asks to turn it on or to restart the
computer, **Person**: do that.

**macOS:** install [Homebrew](https://brew.sh) first if `brew --version` doesn't work.

```sh
brew install git gh node
brew install --cask docker-desktop
curl -fsSL https://bun.sh/install | bash
```

**Linux** (Ubuntu or Debian. On other distros, install the same tools with your package
manager. Don't use plain `apt install nodejs`: Ubuntu's own Node is too old.)

```sh
sudo apt update
sudo apt install -y git curl unzip lsof gh
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
curl -fsSL https://bun.sh/install | bash
```

If Docker isn't installed on Linux yet:

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

then log out and back in (skip that if you are logged in as `root`).

**Then, on every system:**

1. Close the terminal and open a new one, so it finds the new tools.
2. Windows and macOS, **Person**: start **Docker Desktop** and wait until it says it is
   running.

**Check:** run these:

```sh
git --version
bun --version
node --version
gh --version
docker compose version
```

Each prints a version. The Bun version is `1.4.2` or higher and the Node version is
`v22.18.0` or higher. If Bun is too old, run `bun upgrade`. If Node is too old, install it
again with the commands above.

## Step 2. Log in to GitHub

The uniAuth repo is private, so you need to log in to GitHub before you can download it.
Your GitHub account must have access to `unishare-oss/uniAuth`. If it doesn't, ask the
uniAuth maintainer to add you.

**Person:** run these two commands yourself (they ask you questions):

```sh
gh auth login -h github.com -p https -w -s read:packages
gh auth setup-git
```

What you'll see with the first one:

1. `Authenticate Git with your GitHub credentials?`: answer **Yes**.
2. A one-time code like `85DD-84B7`, then `Press Enter to open github.com in your browser`:
   press Enter.
3. The browser opens `https://github.com/login/device`. (If it says `Failed opening a web
browser`, open that address yourself.) Type the code and approve.
4. It ends with `Logged in as <your GitHub name>`.

This saves a GitHub login on your computer. You never copy the token yourself: `git` uses
it in step 3, and step 5 reads it with `gh auth token`.

**Check:**

```sh
git ls-remote https://github.com/unishare-oss/uniAuth.git HEAD
```

It prints one line ending in `HEAD`. An error means the login or your access is missing.

## Step 3. Download both repos

```sh
cd ~
git clone https://github.com/unishare-oss/uniAuth.git dev/unicorp/uniAuth
git clone https://github.com/unishare-oss/uniloom.git dev/unicorp/uniloom
cd ~/dev/unicorp/uniloom
git switch dev
```

This puts both repos side by side in a `dev/unicorp` folder in your home folder, and
leaves you in the `uniloom` folder. uniAuth stays on its `main` branch. Uniloom moves to
`dev`, where day-to-day work happens.

**From here on, run every command in the `uniloom` folder.** When you open a new terminal,
go there first with `cd ~/dev/unicorp/uniloom`. Uniloom's `bun run` commands also take care
of uniAuth, which must stay next to it in `dev/unicorp`.

**Check:** `git branch --show-current` prints `dev`.

## Step 4. Start the two databases

```sh
bun run db:local
```

This starts uniAuth's and Uniloom's databases in Docker and waits until both are ready.
The first time, it downloads PostgreSQL, which takes a minute.

**Check:** it ends with two lines saying `Healthy` (one for `uniauth-db`, one for
`uniloom-db`).

## Step 5. Install uniAuth

```sh
bun run uniauth:install
```

This installs uniAuth's packages, using your GitHub login from step 2 for the one package
that comes from GitHub.

**Check:** it ends without an error, with a line like `306 packages installed`.

## Step 6. Set up uniAuth

Make a random secret:

```sh
bun run secret
```

Create the file `~/dev/unicorp/uniAuth/apps/server/.env` with this content, and put the
secret in place of `PASTE_SECRET_HERE`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/uniauth
BETTER_AUTH_SECRET=PASTE_SECRET_HERE
BETTER_AUTH_URL=http://localhost:3002
COOKIE_PREFIX=uniauth
UNISHARE_ORIGIN=http://localhost:3000
UNIGYM_ORIGIN=http://localhost:3003
UNILOOM_ORIGIN=http://127.0.0.1:3013
UNIAUTH_ADMIN_USER_IDS=
GUEST_EMAIL_DOMAIN=guest.unishare.app
```

Use this content, not a copy of uniAuth's `.env.example`: the example has
`localhost:3013`, which breaks sign-in.

Create uniAuth's tables:

```sh
bun run uniauth:migrate
```

**Check:** it ends with `migrations applied successfully!`.

## Step 7. Start uniAuth

Open a **new terminal** and run this. Leave it running.

```sh
cd ~/dev/unicorp/uniloom
bun run uniauth:dev
```

It prints `uniauth listening on http://localhost:3002/`.

**Check:** in your first terminal, run

```sh
bun run check:setup uniauth
```

It prints `OK    uniAuth: running at http://localhost:3002`.

## Step 8. Make yourself a uniAuth admin

Only an admin can register Uniloom with uniAuth, so make your account one.

**Person:**

1. In the browser, open `http://localhost:3002/signup` and sign up with any email and a
   password you'll remember. The email isn't checked. If "Pick your university" appears,
   click **Skip for now**.
2. In the same browser, open `http://localhost:3002/api/auth/get-session`. You see some
   text. Find `"user":{` and copy the `"id"` value right after it (not the one after
   `"session"`). It is a code like `vtEeS8X89aEPiFk8Ag071FkvFB0iQEqT`. It isn't a secret,
   so you can give it to your agent.

Put the id in `~/dev/unicorp/uniAuth/apps/server/.env`, on the line that is already there:

```env
UNIAUTH_ADMIN_USER_IDS=PASTE_ID_HERE
```

No restart needed. Leave uniAuth running.

**Check:** the file has one `UNIAUTH_ADMIN_USER_IDS=` line, with the id after the `=`.

## Step 9. Register Uniloom with uniAuth

This gives Uniloom its own sign-in client. It uses the email and password from step 8.

**Person:** run these yourself, so your password stays with you. Put your email and
password between the quotes.

**Windows:**

```powershell
$env:UNIAUTH_ADMIN_EMAIL = 'you@example.com'
$env:UNIAUTH_ADMIN_PASSWORD = 'your-password'
bun run uniauth:client
Remove-Item Env:UNIAUTH_ADMIN_PASSWORD
```

**macOS and Linux:**

```sh
UNIAUTH_ADMIN_EMAIL='you@example.com' UNIAUTH_ADMIN_PASSWORD='your-password' bun run uniauth:client
```

It prints a `client_id` and a `client_secret`. You only see the secret once, so keep the
terminal open until step 11. Give both values to your agent, or paste them into step 11's
file yourself.

**Check:** the output has both `client_id` and `client_secret`. If it shows an error, check
the id from step 8 and that the email and password are the ones you signed up with, then
run it again.

## Step 10. Install Uniloom

```sh
bun install
```

This also sets up Git hooks: when you commit, they format your changes and run lint and
typecheck.

**Check:** it ends without an error, with a line like `1313 packages installed`.

## Step 11. Set up Uniloom

Make a second random secret with `bun run secret` (a new one, not the one from step 6).

Create `~/dev/unicorp/uniloom/apps/api/.env`, and fill in the three `PASTE_..._HERE`
values:

```env
DATABASE_URL="postgresql://uniloom:uniloom@127.0.0.1:5434/uniloom"
PORT=3011
BETTER_AUTH_URL="http://127.0.0.1:3013"
BETTER_AUTH_SECRET="PASTE_SECOND_SECRET_HERE"
UNIAUTH_ISSUER="http://localhost:3002/api/auth"
UNIAUTH_CLIENT_ID="PASTE_CLIENT_ID_HERE"
UNIAUTH_CLIENT_SECRET="PASTE_CLIENT_SECRET_HERE"
MCP_RESOURCE="http://127.0.0.1:3013/mcp"
```

Create `~/dev/unicorp/uniloom/apps/web/.env`:

```env
API_URL="http://127.0.0.1:3011"
NEXT_PUBLIC_UNIAUTH_URL="http://localhost:3002"
```

**Check:** open both files again. No `PASTE_..._HERE` is left, and the addresses are
exactly as above.

## Step 12. Prepare Uniloom's code and database

```sh
bun run setup
```

This generates code that isn't in git and creates Uniloom's tables.

**Check:** it ends with `All migrations have been successfully applied.` (or
`No pending migrations to apply.` if you run it again later), with no error before it.

## Step 13. Start Uniloom

uniAuth (step 7) must be running first.

Open **three new terminals**. In each one, go to the folder and start one part. Leave all
three running.

```sh
cd ~/dev/unicorp/uniloom
bun run dev:api
```

```sh
cd ~/dev/unicorp/uniloom
bun run dev:web
```

```sh
cd ~/dev/unicorp/uniloom
bun run dev:worker
```

These are the API, the web app, and a background worker that sends review notifications.
Wait until the web app's terminal says `Ready`.

**Check:** in your first terminal, run

```sh
bun run check:setup
```

It prints four lines, all starting with `OK`:

```text
OK    uniAuth: running at http://localhost:3002
OK    Uniloom API: running at http://127.0.0.1:3011
OK    Uniloom web app: running at http://127.0.0.1:3013
OK    Sign-in: uniAuth accepts Uniloom's client and redirect
```

The first run can take up to a minute while the web app gets ready. A `FAIL` line says
what is wrong; also see [When something goes wrong](#when-something-goes-wrong).

## Step 14. Sign in

**Person:**

1. In the browser, type **`http://127.0.0.1:3013`** and press Enter. You see Uniloom's
   welcome page.
2. Click **Sign in** (top right), then **Continue**.
3. You are on uniAuth's sign-in page (its address starts with `http://localhost:3002`).
   Sign in with the email and password from step 8. If you are still signed in from step
   8, this page is skipped.
4. Uniloom shows its terms. Click **I agree**.
5. You see the **Projects** page, with your name at the bottom left. Done!

## Step 15. Add test data (optional)

After you've signed in once:

```sh
bun run db:seed
```

It adds test projects (keys like `TG`, `TS`, `TR`) and two test accounts,
`seed-mya@example.com` and `seed-ko@example.com`. You get a different role in different
projects (owner, manager, member, or not a member), so you can try each rule. It prints
what to try in each project. Running it again replaces only the test projects.

## Starting it again later

Open terminals as in step 13 and run each command from `~/dev/unicorp/uniloom`:

1. Windows and macOS: start Docker Desktop first.
2. `bun run db:local` (starts the databases if they aren't running).
3. `bun run uniauth:dev` in its own terminal.
4. `bun run dev:api`, `bun run dev:web` and `bun run dev:worker`, each in its own terminal.
5. Open `http://127.0.0.1:3013`.

Always start uniAuth before the API.

After you pull new code:

- In `uniloom`: `bun install`, then `bun run setup`.
- In `uniAuth`: `bun run uniauth:install`, then `bun run uniauth:migrate` (both from the
  `uniloom` folder).

## Stopping servers

Press `Ctrl+C` in the server's terminal.

If you can't find the terminal, or the servers run in the background, this stops uniAuth,
the API and the web app:

```sh
bun run stop
```

It prints `Process on port ... killed`, or `No process running on port` if one wasn't
running. Both are fine. The worker uses no port: stop it with `Ctrl+C` in its terminal.

## When something goes wrong

First run `bun run check:setup`. Its `FAIL` lines say what's wrong. Then find the error
here:

| What you see                                                                                             | What to do                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git clone` of uniAuth says `could not read Username`, `Authentication failed` or `Repository not found` | You aren't logged in to GitHub, or your account can't see uniAuth. Do step 2 again. If its check still fails, ask the uniAuth maintainer for access.                                                                                                                                |
| `bun run uniauth:install` fails with `401`, `403` or `404` for `@unishare-oss/...`                       | Do step 2 again, then step 5.                                                                                                                                                                                                                                                       |
| `does not provide an export named 'styleText'`, or a message that a newer Node.js is needed              | Node is too old. Install it again (step 1), open a new terminal, and check `node --version` is `v22.18.0` or higher.                                                                                                                                                                |
| `bun`, `node` or `gh` is "not found" or "not recognized" right after installing                          | Open a new terminal. On macOS or Linux, if that doesn't help, run `source ~/.bashrc` (or `source ~/.zshrc` on macOS).                                                                                                                                                               |
| `docker` says it can't connect, or `Is the docker daemon running?`                                       | Start Docker Desktop (Windows, macOS) and wait until it is running. On Linux, run `sudo systemctl start docker`.                                                                                                                                                                    |
| `'compose' is not a docker command` (Linux)                                                              | Install Docker Compose: `sudo apt install -y docker-compose-plugin`. If apt can't find it (Docker came from Ubuntu's own `docker.io` package), use `sudo apt install -y docker-compose-v2`.                                                                                         |
| Linux: `permission denied` on `/var/run/docker.sock`                                                     | Run `sudo usermod -aG docker $USER`, then log out and back in.                                                                                                                                                                                                                      |
| `bun run db:local` says `port is already allocated`                                                      | Something else uses port 5433 or 5434, often another PostgreSQL. Run `docker ps` to see what, and ask before stopping it.                                                                                                                                                           |
| `Can't reach database server`, or `ECONNREFUSED` on `5433` or `5434`                                     | The databases are stopped. Run `bun run db:local`.                                                                                                                                                                                                                                  |
| `EADDRINUSE`, `Is port 3002 in use?` or "address already in use"                                         | An old server is still running. Run `bun run stop`, then start the servers again.                                                                                                                                                                                                   |
| `cd: no such file or directory: ../uniAuth` (or similar)                                                 | uniAuth isn't next to uniloom. Both must be in `~/dev/unicorp` (step 3).                                                                                                                                                                                                            |
| The API stops with `uniAuth is not reachable at http://localhost:3002/api/auth`                          | Start uniAuth first (step 7), then start the API again.                                                                                                                                                                                                                             |
| The API stops with `Missing BETTER_AUTH_URL` (or another name)                                           | That line is missing in `uniloom/apps/api/.env`. Copy it from step 11.                                                                                                                                                                                                              |
| `FAIL  Sign-in`, a `redirect_uri` error, or sign-in keeps coming back to the login page                  | Something says `localhost:3013` where it should say `127.0.0.1:3013`. Look at the browser's address bar, `BETTER_AUTH_URL` in `uniloom/apps/api/.env` and `UNILOOM_ORIGIN` in `uniAuth/apps/server/.env`. Fix it, run `bun run stop`, start the servers again, and rerun the check. |
| `invalid_client`                                                                                         | `UNIAUTH_CLIENT_ID` or `UNIAUTH_CLIENT_SECRET` in `uniloom/apps/api/.env` doesn't match step 9. Fix it (or run step 9 again for new values), then restart the API.                                                                                                                  |
| An error about the `issuer` after signing in                                                             | `UNIAUTH_ISSUER` in `uniloom/apps/api/.env` must be exactly `http://localhost:3002/api/auth`. Fix it, then restart the API.                                                                                                                                                         |
| A missing module under `src/generated/prisma` or `src/lib/api/generated`                                 | Run `bun run setup`.                                                                                                                                                                                                                                                                |
| The page loads but nothing works, or the web terminal shows `ECONNREFUSED 127.0.0.1:3011`                | The API isn't running. Look at its terminal for the error.                                                                                                                                                                                                                          |
| `bun run db:seed` says nobody has signed in                                                              | Do step 14 first.                                                                                                                                                                                                                                                                   |
| Windows: "access a socket in a way forbidden by its access permissions"                                  | Windows has reserved that port. Restarting Windows usually fixes it.                                                                                                                                                                                                                |
| Windows: files are locked or installs fail at random                                                     | Your home folder may sync to OneDrive. Ask for help moving the repos to a folder outside OneDrive.                                                                                                                                                                                  |

These are normal, not errors:

- AI agents can't sign in to Uniloom's `/mcp` with this local setup. The website works
  fully.
- Local sign-in clients get no logout or account-deletion notices from uniAuth. Those need
  the shared dev servers.

## When you're done

Agent, tell the person:

1. Which steps passed, and any that didn't, with the error.
2. The address to open: `http://127.0.0.1:3013`.
3. How to start it again: [Starting it again later](#starting-it-again-later).
