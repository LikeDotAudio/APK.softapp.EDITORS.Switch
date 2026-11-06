// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* The ports' VLANs on the BIM bench (ROAD-3582, network-discovery-3): EDITORS.Switch writes each port's
   VLAN membership and AV profile into the bench VLAN systems; the block keeps only the bench ref and
   the VLAN ids; another editor's members, names and subnets are never touched. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SwitchModel, AV_PROFILES } from '../js/switchModel.js';
import { networkTerminals, findInstance, portsToSystems, systemsToPorts, systemIdsFor, savePorts, loadSystems } from '../js/switchBench.js';

const SW = {
  ref: 'U42', name: 'CORE-SW01', part: { id: 'cisco/cbs350' }, identity: { mac: '00:14:d1:1e:a0:5f' },
  terminals: [
    { pin: 'U42:P1', index: 9, terminal: 'AC', domain: 'power' },
    ...[1, 2, 3, 4].map((n) => ({ pin: `U42:N${n}`, index: n, terminal: `Port ${n}`, domain: 'network' })),
  ],
};

/** A stand-in for the BIM server's bench routes, holding VLAN rows as bim/network.py does. */
function bench(initial = []) {
  const rows = new Map(initial.map((r) => [r.id, r]));
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body && JSON.parse(init.body) });
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (url.endsWith('/bench')) return ok({ instances: [SW] });
    const m = url.match(/\/bench\/systems(?:\/(.+))?$/);
    const id = m[1] && decodeURIComponent(m[1]);
    if (init.method === 'PUT') { rows.set(id, { id, ...JSON.parse(init.body) }); return ok(rows.get(id)); }
    return ok({ items: [...rows.values()].map((r) => ({ ...r, guid: `3${r.id.padEnd(21, 'z')}` })) });
  };
  return { impl, rows, calls };
}

function fourPorts() {
  const m = new SwitchModel(4, 60);
  m.ports[0].profile = 'dante'; m.ports[0].vlan = 10;
  m.ports[1].profile = 'control'; m.ports[1].vlan = 40;
  m.ports[2].profile = 'disabled'; m.ports[2].vlan = 999;
  m.ports[3].profile = 'uplink'; m.ports[3].vlan = 1;
  return m;
}

test('port n is the unit\'s n-th network terminal; the unit is found by ref, MAC or its only part', () => {
  assert.deepEqual(networkTerminals(SW).map((t) => t.pin), ['U42:N1', 'U42:N2', 'U42:N3', 'U42:N4']);
  assert.equal(findInstance([SW], { ref: 'U42' }), SW);
  assert.equal(findInstance([SW], { mac: '00:14:D1:1E:A0:5F' }), SW);
  assert.equal(findInstance([SW], { bimId: 'cisco/cbs350' }), SW);
  assert.equal(findInstance([SW], { ref: 'U9' }), null);
});

test('the ports become members of the bench VLANs, the profile the VLAN\'s, a trunk tagged in all, disabled in none', async () => {
  const other = { ref: 'U7', pin: 'U7:N1' };
  const b = bench([{ id: 'V10', kind: 'vlan', vlan_id: 10, name: 'Dante Primary', members: [other, { ref: 'U42', pin: 'U42:N3' }] }]);
  const m = fourPorts();
  const { systems } = await savePorts(m.ports, SW, AV_PROFILES, { api: '/api/bim', fetchImpl: b.impl });
  assert.deepEqual(b.rows.get('V10'), { id: 'V10', kind: 'vlan', vlan_id: 10, name: 'Dante Primary', profile: 'Dante / AES67 Audio', dscp: 46,
    members: [other, { ref: 'U42', pin: 'U42:N1' }, { ref: 'U42', pin: 'U42:N4', tagged: true }] }, 'the other editor\'s member and the VLAN name kept; U42:N3 (now disabled) left');
  assert.deepEqual(b.rows.get('V40'), { id: 'V40', kind: 'vlan', vlan_id: 40, name: 'AV Control & Intercom', profile: 'AV Control & Intercom', dscp: 0,
    members: [{ ref: 'U42', pin: 'U42:N2' }, { ref: 'U42', pin: 'U42:N4', tagged: true }] });
  assert.deepEqual(systems, ['V10', 'V40']);

  // read back: the same profiles and VLANs, ids in, ids out
  const blank = new SwitchModel(4, 60);
  blank.fromBlock({ ...m.toBlock(), systems, bench: { ref: 'U42' } });
  assert.ok(blank.ports.every((p) => p.vlan === undefined), 'a block with ids carries no per-port VLAN');
  const items = await loadSystems({ api: '/api/bim', fetchImpl: b.impl });
  const ports = systemsToPorts(blank.ports, SW, items, AV_PROFILES);
  assert.deepEqual(ports.map((p) => [p.profile, p.vlan]), [['dante', 10], ['control', 40], ['disabled', 0], ['uplink', 1]]);
  assert.deepEqual(systemIdsFor('U42', items), ['V10', 'V40']);

  // a second save of the same ports writes nothing
  b.calls.length = 0;
  await savePorts(ports, SW, AV_PROFILES, { api: '/api/bim', fetchImpl: b.impl });
  assert.equal(b.calls.filter((c) => c.method === 'PUT').length, 0);
});

test('the block keeps the bench ref and VLAN ids, never the profiles or a per-port VLAN', () => {
  const m = fourPorts();
  m.benchRef = 'U42';
  m.systems = ['V10', 'V40'];
  const block = m.toBlock();
  assert.deepEqual(block.bench, { ref: 'U42' });
  assert.deepEqual(block.systems, ['V10', 'V40']);
  assert.ok(block.ports.every((p) => !('vlan' in p) && !('profile' in p)));
  assert.equal(JSON.stringify(block).includes('poeBudget"'), false, 'no AV_PROFILES copy');
});

test('refused: no bench unit, more ports than terminals, a VLAN under two profiles, VLAN 0', () => {
  const m = fourPorts();
  assert.throws(() => portsToSystems(m.ports, null, [], AV_PROFILES), /bench unit/);
  assert.throws(() => portsToSystems(new SwitchModel(8, 60).ports, SW, [], AV_PROFILES), /4 network terminals/);
  m.ports[1].profile = 'qlan'; m.ports[1].vlan = 10;   // Q-LAN preset on VLAN 10: its preset vlan is 20, so no clash
  assert.doesNotThrow(() => portsToSystems(m.ports, SW, [], AV_PROFILES));
  const two = [{ name: 'A', profile: 'dante', vlan: 10 }, { name: 'B', profile: 'dante', vlan: 10 }];
  const presets = [...AV_PROFILES, { id: 'dante2', name: 'Other Dante', vlan: 10, dscp: 34 }];
  two[1].profile = 'dante2';
  assert.throws(() => portsToSystems(two, SW, [], presets), /two profiles/);
  assert.throws(() => portsToSystems([{ name: 'A', profile: 'general', vlan: 0 }], SW, [], AV_PROFILES), /1\.\.4094/);
});
