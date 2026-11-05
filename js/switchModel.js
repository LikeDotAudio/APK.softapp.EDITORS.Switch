// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

export const AV_PROFILES = [
  { id: 'dante', name: 'Dante / AES67 Audio', vlan: 10, dscp: 46, poeBudget: 15.4, color: '#38bdf8' },
  { id: 'qlan', name: 'Q-SYS Q-LAN', vlan: 20, dscp: 46, poeBudget: 30.0, color: '#10b981' },
  { id: 'video-ip', name: 'NDI / SMPTE 2110 Video', vlan: 30, dscp: 34, poeBudget: 30.0, color: '#f59e0b' },
  { id: 'control', name: 'AV Control & Intercom', vlan: 40, dscp: 0, poeBudget: 15.4, color: '#a855f7' },
  { id: 'uplink', name: 'Trunk / Uplink (Tagged)', vlan: 1, dscp: 0, poeBudget: 0, color: '#ec4899' },
  { id: 'general', name: 'General Data / Office', vlan: 1, dscp: 0, poeBudget: 0, color: '#64748b' },
  { id: 'disabled', name: 'Disabled', vlan: 999, dscp: 0, poeBudget: 0, color: '#1e293b' },
];

export class SwitchModel {
  constructor(portCount = 24, poeBudgetW = 370) {
    this.id = 'sw_core_01';
    this.name = 'CORE-SW01';
    this.model = '24-Port Managed AV Switch';
    this.portCount = portCount;
    this.poeBudgetW = poeBudgetW;
    this.ports = [];
    this.generatePorts(portCount);
  }

  generatePorts(count) {
    this.ports = [];
    for (let i = 1; i <= count; i++) {
      const isUplink = i > count - 4;
      const profile = isUplink ? 'uplink' : (i <= 8 ? 'dante' : (i <= 16 ? 'qlan' : 'control'));
      const profMeta = AV_PROFILES.find(p => p.id === profile) || AV_PROFILES[0];
      const hasPoe = !isUplink && (i % 2 === 1);

      this.ports.push({
        id: i,
        name: isUplink ? `SFP+ ${i - (count - 4)}` : `Port ${i}`,
        type: isUplink ? 'SFP+' : 'RJ45',
        profile: profile,
        vlan: profMeta.vlan,
        link: true,
        speed: isUplink ? '10G' : '1G',
        poeEnabled: hasPoe,
        poeDrawW: hasPoe ? (profile === 'qlan' ? 18.5 : 8.2) : 0,
        neighbor: isUplink ? 'AGG-SWITCH-01' : (i <= 8 ? `DSP-OUT-${i}` : `TOUCHPANEL-0${i - 8}`),
      });
    }
  }

  /** Plain ports for a switch read off the network: no profile, PoE or neighbour is assumed. */
  generateBlankPorts(count) {
    this.ports = [];
    for (let i = 1; i <= count; i++) {
      this.ports.push({ id: i, name: `Port ${i}`, type: 'RJ45', profile: 'general', vlan: 1, link: false,
        speed: 'Auto', poeEnabled: false, poeDrawW: 0, neighbor: '' });
    }
    this.portCount = count;
  }

  /** The block the CAD stores (toCad.blockSave). */
  toBlock() {
    const block = {
      type: 'network_switch',
      id: this.id,
      name: this.name,
      model: this.model,
      portCount: this.portCount,
      poeBudgetW: this.poeBudgetW,
      totalPoeDrawW: this.getTotalPoeDraw(),
      ports: JSON.parse(JSON.stringify(this.ports)),
    };
    if (this.discovered) block.discovered = { ...this.discovered };
    return block;
  }

  /** Load a block (toEditor.load, a file, or a switch picked off the bus). */
  fromBlock(block = {}) {
    if (!block || typeof block !== 'object') return;
    this.id = block.id || this.id;
    this.name = block.name || this.name;
    if (block.model) this.model = block.model;
    this.poeBudgetW = block.poeBudgetW || this.poeBudgetW;
    if (Array.isArray(block.ports) && block.ports.length > 0) {
      this.ports = JSON.parse(JSON.stringify(block.ports));
      this.portCount = block.ports.length;
    }
    this.discovered = block.discovered ? { ...block.discovered } : null;
  }

  getTotalPoeDraw() {
    return Math.round(this.ports.reduce((sum, p) => sum + (p.poeEnabled ? p.poeDrawW : 0), 0) * 10) / 10;
  }
}
