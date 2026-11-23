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

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Vite ?raw import: App.tsx source as a string, independent of the test environment.
import appSource from '../../App.tsx?raw';
import { DEMO_BANNER_TEXT } from '../../components/DemoBanner';

// A mutable stand-in for the Keycloak singleton so each test picks its auth state.
const kc = vi.hoisted(() => ({
  authenticated: false,
  token: 'test-token',
  tokenParsed: { exp: 0 },
  idTokenParsed: { realm_access: { roles: [] as string[] } },
  timeSkew: 0,
  init: vi.fn(),
  updateToken: vi.fn(),
  login: vi.fn(),
}));

vi.mock('../../keycloak', () => ({ default: kc }));

// The two routes outside DefaultPageLayout. Their bodies are stubbed: this test
// is about what App.tsx puts around them, not about what they render.
vi.mock('../AuthEntryPoint', () => ({
  default: () => <div data-testid="sign-in-page">sign in</div>,
}));
vi.mock('../LabelCreateNewPolicyPopup', () => ({
  default: () => <div data-testid="label-popup-page">label dialog</div>,
}));

import App from '../../App';

// Vite glob: the raw source of every page file, to see which ones use the layout.
const pageSources = import.meta.glob('../*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SIGN_IN_ROUTE = '/';
const LABEL_POPUP_ROUTE = '/label-create-new-policy-popup';

/**
 * A signed-in visitor on the route the URL names. init resolves false on purpose:
 * a true answer makes App send the visitor to the home page of their role, and
 * the route guard reads keycloak.authenticated, not the answer of init.
 */
function signedIn(): void {
  kc.authenticated = true;
  kc.init.mockResolvedValue(false);
}

/** Opens the application at a path, with the demo flag set or cleared. */
function openApp(path: string, demoFlag: string): void {
  vi.stubEnv('VITE_DEMO_MODE', demoFlag);
  window.history.pushState({}, '', path);
  render(<App />);
}

describe('demo banner on the routes outside DefaultPageLayout (Q-268)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    kc.authenticated = false;
    kc.init.mockResolvedValue(false);
    kc.updateToken.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  describe('in a demo build', () => {
    it('shows the banner above the sign-in page', async () => {
      openApp(SIGN_IN_ROUTE, 'true');

      const page = await screen.findByTestId('sign-in-page');
      const banner = screen.getByTestId('demo-banner');
      expect(banner.textContent).toBe(DEMO_BANNER_TEXT);
      // The banner is the first child of the frame and the page sits in the
      // frame's body, below it.
      expect(banner.nextElementSibling?.contains(page)).toBe(true);
      expect(screen.getAllByTestId('demo-banner')).toHaveLength(1);
    });

    it('shows the banner above the label dialog route when signed in', async () => {
      signedIn();
      openApp(LABEL_POPUP_ROUTE, 'true');

      const page = await screen.findByTestId('label-popup-page');
      const banner = screen.getByTestId('demo-banner');
      expect(banner.textContent).toBe(DEMO_BANNER_TEXT);
      expect(banner.nextElementSibling?.contains(page)).toBe(true);
      expect(screen.getAllByTestId('demo-banner')).toHaveLength(1);
    });

    it('lands on the sign-in page with one banner when the label dialog URL is typed while signed out', async () => {
      openApp(LABEL_POPUP_ROUTE, 'true');

      await screen.findByTestId('sign-in-page');
      expect(window.location.pathname).toBe(SIGN_IN_ROUTE);
      expect(screen.queryByTestId('label-popup-page')).toBeNull();
      expect(screen.getAllByTestId('demo-banner')).toHaveLength(1);
    });
  });

  describe('with the demo flag off', () => {
    it('leaves the sign-in page without a banner', async () => {
      openApp(SIGN_IN_ROUTE, '');

      const page = await screen.findByTestId('sign-in-page');
      expect(screen.queryByTestId('demo-banner')).toBeNull();
      // No frame at all: the page is the only child of the application root.
      expect(page.parentElement?.children).toHaveLength(1);
    });

    it('leaves the label dialog route without a banner', async () => {
      signedIn();
      openApp(LABEL_POPUP_ROUTE, '');

      await screen.findByTestId('label-popup-page');
      expect(screen.queryByTestId('demo-banner')).toBeNull();
    });
  });

  describe('route table', () => {
    /** Lazy page declarations in App.tsx: component name to page file name. */
    function lazyPages(): Map<string, string> {
      const pages = new Map<string, string>();
      for (const [, component, file] of appSource.matchAll(
        /const (\w+) = lazy\(\(\) => import\('\.\/pages\/(\w+)'\)\)/g
      )) {
        pages.set(component, file);
      }
      return pages;
    }

    function pageSource(file: string): string {
      const source = pageSources[`../${file}.tsx`];
      expect(source, `pages/${file}.tsx is routed but was not found`).toBeDefined();
      return source;
    }

    /** Route path to the lazy page its element renders. */
    function routedPages(): Map<string, string> {
      const lazy = lazyPages();
      const routed = new Map<string, string>();
      const routes = appSource.matchAll(
        /<Route\s+path="([^"]+)"\s+element=\{(.*?)\}\s*\/>/g
      );
      for (const [, path, element] of routes) {
        const component = [...lazy.keys()].find((name) =>
          new RegExp(`<${name}\\s*/>`).test(element)
        );
        if (component !== undefined) {
          routed.set(path, lazy.get(component) as string);
        }
      }
      return routed;
    }

    /** Paths whose route element contains a DemoBannerFrame. */
    function framedPaths(): string[] {
      const framed: string[] = [];
      const routes = appSource.matchAll(
        /<Route\s+path="([^"]+)"\s+element=\{(.*?)\}\s*\/>/g
      );
      for (const [, path, element] of routes) {
        if (element.includes('<DemoBannerFrame>')) framed.push(path);
      }
      return framed;
    }

    it('finds the routed pages', () => {
      expect(routedPages().size).toBeGreaterThan(30);
    });

    it('frames exactly the routes whose page does not render DefaultPageLayout', () => {
      const withoutLayout = [...routedPages()]
        .filter(([, file]) => !/<DefaultPageLayout[\s>]/.test(pageSource(file)))
        .map(([path]) => path)
        .sort();

      // A page that skips the layout needs the frame (else it shows no banner);
      // a page that uses the layout must not be framed (else two banners).
      expect(framedPaths().sort()).toEqual(withoutLayout);
      expect(withoutLayout).toEqual([LABEL_POPUP_ROUTE, SIGN_IN_ROUTE].sort());
    });

    it('wraps the page itself, inside the auth guard and the error boundary', () => {
      // The frame sits next to the page so the guard's redirect and the
      // boundary's fallback are not wrapped in a second full-height box.
      expect(appSource).toContain(
        '<RouteErrorBoundary><DemoBannerFrame><AuthEntryPoint /></DemoBannerFrame></RouteErrorBoundary>'
      );
      expect(appSource).toContain(
        '<ProtectedPage><DemoBannerFrame><LabelCreateNewPolicyPopup /></DemoBannerFrame></ProtectedPage>'
      );
    });
  });
});
