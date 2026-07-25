#!/usr/bin/env bash
# Run every committed JWT/RLS suite against the local Supabase database.
#
# Connection modes:
#   SUPABASE_DB_CONTAINER=supabase_db_Demo scripts/run-sql-suites.sh
#   DATABASE_URL=postgresql://... scripts/run-sql-suites.sh
#
# With no override, the script first looks for the local Supabase container
# derived from supabase/config.toml, then falls back to the local port declared
# by this project (54332). URLs are never printed.
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
readonly DEFAULT_DB_URL='postgresql://postgres:postgres@127.0.0.1:54332/postgres'

suite_dir="${SUITE_DIR:-$REPO_ROOT/supabase/tests}"
if [[ "$suite_dir" != /* ]]; then
  suite_dir="$REPO_ROOT/$suite_dir"
fi

db_container="${SUPABASE_DB_CONTAINER:-}"
db_url="${DATABASE_URL:-${SUPABASE_DB_URL:-$DEFAULT_DB_URL}}"

if [[ ! -d "$suite_dir" ]]; then
  printf 'SQL suite directory not found: %s\n' "$suite_dir" >&2
  exit 1
fi

mapfile -d '' -t suites < <(
  find "$suite_dir" -maxdepth 1 -type f -name '*.sql' -print0 | LC_ALL=C sort -z
)
if (( ${#suites[@]} == 0 )); then
  printf 'No SQL suites found in %s\n' "$suite_dir" >&2
  exit 1
fi

if [[ -z "$db_container" ]] && command -v docker >/dev/null 2>&1; then
  project_id="$(awk -F= '/^[[:space:]]*project_id[[:space:]]*=/{gsub(/[[:space:]\"]/, "", $2); print $2; exit}' "$REPO_ROOT/supabase/config.toml")"
  if [[ -n "$project_id" ]]; then
    docker_names=''
    if docker_names="$(docker ps --filter "name=^supabase_db_${project_id}$" --format '{{.Names}}' 2>/dev/null)"; then
      db_container="$(printf '%s\n' "$docker_names" | head -n 1)"
    fi
  fi
fi

if [[ -n "$db_container" ]]; then
  command -v docker >/dev/null 2>&1 || {
    printf 'docker is required for SUPABASE_DB_CONTAINER mode\n' >&2
    exit 1
  }
  printf 'SQL suite connection: Docker container\n'
else
  command -v psql >/dev/null 2>&1 || {
    printf 'psql is required for PostgreSQL URL mode\n' >&2
    exit 1
  }
  printf 'SQL suite connection: PostgreSQL URL\n'
fi

run_suite() {
  if [[ -n "$db_container" ]]; then
    docker exec -i "$db_container" psql --no-psqlrc -U postgres -d postgres -v ON_ERROR_STOP=1
  else
    psql --no-psqlrc "$db_url" -v ON_ERROR_STOP=1
  fi
}

passed=0
for suite in "${suites[@]}"; do
  suite_name="$(basename "$suite")"
  printf 'Running %s\n' "$suite_name"
  if ! run_suite < "$suite"; then
    printf 'FAILED: %s\n' "$suite_name" >&2
    exit 1
  fi
  passed=$((passed + 1))
  printf 'Passed %s\n' "$suite_name"
done

printf 'SQL suites passed: %d/%d\n' "$passed" "${#suites[@]}"
