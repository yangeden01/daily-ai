---
name: deploy-apk
description: Automated submit, build, sync, and deploy pipeline for Google AI Studio to GitHub and Android APK Release for EdenNote / daily-ai.
---

# Deploy APK Skill (Google AI Studio -> GitHub -> Android Release APK)

This skill automates the end-to-end deployment process from Google AI Studio to the GitHub repository and triggers GitHub Actions to build and publish the release APK.

## Repository Information
- **Repository URL**: `https://github.com/yangeden01/daily-ai.git`
- **Target Branch**: `master`
- **Release Tag**: `v1.0.0-apk`
- **APK Download URL**: `https://github.com/yangeden01/daily-ai/releases/download/v1.0.0-apk/Daily-AI.apk`
- **Release Page**: `https://github.com/yangeden01/daily-ai/releases/tag/v1.0.0-apk`
- **Authentication**: Permanent token stored via `credential.helper store` in `/root/.git-credentials`. Never ask user for credentials.

## When to Trigger
Use this workflow whenever the user asks:
- "deploy", "執行deploy", "部署", "發布", "更新APK", or asks to sync/push code to GitHub.

---

## Step-by-Step Deployment Workflow

### Step 1: Verify Code & Compile Applet
Verify all TypeScript/React code builds cleanly without errors:
```bash
npm run build
```
Or call the `compile_applet` tool.

### Step 2: Sync Native Android Assets (Capacitor)
Ensure all web assets (`dist/`) and Android configs are synced into the native Android project:
```bash
npx cap sync android
```

### Step 3: Commit and Push to Master
Stage all changes, create a descriptive commit message, and push directly:
```bash
git add -A
git commit -m "<Descriptive commit message>"
git push origin master
```

### Step 4: Monitor GitHub Actions Workflow
Poll GitHub Actions to observe the APK build:
```bash
# 1. Fetch latest workflow run ID
RUN_ID=$(curl -s -H "Accept: application/vnd.github.v3+json" "https://api.github.com/repos/yangeden01/daily-ai/actions/runs?per_page=1" | grep -m1 '"id":' | tr -dc '0-9')

# 2. Wait and check status until completed
curl -s -H "Accept: application/vnd.github.v3+json" "https://api.github.com/repos/yangeden01/daily-ai/actions/runs/$RUN_ID" | grep -E '"status"|"conclusion"'
```

### Step 5: Deliver Direct APK Download URL
Once the workflow completes with `conclusion: "success"`, provide the user with:
- **Direct APK Download**: `https://github.com/yangeden01/daily-ai/releases/download/v1.0.0-apk/Daily-AI.apk`
- **GitHub Release Page**: `https://github.com/yangeden01/daily-ai/releases/tag/v1.0.0-apk`

---

## One-Click Deployment Script
The project includes `./scripts/deploy-apk.sh` to run steps 1 through 4 in one synchronous or background execution.
