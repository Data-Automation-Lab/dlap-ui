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

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Canonical route paths, keyed by a stable logical name. Single source of truth
 * for in-app navigation. These mirror the <Route path> values declared in
 * App.tsx; keep the two in sync when routes change.
 *
 * This is the idiomatic replacement for the legacy `window.navigateToX(...)`
 * shim wired up in App.tsx's NavigationHelper. New code should use
 * `useAppNavigate()` (or react-router's <Link>/useNavigate directly) instead of
 * reaching through `window`. The shim remains in place during the incremental
 * migration so existing, not-yet-migrated call sites keep working.
 */
export const ROUTES = {
  login: '/',
  home: '/home',
  homeCdo: '/home-cdo',
  homeExec: '/home-exec',
  homeDir: '/home-dir',
  dataEngineer: '/data-engineer',
  myProfile: '/my-profile',
  policyHub: '/policy-hub',
  policyHub2: '/policy-hub2',
  policyEditor: '/policy-editor',
  policyWizardFlow: '/policy-wizard-flow',
  policyDetailView: '/policy-detail-view',
  dataCatalog: '/data-catalog',
  complianceAgent: '/compliance-agent',
  labelRuleConfig: '/label-rule-config',
  labelMlConfig: '/label-ml-config',
  labelAgentOverview: '/label-agent-overview',
  labelCreateNewPolicyPopup: '/label-create-new-policy-popup',
  deleteAgentConfig: '/delete-agent-config',
  deleteAgentOverview: '/delete-agent-overview',
  archivalAgentActivity: '/archival-agent-activity',
  archivalAgentOverview: '/archival-agent-overview',
  archivalAgentPolicyConfiguration: '/archival-agent-policy-configuration',
  adminControlHub: '/admin-control-hub',
  discoveryAgentOverview: '/discovery-agent-overview',
  dataDiscoveryAgentConfig: '/data-discovery-agent-config',
  discoveryAgentAssetLog: '/discovery-agent-asset-log',
  reportingInsightsHub: '/reporting-insights-hub',
  expiryReport: '/expiry-report',
  approvals: '/approvals',
  assetDetailView: '/asset-detail-view',
  platformSettings: '/platform-settings',
  eventCenter: '/event-center',
  eventSubscriptions: '/event-subscriptions',
  eventAnalytics: '/event-analytics',
  userManagement: '/user-management',
} as const;

export type RouteKey = keyof typeof ROUTES;

/**
 * Idiomatic in-app navigation. Returns a `go(routeKey)` function backed by
 * react-router's useNavigate, plus `goTo(path)` for arbitrary paths and the
 * underlying `navigate` for advanced use (options, relative paths).
 *
 * Must be called from a component rendered inside the app's <BrowserRouter>.
 */
export function useAppNavigate() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      navigate,
      go: (route: RouteKey) => navigate(ROUTES[route]),
      goTo: (path: string) => navigate(path),
    }),
    [navigate]
  );
}
