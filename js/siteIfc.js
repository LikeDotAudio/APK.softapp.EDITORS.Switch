// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* Export IFC (IFC-CORE-DELTAS network-discovery-7): the page reads JSON and offers the site model as an
   .ifc DOWNLOAD — GET /api/bim/site.ifc, built by DATABASE.server.BIM (bim/bench_ifc.py: the bench, the
   registry devices and the planned VLANs / subnets / streams of bim/network.py). No IFC parser here. */

export function bimApi() {
  try {
    const fromUrl = new URLSearchParams(globalThis.location?.search || '').get('bim');
    if (fromUrl) return fromUrl.replace(/\/$/, '');
  } catch (_) { /* no location under node */ }
  return (globalThis.APK_BIM_API || '/api/bim').replace(/\/$/, '');
}

export async function exportSiteIfc({ api = bimApi(), fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl(`${api}/site.ifc`);
  if (!res.ok) throw Object.assign(new Error(`site.ifc: ${res.status}`), { status: res.status, code: res.status === 404 ? 'http_not_found' : 'http_server_error' });
  return res.text();
}
