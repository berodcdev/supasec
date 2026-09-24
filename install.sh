#!/usr/bin/env bash
# supabase-pwn — installer for LOCAL use.
# Runs the tool on http://localhost:<port> (loopback only, no auth).
#
# Quick start (clone + install):
#   git clone https://github.com/berodcdev/supabase-pwn.git
#   cd supabase-pwn && ./install.sh
#
# Flags:  --port N     port to serve on (default 3000)
#         --yes        non-interactive (accept defaults)
#         --update     rebuild/pull latest and restart
#         --uninstall  stop and remove everything (container, image, volumes)

set -euo pipefail

REPO_URL="https://github.com/berodcdev/supabase-pwn.git"
NAME="supabase-pwn"
MIN_DOCKER="20.10"

# --- pretty output -----------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RED=$(printf '\033[31m')
  GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m'); CYAN=$(printf '\033[36m'); RESET=$(printf '\033[0m')
else BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; CYAN=""; RESET=""; fi
say()  { printf '%s\n' "$*"; }
step() { printf '\n%s➜%s %s\n' "$CYAN" "$RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s⚠%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

# --- args --------------------------------------------------------------------
PORT=3000; ASSUME_YES=0; UPDATE=0; UNINSTALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:-}"; shift 2 ;;
    --port=*) PORT="${1#*=}"; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --update) UPDATE=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

printf '\n%s\n' "${BOLD}┌─────────────────────────────────┐${RESET}"
printf '%s\n'   "${BOLD}│   ⚡ supabase-pwn · installer   │${RESET}"
printf '%s\n\n' "${BOLD}└─────────────────────────────────┘${RESET}"

# =============================================================================
# UNINSTALL
# =============================================================================
if [ "$UNINSTALL" = 1 ]; then
  step "Stopping containers…"
  if [ -f docker-compose.yml ]; then
    DC=""
    if docker compose version >/dev/null 2>&1; then DC="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"; fi
    if [ -n "$DC" ]; then $DC down --remove-orphans 2>/dev/null || true; fi
  fi
  docker rm -f "$NAME" 2>/dev/null || true
  ok "Containers removed."

  step "Removing Docker image…"
  docker rmi "$NAME:latest" 2>/dev/null || true
  ok "Image removed."

  step "Pruning dangling build cache…"
  docker builder prune -f 2>/dev/null || true
  ok "Build cache cleaned."

  # Offer to delete the repo folder
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [ -f "$SCRIPT_DIR/docker-compose.yml" ] && [ -f "$SCRIPT_DIR/Dockerfile" ]; then
    if [ "$ASSUME_YES" = 1 ]; then DEL_REPO=y
    else printf '\n%sAlso delete the project folder (%s)?%s [y/N] ' "$YELLOW" "$SCRIPT_DIR" "$RESET"; read -r DEL_REPO </dev/tty || DEL_REPO=n; fi
    case "${DEL_REPO:-n}" in
      [yY]*)
        rm -rf "$SCRIPT_DIR"
        ok "Project folder deleted: $SCRIPT_DIR"
        ;;
      *) say "${DIM}Keeping project folder.${RESET}" ;;
    esac
  fi

  say ""
  ok "${BOLD}supabase-pwn fully uninstalled.${RESET}"
  say "${DIM}No containers, images, or build cache remain.${RESET}"
  exit 0
fi

# =============================================================================
# DEPENDENCY CHECKS
# =============================================================================

# --- Git ---------------------------------------------------------------------
step "Checking git…"
if ! command -v git >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Linux" ]; then
    step "Installing git…"
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update -qq && sudo apt-get install -y -qq git || die "Failed to install git."
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y git || die "Failed to install git."
    elif command -v yum >/dev/null 2>&1; then
      sudo yum install -y git || die "Failed to install git."
    elif command -v pacman >/dev/null 2>&1; then
      sudo pacman -Sy --noconfirm git || die "Failed to install git."
    elif command -v apk >/dev/null 2>&1; then
      sudo apk add git || die "Failed to install git."
    else
      die "Cannot auto-install git. Install it manually and re-run."
    fi
  elif [ "$(uname -s)" = "Darwin" ]; then
    if command -v xcode-select >/dev/null 2>&1; then
      step "Installing Xcode Command Line Tools (includes git)…"
      xcode-select --install 2>/dev/null || true
      die "Xcode CLT install triggered. Re-run this script after it finishes."
    else
      die "Git not found. Install Xcode Command Line Tools: xcode-select --install"
    fi
  else
    die "Git not found. Install it and re-run."
  fi
fi
ok "git $(git --version | awk '{print $3}')"

# --- Docker ------------------------------------------------------------------
step "Checking Docker…"
if ! command -v docker >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Linux" ]; then
    if [ "$ASSUME_YES" = 1 ]; then REPLY=y
    else printf 'Docker not found. Install via the official script (needs sudo)? [Y/n] '; read -r REPLY </dev/tty || REPLY=y; fi
    case "${REPLY:-y}" in
      [nN]*) die "Docker is required." ;;
      *)
        step "Installing Docker…"
        curl -fsSL https://get.docker.com | sh || die "Docker install failed."
        sudo systemctl enable docker 2>/dev/null || true
        sudo systemctl start docker 2>/dev/null || true
        sudo usermod -aG docker "$USER" 2>/dev/null || true
        warn "You may need to log out and back in for Docker group permissions to apply."
        ;;
    esac
  elif [ "$(uname -s)" = "Darwin" ]; then
    die "Docker not found. Install Docker Desktop: https://docs.docker.com/desktop/mac/install/ then re-run."
  else
    die "Docker not found. Install Docker Desktop: https://docs.docker.com/desktop/ then re-run."
  fi
fi
docker info >/dev/null 2>&1 || die "Docker daemon isn't running. Start Docker and re-run."

# Check Docker version
DOCKER_VER=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "0.0")
DOCKER_MAJOR=$(echo "$DOCKER_VER" | cut -d. -f1)
DOCKER_MINOR=$(echo "$DOCKER_VER" | cut -d. -f2)
MIN_MAJOR=$(echo "$MIN_DOCKER" | cut -d. -f1)
MIN_MINOR=$(echo "$MIN_DOCKER" | cut -d. -f2)
if [ "$DOCKER_MAJOR" -lt "$MIN_MAJOR" ] 2>/dev/null || \
   { [ "$DOCKER_MAJOR" -eq "$MIN_MAJOR" ] && [ "$DOCKER_MINOR" -lt "$MIN_MINOR" ]; } 2>/dev/null; then
  die "Docker $DOCKER_VER is too old. Minimum required: $MIN_DOCKER. Please upgrade."
fi
ok "Docker $DOCKER_VER"

# --- Docker Compose ----------------------------------------------------------
step "Checking Docker Compose…"
DC=""
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
  DC_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
  DC_VER=$(docker-compose version --short 2>/dev/null || echo "unknown")
else
  if [ "$(uname -s)" = "Linux" ]; then
    step "Installing Docker Compose plugin…"
    sudo apt-get update -qq 2>/dev/null && sudo apt-get install -y -qq docker-compose-plugin 2>/dev/null || \
    sudo dnf install -y docker-compose-plugin 2>/dev/null || \
    sudo yum install -y docker-compose-plugin 2>/dev/null || true
    if docker compose version >/dev/null 2>&1; then
      DC="docker compose"
      DC_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
    else
      die "Docker Compose not found. Install it: https://docs.docker.com/compose/install/"
    fi
  else
    die "Docker Compose not found. It comes with Docker Desktop — make sure it's enabled."
  fi
fi
ok "Docker Compose $DC_VER"

# --- curl (needed for health check) -----------------------------------------
if ! command -v curl >/dev/null 2>&1; then
  step "Installing curl…"
  if command -v apt-get >/dev/null 2>&1; then sudo apt-get install -y -qq curl
  elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y curl
  elif command -v apk >/dev/null 2>&1; then sudo apk add curl
  fi
fi

# =============================================================================
# PORT
# =============================================================================
if [ "$ASSUME_YES" != 1 ] && [ -t 0 ]; then
  printf '\nPort to serve on [%s]: ' "$PORT"; read -r ans </dev/tty || ans=""; [ -n "${ans:-}" ] && PORT="$ans"
fi
case "$PORT" in ''|*[!0-9]*) die "Invalid port: $PORT" ;; esac

# Check if port is already in use
if command -v ss >/dev/null 2>&1; then
  if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    warn "Port $PORT is already in use. The container may fail to bind."
  fi
elif command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port $PORT is already in use. The container may fail to bind."
  fi
fi

URL="http://localhost:${PORT}"

# =============================================================================
# UPDATE
# =============================================================================
if [ "$UPDATE" = 1 ]; then
  step "Updating…"
  [ -d .git ] && git pull --ff-only || true
  APP_PORT="$PORT" $DC up -d --build
  ok "Updated — ${BOLD}${URL}${RESET}"
  exit 0
fi

# =============================================================================
# INSTALL / BUILD
# =============================================================================
[ -n "$DC" ] || die "Docker Compose not found (needed to build from source)."

# If not in a repo, clone it
if [ ! -f Dockerfile ] || [ ! -f docker-compose.yml ]; then
  step "Cloning repository…"
  CLONE_DIR="$NAME"
  if [ -d "$CLONE_DIR" ]; then
    say "${DIM}Directory $CLONE_DIR already exists — pulling latest…${RESET}"
    cd "$CLONE_DIR"
    git pull --ff-only || true
  else
    git clone "$REPO_URL" "$CLONE_DIR"
    cd "$CLONE_DIR"
  fi
fi

step "Building and starting (first run compiles the app — ~1-2 min)…"
APP_PORT="$PORT" $DC up -d --build

# =============================================================================
# HEALTH CHECK
# =============================================================================
step "Waiting for the app to start…"
HEALTHY=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then HEALTHY=1; break; fi
  sleep 2
done

say ""
if [ "$HEALTHY" = 1 ]; then
  ok "${BOLD}supabase-pwn is running!${RESET}"
else
  warn "App didn't respond in 60s. Check logs: ${DC} logs -f"
fi

say ""
say "   ${BOLD}${URL}${RESET}"
say ""
say "   ${DIM}Stop:       ${DC} down${RESET}"
say "   ${DIM}Logs:       ${DC} logs -f${RESET}"
say "   ${DIM}Update:     ./install.sh --update${RESET}"
say "   ${DIM}Uninstall:  ./install.sh --uninstall${RESET}"
say ""

# Try to open in browser
if command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
