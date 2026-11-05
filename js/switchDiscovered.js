// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* switchDiscovered.js — a switch the bus already knows, as a network_switch block.

   Pure: a thing from APKSoftapp.discovered() and config/discovery.json in, a
   block out. The block's id is the switch's identity (MAC, else serial, else
   the discovered id) — never its address. What the scanner did not say is not
   made up: the ports are plain (no profile, PoE or neighbour), and with no
   port count the editor keeps the ports it has.

   The port count is a leaf (`fields.portCount`: PLUGIN.SNMP's `port_count`,
   the rows of the MIB's port table, ROAD-3518). Only when no such leaf is on
   the bus, an optional fallback counts the rows the SNMP bridge published
   under a column `portRows` names (<column>_1 … <column>_N).
   MIB-II ifNumber is not used: it counts VLAN and CPU interfaces too, and
   PLUGIN.SNMP walks only the switch MIB's own subtree, so it is not on the bus. */

/** The first non-empty value of any of `keys`, across every protocol that saw the thing. */
export function field(thing, keys) {
  const fields = thing.fields || {};
  for (const k of keys || []) {
    for (const proto of Object.keys(fields)) {
      const v = fields[proto][k];
      if (v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
    }
  }
  return '';
}

/** The most rows any of `columns` has: distinct <column>_<index> leaves with a value, across protocols. */
export function tableRows(thing, columns) {
  const fields = thing.fields || {};
  let most = 0;
  for (const col of columns || []) {
    const rows = new Set();
    for (const proto of Object.keys(fields)) {
      for (const [leaf, v] of Object.entries(fields[proto])) {
        const index = leaf.startsWith(`${col}_`) ? leaf.slice(col.length + 1) : '';
        if (/^\d+(_\d+)*$/.test(index) && String(v ?? '').trim() !== '') rows.add(index);
      }
    }
    most = Math.max(most, rows.size);
  }
  return most;
}

export function switchFromThing(thing, rules = {}) {
  const f = rules.fields || {};
  const identity = thing.mac || thing.serial || thing.id;
  const name = field(thing, f.name) || thing.name || identity;
  const n = parseInt(field(thing, f.portCount), 10) || tableRows(thing, rules.portRows);
  const portCount = Number.isFinite(n) && n > 0 ? Math.min(n, rules.maxPorts || n) : 0;
  return {
    type: 'network_switch',
    id: `sw_${String(identity).toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name,
    model: [thing.vendor, thing.model].filter(Boolean).join(' ') || field(thing, f.description) || '',
    portCount,
    discovered: {
      identity,
      mac: thing.mac || '',
      serial: thing.serial || '',
      description: field(thing, f.description),
      location: field(thing, f.location),
      seenBy: (thing.protocols || []).slice(),
      live: thing.live ? { state: thing.live.state, why: thing.live.why } : null,
    },
  };
}
