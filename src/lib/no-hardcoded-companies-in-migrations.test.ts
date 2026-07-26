import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, it, expect } from 'vitest';

// Production migrations must never create demo companies. Companies are created
// dynamically through the registration RPC (onboard_company), which inserts the
// caller-provided company name — never a literal Alpha/Beta/Gamma or a fixed
// fixture UUID. Demo tenants only ever exist inside rolled-back SQL test files.
const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations');
const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));

describe('production migrations create no demo companies', () => {
  it.each(migrationFiles)('%s has no hardcoded company fixtures', (file) => {
    const src = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

    // No demo tenant names.
    expect(src).not.toMatch(/'(Alpha|Beta|Gamma)\b[^']*'/i);
    // No fixed company-fixture UUID pattern (…-0000-0000-0000-0000000000N).
    expect(src).not.toMatch(/-0000-0000-0000-0000000000\d/i);
    // Every company INSERT must be the dynamic registration form.
    const inserts = src.match(/insert\s+into\s+public\.companies[\s\S]*?;/gi) ?? [];
    for (const stmt of inserts) {
      expect(stmt).toMatch(/trim\(p_company_name\)/);
    }
  });
});
