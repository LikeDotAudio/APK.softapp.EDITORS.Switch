// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SwitchModel, AV_PROFILES } from '../js/switchModel.js';

test('Switch Model Port Generation and PoE Calculation', () => {
  const sw = new SwitchModel(24, 370);
  assert.equal(sw.ports.length, 24);

  const draw = sw.getTotalPoeDraw();
  assert.ok(draw > 0);
  assert.ok(draw <= 370);

  const dantePort = sw.ports.find(p => p.profile === 'dante');
  assert.ok(dantePort);
  assert.equal(dantePort.vlan, 10);
});

test('AV Profiles Catalog', () => {
  assert.ok(AV_PROFILES.length >= 5);
  const qlan = AV_PROFILES.find(p => p.id === 'qlan');
  assert.ok(qlan);
  assert.equal(qlan.vlan, 20);
  assert.equal(qlan.dscp, 46);
});

test('a switch picked from the BIM library takes its model and network ports, and keeps its BIM reference (ROAD-3572)', async () => {
  const { SwitchModel } = await import('../js/switchModel.js');
  const m = new SwitchModel(24, 370);
  const ref = { part: 'cisco/cbs350-24p-4g-na', url: 'http://apk.local:8160/api/bim/parts/cisco/cbs350-24p-4g-na', rev: 'r1' };
  m.fromPart({ id: 'cisco/cbs350-24p-4g-na', name: 'Cisco CBS350-24P-4G Managed Switch', ports: [
    { group: 'PoE+ Gigabit Ports 1-24', domain: 'network', count: 24 },
    { group: 'SFP Uplink Ports 25-28', domain: 'network', count: 4 },
    { group: 'Console Port', domain: 'control', connector: 'RJ45 serial console', count: 1 },
    { group: 'AC', domain: 'power', count: 1 }] }, ref);
  assert.equal(m.model, 'Cisco CBS350-24P-4G Managed Switch');
  assert.equal(m.portCount, 28, 'the console and mains are not switch ports');
  assert.equal(m.ports.filter((p) => p.type === 'SFP+').length, 4);
  const b = m.toBlock();
  assert.equal(b.bimId, 'cisco/cbs350-24p-4g-na');
  assert.deepEqual(b.bimRef, ref);
  const old = new SwitchModel(24, 370);
  old.fromBlock({ name: 'X', model: 'Typed by hand', ports: [] });
  assert.equal(old.toBlock().model, 'Typed by hand', 'a saved block from before stays readable');
  assert.equal(old.toBlock().bimRef, undefined);
});
