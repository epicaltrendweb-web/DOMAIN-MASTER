#!/usr/bin/env bash
# dev.sh — Layer 1: immortal dev server with memory protection
# Source: AGENT-TOOLKIT knowledge/patterns/keep-alive.md
# Improvements: proactive memory check, .env restore, 2s interval
trap '' SIGHUP SIGTERM
cd /home/z/my-project

while true; do
  # ─── Restore .env if CF creds missing ───
  if ! grep -q "CF_API_KEY" /home/z/my-project/.env 2>/dev/null; then
    if [ -f /home/z/my-project/upload/.env.backup ]; then
      cat /home/z/my-project/upload/.env.backup >> /home/z/my-project/.env 2>/dev/null
      echo "[$(date)] .env restored from backup" >> /tmp/dm-watchdog.log
    fi
  fi

  # ─── Check if next-server is alive ───
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] next-server not running — starting..." >> /tmp/dm-watchdog.log
    NODE_OPTIONS="--max-old-space-size=3072" nohup bun run dev > /home/z/my-project/dev.log 2>&1 &
    disown
    sleep 15
  fi

  # ─── Health check ───
  curl -s --max-time 3 http://localhost:3000/ > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "[$(date)] health check failed — killing + restarting" >> /tmp/dm-watchdog.log
    pkill -f "next-server" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    sleep 2
    continue
  fi

  # ─── Proactive memory check: if free memory < 300MB, restart server ───
  FREE_MEM=$(free -m | awk '/^Mem:/{print $4}')
  if [ -n "$FREE_MEM" ] && [ "$FREE_MEM" -lt 300 ]; then
    echo "[$(date)] LOW MEMORY: ${FREE_MEM}MB free — restarting server to prevent OOM" >> /tmp/dm-watchdog.log
    pkill -f "next-server" 2>/dev/null
    sleep 2
    continue
  fi

  sleep 2
done
