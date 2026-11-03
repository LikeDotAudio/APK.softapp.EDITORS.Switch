// Part of APK.audio - Network Switch Soft Application
// Ported from OneThing gui-Interfaces/switches and 130_ipam

export class SwitchModel {
  constructor(portCount = 24) {
    this.portCount = portCount;
    this.ports = Array.from({ length: portCount }, (_, i) => ({
      id: i + 1,
      name: `ge-0/0/${i + 1}`,
      vlan: i < 8 ? 10 : i < 16 ? 20 : 1,
      mode: 'access', // 'access' | 'trunk'
      poe: i < 12,
      poeWatts: i < 12 ? 15.4 : 0,
      link: i < 14,
      profile: i < 8 ? 'Dante Audio' : i < 16 ? 'AES67 Control' : 'Default Data'
    }));
  }

  setPortVlan(portId, vlan) {
    const p = this.ports.find(x => x.id === portId);
    if (p) p.vlan = Number(vlan);
  }

  setPortProfile(portId, profile) {
    const p = this.ports.find(x => x.id === portId);
    if (p) p.profile = profile;
  }

  togglePoe(portId) {
    const p = this.ports.find(x => x.id === portId);
    if (p) {
      p.poe = !p.poe;
      p.poeWatts = p.poe ? 15.4 : 0;
    }
  }

  getTotalPoeBudget() {
    return this.ports.reduce((sum, p) => sum + (p.poe ? p.poeWatts : 0), 0);
  }
}
