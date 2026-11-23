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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTES, type RouteKey } from '../utils/useAppNavigate';
import {
  DEMO_PAGE_ALLOWLIST,
  isDemoMode,
  isDemoPageAllowed,
  normalizeDemoPath,
} from './pageAllowlist';

/**
 * Every route the application declares, split into the pages the demo shows and
 * the pages it hides. A route that is in neither list fails the classification
 * test below, so adding a route forces a decision here.
 */
const SHOWN_IN_DEMO: RouteKey[] = [
  'home',
  'dataEngineer',
  'dataCatalog',
  'assetDetailView',
  'discoveryAgentOverview',
  'discoveryAgentAssetLog',
  'labelAgentOverview',
  'policyHub2',
  'policyWizardFlow',
  'policyDetailView',
  'eventCenter',
  'eventSubscriptions',
  'eventAnalytics',
  'archivalAgentOverview',
  'archivalAgentActivity',
  'deleteAgentOverview',
  'reportingInsightsHub',
  'expiryReport',
];

const HIDDEN_IN_DEMO: RouteKey[] = [
  // Not a layout page: the sign-in route.
  'login',
  // Need da-admin-service, which the Lite demo stack does not run.
  'userManagement',
  'platformSettings',
  'adminControlHub',
  'myProfile',
  // Needs da-autocompliance, which the Lite demo stack does not run.
  'complianceAgent',
  // Dual-control decisions on real requests: not for a prospect on a public host.
  'approvals',
  // Executive dashboards fed by admin job-status aggregation.
  'homeCdo',
  'homeDir',
  'homeExec',
  // Free-form rule conditions: a code-execution risk on a public host.
  'policyHub',
  'policyEditor',
  'labelCreateNewPolicyPopup',
  // Configuration pages: no cloud account is connected in the demo.
  'dataDiscoveryAgentConfig',
  'labelRuleConfig',
  'labelMlConfig',
  'deleteAgentConfig',
  'archivalAgentPolicyConfiguration',
];

describe('isDemoMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off when VITE_DEMO_MODE is not set', () => {
    vi.stubEnv('VITE_DEMO_MODE', '');
    expect(isDemoMode()).toBe(false);
  });

  it.each(['false', '0', '1', 'yes', 'on', 'truthy'])(
    'is off for the value %s',
    (value) => {
      vi.stubEnv('VITE_DEMO_MODE', value);
      expect(isDemoMode()).toBe(false);
    }
  );

  it.each(['true', 'TRUE', ' True '])('is on for the value "%s"', (value) => {
    vi.stubEnv('VITE_DEMO_MODE', value);
    expect(isDemoMode()).toBe(true);
  });
});

describe('normalizeDemoPath', () => {
  it('lower-cases, drops query, fragment and trailing slashes', () => {
    expect(normalizeDemoPath('/Data-Catalog/')).toBe('/data-catalog');
    expect(normalizeDemoPath('/data-catalog?asset=1')).toBe('/data-catalog');
    expect(normalizeDemoPath('/data-catalog#top')).toBe('/data-catalog');
    expect(normalizeDemoPath('/')).toBe('/');
    expect(normalizeDemoPath('')).toBe('/');
  });
});

describe('isDemoPageAllowed', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows every page when demo mode is off', () => {
    for (const path of Object.values(ROUTES)) {
      expect(isDemoPageAllowed(path, false)).toBe(true);
    }
    expect(isDemoPageAllowed('/not-a-route', false)).toBe(true);
  });

  it('allows the listed pages and hides the rest when demo mode is on', () => {
    for (const key of SHOWN_IN_DEMO) {
      expect(isDemoPageAllowed(ROUTES[key], true)).toBe(true);
    }
    for (const key of HIDDEN_IN_DEMO) {
      expect(isDemoPageAllowed(ROUTES[key], true)).toBe(false);
    }
  });

  it('matches paths the way the router does', () => {
    expect(isDemoPageAllowed('/Data-Catalog/', true)).toBe(true);
    expect(isDemoPageAllowed('/data-catalog?asset=1', true)).toBe(true);
    expect(isDemoPageAllowed('/data-catalog/extra', true)).toBe(false);
    expect(isDemoPageAllowed('/user-management/', true)).toBe(false);
  });

  it('hides an unknown path in demo mode', () => {
    expect(isDemoPageAllowed('/not-a-route', true)).toBe(false);
    expect(isDemoPageAllowed('/', true)).toBe(false);
  });

  it('reads the build flag when no override is given', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    expect(isDemoPageAllowed(ROUTES.userManagement)).toBe(false);
    expect(isDemoPageAllowed(ROUTES.dataCatalog)).toBe(true);

    vi.stubEnv('VITE_DEMO_MODE', '');
    expect(isDemoPageAllowed(ROUTES.userManagement)).toBe(true);
  });
});

describe('DEMO_PAGE_ALLOWLIST', () => {
  it('lists exactly the pages this test classes as shown', () => {
    const expected = SHOWN_IN_DEMO.map((key) => ROUTES[key]).sort();
    expect([...DEMO_PAGE_ALLOWLIST].sort()).toEqual(expected);
  });

  it('holds only canonical, unique ROUTES paths', () => {
    const known = new Set<string>(Object.values(ROUTES));
    const seen = new Set<string>();
    for (const path of DEMO_PAGE_ALLOWLIST) {
      expect(known.has(path), `${path} is not a ROUTES path`).toBe(true);
      expect(path, `${path} must be canonical`).toBe(normalizeDemoPath(path));
      expect(seen.has(path), `${path} is listed twice`).toBe(false);
      seen.add(path);
    }
  });

  it('classifies every route as shown or hidden (add new routes here)', () => {
    // A new route must be added to SHOWN_IN_DEMO (and to the allowlist) or to
    // HIDDEN_IN_DEMO with its reason. Leaving it out would hide or show a page
    // in the public demo by accident.
    const classified = new Set<string>([...SHOWN_IN_DEMO, ...HIDDEN_IN_DEMO]);
    const unclassified = (Object.keys(ROUTES) as RouteKey[]).filter(
      (key) => !classified.has(key)
    );
    expect(unclassified).toEqual([]);
    expect(SHOWN_IN_DEMO.filter((key) => HIDDEN_IN_DEMO.includes(key))).toEqual(
      []
    );
  });

  it('never allows admin, configuration or free-form rule pages', () => {
    const forbidden: RouteKey[] = [
      'userManagement',
      'platformSettings',
      'adminControlHub',
      'myProfile',
      'complianceAgent',
      'policyEditor',
      'policyHub',
      'labelCreateNewPolicyPopup',
      'dataDiscoveryAgentConfig',
      'labelRuleConfig',
      'labelMlConfig',
      'deleteAgentConfig',
      'archivalAgentPolicyConfiguration',
      'approvals',
    ];
    for (const key of forbidden) {
      expect(DEMO_PAGE_ALLOWLIST).not.toContain(ROUTES[key]);
    }
  });

  it('contains the start page the "not part of the demo" notice links to', () => {
    expect(DEMO_PAGE_ALLOWLIST).toContain(ROUTES.home);
  });
});
