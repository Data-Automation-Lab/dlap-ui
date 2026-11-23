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

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../utils/useAppNavigate';
import appSource from '../../App.tsx?raw';

// A mutable stand-in for the Keycloak singleton so each test picks its auth state.
const kc = vi.hoisted(() => ({
  authenticated: true,
  token: 'test-token',
  tokenParsed: { exp: 0 },
  idTokenParsed: { realm_access: { roles: [] as string[] } },
  timeSkew: 0,
  init: vi.fn(),
  updateToken: vi.fn(),
  login: vi.fn(),
}));

vi.mock('../../keycloak', () => ({ default: kc }));

// The page itself is tested in ExpiryReport.test.tsx; here only the route is under test.
vi.mock('../ExpiryReport', () => ({
  default: () => <div data-testid="expiry-report-page">expiry report page</div>,
}));

import App from '../../App';

describe('App route for the expiry report', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    kc.updateToken.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('declares the route from ROUTES behind the auth guard and the error boundary', () => {
    expect(ROUTES.expiryReport).toBe('/expiry-report');
    expect(appSource).toContain(
      `<Route path="${ROUTES.expiryReport}" element={<ProtectedPage><ExpiryReport /></ProtectedPage>} />`
    );
    expect(appSource).toContain("lazy(() => import('./pages/ExpiryReport'))");
  });

  it('renders the page for a signed-in user', async () => {
    kc.authenticated = true;
    kc.init.mockResolvedValue(false);
    window.history.pushState({}, '', ROUTES.expiryReport);
    render(<App />);
    expect(await screen.findByTestId('expiry-report-page')).toBeTruthy();
  });

  it('sends a signed-out visitor to the sign-in route instead of the report', async () => {
    kc.authenticated = false;
    kc.init.mockResolvedValue(false);
    window.history.pushState({}, '', ROUTES.expiryReport);
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.queryByTestId('expiry-report-page')).toBeNull();
  });
});
