// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* ROAD-3488: the switch block goes in and out over cad.like.audio/host@1
   (vendor/apk-softapp), never '*', and a switch the bus discovered becomes a
   block keyed on its MAC, with nothing made up. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { world, hostContract, discovery, ORIGIN } from './softappWorld.mjs';
import { SwitchModel } from '../js/switchModel.js';
import { switchFromThing, tableRows } from '../js/switchDiscovered.js';

const rules = JSON.parse(fs.readFileSync(new URL('../config/discovery.json', import.meta.url)));

/* The app's own wiring (switchApp.js constructor), around the real model. */
function editor(S) {
  const model = new SwitchModel(8, 120);
  const host = S.connectHost({
    editor: 'Switch Configurator', blockType: 'network_switch', notice: false,
    onLoad: (block) => model.fromBlock(block),
    onRequest: () => ({ block: model.toBlock(), meta: { filename: 'switch_x' } }),
  });
  return { model, host };
}

test('block round trip: load from the CAD, edit, request answers blockSave with the edit, all at our origin', async () => {
  const { S, toParent, fire } = world();
  const { model } = editor(S);
  const sent = new SwitchModel(4, 60);
  sent.name = 'FOH-SW';
  sent.ports[1].vlan = 42;
  fire({ protocol: 'cad.like.audio/host@1', type: 'load', block: sent.toBlock(), meta: { blockName: 'FOH-SW' } });
  assert.equal(model.name, 'FOH-SW');
  assert.equal(model.ports.length, 4);
  assert.equal(model.ports[1].vlan, 42);

  model.ports[0].name = 'Stage box A';
  fire({ protocol: 'cad.like.audio/host@1', type: 'request' });
  const save = toParent.at(-1);
  assert.equal(save.o, ORIGIN, 'never "*"');
  assert.equal(save.m.type, 'blockSave');
  assert.equal(save.m.blockType, 'network_switch');
  assert.equal(save.m.block.ports[0].name, 'Stage box A');
  assert.equal(save.m.block.ports[1].vlan, 42);
  assert.equal(save.m.meta.blockName, 'FOH-SW', 'the CAD meta comes back');

  const contract = await hostContract();
  if (contract) {
    for (const { m } of toParent) assert.deepEqual(contract.validateMessage(contract.schema, 'toCad', m), [], m.type);
  }
});

test('a message from anywhere but the parent at our origin is ignored', () => {
  const { S, fire } = world();
  const { model } = editor(S);
  fire({ protocol: 'cad.like.audio/host@1', type: 'load', block: { name: 'EVIL', ports: [] } }, { origin: 'http://elsewhere' });
  fire({ type: 'APK_LOAD_BLOCK', block: { name: 'OLD' } });
  assert.equal(model.name, 'CORE-SW01');
});

test('standalone, Save downloads the block once and says download', () => {
  const { S, downloads, toParent } = world({ framed: false });
  const { model, host } = editor(S);
  assert.equal(host.embedded, false);
  assert.equal(host.save(model.toBlock(), { filename: 'switch_core' }), 'download');
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, 'switch_core.json');
  assert.equal(toParent.length, 0);
});

test('the bench TEG-240WS on the bus becomes a block keyed on its MAC, 24 ports from its port table, nothing invented', () => {
  const { S, win } = world({ contracts: true });
  if (!win.APKContracts) return;
  const now = Date.parse('2026-11-04T12:00:00Z');
  const { model: disc, roots } = discovery(S, win, now);
  // what PLUGIN.SNMP published on the bench, 2026-11-04 (ROAD-3502): the runner's leaves and
  // the TEG-240WS MIB subtree only, no MIB-II (sysName / sysDescr / ifNumber are never walked)
  const dev = `${roots.protocols}/snmp/Device/snmp_00_14_d1_1e_a0_5f`;
  disc.ingest(`${dev}/device_class`, 'Network Switch');
  disc.ingest(`${dev}/model`, 'TEG-240WS                                3.02.03');
  disc.ingest(`${dev}/name`, 'snmp_00_14_d1_1e_a0_5f');
  disc.ingest(`${dev}/notes`, 'answers SNMP at 44.44.44.161');
  disc.ingest(`${dev}/1_3_6_1_4_1_28866_2_11_11_13_0`, '00 14 D1 1E A0 5F ');
  const port = '1_3_6_1_4_1_28866_2_11_11_6_1';   // configPortTable.configPortEntry
  for (let i = 1; i <= 24; i++) {
    disc.ingest(`${dev}/${port}_1_${i}`, String(i));   // configPort: the row index
    disc.ingest(`${dev}/${port}_3_${i}`, '5');         // configPortOperStatus
  }
  disc.ingest(`${dev}/1_3_6_1_4_1_28866_2_11_14_1_1_1_6`, '6');   // a trunk table row: not a port
  const things = disc.things().filter((t) => rules.kinds.some((k) => t.kinds.some((x) => x.includes(k))));
  assert.equal(things.length, 1);
  const t = things[0];
  assert.equal(tableRows(t, rules.portRows), 24, 'configPort rows, not every table');

  const block = switchFromThing(t, rules);
  assert.equal(block.id, 'sw_00_14_d1_1e_a0_5f', 'identity is the MAC, never the address');
  assert.equal(block.name, t.name, 'no name leaf on the bus: the thing\'s own name');
  assert.ok(!/44\.44\./.test(block.name + block.id), 'the address is never the name or the id');
  assert.equal(block.portCount, 24);
  assert.match(block.model, /^TEG-240WS/);
  assert.equal(block.discovered.description, '', 'no sysDescr on the bus: none invented');

  const m = new SwitchModel();
  m.generateBlankPorts(block.portCount);
  m.fromBlock({ ...block, ports: m.ports });
  assert.equal(m.ports.length, 24);
  assert.ok(m.ports.every((p) => !p.poeEnabled && p.neighbor === '' && p.profile === 'general'));
  assert.deepEqual(m.toBlock().discovered.identity, '00:14:d1:1e:a0:5f');
});

test('a port count leaf wins over the table, and maxPorts caps either', () => {
  const thing = { id: 'x', mac: '00:00:00:00:00:01', fields: { snmp: { port_count: '200' } } };
  assert.equal(switchFromThing(thing, { fields: { portCount: ['port_count'] }, portRows: ['c'], maxPorts: 96 }).portCount, 96);
  const rows = { id: 'y', mac: '00:00:00:00:00:02', fields: { snmp: { c_1: '1', c_2: '2', c_3: '', c_x: '9' } } };
  assert.equal(switchFromThing(rows, { portRows: ['c'] }).portCount, 2, 'an empty row or a non-index leaf is not a port');
});

test('no port count on the bus: the block says 0 and the editor keeps its ports', () => {
  const block = switchFromThing({ id: 'serial:X1', serial: 'X1', name: 'sw', fields: {}, protocols: ['netgear'] }, rules);
  assert.equal(block.portCount, 0);
  assert.equal(block.id, 'sw_x1', 'the serial, when there is no MAC');
});
