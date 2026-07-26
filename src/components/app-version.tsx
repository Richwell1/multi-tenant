import { APP_VERSION } from '@/lib/app-version';

export function AppVersion({ className }: { className?: string }) {
  return (
    <span className={className} aria-label={`Application version ${APP_VERSION}`}>
      {APP_VERSION}
    </span>
  );
}
