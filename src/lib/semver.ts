// ---------------------------------------------------------------------------
// Minimal semantic-version comparison for package-version gating. Compares the
// numeric core (major.minor.patch); pre-release/build suffixes are ignored for
// the gate (a feature unlocks at a release, e.g. ">= 1.1.0").
// ---------------------------------------------------------------------------

/** Parse the numeric core of a semver string; invalid input → [0,0,0]. */
export function parseSemverCore(version: string): [number, number, number] {
  const core = (version ?? '').split('+')[0]!.split('-')[0]!;
  const parts = core.split('.').map((n) => Number.parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** -1 | 0 | 1 comparing a to b by numeric core. */
export function compareSemver(a: string, b: string): number {
  const x = parseSemverCore(a);
  const y = parseSemverCore(b);
  for (let i = 0; i < 3; i += 1) {
    if (x[i]! > y[i]!) return 1;
    if (x[i]! < y[i]!) return -1;
  }
  return 0;
}

/** Whether `version` is at least `minVersion` (>=). */
export function semverGte(version: string | null | undefined, minVersion: string): boolean {
  if (!version) return false;
  return compareSemver(version, minVersion) >= 0;
}
