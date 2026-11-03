import test from 'node:test';
import assert from 'node:assert/strict';
import { SwitchModel } from '../js/switchApp.js';

test('SwitchModel initializes ports, sets VLANs and computes PoE budget', () => {
  const sw = new SwitchModel(24);
  assert.equal(sw.ports.length, 24);

  // Check port 1 initial state
  const p1 = sw.ports[0];
  assert.equal(p1.id, 1);
  assert.equal(p1.vlan, 10);
  assert.equal(p1.poe, true);

  // Set VLAN
  sw.setPortVlan(1, 100);
  assert.equal(sw.ports[0].vlan, 100);

  // Set Profile
  sw.setPortProfile(1, 'Video NDI');
  assert.equal(sw.ports[0].profile, 'Video NDI');

  // Total PoE budget
  const initialBudget = sw.getTotalPoeBudget();
  assert.ok(initialBudget > 0);

  // Toggle PoE off
  sw.togglePoe(1);
  assert.equal(sw.ports[0].poe, false);
  assert.ok(sw.getTotalPoeBudget() < initialBudget);
});
