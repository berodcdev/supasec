#!/usr/bin/env bash
# supabase-pwn — installer for LOCAL use.
# Runs the tool on http://localhost:<port> (loopback only, no auth).
#
# From a clone (builds from source):
#   git clone https://github.com/berodcdev/supabase-pwn.git
#   cd supabase-pwn && ./install.sh
#
# Or anywhere, using the prebuilt image (no clone, no build):
#   curl -fsSL https://raw.githubusercontent.com/berodcdev/supabase-pwn/master/install.sh | bash
#
# Flags:  --port N     port to serve on (default 3000)
#         --image      use the prebuilt GHCR image instead of building
#         --yes        non-interactive (accept defaults)
#         --update     rebuild/pull latest and restart
#         --uninstall  stop and remove the container (and offer to drop the image)

set -euo pipefail

IMAGE="ghcr.io/berodcdev/supabase-pwn:latest"
NAME="supabase-pwn"

# --- pretty output -----------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RED=$(printf '\033[31m')
  GREEN=$(printf '\033[32m'); CYAN=$(printf '\033[36m'); RESET=$(printf '\033[0m')
else BOLD=""; DIM=""; RED=""; GREEN=""; CYAN=""; RESET=""; fi
say()  { printf '%s\n' "$*"; }
step() { printf '%s➜%s %s\n' "$CYAN" "$RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

# --- args --------------------------------------------------------------------
PORT=3000; ASSUME_YES=0; UPDATE=0; UNINSTALL=0; FORCE_IMAGE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:-}"; shift 2 ;;
    --port=*) PORT="${1#*=}"; shift ;;
    --image) FORCE_IMAGE=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --update) UPDATE=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

printf '%s\n' "${BOLD}┌───────────────────────────────┐${RESET}"
printf '%s\n' "${BOLD}│   supabase-pwn · installer     │${RESET}"
printf '%s\n' "${BOLD}└───────────────────────────────┘${RESET}"

# --- Docker ------------------------------------------------------------------
step "Checking Docker…"
if ! command -v docker >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Linux" ]; then
    if [ "$ASSUME_YES" = 1 ]; then REPLY=y
    else printf 'Docker not found. Install via the official script (needs sudo)? [Y/n] '; read -r REPLY </dev/tty || REPLY=y; fi
    case "${REPLY:-y}" in
      [nN]*) die "Docker is required." ;;
      *) curl -fsSL https://get.docker.com | sh || die "Docker install failed."
         sudo usermod -aG docker "$USER" 2>/dev/null || true ;;
    esac
  else die "Docker not found. Install Docker Desktop: https://docs.docker.com/desktop/ then re-run."; fi
fi
docker info >/dev/null 2>&1 || die "Docker daemon isn't running. Start Docker and re-run."
if docker compose version >/dev/null 2>&1; then DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"
else DC=""; fi
ok "Docker ready."

# --- uninstall ---------------------------------------------------------------
if [ "$UNINSTALL" = 1 ]; then
  step "Removing…"
  if [ -f docker-compose.yml ] && [ -n "$DC" ]; then APP_PORT="$PORT" $DC down 2>/dev/null || true; fi
  docker rm -f "$NAME" 2>/dev/null || true
  if [ "$ASSUME_YES" = 1 ]; then RI=y; else printf 'Also delete the image? [y/N] '; read -r RI </dev/tty || RI=n; fi
  case "${RI:-n}" in [yY]*) docker rmi "$IMAGE" "$NAME:latest" 2>/dev/null || true ;; esac
  ok "Uninstalled."
  exit 0
fi

# --- pick mode: source (has Dockerfile) unless --image or running standalone --
MODE=image
if [ "$FORCE_IMAGE" != 1 ] && [ -f Dockerfile ] && [ -f docker-compose.yml ]; then MODE=source; fi

# --- port --------------------------------------------------------------------
if [ "$ASSUME_YES" != 1 ] && [ -t 0 ]; then
  printf 'Port to serve on [%s]: ' "$PORT"; read -r ans </dev/tty || ans=""; [ -n "${ans:-}" ] && PORT="$ans"
fi
case "$PORT" in ''|*[!0-9]*) die "Invalid port: $PORT" ;; esac

URL="http://localhost:${PORT}"

run_image() {  # pull + (re)create a plain container
  step "Pulling prebuilt image…"
  docker pull "$IMAGE" || die "Could not pull $IMAGE (is the package public? or use a clone + ./install.sh to build locally)."
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" --restart unless-stopped \
    -e NODE_ENV=production -e NEXT_TELEMETRY_DISABLED=1 \
    -p "127.0.0.1:${PORT}:3000" "$IMAGE" >/dev/null
}

if [ "$UPDATE" = 1 ]; then
  step "Updating…"
  if [ "$MODE" = source ]; then [ -d .git ] && git pull --ff-only || true; APP_PORT="$PORT" $DC up -d --build
  else run_image; fi
  ok "Updated — ${URL}"; exit 0
fi

# --- build/run ---------------------------------------------------------------
if [ "$MODE" = source ]; then
  [ -n "$DC" ] || die "Docker Compose not found (needed to build from source)."
  step "Building and starting (first run compiles the app — ~1 min)…"
  APP_PORT="$PORT" $DC up -d --build
else
  run_image
fi

# --- wait & report -----------------------------------------------------------
step "Waiting for it to come up…"
for _ in $(seq 1 30); do curl -fsS -o /dev/null "$URL" 2>/dev/null && break; sleep 2; done

say ""
ok "${BOLD}supabase-pwn is running${RESET}"
say "   ${BOLD}${URL}${RESET}"
say ""
if [ "$MODE" = source ]; then
  say "${DIM}Stop: ${DC} down   ·   Logs: ${DC} logs -f   ·   Update: ./install.sh --update${RESET}"
else
  say "${DIM}Stop: docker rm -f ${NAME}   ·   Logs: docker logs -f ${NAME}   ·   Update: ./install.sh --image --update${RESET}"
fi
say "${DIM}Uninstall: ./install.sh --uninstall${RESET}"

if command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
