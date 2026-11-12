# Smoke test — EDITORS.Switch

Is `EDITORS.Switch` deployed? Written by `.apk.scripts/smoke.py` from the module's own shape; what each check means is in that script's header.

← [Wiki home](../README.md)

**❌ FAIL** — 2/3 checks, since 2026-11-12 00:16 EST

| Check | Target | Result | Detail |
|---|---|---|---|
| pushed | [APK.softapp.EDITORS.Switch](https://github.com/LikeDotAudio/APK.softapp.EDITORS.Switch.git) | ❌ | 1 commit(s) not pushed |
| web | [index.html](https://apk.audio/APK%3ASoftapps/EDITORS/EDITORS.Switch/index.html) | ✅ | HTTP 200 |
| app | `OS/Switch Matrix` → `PODS/POD.THIN/Softapps/EDITORS/EDITORS.Switch/index.html` | ✅ | present |

Re-run: `python3 .apk.scripts/smoke.py PODS/POD.THIN/Softapps/EDITORS/EDITORS.Switch`

<!-- smoke:sig 3491225cdcf5 since 2026-11-12 00:16 EST -->
