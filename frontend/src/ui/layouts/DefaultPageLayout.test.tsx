/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The layout reads the Keycloak singleton (keycloak.ts builds a real client at
// import time), so replace it with a minimal double. `vi.hoisted` keeps the mock
// reachable from the hoisted vi.mock factory.
const kc = vi.hoisted(() => ({
  authenticated: true,
  tokenParsed: undefined as undefined | Record<string, unknown>,
  logout: vi.fn(),
  onAuthSuccess: undefined,
  onAuthRefreshSuccess: undefined,
  onAuthLogout: undefined,
}));

vi.mock('../../keycloak', () => ({ default: kc }));

import { DefaultPageLayout } from './DefaultPageLayout';

/** Opens the footer "more" menu, then returns the Log out item. */
async function openLogoutItem(): Promise<HTMLElement> {
  render(
    <MemoryRouter initialEntries={['/home']}>
      <DefaultPageLayout />
    </MemoryRouter>
  );
  // The footer trigger is the only icon-only button in the sidebar footer; the
  // Radix trigger opens on Enter, which works in jsdom (pointer events do not).
  const trigger = document.querySelector<HTMLElement>(
    '[aria-haspopup="menu"]'
  );
  expect(trigger).not.toBeNull();
  fireEvent.keyDown(trigger as HTMLElement, { key: 'Enter' });
  return screen.findByText('Log out');
}

describe('DefaultPageLayout logout', () => {
  beforeEach(() => {
    kc.logout.mockReset();
    kc.logout.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ends the Keycloak session with the app root as redirectUri', async () => {
    fireEvent.click(await openLogoutItem());

    await waitFor(() => expect(kc.logout).toHaveBeenCalledTimes(1));
    expect(kc.logout).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/`,
    });
  });

  it('does not rely on the legacy window.navigateToLogin shim', async () => {
    const legacy = vi.fn();
    window.navigateToLogin = legacy;
    try {
      fireEvent.click(await openLogoutItem());
      await waitFor(() => expect(kc.logout).toHaveBeenCalled());
      expect(legacy).not.toHaveBeenCalled();
    } finally {
      delete window.navigateToLogin;
    }
  });

  it('logs and does not throw when Keycloak logout rejects', async () => {
    kc.logout.mockRejectedValue(new Error('keycloak unreachable'));
    // jsdom cannot navigate; give the fallback assignment a harmless target.
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: original.origin, href: original.href },
    });
    try {
      fireEvent.click(await openLogoutItem());
      await waitFor(() => expect(console.error).toHaveBeenCalled());
      expect(kc.logout).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe('/');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: original,
      });
    }
  });
});
