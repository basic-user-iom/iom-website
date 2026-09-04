const IOM_DOUBLE_SIDED_REASON = 'iomDoubleSidedReason'
const IOM_MATERIAL_ROLE = 'iomMaterialRole'

function descriptorKey(descriptor) {
  return JSON.stringify([
    descriptor.name,
    descriptor.reason,
    descriptor.role,
  ])
}

/**
 * Capture every material that an upstream pass selected for two-sided
 * rendering. Keeping the authored reason and safety role in the identity makes
 * this inventory protect sheets, glass, foliage, and fire-safety materials
 * without depending on optimizer-specific naming heuristics downstream.
 */
export function doubleSidedMaterialInventory(document) {
  const entries = new Map()
  for (const material of document.getRoot().listMaterials()) {
    if (!material.getDoubleSided()) continue
    const extras = material.getExtras()
    const descriptor = {
      name: material.getName() || '(unnamed)',
      reason:
        typeof extras?.[IOM_DOUBLE_SIDED_REASON] === 'string'
          ? extras[IOM_DOUBLE_SIDED_REASON]
          : null,
      role:
        typeof extras?.[IOM_MATERIAL_ROLE] === 'string'
          ? extras[IOM_MATERIAL_ROLE]
          : null,
    }
    const key = descriptorKey(descriptor)
    const entry = entries.get(key) || { ...descriptor, occurrences: 0 }
    entry.occurrences += 1
    entries.set(key, entry)
  }
  return [...entries.values()].sort((a, b) =>
    descriptorKey(a).localeCompare(descriptorKey(b)),
  )
}

/**
 * Require the complete upstream two-sided inventory to remain two-sided. Extra
 * conservative output materials are allowed, but a protected input material
 * may not disappear, lose its reason/role, or become single-sided.
 */
export function assertDoubleSidedMaterialInventory(
  document,
  expected,
  label = 'Optimizer output',
) {
  const actual = doubleSidedMaterialInventory(document)
  const actualByKey = new Map(
    actual.map((entry) => [descriptorKey(entry), entry.occurrences]),
  )
  const missing = expected.filter(
    (entry) =>
      (actualByKey.get(descriptorKey(entry)) || 0) < entry.occurrences,
  )
  if (missing.length > 0) {
    const detail = missing
      .map(
        (entry) =>
          `${entry.name} (${entry.reason || 'no reason'}, ${entry.role || 'no role'})`,
      )
      .join(', ')
    throw new Error(`${label} lost protected two-sided material(s): ${detail}`)
  }
  return actual
}
