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

import { ROUTES } from '../utils/useAppNavigate';

/**
 * Demo mode (work package DEMO-03).
 *
 * The public demo is the same single-page application built with the flag
 * VITE_DEMO_MODE=true. Vite inlines the value at build time, so a normal build
 * (flag unset or anything other than "true") carries no demo behaviour at all.
 *
 * In demo mode every page shown inside the default layout carries a persistent
 * banner (see components/DemoBanner.tsx), and only the pages listed below are
 * reachable. Everything else is hidden from the sidebar and the account menu,
 * and a direct visit to its URL shows a "not part of the demo" notice instead
 * of the page content.
 *
 * This is a presentation filter, not an authorization boundary. Access control
 * stays with Keycloak and the services (R9). A page that is hidden here is
 * still served by the SPA bundle.
 */

/** The only value of VITE_DEMO_MODE that turns demo mode on. */
const DEMO_FLAG_ON = 'true';

/**
 * Pages reachable in the demo, as route paths. Every entry comes from ROUTES so
 * a renamed or removed route fails the type check and the drift test, and the
 * list reads as the guided tour.
 *
 * The Lite demo stack runs eight services (catalog, discovery, policyengine,
 * reporting, autolabel, autoarchival, autodelete, logingest) and drops
 * da-admin-service and da-autocompliance (research/hardening/08-demo-hosting.md
 * section 2). A page appears here only when the services it needs are in that
 * set and it does not change configuration.
 *
 * Deliberately NOT listed, with the reason (guarded by pageAllowlist.test.ts):
 *   - userManagement, platformSettings, adminControlHub, myProfile: need
 *     da-admin-service, and a prospect must not edit users or settings;
 *   - complianceAgent: needs da-autocompliance;
 *   - approvals: a hard delete or an archive waits for a second person (dual control, ADR-0095), and a
 *     prospect on a public host must not decide on or see other people's requests;
 *   - homeCdo, homeDir, homeExec: executive dashboards fed by admin job-status
 *     aggregation that the Lite stack does not run;
 *   - policyHub, policyEditor, labelCreateNewPolicyPopup: free-form rule
 *     conditions are a code-execution risk on a public host, so the demo
 *     authors policies through the wizard only;
 *   - dataDiscoveryAgentConfig, labelRuleConfig, labelMlConfig,
 *     deleteAgentConfig, archivalAgentPolicyConfiguration: configuration pages
 *     (cloud sources are off in the demo; no cloud account is connected).
 *
 * The first walk of every page against the live demo stack belongs to DEMO-04.
 * Change this list there if a page fails or is missing.
 */
export const DEMO_PAGE_ALLOWLIST: readonly string[] = [
  // Landing pages for the demo personas (viewer and steward).
  ROUTES.home,
  ROUTES.dataEngineer,
  // Discover and catalog: fixture replay lands here.
  ROUTES.dataCatalog,
  ROUTES.assetDetailView,
  ROUTES.discoveryAgentOverview,
  ROUTES.discoveryAgentAssetLog,
  // Label.
  ROUTES.labelAgentOverview,
  // Govern: the policy wizard and the policy views.
  ROUTES.policyHub2,
  ROUTES.policyWizardFlow,
  ROUTES.policyDetailView,
  // Events and consumption signals.
  ROUTES.eventCenter,
  ROUTES.eventSubscriptions,
  ROUTES.eventAnalytics,
  // Retire: archive and delete run as dry-runs in the demo.
  ROUTES.archivalAgentOverview,
  ROUTES.archivalAgentActivity,
  ROUTES.deleteAgentOverview,
  // Report.
  ROUTES.reportingInsightsHub,
  ROUTES.expiryReport,
];

/**
 * True when this build is the demo build. Reads the build-time flag on every
 * call (not at module load) so tests can switch it with vi.stubEnv.
 *
 * Only the exact text "true" (surrounding spaces and case ignored) enables the
 * mode. Anything else, including an unset variable, leaves the application
 * unchanged.
 */
export function isDemoMode(): boolean {
  const raw: unknown = import.meta.env.VITE_DEMO_MODE;
  return typeof raw === 'string' && raw.trim().toLowerCase() === DEMO_FLAG_ON;
}

/**
 * Canonical form used to compare paths: lower case (react-router matches
 * case-insensitively), no query or fragment, no trailing slash except for the
 * root.
 */
export function normalizeDemoPath(pathname: string): string {
  const bare = pathname.split(/[?#]/, 1)[0].toLowerCase();
  const trimmed = bare.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Whether a page may be shown. Outside demo mode every page is allowed. In
 * demo mode only the paths in DEMO_PAGE_ALLOWLIST are allowed.
 *
 * @param pathname the route path, for example "/data-catalog"
 * @param demoMode defaults to the build flag; tests may override it
 */
export function isDemoPageAllowed(
  pathname: string,
  demoMode: boolean = isDemoMode()
): boolean {
  if (!demoMode) {
    return true;
  }
  return DEMO_PAGE_ALLOWLIST.includes(normalizeDemoPath(pathname));
}
