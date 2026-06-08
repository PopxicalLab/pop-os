// ── Airtable → Pop OS migration ──────────────────────────────────────────────
// Pulls Sales Lead 2024-2025 + Sales Lead 2026 from Airtable and inserts
// Accounts, Contacts, and Leads into Pop OS.
//
// Prerequisites:
//   1. Add AIRTABLE_PAT=your_personal_access_token to your .env file
//   2. Run AFTER the migration: npx prisma migrate deploy
//   3. Run: node prisma/migrate-airtable.js
//
// Safe to re-run — uses airtableId to skip already-imported records.
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PAT = process.env.AIRTABLE_PAT;
if (!PAT) { console.error('❌  AIRTABLE_PAT not set in .env'); process.exit(1); }

// Both bases share the same table/field IDs.
const BASES = [
  { id: 'appr7PzHPbNNP7rn4', label: '2024-2025' },
  { id: 'appc1eDetZbmafXoW', label: '2026'      },
];
const TABLE = {
  opportunities: 'tblsmDAmPOOO8Kj7Z',
  accounts:      'tblK5yXHvOSMVKl0S',
  contacts:      'tbl7KW79cGL0ghnN0',
  salesPic:      'tblVB2fSvybnstWts',
};

// ── Airtable API helper ───────────────────────────────────────────────────────
async function fetchAll(baseId, tableId) {
  const records = [];
  let offset = '';
  do {
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}${offset ? '?offset=' + offset : ''}`;
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const json = await res.json();
    records.push(...json.records);
    offset = json.offset || '';
  } while (offset);
  return records;
}

// ── Status mapping ────────────────────────────────────────────────────────────
function mapStatus(name) {
  if (!name) return 'QUALIFICATION';
  const n = name.toLowerCase();
  if (n === 'qualification')              return 'QUALIFICATION';
  if (n === 'proposal')                   return 'PROPOSAL';
  if (n === 'negotiation')                return 'NEGOTIATION';
  if (n.includes('won'))                  return 'WON';
  if (n.includes('lost') || n.includes('closed')) return 'LOST';
  return 'QUALIFICATION';
}

function mapPriority(name) {
  if (!name) return 'MEDIUM';
  const n = name.toLowerCase();
  if (n === 'done')       return 'MEDIUM'; // DONE = completed, not a real priority
  if (n === 'very high')  return 'VERY_HIGH';
  if (n === 'high')       return 'HIGH';
  if (n === 'low')        return 'LOW';
  return 'MEDIUM';
}

// Extract highest invoiced % and paid % from multi-select payment status.
function extractPcts(paymentStatuses) {
  let inv = 0; let paid = 0;
  for (const s of (paymentStatuses || [])) {
    const name = typeof s === 'object' ? (s.name || '') : String(s);
    const im = name.match(/Invoiced\s+(\d+)/i);
    const pm = name.match(/Paid\s+(\d+)/i);
    if (im)  inv  = Math.max(inv,  parseInt(im[1]));
    if (pm)  paid = Math.max(paid, parseInt(pm[1]));
  }
  if (paid === 100) inv = 100; // if fully paid, must be fully invoiced
  return { invoicedPct: inv, paidPct: paid };
}

// Determine who closed the deal from the status string (e.g. "Frankie : won").
function extractSalesPicName(statusName) {
  if (!statusName) return null;
  const wonMatch  = statusName.match(/^(.+?)\s*:\s*won/i);
  const lostMatch = statusName.match(/^(.+?)\s*:\s*lost/i);
  const m = wonMatch || lostMatch;
  if (m) return m[1].trim();
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Starting Airtable → Pop OS migration…\n');

  // Load all Pop OS people for sales PIC matching.
  const popPeople = await prisma.person.findMany({ select: { id: true, name: true } });

  // Match by first name (case-insensitive).
  function findPerson(name) {
    if (!name) return null;
    const n = name.toLowerCase().trim();
    return popPeople.find(p => p.name.toLowerCase().startsWith(n) || n.startsWith(p.name.toLowerCase()))?.id ?? null;
  }

  // ── Step 1: Accounts (deduplicate across both bases by name) ─────────────
  console.log('Importing accounts…');
  const accountMap = {}; // airtableRecordId → popOsId (across both bases)
  let accountsCreated = 0; let accountsSkipped = 0;

  for (const base of BASES) {
    const records = await fetchAll(base.id, TABLE.accounts);
    for (const r of records) {
      const name = r.fields['Name'] || r.fields[Object.keys(r.fields)[0]];
      if (!name) continue;

      // Already imported this exact record?
      const existing = await prisma.account.findFirst({ where: { airtableId: r.id } });
      if (existing) { accountMap[r.id] = existing.id; accountsSkipped++; continue; }

      // Same account name already in DB (from other base)?
      const byName = await prisma.account.findFirst({ where: { name } });
      if (byName) { accountMap[r.id] = byName.id; continue; }

      const acc = await prisma.account.create({
        data: {
          name,
          industry:   r.fields['Industry']?.name       ?? null,
          size:       r.fields['Size']?.name           ?? null,
          website:    r.fields['Company website']      ?? null,
          address:    r.fields['HQ address']           ?? null,
          airtableId: r.id,
        },
      });
      accountMap[r.id] = acc.id;
      accountsCreated++;
    }
  }
  console.log(`  ✓ ${accountsCreated} accounts created, ${accountsSkipped} skipped (already exist)`);

  // ── Step 2: Contacts ─────────────────────────────────────────────────────
  console.log('Importing contacts…');
  const contactMap = {};
  let contactsCreated = 0;

  for (const base of BASES) {
    const records = await fetchAll(base.id, TABLE.contacts);
    for (const r of records) {
      const name = r.fields['Name'];
      if (!name) continue;

      const existing = await prisma.contact.findFirst({ where: { airtableId: r.id } });
      if (existing) { contactMap[r.id] = existing.id; continue; }

      // Resolve linked account record ID → Pop OS account ID.
      const linkedAccIds = r.fields['Account'] || [];
      const accountId    = linkedAccIds.length ? (accountMap[linkedAccIds[0]] ?? null) : null;
      if (!accountId) continue; // contact without an account — skip

      const contact = await prisma.contact.create({
        data: {
          name,
          accountId,
          email:      r.fields['Email']      ?? null,
          phone:      r.fields['Phone']      ?? null,
          title:      r.fields['Title']      ?? null,
          department: r.fields['Department']?.name ?? null,
          vip:        r.fields['VIP']        ?? false,
          airtableId: r.id,
        },
      });
      contactMap[r.id] = contact.id;
      contactsCreated++;
    }
  }
  console.log(`  ✓ ${contactsCreated} contacts created`);

  // ── Step 3: Opportunities → Leads ────────────────────────────────────────
  console.log('Importing opportunities…');
  let leadsCreated = 0; let leadsSkipped = 0;

  for (const base of BASES) {
    const records = await fetchAll(base.id, TABLE.opportunities);
    for (const r of records) {
      const name = r.fields['Opportunity name'];
      if (!name) continue;

      const existing = await prisma.lead.findFirst({ where: { airtableId: r.id } });
      if (existing) { leadsSkipped++; continue; }

      const statusName  = r.fields['Status']?.name   ?? null;
      const priorityName = r.fields['Priority']?.name ?? null;
      const { invoicedPct, paidPct } = extractPcts(r.fields['Payment Status']);

      // Resolve linked records.
      const linkedAccIds     = r.fields['Account']  || [];
      const linkedContactIds = r.fields['Primary contact for'] || [];
      const accountId  = linkedAccIds.length     ? (accountMap[linkedAccIds[0]]     ?? null) : null;
      const contactId  = linkedContactIds.length ? (contactMap[linkedContactIds[0]] ?? null) : null;

      // Who closed it?
      const picName    = extractSalesPicName(statusName);
      const closedById = findPerson(picName);

      const paymentDateRaw = r.fields['Payment Date'];

      await prisma.lead.create({
        data: {
          name,
          accountId,
          contactId,
          status:         mapStatus(statusName),
          priority:       mapPriority(priorityName),
          estimatedValue: r.fields['Estimated value'] ?? null,
          invoicedPct,
          paidPct,
          paymentDate:    paymentDateRaw ? new Date(paymentDateRaw) : null,
          completed:      r.fields['Completion'] ?? false,
          closedById,
          airtableId:     r.id,
        },
      });
      leadsCreated++;
    }
  }
  console.log(`  ✓ ${leadsCreated} leads created, ${leadsSkipped} skipped (already exist)`);

  console.log('\n✅ Migration complete.');
  console.log('   Tip: check the Sales tab in Pop OS — leads are now in the pipeline.');
  console.log('   Tip: manually link any closedBy person that could not be auto-matched.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
