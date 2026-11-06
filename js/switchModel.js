// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* AV PROFILES ARE PRESETS, NOT THE PLAN (ROAD-3582). Each names a VLAN and its QoS; a port that
   takes one becomes a member of that VLAN on the BIM bench, and the VLAN system carries the profile
   (APK_Vlan.AvProfile, Dscp) — switchBench.js. `trunk`: a tagged member of every VLAN the switch's
   other ports carry; `none`: a member of nothing. Colour and PoE budget are this page's own hints.
   The block never stores them. */
export const AV_PROFILES = [
  { id: 'dante', name: 'Dante / AES67 Audio', vlan: 10, dscp: 46, poeBudget: 15.4, color: '#38bdf8' },
  { id: 'qlan', name: 'Q-SYS Q-LAN', vlan: 20, dscp: 46, poeBudget: 30.0, color: '#10b981' },
  { id: 'video-ip', name: 'NDI / SMPTE 2110 Video', vlan: 30, dscp: 34, poeBudget: 30.0, color: '#f59e0b' },
  { id: 'control', name: 'AV Control & Intercom', vlan: 40, dscp: 0, poeBudget: 15.4, color: '#a855f7' },
  { id: 'uplink', name: 'Trunk / Uplink (Tagged)', vlan: 1, dscp: 0, poeBudget: 0, color: '#ec4899', trunk: true },
  { id: 'general', name: 'General Data / Office', vlan: 1, dscp: 0, poeBudget: 0, color: '#64748b' },
  { id: 'disabled', name: 'Disabled', vlan: 999, dscp: 0, poeBudget: 0, color: '#1e293b', none: true },
];

export class SwitchModel {
  constructor(portCount = 24, poeBudgetW = 370) {
    this.id = 'sw_core_01';
    this.name = 'CORE-SW01';
    this.model = '24-Port Managed AV Switch';
    this.portCount = portCount;
    this.poeBudgetW = poeBudgetW;
    this.benchRef = '';    // the bench instance this switch is (its ports are its network terminals)
    this.systems = [];     // the bench VLAN ids its ports are in
    this.legacy = false;   // ports from an old block that carried their own vlan / profile
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

  /** THE SWITCH IS A BIM PART (ROAD-3572): one picked from the library (📚 Library) gives
      the model its name and its ports — one per network terminal the part declares (SFP
      where the part says so) — and the block keeps bimId and bimRef {part, url, rev}.
      A part that declares no network terminal keeps the current ports. */
  fromPart(part = {}, bimRef = null) {
    const net = (part.ports || []).filter((p) => !/console|serial/i.test(`${p.group || ''} ${p.signal || ''}`)) // a management console is not a switch port
      .filter((p) => p.domain === 'network' || (!p.domain && /RJ-?45|SFP|ethernet|LAN/i.test(`${p.connector || ''} ${p.group || ''}`)));
    const ports = [];
    for (const p of net) {
      const n = Math.max(1, Number(p.count) || 1);
      const sfp = /SFP/i.test(`${p.connector || ''} ${p.group || ''}`);
      for (let i = 0; i < n; i++) {
        const id = ports.length + 1;
        ports.push({ id, name: (p.labels && p.labels[i]) || `${sfp ? 'SFP' : 'Port'} ${id}`, type: sfp ? 'SFP+' : 'RJ45',
          profile: 'general', vlan: 1, link: false, speed: 'Auto', poeEnabled: false, poeDrawW: 0, neighbor: '' });
      }
    }
    if (ports.length) { this.ports = ports; this.portCount = ports.length; }
    this.model = part.name || `${part.manufacturer || ''} ${part.model || ''}`.trim() || part.id || this.model;
    this.bimId = part.id || '';
    this.bimRef = bimRef || (part.ref && part.ref.part ? { ...part.ref } : null);
  }

  /** The block the CAD stores (toCad.blockSave): the switch and its ports as hardware, the bench
      unit it is (`bench.ref`) and the ids of the bench VLANs its ports are in (`systems`). A port's
      VLAN and profile are the bench's (switchBench.js), never copied here (ROAD-3582). */
  toBlock() {
    const block = {
      type: 'network_switch',
      id: this.id,
      name: this.name,
      model: this.model,
      portCount: this.portCount,
      poeBudgetW: this.poeBudgetW,
      totalPoeDrawW: this.getTotalPoeDraw(),
      ports: this.ports.map(({ vlan, profile, tagged, vlanSystem, ...hw }) => JSON.parse(JSON.stringify(hw))),
      systems: [...(this.systems || [])],
    };
    if (this.benchRef) block.bench = { ref: this.benchRef };
    if (this.discovered) block.discovered = { ...this.discovered };
    if (this.bimId) block.bimId = this.bimId;
    if (this.bimRef) block.bimRef = { ...this.bimRef };
    return block;
  }

  /** Load a block (toEditor.load, a file, or a switch picked off the bus). A block with `systems` takes
      its ports' VLANs from the bench (SwitchApp.loadPlan); an old block whose ports carry their own
      vlan / profile loads them as they were (`legacy`) until Save moves them onto the bench. */
  fromBlock(block = {}) {
    if (!block || typeof block !== 'object') return;
    this.id = block.id || this.id;
    this.name = block.name || this.name;
    if (block.model) this.model = block.model;
    this.poeBudgetW = block.poeBudgetW || this.poeBudgetW;
    const ids = Array.isArray(block.systems) ? block.systems.filter((id) => typeof id === 'string' && id) : null;
    if (Array.isArray(block.ports) && block.ports.length > 0) {
      this.ports = JSON.parse(JSON.stringify(block.ports));
      this.portCount = block.ports.length;
      if (ids) for (const p of this.ports) { delete p.vlan; p.profile = ''; }
    }
    this.systems = ids || [];
    this.legacy = !ids && this.ports.some((p) => p.vlan !== undefined || p.profile !== undefined);
    this.benchRef = (block.bench && typeof block.bench.ref === 'string' && block.bench.ref) || '';
    this.discovered = block.discovered ? { ...block.discovered } : null;
    this.bimId = block.bimId || '';
    this.bimRef = block.bimRef ? { ...block.bimRef } : null;
  }

  getTotalPoeDraw() {
    return Math.round(this.ports.reduce((sum, p) => sum + (p.poeEnabled ? p.poeDrawW : 0), 0) * 10) / 10;
  }
}
