import packageJson from '../../package.json';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppVersion } from '@/components/app-version';
import { APP_VERSION } from './app-version';

describe('application version', () => {
  it('reads the platform version from package metadata', () => {
    expect(APP_VERSION).toBe(`v${packageJson.version}`);
  });

  it('renders one accessible shared version label', () => {
    render(<AppVersion />);
    expect(screen.getByLabelText(`Application version ${APP_VERSION}`)).toHaveTextContent(APP_VERSION);
  });
});
