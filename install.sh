#!/usr/bin/env bash
# supabase-pwn — installer for LOCAL use.
# Runs the tool on http://localhost:<port> (loopback only, no auth).
#
#   git clone https://github.com/berodcdev/supabase-pwn.git
#   cd supabase-pwn && ./install.sh
#
# Flags:  --port N   use a specific port (default 3000)
#         --yes      non-interactive (accept defaults)
#         --update   pull latest image/code and restart

set -euo pipefail

# --- pretty output -----------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RED=$(printf '\033[31m')
  GREEN=$(printf '\033[32m'); CYAN=$(printf '\033[36m'); RESET=$(printf '\033[0m')
else
  BOLD=""; DIM=""; RED=""; GREEN=""; CYAN=""; RESET=""
fi
say()  { printf '%s\n' "$*"; }
step() { printf '%s➜%s %s\n' "$CYAN" "$RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

# --- args --------------------------------------------------------------------
PORT=3000
ASSUME_YES=0
UPDATE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:-}"; shift 2 ;;
    --port=*) PORT="${1#*=}"; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --update) UPDATE=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

cd "$(dirname "$0")"

printf '%s\n' "${BOLD}┌───────────────────────────────┐${RESET}"
printf '%s\n' "${BOLD}│   supabase-pwn · installer     │${RESET}"
printf '%s\n' "${BOLD}└───────────────────────────────┘${RESET}"

# --- 1. Docker ---------------------------------------------------------------
step "Checking Docker…"
OS="$(uname -s)"
if ! command -v docker >/dev/null 2>&1; then
  if [ "$OS" = "Linux" ]; then
    say "Docker isn't installed."
    if [ "$ASSUME_YES" = 1 ]; then REPLY=y; else
      printf 'Install it now via the official script (needs sudo)? [Y/n] '; read -r REPLY || REPLY=y
    fi
    case "${REPLY:-y}" in
      [nN]*) die "Docker is required. Install it and re-run." ;;
      *) curl -fsSL https://get.docker.com | sh || die "Docker install failed."
         sudo usermod -aG docker "$USER" 2>/dev/null || true
         ok "Docker installed (you may need to log out/in for group changes)." ;;
    esac
  else
    die "Docker isn't installed. Install Docker Desktop: https://docs.docker.com/desktop/ then re-run."
  fi
fi
docker info >/dev/null 2>&1 || die "Docker is installed but the daemon isn't running. Start Docker and re-run."

# docker compose v2 (plugin) or legacy docker-compose
if docker compose version >/dev/null 2>&1; then DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"
else die "Docker Compose not found. Install the Compose plugin and re-run."; fi
ok "Docker + Compose ready."

# --- update path -------------------------------------------------------------
if [ "$UPDATE" = 1 ]; then
  step "Updating…"
  [ -d .git ] && git pull --ff-only || true
  APP_PORT="$PORT" $DC up -d --build
  ok "Updated. Open http://localhost:${PORT}"
  exit 0
fi

# --- 2. Port -----------------------------------------------------------------
if [ "$ASSUME_YES" != 1 ]; then
  printf 'Port to serve on [%s]: ' "$PORT"; read -r ans || ans=""
  [ -n "${ans:-}" ] && PORT="$ans"
fi
case "$PORT" in ''|*[!0-9]*) die "Invalid port: $PORT" ;; esac

# --- 3. Build & run ----------------------------------------------------------
step "Building and starting (first run compiles the app — can take a minute)…"
APP_PORT="$PORT" $DC up -d --build

# --- 4. Wait until ready -----------------------------------------------------
step "Waiting for it to come up…"
URL="http://localhost:${PORT}"
ready=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then ready=1; break; fi
  sleep 2
done
[ "$ready" = 1 ] || say "${DIM}(still starting — give it a few more seconds)${RESET}"

# --- 5. Done -----------------------------------------------------------------
say ""
ok "${BOLD}supabase-pwn is running${RESET}"
say "   ${BOLD}${URL}${RESET}"
say ""
say "${DIM}Stop:    ${DC} down${RESET}"
say "${DIM}Logs:    ${DC} logs -f${RESET}"
say "${DIM}Update:  ./install.sh --update${RESET}"

# Try to open the browser (best-effort).
if command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true
fi
