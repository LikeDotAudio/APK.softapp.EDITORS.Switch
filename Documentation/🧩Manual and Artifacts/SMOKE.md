# Smoke test — EDITORS.Switch

Is `EDITORS.Switch` deployed? Written by `.apk.scripts/smoke.py` from the module's own shape; what each check means is in that script's header.

← [Wiki home](../README.md)

**✅ PASS** — 3/3 checks, since 2026-11-12 00:27 EST

| Check | Target | Result | Detail |
|---|---|---|---|
| pushed | [APK.softapp.EDITORS.Switch](https://github.com/LikeDotAudio/APK.softapp.EDITORS.Switch.git) | ✅ | HEAD is on origin |
| web | [index.html](https://apk.audio/APK%3ASoftapps/EDITORS/EDITORS.Switch/index.html) | ✅ | HTTP 200 |
| app | `OS/Switch Matrix` → `PODS/POD.THIN/Softapps/EDITORS/EDITORS.Switch/index.html` | ✅ | present |

Re-run: `python3 .apk.scripts/smoke.py PODS/POD.THIN/Softapps/EDITORS/EDITORS.Switch`

<!-- smoke:sig 609309e940d7 since 2026-11-12 00:27 EST -->
