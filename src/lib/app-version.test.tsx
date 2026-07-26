import packageJson from '../../package.json';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppVersion } from '@/components/app-version';
import { APP_VERSION } from './app-version';
import { releaseService } from '@/services/package-service';
import { emptyCompanyTarget } from '@/lib/company-target';

describe('application version', () => {
  it('reads the platform version from package metadata', () => {
    expect(APP_VERSION).toBe(`v${packageJson.version}`);
  });

  it('renders one accessible shared version label', () => {
    render(<AppVersion />);
    expect(screen.getByLabelText(`Application version ${APP_VERSION}`)).toHaveTextContent(APP_VERSION);
  });

  it('keeps package release versions separate from the global platform version', async () => {
    const platformVersionBefore = APP_VERSION;
    const release = await releaseService.publish({
      packageVersionId: 'attendance-management-1.0.0',
      classification: 'standard_update',
      target: emptyCompanyTarget('all_companies'),
      automaticInstall: true,
    });

    expect(release.version).toBe('1.0.0');
    expect(APP_VERSION).toBe(platformVersionBefore);
    expect(APP_VERSION).not.toBe(`v${release.version}`);
  });

  it('renders a package version as a separate value', () => {
    render(
      <>
        <AppVersion />
        <span>Attendance Management 1.0.0</span>
      </>,
    );

    expect(screen.getByText(APP_VERSION)).toBeInTheDocument();
    expect(screen.getByText('Attendance Management 1.0.0')).toBeInTheDocument();
  });
});
