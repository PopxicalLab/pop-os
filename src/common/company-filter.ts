// Shared helper: builds the Prisma `where` fragment for company scoping.
//
// Rules:
//   - GROUP or null/undefined → no filter (user sees all companies)
//   - LPS or PXL → filter to that company OR null (unassigned records visible to all)
//
// Usage on a model with a direct company field:
//   where: { ...companyWhere(company), ...otherFilters }
//
// Usage when filtering via a relation (e.g. asset → project.company):
//   where: { project: companyWhere(company) ?? {} }

export function companyWhere(company?: string | null): object | undefined {
  if (!company || company === 'GROUP') return undefined;
  // Include records with no company set — they are treated as shared/global.
  return { OR: [{ company }, { company: null }] };
}
