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

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APPROVAL_READ_ROLES, APPROVALS_ROUTE } from '../../utils/approvalApi';

// The layout reads the Keycloak singleton (keycloak.ts builds a real client at
// import time), so replace it with a minimal double whose roles each test sets.
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

const NAV_LABEL = 'Approvals';

function LocationProbe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderLayout(path = '/home') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DefaultPageLayout>
        <div data-testid="page-content">page content</div>
      </DefaultPageLayout>
      <LocationProbe />
    </MemoryRouter>
  );
}

function setRoles(roles: string[]) {
  kc.tokenParsed = { realm_access: { roles } };
}

describe('DefaultPageLayout Approvals navigation', () => {
  beforeEach(() => {
    setRoles([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the route the app declares', () => {
    expect(APPROVALS_ROUTE).toBe('/approvals');
  });

  it.each(APPROVAL_READ_ROLES)('shows the item to %s', (role) => {
    setRoles([role]);
    renderLayout();
    expect(screen.queryByText(NAV_LABEL)).not.toBeNull();
  });

  it.each([
    [[]],
    [['ROLE_VIEWER']],
    [['ROLE_DATA_ANALYST']],
    [['ROLE_SERVICE_ACCOUNT']],
    [['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT']],
    [['offline_access']],
  ])('hides the item for roles %j', (roles) => {
    setRoles(roles);
    renderLayout();
    expect(screen.queryByText(NAV_LABEL)).toBeNull();
    // The rest of the navigation is untouched.
    expect(screen.queryByText('Analytics')).not.toBeNull();
  });

  it('hides the item before a token is parsed', () => {
    kc.tokenParsed = undefined;
    renderLayout();
    expect(screen.queryByText(NAV_LABEL)).toBeNull();
  });

  it('opens the approvals page on click', () => {
    setRoles(['ROLE_CDO']);
    renderLayout();
    fireEvent.click(screen.getByText(NAV_LABEL));
    expect(screen.getByTestId('path').textContent).toBe('/approvals');
  });

  it('is not part of the public demo, which has no approval backend to ask', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    setRoles(['ROLE_ADMIN']);
    renderLayout('/home');
    expect(screen.queryByText(NAV_LABEL)).toBeNull();
  });
});
