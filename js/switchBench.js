// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* THE PORTS' VLANS ON THE BENCH (IFC-CORE-DELTAS network-discovery-3, ROAD-3582).

   A port's VLAN and AV profile are not the switch block's to keep: they are
   the site's plan, held once in the BIM bench (DATABASE.server.BIM
   bim/network.py) as VLAN systems — GET /api/bim/bench/systems, PUT
   /api/bim/bench/systems/<id>. A port is a MEMBER of the VLAN it carries:

     {id:'V10', kind:'vlan', vlan_id:10, profile:'Dante / AES67 Audio', dscp:46,
      members:[{ref:'U42', pin:'U42:N1'}, {ref:'U42', pin:'U42:N24', tagged:true}]}

   In the IFC twin that is IfcRelAssignsToGroup(VLAN IfcDistributionSystem,
   the switch's DATA IfcDistributionPorts), a trunk's list in
   APK_NetworkPort.TaggedVlans, and the profile is APK_Vlan.AvProfile / Dscp.

   The switch must be a bench instance (its `ref`) for its ports to be
   members: port n is the instance's n-th network terminal. The AV profiles
   (switchModel.js AV_PROFILES) are PRESETS that name a VLAN and its QoS; a
   preset's `trunk` makes the port a tagged member of every VLAN the switch's
   other ports carry, `none` makes it a member of nothing. The block keeps the
   bench ref and the ids of the VLANs its ports are in — never the profiles,
   never a per-port VLAN copy. Never deleted here: a VLAN the switch no longer
   uses keeps its name, its subnets and the other editors' members. */

import { bimApi } from './siteIfc.js';

const NETWORK = /RJ-?45|SFP|ethernet|\bLAN\b|\beth\d*\b|network/i;

/** The instance's network terminals in their order: port n of the switch is the n-th of them. */
export function networkTerminals(instance = {}) {
  const ts = (instance.terminals || []).filter((t) => t.domain === 'network'
    || (!t.domain && NETWORK.test(`${t.terminal || ''} ${t.connector || ''} ${t.signal || ''}`)));
  return [...ts].sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));
}

/** The bench instance this switch is: by its stored ref, else the one discovered MAC, else the only one of its part. */
export function findInstance(instances = [], { ref, mac, bimId } = {}) {
  if (ref) return instances.find((i) => i.ref === ref) || null;
  const m = String(mac || '').toLowerCase();
  if (m) {
    const hit = instances.find((i) => String(i.identity?.mac || '').toLowerCase() === m);
    if (hit) return hit;
  }
  if (bimId) {
    const same = instances.filter((i) => (i.part?.id || i.part) === bimId);
    if (same.length === 1) return same[0];
  }
  return null;
}

const presetById = (presets, id) => presets.find((p) => p.id === id) || null;

/** The ports as the bench plans them: each one's untagged VLAN, and the preset its VLAN's profile names. */
export function systemsToPorts(ports, instance, systems = [], presets = []) {
  const terms = networkTerminals(instance);
  const vlans = systems.filter((s) => s.kind === 'vlan');
  return ports.map((p, i) => {
    const pin = terms[i]?.pin;
    if (!pin) return { ...p };
    const mine = vlans.filter((v) => (v.members || []).some((m) => m.ref === instance.ref && m.pin === pin));
    const access = mine.find((v) => !(v.members || []).find((m) => m.ref === instance.ref && m.pin === pin).tagged);
    if (!access) {
      if (mine.length) return { ...p, profile: presets.find((pr) => pr.trunk)?.id || p.profile, vlan: 1, tagged: mine.map((v) => v.vlan_id) };
      return { ...p, profile: presets.find((pr) => pr.none)?.id || '', vlan: 0 };
    }
    const preset = presets.find((pr) => !pr.trunk && !pr.none && access.profile && pr.name === access.profile)
      || presets.find((pr) => !pr.trunk && !pr.none && pr.vlan === access.vlan_id) || null;
    const { tagged, ...rest } = p;
    return { ...rest, profile: preset ? preset.id : '', vlan: access.vlan_id, vlanSystem: access.id };
  });
}

/** The PUTs that make the bench's VLANs hold these ports: this switch's members are rewritten, nobody else's.
    Throws bad_input when a port has no terminal or two ports put one VLAN under two profiles. */
export function portsToSystems(ports, instance, existing = [], presets = []) {
  const ref = instance?.ref;
  if (!ref) throw Object.assign(new Error('the switch is not a bench instance: pick its bench unit first'), { code: 'bad_input' });
  const terms = networkTerminals(instance);
  if (ports.length > terms.length) {
    throw Object.assign(new Error(`${ref} has ${terms.length} network terminals on the bench, the switch ${ports.length} ports`), { code: 'bad_input' });
  }
  const before = new Map(existing.filter((s) => s.kind === 'vlan').map((s) => [s.id, JSON.stringify(s)]));
  const rows = new Map(existing.filter((s) => s.kind === 'vlan').map((s) => {
    const { guid, ...keep } = JSON.parse(JSON.stringify(s));
    keep.members = (keep.members || []).filter((m) => m.ref !== ref);
    return [s.id, keep];
  }));
  const byVid = (vid) => [...rows.values()].find((r) => r.vlan_id === vid);
  const profiled = new Map();
  const trunks = [];
  ports.forEach((p, i) => {
    const pin = terms[i].pin;
    const preset = presetById(presets, p.profile);
    if (preset?.none) return;
    if (preset?.trunk) { trunks.push(pin); return; }
    const vid = Number(p.vlan);
    if (!Number.isInteger(vid) || vid < 1 || vid > 4094) throw Object.assign(new Error(`${p.name || `port ${p.id}`}: VLAN ${p.vlan} is not 1..4094`), { code: 'bad_input' });
    let row = byVid(vid);
    if (!row) { row = { id: `V${vid}`, kind: 'vlan', vlan_id: vid, name: preset && preset.vlan === vid ? preset.name : `VLAN ${vid}`, members: [] }; rows.set(row.id, row); }
    if (preset && preset.vlan === vid) {
      const was = profiled.get(row.id);
      if (was && was.preset.id !== preset.id) {
        throw Object.assign(new Error(`${was.port} and ${p.name || `port ${p.id}`} put VLAN ${vid} under two profiles (${was.preset.name}, ${preset.name})`), { code: 'bad_input' });
      }
      profiled.set(row.id, { preset, port: p.name || `port ${p.id}` });
      row.profile = preset.name;
      if (Number.isInteger(preset.dscp)) row.dscp = preset.dscp;
    }
    row.members.push({ ref, pin });
  });
  const carried = [...rows.values()].filter((r) => r.members.some((m) => m.ref === ref && !m.tagged));
  for (const pin of trunks) for (const r of carried) r.members.push({ ref, pin, tagged: true });
  const puts = [];
  for (const r of rows.values()) {
    if (!r.members.length) delete r.members;
    if (before.get(r.id) !== undefined) {
      const { guid, ...old } = JSON.parse(before.get(r.id));
      if (JSON.stringify(sortKeys(old)) === JSON.stringify(sortKeys(r))) continue;
    }
    puts.push(r);
  }
  return { puts, systems: carried.map((r) => r.id) };
}

function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  return o;
}

/** The ids of the VLAN systems this switch's ports are in (what the block keeps). */
export function systemIdsFor(ref, systems = []) {
  return systems.filter((s) => s.kind === 'vlan' && (s.members || []).some((m) => m.ref === ref)).map((s) => s.id);
}

async function answer(res, what) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${what}: ${body.error || res.status}`);
    err.status = res.status;
    err.code = res.status === 401 || res.status === 403 ? 'http_forbidden' : res.status === 404 ? 'http_not_found'
      : res.status >= 500 ? 'http_server_error' : 'bad_input';
    throw err;
  }
  return body;
}

/** The bench's instances (GET /api/bim/bench). */
export async function loadInstances({ api = bimApi(), fetchImpl = globalThis.fetch } = {}) {
  return (await answer(await fetchImpl(`${api}/bench`), 'read the bench')).instances || [];
}

export async function loadSystems({ api = bimApi(), fetchImpl = globalThis.fetch } = {}) {
  return (await answer(await fetchImpl(`${api}/bench/systems`), 'read the bench plan')).items || [];
}

/** Write the ports' VLAN memberships and profiles into the bench's VLAN systems; answers {items, systems}. */
export async function savePorts(ports, instance, presets, { api = bimApi(), fetchImpl = globalThis.fetch } = {}) {
  const { puts } = portsToSystems(ports, instance, await loadSystems({ api, fetchImpl }), presets);
  for (const row of puts) {
    const { id, ...body } = row;
    await answer(await fetchImpl(`${api}/bench/systems/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }), `plan ${id}`);
  }
  const items = await loadSystems({ api, fetchImpl });
  return { items, systems: systemIdsFor(instance.ref, items) };
}
