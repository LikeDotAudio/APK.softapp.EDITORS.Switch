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
