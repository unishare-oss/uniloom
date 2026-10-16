# Local setup

This guide takes you from a fresh computer to a running Uniloom, with your own uniAuth for
sign-in. It works on Windows, macOS and Linux and takes about 30 minutes, most of it
waiting for installs.

You can follow it yourself, or give this whole file to an AI coding agent and let it do
the steps. Either way, you need a GitHub account that has access to the private
`unishare-oss/uniAuth` repo.

Everything runs on your computer. Nothing here needs Tailscale, the Oracle server, SSH, or
anyone else's server.

## The steps at a glance

1. Install the tools.
2. Log in to GitHub.
3. Download both repos.
4. `bun run uniauth:install` and `bun install`
5. `bun run setup`
6. `bun run setup:uniauth` (you type an email and password)
7. `bun run dev:local`, then `bun run check:setup`
8. Sign in at `http://127.0.0.1:3013`.

After step 3, every command is the same on Windows, macOS and Linux.

## Before you start

**Open a terminal.** Every command in this guide is typed into a terminal and run with
Enter.

- Windows: open the Start menu, type `PowerShell`, and open **Windows PowerShell**. Not
  "Command Prompt".
- macOS: press `Cmd+Space`, type `Terminal`, press Enter.
- Linux: press `Ctrl+Alt+T`, or open "Terminal" from your apps.

**Step 1 has a block for each system.** Run only the one for yours. Every other step is the
same everywhere.

## For AI agents following this guide

1. Do the steps in order. Don't skip a step, don't add steps, and don't change the
   commands. Run each step's **Check** before moving on.
2. If a check fails, find the error in [When something goes wrong](#when-something-goes-wrong)
   and do what it says. If it isn't there, or the fix doesn't work, stop and show the
   person the exact error text.
3. On Windows, run everything in PowerShell, not cmd, Git Bash or WSL.
4. Don't create or change files yourself: the commands do it. Don't edit `bun.lock`, don't
   run `npm`, `yarn` or `pnpm`, and don't run `git commit` or `git push`.
5. Steps marked **Person** need the human: logging in to GitHub, typing a password, using
   the browser. Tell them exactly what to do, then wait for them.
6. Step 7 starts a server that keeps running. Start it in its own terminal, or as a
   background process with its output saved to a log file, and leave it running.
7. Never show the contents of a `.env` file: they hold secrets.

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
manager.) The `nodesource` line adds a newer Node before `apt install nodejs`. Without it,
apt installs Ubuntu's own Node, which is too old.

```sh
sudo apt update
sudo apt install -y git curl unzip lsof gh
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
curl -fsSL https://bun.sh/install | bash
```

If `docker --version` doesn't print a version, Docker isn't installed yet. Install it
with:

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
it to download uniAuth, and step 4 uses it to install one of uniAuth's packages.

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
leaves you in the `uniloom` folder. Uniloom moves to its `dev` branch, where day-to-day
work happens.

**From here on, run every command in the `uniloom` folder.** If you open a new terminal,
go there first with `cd ~/dev/unicorp/uniloom`. Uniloom's commands also take care of
uniAuth, which must stay next to it.

**Check:** `git branch --show-current` prints `dev`.

## Step 4. Install the packages

```sh
bun run uniauth:install
bun install
```

The first installs uniAuth's packages, the second Uniloom's. `bun install` also sets up
Git hooks: when you commit, they format your changes and run lint and typecheck.

**Check:** both end without an error, with a line like `306 packages installed`. (The
numbers change over time.)

## Step 5. Set everything up

Docker Desktop must be running (Windows and macOS).

```sh
bun run setup
```

This does the whole setup:

- creates the settings files (`.env`) for uniAuth and Uniloom, each with a new random
  secret. It never overwrites one that already exists;
- starts both databases in Docker and waits until they're ready (the first time, it
  downloads PostgreSQL, which takes a minute);
- creates uniAuth's and Uniloom's tables, and generates code that isn't in git.

**Check:** it ends with `All migrations have been successfully applied.` (or
`No pending migrations to apply.` if you run it again), and shows no error before that.
If it shows an `Update available` box from Prisma, ignore it: don't run the command in it.

## Step 6. Create your account and connect uniAuth

**Person:** run this yourself, because it asks for a password:

```sh
bun run setup:uniauth
```

It asks for an email and a password. If there's no account with that email yet, it also
asks for your name and creates the account. Use any email: it isn't checked. The password
needs 8 or more characters, and it shows on screen as you type (this is a local test
account only). You'll sign in to Uniloom with this email and password.

It then connects Uniloom to uniAuth and saves what Uniloom needs in its settings file.

**Check:** it ends with `Done. Uniloom is registered with uniAuth`.

## Step 7. Start Uniloom

Open a **new terminal**, go to the folder, and start everything. Leave it running.

```sh
cd ~/dev/unicorp/uniloom
bun run dev:local
```

This starts uniAuth, Uniloom's API, the web app, and a worker that sends review
notifications. Each line starts with `[uniauth]`, `[api]`, `[web]`, `[worker]` or `[ready]`
so you can tell them apart. After 10 to 30 seconds you see:

```text
[ready]   Uniloom is ready. Open http://127.0.0.1:3013 in your browser.
```

The `[web]` lines also print `http://localhost:3013`. Don't use that one: sign-in only works
on `http://127.0.0.1:3013`.

**Check:** back in your first terminal, run

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

A `FAIL` line says what is wrong.

## Step 8. Sign in

**Person:**

1. In the browser, type **`http://127.0.0.1:3013`** and press Enter. You see Uniloom's
   welcome page.
2. Click **Sign in** (top right), then **Continue**.
3. You are on uniAuth's sign-in page (its address starts with `http://localhost:3002`).
   Sign in with the email and password from step 6.
4. Uniloom shows its terms. Click **I agree**.
5. You see the **Projects** page, with your name at the bottom left. Done!

## Step 9. Add test data (optional)

```sh
bun run db:seed
```

It adds test projects (keys like `TG`, `TS`, `TR`) and two test accounts,
`seed-mya@example.com` and `seed-ko@example.com`. You get a different role in different
projects (owner, manager, member, or not a member), so you can try each rule. It prints
what to try in each project. Running it again replaces only the test projects. A
`DeprecationWarning` line in its output is harmless.

## Every day after this

1. Windows and macOS: start Docker Desktop.
2. `cd ~/dev/unicorp/uniloom`, then `bun run dev:local`.
3. Open `http://127.0.0.1:3013`.

To stop, press `Ctrl+C` in the `dev:local` terminal. If it runs in the background or you
can't find its terminal, run `bun run stop`. It
stops uniAuth, the API and the web app, and `dev:local` then stops the worker too.

After you pull new code (in either repo): `bun run uniauth:install`, `bun install`, then
`bun run setup`.

## When something goes wrong

First run `bun run check:setup`. Its `FAIL` lines say what's wrong. Then look for the
error here:

| What you see                                                                                                | What to do                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git clone` of uniAuth says `could not read Username`, `Authentication failed` or `Repository not found`    | You aren't logged in to GitHub, or your account can't see uniAuth. Do step 2 again. If its check still fails, ask the uniAuth maintainer for access.                                        |
| `bun run uniauth:install` fails with `401`, `403` or `404` for `@unishare-oss/...`                          | Do step 2 again, then step 4.                                                                                                                                                               |
| `does not provide an export named 'styleText'`, or a message that a newer Node.js is needed                 | Node is too old. Install it again (step 1), open a new terminal, and check `node --version` is `v22.18.0` or higher.                                                                        |
| `bun`, `node` or `gh` is "not found" or "not recognized" right after installing                             | Open a new terminal. On macOS or Linux, if that doesn't help, run `source ~/.bashrc` (or `source ~/.zshrc` on macOS).                                                                       |
| `docker` says it can't connect, or `Is the docker daemon running?`                                          | Start Docker Desktop (Windows, macOS) and wait until it is running. On Linux, run `sudo systemctl start docker`.                                                                            |
| `'compose' is not a docker command` (Linux)                                                                 | Install Docker Compose: `sudo apt install -y docker-compose-plugin`. If apt can't find it (Docker came from Ubuntu's own `docker.io` package), use `sudo apt install -y docker-compose-v2`. |
| Linux: `permission denied` on `/var/run/docker.sock`                                                        | Run `sudo usermod -aG docker $USER`, then log out and back in.                                                                                                                              |
| `port is already allocated` during `bun run setup` or `dev:local`                                           | Something else uses port 5433 or 5434, often another PostgreSQL. Run `docker ps` to see what, and ask before stopping it.                                                                   |
| `uniAuth isn't next to uniloom`                                                                             | Both repos must be in `~/dev/unicorp`. Do step 3 again.                                                                                                                                     |
| `setup:uniauth` says `already has a uniAuth account, with a different password`                             | Run it again with that account's password, or use a different email.                                                                                                                        |
| `EADDRINUSE`, `Is port 3002 in use?` or "address already in use"                                            | An old server is still running. Run `bun run stop`, then `bun run dev:local` again.                                                                                                         |
| `FAIL  Sign-in: Uniloom isn't connected to uniAuth yet`                                                     | Do step 6, then stop `dev:local` (`Ctrl+C`) and start it again.                                                                                                                             |
| `FAIL  Sign-in`, a `redirect_uri` or `invalid_client` error, or sign-in keeps coming back to the login page | Run step 6 again, then restart `dev:local`. Make sure the browser's address is `http://127.0.0.1:3013`, not `localhost:3013`.                                                               |
| `[api]` lines say `uniAuth is not reachable`                                                                | uniAuth didn't start. Read the `[uniauth]` lines for the reason.                                                                                                                            |
| A missing module under `src/generated/prisma` or `src/lib/api/generated`                                    | Run `bun run setup` again.                                                                                                                                                                  |
| `bun run db:seed` says nobody has signed in                                                                 | Do step 8 first.                                                                                                                                                                            |
| Windows: "access a socket in a way forbidden by its access permissions"                                     | Windows has reserved that port. Restarting Windows usually fixes it.                                                                                                                        |
| Windows: files are locked or installs fail at random                                                        | Your home folder may sync to OneDrive. Ask for help moving the repos to a folder outside OneDrive.                                                                                          |

These are normal, not errors:

- AI agents can't sign in to Uniloom's `/mcp` with this local setup. The website works
  fully.
- Local sign-in clients get no logout or account-deletion notices from uniAuth. Those need
  the shared dev servers.

## What the commands do

All of these run from the `uniloom` folder and work the same on every system.

| Command                   | What it does                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `bun run uniauth:install` | Installs uniAuth's packages, using your GitHub login for its private package        |
| `bun run setup`           | Creates missing `.env` files, starts the databases, runs migrations, generates code |
| `bun run setup:uniauth`   | Creates or signs in to your uniAuth account and connects Uniloom to it              |
| `bun run dev:local`       | Starts the databases, uniAuth, the API, the web app and the worker                  |
| `bun run check:setup`     | Checks that uniAuth, the API, the web app and sign-in work                          |
| `bun run stop`            | Stops whatever runs on ports 3002, 3011 and 3013                                    |
| `bun run db:local`        | Starts only the databases                                                           |
| `bun run uniauth:dev`     | Starts only uniAuth                                                                 |
| `bun run db:seed`         | Adds test projects                                                                  |

Where things run: Uniloom at `http://127.0.0.1:3013`, its API at `http://127.0.0.1:3011`,
uniAuth at `http://localhost:3002`, and the databases on ports 5433 (uniAuth) and 5434
(Uniloom). Uniloom has to be opened at `127.0.0.1`, because uniAuth only sends you back
to that exact address. uniAuth stays on `localhost`, because Uniloom checks uniAuth's
address letter for letter.

## When you're done

Agent, tell the person:

1. Which steps passed, and any that didn't, with the error.
2. The address to open: `http://127.0.0.1:3013`.
3. How to start it again: [Every day after this](#every-day-after-this).
