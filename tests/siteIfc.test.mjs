// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportSiteIfc } from '../js/siteIfc.js';

test('Export IFC is GET /api/bim/site.ifc, the text as the BIM writes it', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return { ok: true, status: 200, text: async () => 'ISO-10303-21;' }; };
  assert.equal(await exportSiteIfc({ api: '/api/bim', fetchImpl }), 'ISO-10303-21;');
  assert.deepEqual(calls, ['/api/bim/site.ifc']);
  const missing = async () => ({ ok: false, status: 404, text: async () => '' });
  await assert.rejects(exportSiteIfc({ api: '/api/bim', fetchImpl: missing }), (e) => e.code === 'http_not_found');
});
