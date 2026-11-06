// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { libraryButton, acceptLibraryDrops, bimFields } from './bimLibrary.js';
import { SwitchModel, AV_PROFILES } from './switchModel.js';
import { switchFromThing } from './switchDiscovered.js';
import { exportSiteIfc } from './siteIfc.js';
import { loadInstances, loadSystems, savePorts, systemsToPorts, systemIdsFor, findInstance, networkTerminals } from './switchBench.js';

const esc = (s) => window.APKSoftapp.esc(s);
const SPEEDS = ['1G', '10G', '100M', 'Auto'];

export class SwitchApp {
  constructor() {
    this.model = new SwitchModel(24, 370);
    this.selectedPortId = 1;

    /* The CAD link: cad.like.audio/host@1 through vendor/apk-softapp. Same
       origin only; standalone, Save downloads the block as .json. */
    this.host = window.APKSoftapp.connectHost({
      editor: 'Switch Configurator',
      blockType: 'network_switch',
      onLoad: (block) => this.handleBlockLoaded(block),
      onRequest: () => ({ block: this.model.toBlock(), meta: this.saveMeta() }),
    });

    window.APKSoftapp.describe({
      name: 'Switch Configurator',
      does: 'Plans a network switch port by port — label, AV profile / QoS preset, VLAN, speed, PoE and the connected device — and checks the PoE draw against the budget.',
      inputs: [
        { name: 'Switch block', from: 'the CAD drawing (network_switch block) when opened from the CAD', kind: 'cad' },
        { name: 'Block file', from: 'a .json saved by this editor, picked with Open', kind: 'file' },
        { name: 'Device library', from: 'the BIM library (📚 Library, Ctrl+Shift+L, or a part dragged onto the port grid): the switch model and its ports, kept as bimId and bimRef' },
        { name: 'Switches on the network', from: 'what the bus has discovered (SNMP bridge, vendor plugins); which kinds show is config/discovery.json', kind: 'bus' },
        { name: 'The bench plan', from: 'DATABASE.server.BIM GET /api/bim/bench (the unit) and /api/bim/bench/systems (its ports\' VLANs and profiles)' },
      ],
      outputs: [
        { name: 'Switch block', to: 'the CAD drawing on Save & Return, or a switch_<name>.json download when standalone: the hardware, bench.ref and the bench VLAN ids (no per-port VLAN copy)', kind: 'file' },
        { name: 'The bench plan', to: 'DATABASE.server.BIM bench VLAN systems on ⇧ To bench / Save: each port a member (a trunk tagged), the VLAN its AV profile and DSCP' },
        { name: 'Site model', to: 'a site.ifc download on Export IFC (GET /api/bim/site.ifc)', kind: 'file' },
      ],
      controls: [
        { name: 'Switch name / port count / PoE budget', how: 'The fields above the port grid (changing the port count regenerates the ports)' },
        { name: '📚 Library', how: 'Pick the switch from the BIM library (Ctrl+Shift+L): its model and network ports' },
        { name: 'Select a port', how: 'Click it in the front-panel grid or its row in the port table' },
        { name: 'Edit a port', how: 'Port table: label, AV profile (sets its VLAN), VLAN, speed, PoE on/off, PoE watts, neighbour' },
        { name: 'Load a discovered switch', how: 'Load on its row in the network table (Discovered button shows / hides it)' },
        { name: 'Bench unit', how: 'which BIM bench instance this switch is (its network terminals are the ports)' },
        { name: '⇩ From bench / ⇧ To bench', how: 'read / write each port\'s VLAN membership and AV profile in the bench plan' },
        { name: 'Open / Save & Return / Close', how: 'Top-bar buttons (Save writes the VLANs to the bench first)' },
        { name: 'Export IFC', how: 'download the site model (site.ifc) the BIM server builds; the page parses no IFC' },
      ],
      problems: ['file_unreadable', 'bad_json', 'bad_input', 'config_invalid', 'bus_missing', 'device_stale', 'http_not_found', 'http_server_error'],
    });
    this.initElements();
    this.attachEvents();
    this.render();
    this.startDiscovered();
  }

  initElements() {
    this.btnOpen = document.getElementById('btn-open');
    this.btnSave = document.getElementById('btn-save');
    this.btnClose = document.getElementById('btn-close');
    this.btnSyncDiscovered = document.getElementById('btn-sync-discovered');

    this.inputSwitchName = document.getElementById('input-switch-name');
    this.selectPortCount = document.getElementById('select-port-count');
    this.inputPoeBudget = document.getElementById('input-poe-budget');

    this.poeDrawEl = document.getElementById('poe-draw');
    this.poeBudgetEl = document.getElementById('poe-budget');
    this.poeBarEl = document.getElementById('poe-bar-fill');

    this.portsGrid = document.getElementById('ports-visual-grid');
    this.portTableHost = document.getElementById('switch-port-table');
  }

  changed() {
    this.host.changed(this.model.toBlock());
  }

  attachEvents() {
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    document.getElementById('btn-export-ifc')?.addEventListener('click', async () => {
      try {
        const text = await exportSiteIfc();
        const url = URL.createObjectURL(new Blob([text], { type: 'model/step' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: 'site.ifc' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        window.APKSoftapp.showProblem(err, { subject: 'site.ifc' });
      }
    });
    this.btnClose?.addEventListener('click', () => this.host.close());
    document.getElementById('btn-from-bench')?.addEventListener('click', () => this.loadPlan());
    document.getElementById('btn-to-bench')?.addEventListener('click', () => this.toBench());
    this.selectBench = document.getElementById('select-bench-unit');
    this.selectBench?.addEventListener('change', (e) => {
      this.model.benchRef = e.target.value;
      if (this.model.benchRef) this.loadPlan(); else this.changed();
    });
    this.fillBenchUnits();
    this.btnSyncDiscovered?.addEventListener('click', () => document.body.classList.toggle('net-hidden'));

    this.inputSwitchName.addEventListener('input', (e) => {
      this.model.name = e.target.value;
      this.changed();
    });

    this.selectPortCount.addEventListener('change', (e) => {
      const count = parseInt(e.target.value, 10);
      this.model.portCount = count;
      this.model.generatePorts(count);
      this.render();
      this.changed();
    });

    // 📚 Library (ROAD-3572): the switch is a BIM part, with its BIM reference
    const usePart = (it) => {
      this.model.fromPart(it.bim, bimFields(it).bimRef);
      const tag = document.getElementById('block-tag');
      if (tag) tag.textContent = `BIM: ${this.model.model}`;
      this.render();
      this.changed();
    };
    this.inputSwitchName.closest('.form-group-inline')?.after(libraryButton((items) => usePart(items[0]), {
      className: 'btn btn-secondary btn-sm', title: 'Pick this switch from the BIM library', filter: { category: 'Network' } }));
    if (this.portsGrid) acceptLibraryDrops(this.portsGrid, usePart);

    this.inputPoeBudget.addEventListener('input', (e) => {
      this.model.poeBudgetW = parseFloat(e.target.value) || 370;
      this.renderTelemetry();
      this.changed();
    });
  }

  /* The switches the bus already knows (SNMP bridge, vendor plugins): which
     ones is config/discovery.json, never a list here. Load takes one in. */
  async startDiscovered() {
    const host = document.getElementById('net-table');
    const status = document.getElementById('net-status');
    if (!host) return;
    let rules;
    try {
      const cfg = await window.APKSoftapp.discoveredConfig(new URL('../config/discovery.json', import.meta.url), { required: true });
      if (cfg.problem) throw Object.assign(new Error(cfg.why), { problem: cfg.problem });
      rules = cfg;
    } catch (err) {
      if (status) { status.setAttribute('data-apk-state', 'dead'); status.textContent = `Could not read config/discovery.json (${err.message}).`; }
      window.APKSoftapp.showProblem(err.problem || err, {
        into: status || undefined, subject: 'config/discovery.json', detail: err.message,
        fix: ['config/discovery.json beside this app says which discovered kinds are switches; it must be served and be valid JSON ({ "kinds": [...] }).'],
        onRetry: () => this.startDiscovered(),
      });
      return;
    }
    this.rules = rules;
    this.network = await window.APKSoftapp.discoveredPanel(host, {
      status, id: 'switch-discovered', config: rules,
      empty: 'No switch on the bus yet.',
      pickLabel: 'Load', onPick: (thing) => this.loadDiscovered(thing),
    });
  }

  loadDiscovered(thing) {
    const block = switchFromThing(thing, this.rules || {});
    if (block.portCount > 0) this.model.generateBlankPorts(block.portCount);
    this.model.fromBlock({ ...block, ports: block.portCount > 0 ? this.model.ports : [] });
    const tag = document.getElementById('block-tag');
    if (tag) tag.textContent = `FROM THE NETWORK: ${block.discovered.identity}`;
    this.render();
    this.changed();
  }

  handleBlockLoaded(block) {
    if (!block) return;
    this.model.fromBlock(block);
    this.render();
    if (!this.model.legacy && (this.model.benchRef || this.model.systems.length)) this.loadPlan();
  }

  /* THE PORTS' VLANS ARE THE BENCH'S (switchBench.js, ROAD-3582). */

  /** The bench units a switch can be: instances with network terminals. */
  async fillBenchUnits() {
    if (!this.selectBench) return;
    try {
      this.instances = await loadInstances();
    } catch (_) {
      this.instances = [];   // no bench: the select stays "not on the bench"; To bench names the problem
    }
    const keep = this.model.benchRef;
    this.selectBench.length = 1;
    for (const i of this.instances.filter((x) => networkTerminals(x).length)) {
      this.selectBench.add(new Option(`${i.ref} · ${i.name || i.part?.name || ''} (${networkTerminals(i).length})`, i.ref));
    }
    this.selectBench.value = keep || '';
  }

  /** This switch's bench instance, found by its ref, its discovered MAC or its part. */
  async benchInstance() {
    if (!this.instances?.length) this.instances = await loadInstances();
    const inst = findInstance(this.instances, { ref: this.model.benchRef, mac: this.model.discovered?.identity, bimId: this.model.bimId });
    if (inst) {
      this.model.benchRef = inst.ref;
      if (this.selectBench) this.selectBench.value = inst.ref;
    }
    return inst;
  }

  /** ⇩ From bench: each port's VLAN and profile as the bench plans them. */
  async loadPlan() {
    try {
      const inst = await this.benchInstance();
      if (!inst) throw Object.assign(new Error('this switch is not a bench unit yet'), { code: 'bad_input' });
      const items = await loadSystems();
      this.model.ports = systemsToPorts(this.model.ports, inst, items, AV_PROFILES);
      this.model.systems = systemIdsFor(inst.ref, items);
      this.model.legacy = false;
      this.render();
      this.changed();
      return this.model.ports;
    } catch (err) {
      window.APKSoftapp.showProblem(err, { subject: 'the bench plan', fix: ['Pick the Bench unit this switch is; the plan is the BIM bench (DATABASE.server.BIM, /api/bim): check it is running in DockTor.'], onRetry: () => this.loadPlan() });
      return null;
    }
  }

  /** ⇧ To bench: every port a member of its VLAN (a trunk tagged in all), the VLAN its preset's profile. */
  async toBench() {
    try {
      const inst = await this.benchInstance();
      if (!inst) throw Object.assign(new Error('this switch is not a bench unit yet'), { code: 'bad_input' });
      const { items, systems } = await savePorts(this.model.ports, inst, AV_PROFILES);
      this.model.ports = systemsToPorts(this.model.ports, inst, items, AV_PROFILES);
      this.model.systems = systems;
      this.model.legacy = false;
      this.render();
      return systems;
    } catch (err) {
      window.APKSoftapp.showProblem(err, { subject: 'ports on the bench', fix: ['Pick the Bench unit this switch is (its network terminals are the ports); each port a VLAN 1..4094; one profile per VLAN.'], onRetry: () => this.toBench() });
      return null;
    }
  }

  saveMeta() {
    return {
      title: `${this.model.name} (${this.model.portCount} Ports)`,
      filename: `switch_${String(this.model.name).toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    };
  }

  /** Save & Return: the ports' VLANs go onto the bench first, then the block (hardware + VLAN ids). */
  async saveBlock() {
    if (!(await this.toBench())) return null;
    const block = this.model.toBlock();
    this.host.save(block, this.saveMeta());
    return block;
  }

  render() {
    this.inputSwitchName.value = this.model.name;
    // a part's own port count need not be one of the densities: show it as an option
    if (![...this.selectPortCount.options].some((o) => Number(o.value) === this.model.portCount)) {
      this.selectPortCount.add(new Option(`${this.model.portCount} Ports (the part's)`, String(this.model.portCount)));
    }
    this.selectPortCount.value = this.model.portCount;
    this.inputPoeBudget.value = this.model.poeBudgetW;
    this.renderTelemetry();
    this.renderVisualGrid();
    this.renderTable();
  }

  renderTelemetry() {
    const draw = this.model.getTotalPoeDraw();
    const budget = this.model.poeBudgetW;
    const pct = Math.min(100, Math.round((draw / budget) * 100));

    this.poeDrawEl.textContent = `${draw} W`;
    this.poeBudgetEl.textContent = `${budget} W`;
    if (this.poeBarEl) {
      this.poeBarEl.style.width = `${pct}%`;
      this.poeBarEl.style.background = pct > 90 ? 'var(--osc-status-danger)' : (pct > 75 ? 'var(--osc-status-warning)' : 'var(--osc-accent-secondary)');
    }
  }

  renderVisualGrid() {
    this.portsGrid.innerHTML = '';
    this.model.ports.forEach(p => {
      const isSelected = p.id === this.selectedPortId;
      const profile = AV_PROFILES.find(pr => pr.id === p.profile) || AV_PROFILES.find(pr => pr.id === 'general') || AV_PROFILES[0];
      const slot = document.createElement('div');
      slot.className = `port-bezel ${isSelected ? 'selected' : ''}`;
      slot.style.display = 'flex';
      slot.style.flexDirection = 'column';
      slot.style.alignItems = 'center';
      slot.style.padding = '6px';
      slot.style.background = isSelected ? 'var(--osc-bg-surface-hover)' : 'var(--osc-bg-input)';
      slot.style.border = `1px solid ${isSelected ? 'var(--osc-accent-primary)' : 'var(--osc-border-default)'}`;
      slot.style.borderRadius = '3px';
      slot.style.cursor = 'pointer';

      slot.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; font-size:8px; color:var(--osc-text-muted);">
          <span>${esc(p.id)}</span>
          <span style="color:${p.link ? 'var(--osc-status-success)' : '#444'};">●</span>
        </div>
        <div style="width:24px; height:16px; margin:4px 0; background:#000; border:1px solid ${esc(profile.color)}; border-radius:2px; display:flex; align-items:center; justify-content:center;">
          <span style="font-size:7px; color:${esc(profile.color)}; font-weight:bold;">${p.type === 'SFP+' ? 'SFP' : 'RJ'}</span>
        </div>
        <div style="font-size:8px; color:${p.poeEnabled ? 'var(--osc-accent-primary)' : 'var(--osc-text-subtle)'};">
          ${p.poeEnabled ? `${esc(p.poeDrawW)}W` : '—'}
        </div>
      `;

      slot.addEventListener('click', () => {
        this.selectedPortId = p.id;
        this.renderVisualGrid();
        const i = this.model.ports.indexOf(p);
        if (this.portTable && i >= 0) this.portTable.select(i);
      });

      this.portsGrid.appendChild(slot);
    });
  }

  /* The port schedule is an APKTable (vendor/apk-table), reachable by script
     as APKTable.get('switch-ports'). Rows are the model's own port objects. */
  renderTable() {
    if (!this.portTableHost || !window.APKTable) return;
    if (this.portTable) { this.portTable.setRows(this.model.ports); return; }
    this.portTable = window.APKTable.create(this.portTableHost, {
      id: 'switch-ports',
      searchPlaceholder: 'Filter ports',
      empty: 'No ports.',
      columns: [
        { key: 'id', label: 'Port #', type: 'number', editable: false },
        { key: 'name', label: 'Description / Label' },
        { key: 'profile', label: 'AV Profile / QoS Preset', type: 'select', options: AV_PROFILES.map((pr) => pr.id) },
        { key: 'vlan', label: 'VLAN', type: 'number' },
        { key: 'speed', label: 'Speed', type: 'select', options: SPEEDS },
        { key: 'poeEnabled', label: 'PoE', render: (v, row) => this.poeBox(row) },
        { key: 'poeDrawW', label: 'PoE Watts', type: 'number' },
        { key: 'neighbor', label: 'Connected Device / LLDP Neighbor' },
      ],
      rows: this.model.ports,
      onSelect: (i, row) => { if (row && row.id !== this.selectedPortId) { this.selectedPortId = row.id; this.renderVisualGrid(); } },
      onEdit: (i, key, value, row) => {
        if (key === 'vlan') row.vlan = parseInt(value, 10) || 1;
        if (key === 'poeDrawW') row.poeDrawW = parseFloat(value) || 0;
        if (key === 'profile') {
          const prof = AV_PROFILES.find((pr) => pr.id === value);
          if (prof) { row.vlan = prof.vlan; this.portTable.setRows(this.model.ports); }
        }
        this.renderTelemetry();
        this.renderVisualGrid();
        this.changed();
      },
    });
  }

  poeBox(row) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!row.poeEnabled;
    box.onchange = () => {
      row.poeEnabled = box.checked;
      this.renderTelemetry();
      this.renderVisualGrid();
      this.changed();
    };
    return box;
  }

  promptOpen() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const S = window.APKSoftapp;
      const again = () => this.promptOpen();
      const reader = new FileReader();
      reader.onload = (re) => {
        let parsed;
        try {
          parsed = JSON.parse(re.target.result);
        } catch (err) {
          S.showProblem('bad_json', { subject: file.name, detail: err.message, onRetry: again });
          return;
        }
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ports)) {
          S.showProblem('bad_input', {
            subject: file.name,
            detail: 'This is not a switch block: it has no "ports" list.',
            fix: ['Open a .json saved by this editor (Save & Return when standalone downloads one), or Load a switch from the network table.'],
            onRetry: again,
          });
          return;
        }
        this.handleBlockLoaded(parsed);
        this.changed();
      };
      reader.onerror = () => S.showProblem('file_unreadable', { subject: file.name, detail: reader.error && reader.error.message, onRetry: again });
      reader.readAsText(file);
    };
    input.click();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.switchApp = new SwitchApp();
  });
}
