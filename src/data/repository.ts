// ---------------------------------------------------------------------------
// Repository factory — the single place that selects the concrete data source.
// Today it returns the in-memory mock; when the Supabase adapter lands, only
// this file changes, nothing in the hooks or pages.
// ---------------------------------------------------------------------------

import { api } from './api';
import type { Repository } from './repository.types';

export type DataSource = 'mock' | 'supabase';

/**
 * Which data source to use. Defaults to 'mock'. A future flag
 * (import.meta.env.VITE_DATA_SOURCE) will opt into Supabase per environment
 * once SupabaseRepository exists.
 */
export function resolveDataSource(): DataSource {
  const configured = import.meta.env.VITE_DATA_SOURCE;
  return configured === 'supabase' ? 'supabase' : 'mock';
}

export function createRepository(source: DataSource = resolveDataSource()): Repository {
  switch (source) {
    case 'supabase':
      // Implemented in the backend persistence phases (Phase 3+). Until then the
      // interface is the contract a SupabaseRepository must satisfy.
      throw new Error('SupabaseRepository is not implemented yet.');
    case 'mock':
    default:
      return api;
  }
}

/** Default repository instance consumed by hooks. */
export const repository: Repository = createRepository();

export type { Repository } from './repository.types';
