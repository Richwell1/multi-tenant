import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// The package/feature gating path must derive access from entitlement records
// (company_id + package_key + installed version) — never from a hardcoded
// company name, slug, or id. Mock fixtures and tests are intentionally excluded;
// only production gating logic is scanned.
const GATING_LOGIC_FILES = [
  'src/lib/entitlements.ts',
  'src/lib/semver.ts',
  'src/lib/packages/manifest.ts',
  'src/components/workspace-shell.tsx',
  'src/components/guards/package-guard.tsx',
];

// Quoted demo company identifiers used elsewhere as fixtures.
const HARDCODED_COMPANY = /['"](alpha|beta|gamma)['"]/i;

describe('no hardcoded company identifiers in gating logic', () => {
  it.each(GATING_LOGIC_FILES)('%s does not branch on a company name/slug/id', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');
    expect(source).not.toMatch(HARDCODED_COMPANY);
  });
});
