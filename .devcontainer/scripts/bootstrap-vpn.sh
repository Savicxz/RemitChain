#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TAILSCALE_AUTH_KEY:-}" ]]; then
  echo "TAILSCALE_AUTH_KEY is not set. Skipping VPN bootstrap."
  exit 0
fi

if ! command -v tailscale >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y tailscale
fi

if ! pgrep -x tailscaled >/dev/null 2>&1; then
  sudo nohup tailscaled >/tmp/tailscaled.log 2>&1 &
fi

sudo tailscale up --authkey "$TAILSCALE_AUTH_KEY" --hostname "${CODESPACE_NAME:-remitchain-codespace}" >/tmp/tailscale-up.log 2>&1 || {
  echo "Failed to bring up Tailscale. See /tmp/tailscale-up.log"
  exit 1
}

if [[ -n "${REMOTE_VM_HOST:-}" ]]; then
  echo "Waiting for remote VM at ${REMOTE_VM_HOST}..."
  for attempt in $(seq 1 30); do
    if ping -c 1 -W 1 "$REMOTE_VM_HOST" >/dev/null 2>&1; then
      echo "Remote VM reachable."
      exit 0
    fi
    sleep 2
  done

  echo "Timed out waiting for VPN route to ${REMOTE_VM_HOST}."
  exit 1
fi

echo "VPN ready."
