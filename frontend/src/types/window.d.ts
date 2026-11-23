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

/**
 * The page-to-page navigation helpers that NavigationHelper (App.tsx) publishes on the window so
 * Subframe pages can navigate without importing the router: window.navigateToHome(), and so on.
 * Each helper may be absent (a page rendered outside App, a test), so callers use optional
 * chaining. The list is explicit on purpose: a misspelt helper name is a type error. It replaces
 * the casts to any that used to stand in for it.
 */
export type NavigationHelper = (argument?: string) => void;

/** The name of any helper declared on the window. */
export type NavigationHelperName = Extract<keyof Window, `navigateTo${string}`>;

declare global {
  interface Window {
    navigateToLogin?: NavigationHelper;
    navigateToDashboard?: NavigationHelper;
    navigateToHome?: NavigationHelper;
    navigateToHomeCdo?: NavigationHelper;
    navigateToHomeExec?: NavigationHelper;
    navigateToHomeDir?: NavigationHelper;
    navigateToPolicyHub?: NavigationHelper;
    navigateToPolicyHub2?: NavigationHelper;
    navigateToPolicyWizardFlow?: NavigationHelper;
    navigateToDataCatalog?: NavigationHelper;
    navigateToDataEngineer?: NavigationHelper;
    navigateToComplianceAgent?: NavigationHelper;
    navigateToLabelRuleConfig?: NavigationHelper;
    navigateToDeleteAgentConfig?: NavigationHelper;
    navigateToArchivalAgentActivity?: NavigationHelper;
    navigateToAdminControlHub?: NavigationHelper;
    navigateToLabelMlConfig?: NavigationHelper;
    navigateToArchivalAgentOverview?: NavigationHelper;
    navigateToLabelCreateNewPolicyPopup?: NavigationHelper;
    navigateToArchivalAgentPolicyConfiguration?: NavigationHelper;
    navigateToDeleteAgentOverview?: NavigationHelper;
    navigateToLabelAgentOverview?: NavigationHelper;
    navigateToDiscoveryAgentOverview?: NavigationHelper;
    navigateToDataDiscoveryAgentConfig?: NavigationHelper;
    navigateToDiscoveryAgentAssetLog?: NavigationHelper;
    navigateToReportingInsightsHub?: NavigationHelper;
    navigateToMyProfile?: NavigationHelper;
    navigateToPolicyDetailView?: NavigationHelper;
    navigateToAssetDetailView?: NavigationHelper;
    navigateToPlatformSettings?: NavigationHelper;
    navigateToEventCenter?: NavigationHelper;
    navigateToEventSubscriptions?: NavigationHelper;
    navigateToEventAnalytics?: NavigationHelper;
    navigateToUserManagement?: NavigationHelper;
    navigateToApprovals?: NavigationHelper;
    navigateToPolicyEditor?: NavigationHelper;
    navigateToSignUp?: NavigationHelper;
    navigateToAdminCloudConnections?: NavigationHelper;
    navigateToAdminCloudConnectionWizard1?: NavigationHelper;
  }
}
