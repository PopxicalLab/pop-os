/**
 * import-airtable.js
 *
 * One-time (re-runnable) import of CRM data from Airtable into Pop OS.
 * Imports Accounts, Contacts, and Leads (Opportunities) from both Airtable bases.
 *
 * Usage:
 *   node prisma/import-airtable.js
 *
 * Requires AIRTABLE_PAT in .env (already set).
 * Safe to re-run — uses airtableId as the deduplication key so records are
 * upserted, not duplicated.
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const PAT = process.env.AIRTABLE_PAT;
if (!PAT) {
  console.error('AIRTABLE_PAT not set in .env');
  process.exit(1);
}

// Both Airtable bases contain the same CRM tables.
// 2024-2025 has the full history; 2026 is the current-year working base.
const BASES = [
  { id: 'appr7PzHPbNNP7rn4', label: 'Sales Lead 2024-2025' },
  { id: 'appc1eDetZbmafXoW', label: 'Sales Lead 2026' },
];

const TABLE_ACCOUNTS      = 'tblK5yXHvOSMVKl0S';
const TABLE_CONTACTS      = 'tbl7KW79cGL0ghnN0';
const TABLE_OPPORTUNITIES = 'tblsmDAmPOOO8Kj7Z';

// ── Airtable field IDs ───────────────────────────────────────────────────────

const F = {
  // Accounts
  acc_name:     'fldy6vgKivgG3vUUy',
  acc_industry: 'fldpCqvAkJMZBGxVi',
  acc_size:     'fldFJhpNoeE3wZ0D1',
  acc_website:  'fldt99kf7PDPXXYnN',
  acc_address:  'fldBeeFdHwPu2ev4K',
  // Contacts
  con_name:     'fldS2Hoz2I5c1t2tc',
  con_account:  'fldNAxuJuA9ktQyBy',
  con_vip:      'fldxEzSgnZqtrDthQ',
  con_email:    'fldQlRfEiNwYk7xqG',
  con_phone:    'fldQYFiT1GEvPFfEI',
  con_title:    'fld6WUxeZW5UeEpSb',
  con_dept:     'fldbnOsag1WIIRMx9',
  // Opportunities
  opp_name:     'fldm0Ino4RtnmMBTw',
  opp_status:   'fldMeVQEsVXsDNVQb',
  opp_priority: 'fldAFJeBB9o8eQqhH',
  opp_account:  'fldS20JB4IyIYgyzk',
  opp_value:    'fldqI4Bnq5Suhj6Tw',
};

// ── Airtable fetch helpers ───────────────────────────────────────────────────

async function fetchAllRecords(baseId, tableId) {
  const all = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('returnFieldsByFieldId', 'true'); // use field IDs as keys
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${PAT}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable ${res.status}: ${err}`);
    }

    const body = await res.json();
    all.push(...(body.records ?? []));
    offset = body.offset ?? null;
  } while (offset);

  return all;
}

// ── value coercion helpers ───────────────────────────────────────────────────

const str  = val => (val ? String(val).trim() || null : null);
const bool = val => !!val;
const num  = val => (val !== null && val !== undefined) ? Number(val) : null;
const sel  = val => val?.name ? String(val.name).trim() : null;  // singleSelect
// First linked record's airtable id.
// With returnFieldsByFieldId=true the REST API returns linked records as plain
// string record IDs, not {id, name} objects (which is what the MCP tool returns).
const link1 = val => {
  if (!Array.isArray(val) || !val.length) return null;
  const v = val[0];
  return typeof v === 'string' ? v : (v?.id ?? null);
};

function mapStatus(raw) {
  if (!raw) return 'QUALIFICATION';
  const s = raw.toLowerCase();
  if (s.includes('won'))         return 'WON';
  if (s.includes('lost'))        return 'LOST';
  if (s.includes('proposal'))    return 'PROPOSAL';
  if (s.includes('negotiation')) return 'NEGOTIATION';
  return 'QUALIFICATION';
}

function mapPriority(raw) {
  if (!raw) return 'MEDIUM';
  const s = raw.toLowerCase();
  if (s === 'high') return 'HIGH';
  if (s === 'low')  return 'LOW';
  return 'MEDIUM';
}

// ── import functions ─────────────────────────────────────────────────────────

async function importAccounts(baseId, label) {
  console.log(`\n[${label}] Fetching accounts…`);
  const records = await fetchAllRecords(baseId, TABLE_ACCOUNTS);
  console.log(`  ${records.length} records found`);

  let created = 0, updated = 0, skipped = 0;

  for (const rec of records) {
    const f    = rec.fields;
    const name = str(f[F.acc_name]);
    if (!name) { skipped++; continue; }

    const existing = await prisma.account.findUnique({ where: { airtableId: rec.id } });
    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: {
          name,
          industry: sel(f[F.acc_industry]) ?? existing.industry,
          size:     sel(f[F.acc_size])     ?? existing.size,
          website:  str(f[F.acc_website])  ?? existing.website,
          address:  str(f[F.acc_address])  ?? existing.address,
        },
      });
      updated++;
    } else {
      await prisma.account.create({
        data: {
          airtableId: rec.id,
          name,
          industry: sel(f[F.acc_industry]),
          size:     sel(f[F.acc_size]),
          website:  str(f[F.acc_website]),
          address:  str(f[F.acc_address]),
        },
      });
      created++;
    }
  }

  console.log(`  → ${created} created, ${updated} updated, ${skipped} skipped (no name)`);
  return { created, updated, skipped };
}

async function importContacts(baseId, label) {
  console.log(`\n[${label}] Fetching contacts…`);
  const records = await fetchAllRecords(baseId, TABLE_CONTACTS);
  console.log(`  ${records.length} records found`);

  let created = 0, updated = 0, skipped = 0;

  for (const rec of records) {
    const f    = rec.fields;
    const name = str(f[F.con_name]);
    if (!name) { skipped++; continue; }

    // Resolve accountId by the airtableId of the first linked Account record.
    const accAirtableId = link1(f[F.con_account]);
    let accountId = null;
    if (accAirtableId) {
      const acc = await prisma.account.findUnique({ where: { airtableId: accAirtableId } });
      accountId = acc?.id ?? null;
    }

    const existing = await prisma.contact.findUnique({ where: { airtableId: rec.id } });
    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name,
          // Only overwrite accountId if we resolved one; otherwise keep the existing link.
          ...(accountId ? { accountId } : {}),
          vip:        bool(f[F.con_vip]),
          email:      str(f[F.con_email]),
          phone:      str(f[F.con_phone]),
          title:      str(f[F.con_title]),
          department: sel(f[F.con_dept]),
        },
      });
      updated++;
    } else {
      // Contact.accountId is required in the schema — skip if we couldn't resolve it.
      if (!accountId) { skipped++; continue; }
      await prisma.contact.create({
        data: {
          airtableId: rec.id,
          name,
          accountId,
          vip:        bool(f[F.con_vip]),
          email:      str(f[F.con_email]),
          phone:      str(f[F.con_phone]),
          title:      str(f[F.con_title]),
          department: sel(f[F.con_dept]),
        },
      });
      created++;
    }
  }

  console.log(`  → ${created} created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

async function importLeads(baseId, label) {
  console.log(`\n[${label}] Fetching opportunities…`);
  const records = await fetchAllRecords(baseId, TABLE_OPPORTUNITIES);
  console.log(`  ${records.length} records found`);

  let created = 0, updated = 0, skipped = 0;

  for (const rec of records) {
    const f    = rec.fields;
    const name = str(f[F.opp_name]);
    if (!name) { skipped++; continue; }

    const accAirtableId = link1(f[F.opp_account]);
    let accountId = null;
    if (accAirtableId) {
      const acc = await prisma.account.findUnique({ where: { airtableId: accAirtableId } });
      accountId = acc?.id ?? null;
    }

    const status   = mapStatus(sel(f[F.opp_status]));
    const priority = mapPriority(sel(f[F.opp_priority]));
    const estValue = num(f[F.opp_value]);

    const existing = await prisma.lead.findUnique({ where: { airtableId: rec.id } });
    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data:  { name, accountId, status, priority, estimatedValue: estValue },
      });
      updated++;
    } else {
      await prisma.lead.create({
        data: {
          airtableId: rec.id,
          name,
          accountId,
          status,
          priority,
          estimatedValue: estValue,
        },
      });
      created++;
    }
  }

  console.log(`  → ${created} created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Airtable CRM import ===');
  console.log('Bases:', BASES.map(b => b.label).join(', '));

  const totals = {
    accounts: { created: 0, updated: 0 },
    contacts: { created: 0, updated: 0 },
    leads:    { created: 0, updated: 0 },
  };

  // Accounts first — contacts and leads reference them by airtableId.
  for (const base of BASES) {
    const r = await importAccounts(base.id, base.label);
    totals.accounts.created += r.created;
    totals.accounts.updated += r.updated;
  }

  for (const base of BASES) {
    const r = await importContacts(base.id, base.label);
    totals.contacts.created += r.created;
    totals.contacts.updated += r.updated;
  }

  for (const base of BASES) {
    const r = await importLeads(base.id, base.label);
    totals.leads.created += r.created;
    totals.leads.updated += r.updated;
  }

  console.log('\n=== Done ===');
  console.log(`Accounts : ${totals.accounts.created} created, ${totals.accounts.updated} updated`);
  console.log(`Contacts : ${totals.contacts.created} created, ${totals.contacts.updated} updated`);
  console.log(`Leads    : ${totals.leads.created} created, ${totals.leads.updated} updated`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
