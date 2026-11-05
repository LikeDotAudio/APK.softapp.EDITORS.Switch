// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { SwitchModel, AV_PROFILES } from './switchModel.js';
import { switchFromThing } from './switchDiscovered.js';
import { mountDiscovered, loadRules } from './discoveredTable.js';

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
    this.btnClose?.addEventListener('click', () => this.host.close());
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
      rules = await loadRules(import.meta.url);
    } catch (err) {
      if (status) { status.setAttribute('data-apk-state', 'dead'); status.textContent = `Could not read config/discovery.json (${err.message}).`; }
      return;
    }
    this.rules = rules;
    this.network = await mountDiscovered({
      host, status, id: 'switch-discovered', kinds: rules.kinds,
      empty: 'No switch on the bus yet.',
      action: { label: 'Load', run: (thing) => this.loadDiscovered(thing) },
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
  }

  saveMeta() {
    return {
      title: `${this.model.name} (${this.model.portCount} Ports)`,
      filename: `switch_${String(this.model.name).toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    };
  }

  saveBlock() {
    this.host.save(this.model.toBlock(), this.saveMeta());
  }

  render() {
    this.inputSwitchName.value = this.model.name;
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
      const profile = AV_PROFILES.find(pr => pr.id === p.profile) || AV_PROFILES[0];
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
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          const parsed = JSON.parse(re.target.result);
          this.handleBlockLoaded(parsed);
          this.changed();
        } catch (err) {
          alert('Invalid JSON switch block');
        }
      };
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
