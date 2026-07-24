// ---------------------------------------------------------------------------
// Repository facade — the single place that selects the concrete data source.
// Today it points at the in-memory mock; swapping to Supabase later means
// changing only this binding, nothing in the hooks or pages.
// ---------------------------------------------------------------------------

import { api } from './api';
import type { Repository } from './repository.types';

export const repository: Repository = api;

export type { Repository } from './repository.types';
