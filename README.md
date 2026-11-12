# EDITORS.Switch — Network Switch Configurator

**Wiki:** [Documentation/README.md](Documentation/README.md) — principles, architecture, delivery.

Network Switch Soft Application: interactive 24/48-port matrix editor for configuring VLAN tagging (Access/Trunk), 802.3bt PoE power budgets, Link Aggregation Groups (LAG), LLDP neighbor discovery, and Dante/AES67 port profiles.

| | |
|---|---|
| **Opens** | the OS shell (Design → Network & Topology), or `index.html` standalone |
| **Build** | none — plain web files; `npm test` |
| **Ships** | baked into WEB.Frontend-Assets (`up-stack.sh WEB.Frontend-Assets`), served at `:8080/Softapps/EDITORS/EDITORS.Switch/` |

<!-- wiki:smoke -->
**Smoke test** — ✅ PASS 3/3 since 2026-11-12 00:27 EST — [results](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md)
<!-- /wiki:smoke -->
