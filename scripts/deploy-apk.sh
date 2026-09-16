#!/usr/bin/env bash
set -e

echo "=== 1. Building Web Assets ==="
npm run build

echo "=== 2. Syncing Capacitor Android ==="
npx cap sync android

echo "=== 3. Git Staging & Committing ==="
git add -A
COMMIT_MSG="${1:-Deploy EdenNote update from Google AI Studio}"
git commit -m "$COMMIT_MSG" || echo "No changes to commit"

echo "=== 4. Pushing to GitHub (origin master) ==="
git push origin master

echo "=== 5. Monitoring GitHub Actions Workflow ==="
sleep 4
RUN_ID=$(curl -s -H "Accept: application/vnd.github.v3+json" "https://api.github.com/repos/yangeden01/daily-ai/actions/runs?per_page=1" | grep -m1 '"id":' | tr -dc '0-9')
echo "Detected Workflow Run ID: $RUN_ID"

if [ -n "$RUN_ID" ]; then
  for i in {1..30}; do
    STATUS_JSON=$(curl -s -H "Accept: application/vnd.github.v3+json" "https://api.github.com/repos/yangeden01/daily-ai/actions/runs/$RUN_ID")
    STATUS=$(echo "$STATUS_JSON" | grep -m1 '"status":' | cut -d'"' -f4)
    CONCLUSION=$(echo "$STATUS_JSON" | grep -m1 '"conclusion":' | cut -d'"' -f4)
    echo "[$i/30] Status: $STATUS, Conclusion: $CONCLUSION"
    if [ "$STATUS" = "completed" ]; then
      if [ "$CONCLUSION" = "success" ]; then
        echo "Build & Release succeeded!"
        echo "Direct APK Download: https://github.com/yangeden01/daily-ai/releases/download/v1.0.0-apk/Daily-AI.apk"
        exit 0
      else
        echo "Build finished with conclusion: $CONCLUSION"
        exit 1
      fi
    fi
    sleep 10
  done
fi
