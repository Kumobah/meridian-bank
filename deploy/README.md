# Running Meridian Bank as a persistent local deployment

This turns the "two terminals open" dev setup into something that survives
closing your terminal (and, if you enable the services, survives a reboot)
— plus a self-hosted Gitea instance for version control, instead of GitHub.

All commands assume the project lives at `/home/blackjew/labs/secure_bank`
and your user is `blackjew`. Adjust the paths in the two config files in
this folder if that's not accurate.

---

## Part 1 — Self-hosted Gitea (git server)

Gitea runs great in Docker, and you already have Docker installed for
Postgres, so this reuses that.

```bash
mkdir -p ~/gitea && cd ~/gitea
cat > docker-compose.yml << 'EOF'
services:
  gitea:
    image: gitea/gitea:1.22
    container_name: gitea
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__server__DOMAIN=localhost
      - GITEA__server__SSH_DOMAIN=localhost
      - GITEA__server__ROOT_URL=http://localhost:3000/
    restart: unless-stopped
    volumes:
      - ./gitea-data:/data
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "3000:3000"   # web UI
      - "2222:22"     # git-over-SSH (remapped so it doesn't clash with your real SSH on 22)
EOF
docker compose up -d
```

Open `http://localhost:3000` — Gitea's setup wizard walks you through
creating the first (admin) account. That account you create *is* the admin
— nothing further to configure there.

Once logged in: **+ → New Repository** → name it `secure_bank` → don't
initialize with a README (you already have one) → Create Repository.

### Push the project into it

```bash
cd /home/blackjew/labs/secure_bank

# One-time git identity, if you haven't set this before:
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin http://localhost:3000/<your-gitea-username>/secure_bank.git
git push -u origin main
```

It'll prompt for your Gitea username/password on that first push (browser
login and git push are separate credentials the first time). The
`.gitignore` at the project root already excludes `.env`, `venv/`,
`node_modules/`, and build output — verify with `git status` before your
first commit that nothing sensitive is staged.

`docker-compose.yml` has `restart: unless-stopped`, and Docker itself
starts on boot once enabled:
```bash
sudo systemctl enable docker
```
That's Gitea (and your Postgres container) covered for persistence.

---

## Part 2 — Backend as a systemd service

The Flask dev server (`python app.py`) explicitly warns it's not for this
kind of use. `meridian-backend.service` in this folder runs it under
**gunicorn** instead — a real WSGI server — as a background service.

```bash
cd /home/blackjew/labs/secure_bank/backend
source venv/bin/activate
pip install -r requirements.txt   # picks up gunicorn
deactivate

sudo cp /home/blackjew/labs/secure_bank/deploy/meridian-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now meridian-backend
```

Check it's actually up:
```bash
sudo systemctl status meridian-backend
curl http://127.0.0.1:5000/api/auth/me   # should return a 401 JSON, not a connection error
journalctl -u meridian-backend -f        # live logs, replaces watching the terminal
```

---

## Part 3 — Frontend, served by nginx (not the Vite dev server)

`npm run dev` is also a dev tool, not meant to run unattended. Build the
production bundle once, and let nginx serve it as static files — and
**also** have nginx reverse-proxy `/api/*` to the backend, so the browser
only ever talks to one origin. That sidesteps CORS entirely and makes
cookies behave like plain same-origin cookies, which is simpler and more
correct than running two separate origins.

```bash
cd /home/blackjew/labs/secure_bank/frontend
npm install
npm run build              # outputs static files to frontend/dist/

sudo apt install -y nginx
sudo cp /home/blackjew/labs/secure_bank/deploy/nginx-meridian.conf /etc/nginx/sites-available/meridian-bank
sudo ln -s /etc/nginx/sites-available/meridian-bank /etc/nginx/sites-enabled/
sudo nginx -t               # should say "syntax is ok" / "test is successful"
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Open **`http://localhost:8080`** — that's the whole app now, backend
included, no terminals open.

nginx is already systemd-managed once enabled, so there's no separate
custom unit file needed for the frontend.

### If you change the frontend code later

The dev workflow (`npm run dev` on :5173) still works fine for active
development — that's unaffected by any of this. When you're ready to
publish a change to the persistent deployment:
```bash
cd /home/blackjew/labs/secure_bank/frontend
npm run build
sudo systemctl reload nginx   # picks up the new dist/ files
```

### If you change the backend code

```bash
sudo systemctl restart meridian-backend
```

---

## Everything running

| Piece | How it persists | Where |
|---|---|---|
| Postgres | Docker `restart: unless-stopped` | `backend/docker-compose.yml` |
| Gitea | Docker `restart: unless-stopped` | `~/gitea/docker-compose.yml` |
| Backend (Flask/gunicorn) | systemd, `enable`d | `meridian-backend.service` |
| Frontend + API proxy | nginx, `enable`d | `nginx-meridian.conf` |

All four survive a reboot once `docker`, `meridian-backend`, and `nginx`
are `enable`d (not just `start`ed) — confirm with:
```bash
systemctl is-enabled docker meridian-backend nginx
```

## Rolling back to plain dev mode

Nothing here removes your ability to just run `python app.py` and
`npm run dev` directly for active development — stop the persistent
services first so they're not both fighting over port 5000/8080:
```bash
sudo systemctl stop meridian-backend nginx
```
