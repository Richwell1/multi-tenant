// ---------------------------------------------------------------------------
// Auth domain types — provider-agnostic. The UI and hooks depend on these, not
// on Supabase's session shape.
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
}

export interface SignInInput {
  email: string;
  password: string;
}

/** Unsubscribe handle returned by onAuthStateChange. */
export type Unsubscribe = () => void;
