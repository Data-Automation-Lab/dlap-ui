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
// Vite ?raw import: App.tsx source as a string, independent of the test environment.
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

// The generic home page throws while rendering, as a page does on an API shape it
// does not expect. The rest of the application must survive it.
vi.mock('../HomePage', () => ({
  default: () => {
    throw new TypeError("Cannot read properties of undefined (reading 'items')");
  },
}));

import App from '../../App';

describe('App route table', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    kc.updateToken.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('wraps every protected route in an error boundary', () => {
    const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"\s+element=\{(.*?)\}\s*\/>/g)];
    expect(routes.length).toBeGreaterThan(30);
    const unwrapped: string[] = [];
    for (const [, path, element] of routes) {
      if (path === '*') continue;
      const guarded = element.startsWith('<ProtectedPage>') || element.startsWith('<RouteErrorBoundary>');
      if (!guarded) unwrapped.push(path);
    }
    expect(unwrapped).toEqual([]);
    // A bare ProtectedRoute would skip the boundary.
    expect(appSource).not.toMatch(/element=\{<ProtectedRoute>/);
  });

  it('removes the mock sign-up route and shim', () => {
    expect(appSource).not.toContain('/signup');
    expect(appSource).not.toContain('navigateToSignUp');
    expect(appSource).not.toContain("pages/SignUp");
  });

  it('shows the boundary fallback for a crashing page and keeps the shell alive', async () => {
    kc.authenticated = true;
    kc.init.mockResolvedValue(true);
    window.history.pushState({}, '', '/home');
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This page ran into a problem');
    // The navigation shim is still installed, so the user can leave the broken page.
    expect(typeof window.navigateToHome).toBe('function');
  });

  it('serves a 404 for /signup because the route no longer exists', async () => {
    kc.authenticated = false;
    kc.init.mockResolvedValue(false);
    window.history.pushState({}, '', '/signup');
    render(<App />);
    await waitFor(() => expect(screen.getByText('404 - Page Not Found')).toBeTruthy());
    expect(window.navigateToSignUp).toBeUndefined();
  });
});
