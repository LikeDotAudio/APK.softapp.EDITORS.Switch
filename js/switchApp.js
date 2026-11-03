// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { BlockBridge } from './blockBridge.js';
import { SwitchModel, AV_PROFILES } from './switchModel.js';

export class SwitchApp {
  constructor() {
    this.model = new SwitchModel(24, 370);
    this.selectedPortId = 1;

    this.bridge = new BlockBridge({
      name: 'Switch Configurator',
      type: 'network_switch',
      onBlockLoaded: (block, meta) => this.handleBlockLoaded(block, meta),
      onBlockChanged: () => {},
    });

    this.initElements();
    this.attachEvents();
    this.loadInitialData();
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
    this.portTableBody = document.getElementById('switch-port-table-body');
  }

  attachEvents() {
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => this.bridge.close());
    this.btnSyncDiscovered?.addEventListener('click', () => this.loadFromDiscoveredProject());

    this.inputSwitchName.addEventListener('input', (e) => {
      this.model.name = e.target.value;
      this.bridge.notifyChanged();
    });

    this.selectPortCount.addEventListener('change', (e) => {
      const count = parseInt(e.target.value, 10);
      this.model.portCount = count;
      this.model.generatePorts(count);
      this.render();
      this.bridge.notifyChanged();
    });

    this.inputPoeBudget.addEventListener('input', (e) => {
      this.model.poeBudgetW = parseFloat(e.target.value) || 370;
      this.renderTelemetry();
      this.bridge.notifyChanged();
    });
  }

  loadInitialData() {
    this.loadFromDiscoveredProject().catch(() => {
      this.render();
    });
  }

  async loadFromDiscoveredProject() {
    try {
      const data = await this.bridge.fetchDiscoveredProject();
      if (data && (data.switches || data.networkSwitches)) {
        const sws = data.switches || data.networkSwitches;
        if (Array.isArray(sws) && sws.length > 0) {
          this.handleBlockLoaded(sws[0], { title: sws[0].name });
          return;
        }
      }
    } catch (_) {}
    this.render();
  }

  handleBlockLoaded(block, meta = {}) {
    if (!block) return;
    this.model.id = block.id || this.model.id;
    this.model.name = block.name || this.model.name;
    this.model.poeBudgetW = block.poeBudgetW || this.model.poeBudgetW;
    if (Array.isArray(block.ports) && block.ports.length > 0) {
      this.model.ports = block.ports;
      this.model.portCount = block.ports.length;
    }
    this.render();
  }

  saveBlock() {
    const block = {
      type: 'network_switch',
      id: this.model.id,
      name: this.model.name,
      portCount: this.model.portCount,
      poeBudgetW: this.model.poeBudgetW,
      totalPoeDrawW: this.model.getTotalPoeDraw(),
      ports: this.model.ports,
      timestamp: new Date().toISOString(),
    };
    this.bridge.saveBlock(block, {
      title: `${this.model.name} (${this.model.portCount} Ports)`,
      filename: `switch_${this.model.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    });
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
          <span>${p.id}</span>
          <span style="color:${p.link ? 'var(--osc-status-success)' : '#444'};">●</span>
        </div>
        <div style="width:24px; height:16px; margin:4px 0; background:#000; border:1px solid ${profile.color}; border-radius:2px; display:flex; align-items:center; justify-content:center;">
          <span style="font-size:7px; color:${profile.color}; font-weight:bold;">${p.type === 'SFP+' ? 'SFP' : 'RJ'}</span>
        </div>
        <div style="font-size:8px; color:${p.poeEnabled ? 'var(--osc-accent-primary)' : 'var(--osc-text-subtle)'};">
          ${p.poeEnabled ? `${p.poeDrawW}W` : '—'}
        </div>
      `;

      slot.addEventListener('click', () => {
        this.selectedPortId = p.id;
        this.renderVisualGrid();
        const row = document.getElementById(`port-row-${p.id}`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      this.portsGrid.appendChild(slot);
    });
  }

  renderTable() {
    this.portTableBody.innerHTML = '';
    this.model.ports.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.id = `port-row-${p.id}`;
      if (p.id === this.selectedPortId) {
        tr.style.background = 'var(--osc-bg-surface-hover)';
      }

      tr.innerHTML = `
        <td class="col-idx text-center">${p.id}</td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="name" value="${p.name}"></td>
        <td>
          <select class="cell-input" data-idx="${idx}" data-field="profile">
            ${AV_PROFILES.map(pr => `<option value="${pr.id}" ${pr.id === p.profile ? 'selected' : ''}>${pr.name}</option>`).join('')}
          </select>
        </td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="vlan" value="${p.vlan}"></td>
        <td>
          <select class="cell-input" data-idx="${idx}" data-field="speed">
            <option value="1G" ${p.speed === '1G' ? 'selected' : ''}>1G Copper</option>
            <option value="10G" ${p.speed === '10G' ? 'selected' : ''}>10G SFP+</option>
            <option value="100M" ${p.speed === '100M' ? 'selected' : ''}>100M</option>
            <option value="Auto" ${p.speed === 'Auto' ? 'selected' : ''}>Auto</option>
          </select>
        </td>
        <td class="text-center">
          <input type="checkbox" data-idx="${idx}" data-field="poeEnabled" ${p.poeEnabled ? 'checked' : ''}>
        </td>
        <td><input type="number" step="0.1" class="cell-input text-center" data-idx="${idx}" data-field="poeDrawW" value="${p.poeDrawW}"></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="neighbor" value="${p.neighbor || ''}"></td>
      `;
      this.portTableBody.appendChild(tr);
    });

    this.portTableBody.querySelectorAll('.cell-input, input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const f = e.target.dataset.field;
        if (e.target.type === 'checkbox') {
          this.model.ports[i][f] = e.target.checked;
        } else if (f === 'vlan') {
          this.model.ports[i][f] = parseInt(e.target.value, 10) || 1;
        } else if (f === 'poeDrawW') {
          this.model.ports[i][f] = parseFloat(e.target.value) || 0;
        } else {
          this.model.ports[i][f] = e.target.value;
          if (f === 'profile') {
            const prof = AV_PROFILES.find(pr => pr.id === e.target.value);
            if (prof) this.model.ports[i].vlan = prof.vlan;
          }
        }
        this.renderTelemetry();
        this.renderVisualGrid();
        this.bridge.notifyChanged();
      });
    });
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
          this.handleBlockLoaded(parsed, { title: file.name });
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
