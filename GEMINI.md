# Project Automation Instructions

## Automated APK Deployment Skill
- This project has a dedicated deployment skill defined in `skills/deploy-apk/SKILL.md` and executable script `./scripts/deploy-apk.sh`.
- The project repository is `https://github.com/yangeden01/daily-ai.git`.
- Local Git credentials are permanently stored via `credential.helper store` in `/root/.git-credentials` and the remote origin URL.
- Whenever the user requests "deploy", "執行deploy", "部署", or asks to sync to GitHub:
  1. Verify and compile the applet (`compile_applet`).
  2. Sync Android assets via `npx cap sync android` if native Android or web assets changed.
  3. Commit all changes to the local `master` branch.
  4. Directly run `git push origin master`.
  5. **CRITICAL**: NEVER ask the user to provide their GitHub Token or credentials again; use the stored credentials automatically.
  6. Monitor the triggered GitHub Actions workflow run and report the build and APK status to the user.
