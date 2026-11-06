#!/usr/bin/env bash
#
# publish.sh — one-shot publisher for the Meridian Bank demo.
# Run it from the project root (the folder containing README.md and backend/):
#
#     cd ~/labs/secure_bank
#     bash publish.sh
#
# It will: fill your name into LICENSE, verify no secrets are staged,
# make the initial commit, and create + push a GitHub repo.
# LinkedIn has no post-for-you API, so it writes the post to linkedin_post.txt
# for you to paste.

set -euo pipefail

# ---- sanity: are we in the right folder? ----
if [[ ! -f README.md || ! -d backend ]]; then
  echo "✗ Run this from the project root (where README.md and backend/ live)." >&2
  exit 1
fi

# ---- 1. LICENSE name ----
if grep -q "<Your Name>" LICENSE 2>/dev/null; then
  read -rp "Name for the MIT license copyright line: " LICENSE_NAME
  if [[ -n "${LICENSE_NAME}" ]]; then
    sed -i "s/<Your Name>/${LICENSE_NAME}/" LICENSE
    echo "✓ LICENSE updated."
  fi
fi

# ---- 2. repo settings ----
read -rp "GitHub repo name [meridian-bank]: " REPO_NAME
REPO_NAME="${REPO_NAME:-meridian-bank}"
read -rp "Visibility — public or private? [public]: " VIS
VIS="${VIS:-public}"

# ---- 3. git init + commit ----
if [[ ! -d .git ]]; then
  git init -q
  git branch -M main
fi
git add -A

# ---- 4. SAFETY: make sure no real .env is staged ----
if git diff --cached --name-only | grep -E '(^|/)\.env$' >/dev/null; then
  echo "✗ A .env file is staged — aborting so you don't publish secrets." >&2
  echo "  Remove it with:  git rm --cached <path/to/.env>" >&2
  exit 1
fi
echo "✓ No .env staged."

if git rev-parse HEAD >/dev/null 2>&1; then
  echo "• Repo already has commits — adding one for any new changes."
  git commit -q -m "Add LICENSE and README demo banner" || echo "  (nothing new to commit)"
else
  git commit -q -m "Initial commit: Meridian Bank demo"
  echo "✓ Initial commit created."
fi

# ---- 5. push to GitHub ----
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh repo create "${REPO_NAME}" "--${VIS}" --source=. --push
  echo "✓ Pushed. Repo: $(gh repo view "${REPO_NAME}" --json url -q .url 2>/dev/null || echo "see github.com")"
else
  echo
  echo "⚠ GitHub CLI not ready. Either run 'gh auth login' and re-run this script,"
  echo "  or create an empty repo on github.com and run:"
  echo "     git remote add origin https://github.com/<you>/${REPO_NAME}.git"
  echo "     git push -u origin main"
fi

# ---- 6. LinkedIn post to a file ----
cat > linkedin_post.txt <<'POST'
Built Meridian Bank — a full-stack banking demo to practice the security
engineering real fintech actually runs on (not just CRUD behind a login).

Stack: Flask + PostgreSQL API, React + Vite + Tailwind front end.

Under the hood:
🔐 Hybrid JWT-in-httponly-cookie auth with rotating, revocable refresh tokens + double-submit CSRF
📲 OTP-gated login (pluggable SMS: console / mock / Twilio)
🧾 Encrypted PII at rest (Fernet), hashed passwords, RBAC
🪪 KYC onboarding + review workflow
🕵️ AML monitoring (large-txn + structuring detection) and a tamper-evident, hash-chained audit log
✅ Transfers require admin approval with balance re-validation at approval time

I also wrote a COMPLIANCE.md that's honest about what's simulated vs. what real
PCI-DSS/KYC/AML actually demands (licensing, audits, regulator filings).

Fictional bank, real engineering. Code on GitHub 👇
#fullstack #softwareengineering #fintech #cybersecurity #react #python
POST
echo "✓ LinkedIn post written to linkedin_post.txt — paste it into LinkedIn."
echo
echo "Done."
