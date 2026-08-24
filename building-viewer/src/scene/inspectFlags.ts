/** Set by Inspect Hide / Isolate. Floor zoning and LOD must not restore these. */
export function isInspectHidden(obj: { userData?: Record<string, unknown> }): boolean {
  return Boolean(obj.userData?.inspectHidden)
}
