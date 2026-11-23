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
import { DEMO_BANNER_TEXT } from '../../components/DemoBanner';

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

/** Every sidebar label of the layout, in render order, with the demo setting. */
const NAV_LABELS_IN_ORDER = [
  'Home',
  'Dashboard',
  'Data Estate',
  'Data Policy Center',
  'Analytics',
  'Event Center',
  'Smart Discovery',
  'Smart Label',
  'Smart Compliance',
  'Smart Archival',
  'Smart Deletion',
  'User Management',
  'Platform Settings',
];

const HIDDEN_NAV_LABELS_IN_DEMO = [
  'Smart Compliance',
  'User Management',
  'Platform Settings',
];

/** The legacy navigation shims App.tsx installs on window. */
const shimHost = window as unknown as Record<string, unknown>;

function LocationProbe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderLayout(path: string) {
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

/** The labels of the sidebar items currently rendered, in DOM order. */
function renderedNavLabels(): string[] {
  return NAV_LABELS_IN_ORDER.filter((label) => screen.queryByText(label));
}

/** Opens the footer "more" menu (the Radix trigger opens on Enter in jsdom). */
function openFooterMenu(): void {
  const trigger = document.querySelector<HTMLElement>('[aria-haspopup="menu"]');
  expect(trigger).not.toBeNull();
  fireEvent.keyDown(trigger as HTMLElement, { key: 'Enter' });
}

describe('DefaultPageLayout in a demo build', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    setRoles([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows the demo banner above the layout on an allowlisted page', () => {
    const { container } = renderLayout('/data-catalog');

    const banner = screen.getByTestId('demo-banner');
    expect(banner.textContent).toBe(DEMO_BANNER_TEXT);
    // The banner is the first thing in the page, ahead of the sidebar.
    expect(container.firstElementChild?.firstElementChild).toBe(banner);
    expect(screen.getByTestId('page-content')).toBeTruthy();
    expect(screen.queryByTestId('demo-page-unavailable')).toBeNull();
  });

  it('shows the banner on every allowlisted page', () => {
    // The banner must not depend on which page is open.
    for (const path of [
      '/home',
      '/data-engineer',
      '/data-catalog',
      '/policy-hub2',
      '/reporting-insights-hub',
      '/delete-agent-overview',
    ]) {
      const { unmount } = renderLayout(path);
      expect(screen.getByTestId('demo-banner').textContent).toBe(
        DEMO_BANNER_TEXT
      );
      unmount();
    }
  });

  it('hides sidebar entries for pages off the allowlist', () => {
    renderLayout('/data-catalog');

    const expected = NAV_LABELS_IN_ORDER.filter(
      (label) => !HIDDEN_NAV_LABELS_IN_DEMO.includes(label)
    );
    expect(renderedNavLabels()).toEqual(expected);
    // The Admin Center section goes with its only two entries.
    expect(screen.queryByText('Admin Center')).toBeNull();
    // The Smart Agents section keeps its heading and its allowlisted entries.
    expect(screen.getByText('Smart Agents')).toBeTruthy();
  });

  it('hides Account and Settings in the footer menu and keeps Log out', async () => {
    renderLayout('/data-catalog');
    openFooterMenu();

    expect(await screen.findByText('Log out')).toBeTruthy();
    expect(screen.queryByText('Account')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();
  });

  it.each(['/user-management', '/platform-settings', '/compliance-agent', '/policy-editor'])(
    'replaces the content of %s with the not-in-the-demo notice',
    (path) => {
      renderLayout(path);

      expect(screen.getByTestId('demo-banner')).toBeTruthy();
      expect(screen.queryByTestId('page-content')).toBeNull();
      expect(screen.getByTestId('demo-page-unavailable')).toBeTruthy();
      expect(screen.getByText('This page is not part of the demo')).toBeTruthy();
    }
  );

  it('treats a differently cased or slashed address as the same page', () => {
    renderLayout('/User-Management/');

    expect(screen.queryByTestId('page-content')).toBeNull();
    expect(screen.getByTestId('demo-page-unavailable')).toBeTruthy();
  });

  it('leads the visitor from a hidden page to the demo start page', () => {
    renderLayout('/user-management');
    expect(screen.getByTestId('path').textContent).toBe('/user-management');

    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the demo start page' })
    );

    expect(screen.getByTestId('path').textContent).toBe('/home');
  });

  it.each([
    ['ROLE_CDO', false],
    ['ROLE_DIRECTOR', false],
    ['ROLE_ADMIN', false],
    ['ROLE_DATA_ENGINEER', true],
    ['ROLE_AUDITOR', true],
  ])('Dashboard entry for %s is visible: %s', (role, visible) => {
    setRoles([role]);
    renderLayout('/data-catalog');

    expect(screen.queryByText('Dashboard') !== null).toBe(visible);
  });
});

describe('DefaultPageLayout with the demo flag off', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DEMO_MODE', '');
    setRoles([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const shim of [
      'navigateToHome',
      'navigateToHomeCdo',
      'navigateToHomeDir',
      'navigateToHomeExec',
      'navigateToDataEngineer',
    ]) {
      delete shimHost[shim];
    }
  });

  it('shows no banner and no notice', () => {
    renderLayout('/data-catalog');

    expect(screen.queryByTestId('demo-banner')).toBeNull();
    expect(screen.queryByText(DEMO_BANNER_TEXT)).toBeNull();
    expect(screen.queryByTestId('demo-page-unavailable')).toBeNull();
  });

  it('renders every sidebar entry and the Admin Center section', () => {
    renderLayout('/data-catalog');

    expect(renderedNavLabels()).toEqual(NAV_LABELS_IN_ORDER);
    expect(screen.getByText('Smart Agents')).toBeTruthy();
    expect(screen.getByText('Admin Center')).toBeTruthy();
  });

  it('keeps the original root element with no wrapper around it', () => {
    const { container } = renderLayout('/data-catalog');

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('flex h-screen w-full items-start');
    expect(root.querySelector('[data-testid="demo-banner"]')).toBeNull();
  });

  it('renders page content on any path, including pages the demo hides', () => {
    for (const path of ['/user-management', '/compliance-agent', '/policy-editor']) {
      const { unmount } = renderLayout(path);
      expect(screen.getByTestId('page-content')).toBeTruthy();
      expect(screen.queryByTestId('demo-page-unavailable')).toBeNull();
      unmount();
    }
  });

  it('keeps Account and Settings in the footer menu', async () => {
    renderLayout('/data-catalog');
    openFooterMenu();

    expect(await screen.findByText('Account')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Log out')).toBeTruthy();
  });

  it.each([
    [['ROLE_CDO'], 'navigateToHomeCdo'],
    [['ROLE_DIRECTOR'], 'navigateToHomeDir'],
    [['ROLE_ADMIN'], 'navigateToHomeExec'],
    [['ROLE_DATA_ENGINEER'], 'navigateToDataEngineer'],
    [['ROLE_DATA_SCIENTIST'], 'navigateToHome'],
    [[], 'navigateToHome'],
    // The first role in priority order wins when a user holds several.
    [['ROLE_ADMIN', 'ROLE_CDO'], 'navigateToHomeCdo'],
    [['ROLE_DIRECTOR', 'ROLE_CDO'], 'navigateToHomeCdo'],
    [['ROLE_ADMIN', 'ROLE_DIRECTOR'], 'navigateToHomeDir'],
    [['ROLE_DATA_ENGINEER', 'ROLE_ADMIN'], 'navigateToHomeExec'],
  ])('Dashboard for %j calls %s', (roles, shim) => {
    const shims = [
      'navigateToHome',
      'navigateToHomeCdo',
      'navigateToHomeDir',
      'navigateToHomeExec',
      'navigateToDataEngineer',
    ];
    const calls = new Map<string, ReturnType<typeof vi.fn>>();
    for (const name of shims) {
      const fn = vi.fn();
      calls.set(name, fn);
      shimHost[name] = fn;
    }
    setRoles(roles);
    renderLayout('/data-catalog');

    fireEvent.click(screen.getByText('Dashboard'));

    for (const name of shims) {
      expect(calls.get(name)).toHaveBeenCalledTimes(name === shim ? 1 : 0);
    }
  });
});
