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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Vite ?raw import: App.tsx source as a string, independent of the test environment.
import appSource from '../App.tsx?raw';

// Vite refuses to serve .env* files as modules (server.fs.deny), so read it from
// disk. Vitest runs with the frontend directory (the Vite root) as its cwd.
const envDemoExample = readFileSync(
  join(process.cwd(), '.env.demo.example'),
  'utf-8'
);

const pageSources = import.meta.glob('../pages/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Routed pages that do not render inside DefaultPageLayout, so the demo banner
 * (which the layout owns) does not reach them. Both live in files this package
 * does not own: the sign-in route is outside the signed-in shell, and the label
 * dialog uses DialogLayout. Closing the gap takes wrapping those two route
 * elements in <DemoBannerFrame> in App.tsx (see the DEMO-03 hand-off notes).
 * When that lands, empty this list; the test fails if a page here starts using
 * the layout.
 */
const PAGES_WITHOUT_THE_DEMO_BANNER = [
  'AuthEntryPoint',
  'LabelCreateNewPolicyPopup',
];

/** Page component names that App.tsx lazy-loads, i.e. every routed page. */
function routedPages(): string[] {
  const names: string[] = [];
  const lazyImport = /lazy\(\(\) => import\('\.\/pages\/(\w+)'\)\)/g;
  let match: RegExpExecArray | null;
  while ((match = lazyImport.exec(appSource)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function pageSource(name: string): string {
  const entry = Object.entries(pageSources).find(
    ([path]) => path === `../pages/${name}.tsx`
  );
  expect(entry, `pages/${name}.tsx is routed but was not found`).toBeDefined();
  return (entry as [string, string])[1];
}

describe('demo banner coverage of routed pages', () => {
  it('finds the routed pages', () => {
    expect(routedPages().length).toBeGreaterThan(30);
  });

  it('every routed page renders in DefaultPageLayout, except the documented two', () => {
    const missing = routedPages().filter(
      (name) =>
        !PAGES_WITHOUT_THE_DEMO_BANNER.includes(name) &&
        !/<DefaultPageLayout[\s>]/.test(pageSource(name))
    );
    // A new page that skips the layout would show no demo banner. Wrap it in
    // DefaultPageLayout, or mount <DemoBanner /> for it deliberately.
    expect(missing).toEqual([]);
  });

  it('the exception list is accurate', () => {
    for (const name of PAGES_WITHOUT_THE_DEMO_BANNER) {
      expect(routedPages()).toContain(name);
      expect(pageSource(name)).not.toMatch(/<DefaultPageLayout[\s>]/);
    }
  });
});

describe('.env.demo.example', () => {
  const assignments = new Map<string, string>(
    envDemoExample
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at), line.slice(at + 1)] as [string, string];
      })
  );

  it('turns demo mode on and keeps client-side mock data off', () => {
    expect(assignments.get('VITE_DEMO_MODE')).toBe('true');
    expect(assignments.get('REACT_APP_ENABLE_MOCK_DATA')).toBe('false');
  });

  it('sets only public, placeholder values', () => {
    // A browser bundle cannot keep a secret (UI .gitleaks.toml policy 5).
    for (const [name, value] of assignments) {
      expect(name, `${name} looks like a credential`).not.toMatch(
        /PASSWORD|SECRET|TOKEN|API_?KEY|CREDENTIAL/
      );
      expect(value, `${name} must not hold a bearer token`).not.toMatch(
        /^eyJ|^Bearer /
      );
    }
    expect(assignments.get('REACT_APP_API_BASE_URL')).toMatch(
      /^https:\/\/[a-z.]+\.example\.org$/
    );
    expect(assignments.get('REACT_APP_KEYCLOAK_URL')).toMatch(
      /^https:\/\/[a-z.]+\.example\.org$/
    );
  });
});
