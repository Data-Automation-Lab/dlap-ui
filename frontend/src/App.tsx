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

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import keycloak from './keycloak'; // Import the Keycloak instance
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { DemoBannerFrame } from './components/DemoBanner';

// Route components are code-split via React.lazy so each page ships in its own
// chunk instead of one large eager bundle. All of these are default exports and
// are referenced only through the <Routes> below, so lazy loading is safe.
const AdminControlHub = lazy(() => import('./pages/AdminControlHub'));
const ApprovalInbox = lazy(() => import('./pages/ApprovalInbox'));
const ArchivalAgentActivitySaving = lazy(() => import('./pages/ArchivalAgentActivitySaving'));
const ArchivalAgentOverview = lazy(() => import('./pages/ArchivalAgentOverview'));
const ArchivalAgentPolicyConfiguration = lazy(() => import('./pages/ArchivalAgentPolicyConfiguration'));
const AssetDetailView = lazy(() => import('./pages/AssetDetailView'));
const AuthEntryPoint = lazy(() => import('./pages/AuthEntryPoint'));
const ComplianceAgentView = lazy(() => import('./pages/ComplianceAgentView'));
const DataCatalog = lazy(() => import('./pages/DataCatalog'));
const DataDiscoveryAgentConfig = lazy(() => import('./pages/DataDiscoveryAgentConfig'));
const DataEngineerDashboard = lazy(() => import('./pages/DataEngineerDashboard'));
const DeleteAgentConfig = lazy(() => import('./pages/DeleteAgentConfig'));
const DeleteAgentOverview = lazy(() => import('./pages/DeleteAgentOverview'));
const DiscoveryAgentAssetLog = lazy(() => import('./pages/DiscoveryAgentAssetLog'));
const DiscoveryAgentOverview = lazy(() => import('./pages/DiscoveryAgentOverview'));
const EventAnalytics = lazy(() => import('./pages/EventAnalytics'));
const EventCenter = lazy(() => import('./pages/EventCenter'));
const EventSubscriptions = lazy(() => import('./pages/EventSubscriptions'));
const ExpiryReport = lazy(() => import('./pages/ExpiryReport'));
const HomePage = lazy(() => import('./pages/HomePage'));
const HomePageCdo = lazy(() => import('./pages/HomePageCdo'));
const HomePageDir = lazy(() => import('./pages/HomePageDir'));
const HomePageExec = lazy(() => import('./pages/HomePageExec'));
const LabelAgentOverview = lazy(() => import('./pages/LabelAgentOverview'));
const LabelCreateNewPolicyPopup = lazy(() => import('./pages/LabelCreateNewPolicyPopup'));
const LabelMlConfig = lazy(() => import('./pages/LabelMlConfig'));
const LabelRuleConfig = lazy(() => import('./pages/LabelRuleConfig'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'));
const PlatformSettings = lazy(() => import('./pages/PlatformSettings'));
const PolicyDetailView = lazy(() => import('./pages/PolicyDetailView'));
const PolicyEditor = lazy(() => import('./pages/PolicyEditor'));
const PolicyManagementHub = lazy(() => import('./pages/PolicyManagementHub'));
const PolicyManagementHub2 = lazy(() => import('./pages/PolicyManagementHub2'));
const PolicyWizardFlow = lazy(() => import('./pages/PolicyWizardFlow'));
const ReportingInsightsHub = lazy(() => import('./pages/ReportingInsightsHub'));
const UserManagement = lazy(() => import('./pages/UserManagement'));

// Define a NotFound component
const NotFound = () => <div className="flex h-screen items-center justify-center">404 - Page Not Found</div>;

// Simple loading component
const Loading = () => <div className="flex h-screen items-center justify-center">Loading...</div>;

// Navigation helper component to bridge window.navigation calls to useNavigate
const NavigationHelper: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    window.navigateToLogin = () => navigate('/'); // Assuming login is the root path now
    window.navigateToDashboard = () => navigate('/home-cdo'); // Or a dedicated dashboard path
    window.navigateToHome = () => navigate('/home'); // Or a generic home path if different from login
    window.navigateToHomeCdo = () => navigate('/home-cdo');
    window.navigateToHomeExec = () => navigate('/home-exec');
    window.navigateToHomeDir = () => navigate('/home-dir');
    window.navigateToPolicyHub = () => navigate('/policy-hub');
    window.navigateToDataEngineer = () => navigate('/data-engineer');
    window.navigateToComplianceAgent = () => navigate('/compliance-agent');
    window.navigateToLabelRuleConfig = () => navigate('/label-rule-config');
    window.navigateToDeleteAgentConfig = () => navigate('/delete-agent-config');
    window.navigateToArchivalAgentActivity = () => navigate('/archival-agent-activity');
    window.navigateToAdminControlHub = () => navigate('/admin-control-hub');
    window.navigateToLabelMlConfig = () => navigate('/label-ml-config');
    window.navigateToArchivalAgentOverview = () => navigate('/archival-agent-overview');
    window.navigateToLabelCreateNewPolicyPopup = () => navigate('/label-create-new-policy-popup');
    window.navigateToPolicyHub2 = () => navigate('/policy-hub2');
    window.navigateToPolicyWizardFlow = () => navigate('/policy-wizard-flow');
    window.navigateToDataCatalog = () => navigate('/data-catalog');
    window.navigateToArchivalAgentPolicyConfiguration = () => navigate('/archival-agent-policy-configuration');
    window.navigateToDeleteAgentOverview = () => navigate('/delete-agent-overview');
    window.navigateToLabelAgentOverview = () => navigate('/label-agent-overview');
    window.navigateToDiscoveryAgentOverview = () => navigate('/discovery-agent-overview');
    window.navigateToDataDiscoveryAgentConfig = () => navigate('/data-discovery-agent-config');
    window.navigateToDiscoveryAgentAssetLog = () => navigate('/discovery-agent-asset-log');
    window.navigateToReportingInsightsHub = () => navigate('/reporting-insights-hub');
    window.navigateToMyProfile = () => navigate('/my-profile');
    window.navigateToPolicyDetailView = () => navigate('/policy-detail-view');
    window.navigateToPolicyEditor = () => navigate('/policy-editor');
    window.navigateToAssetDetailView = () => navigate('/asset-detail-view');
    window.navigateToPlatformSettings = () => navigate('/platform-settings');
    window.navigateToEventCenter = () => navigate('/event-center');
    window.navigateToEventSubscriptions = () => navigate('/event-subscriptions');
    window.navigateToEventAnalytics = () => navigate('/event-analytics');
    window.navigateToUserManagement = () => navigate('/user-management');
  }, [navigate]);

  return null; // This component does not render anything
};

// Higher-order component for protected routes
interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  if (!keycloak.authenticated) {
    // If not authenticated, redirect to login. 
    // Keycloak's login function will handle the actual redirect to Keycloak server.
    // Here we redirect to our app's login page route.
    // Note: keycloak.login() could be called here directly if we don't want to show the login page first.
    return <Navigate to="/" replace />;
  }
  return children;
};

/**
 * A protected route with its own error boundary. A page that throws while
 * rendering (for example on an unexpected API shape) shows the boundary's
 * fallback instead of blanking the whole application.
 */
export const ProtectedPage: React.FC<ProtectedRouteProps> = ({ children }) => (
  <ProtectedRoute>
    <RouteErrorBoundary>{children}</RouteErrorBoundary>
  </ProtectedRoute>
);

function App() {
  const [isKeycloakInitialized, setIsKeycloakInitialized] = useState(false);
  const navigate = useNavigate(); // Use navigate for programmatic redirection after login

  useEffect(() => {
    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({ 
          onLoad: 'check-sso', // Silently check for SSO session
          silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
          pkceMethod: 'S256' // Recommended for SPAs
        });
        setIsKeycloakInitialized(true);

        if (authenticated) {
          // Do not log the access token, the parsed ID token, or the role
          // list - they are credentials / PII (CLAUDE.md §11: never log
          // credentials or PII).
          const roles = keycloak.idTokenParsed?.realm_access?.roles || [];

          // Route each persona to its dashboard using the real Keycloak realm
          // roles (ROLE_*). ROLE_ADMIN maps to the executive home.
          if (roles.includes('ROLE_CDO')) {
            navigate('/home-cdo', { replace: true });
          } else if (roles.includes('ROLE_DIRECTOR')) {
            navigate('/home-dir', { replace: true });
          } else if (roles.includes('ROLE_ADMIN')) {
            navigate('/home-exec', { replace: true });
          } else if (roles.includes('ROLE_DATA_ENGINEER')) {
            navigate('/data-engineer', { replace: true });
          } else {
            // Default dashboard (e.g. ROLE_DATA_SCIENTIST or a general user role)
            navigate('/home', { replace: true });
          }
        } else {
          console.log("User is not authenticated.");
          // If on a protected route and not authenticated, ProtectedRoute component will handle redirect to login
          // If on the login page itself (e.g. path '/'), no redirect needed from here.
        }
      } catch (error) {
        console.error("Keycloak initialization error:", error);
        setIsKeycloakInitialized(true); // Still mark as initialized to stop loading screen
        // Potentially redirect to an error page or show a global error message
      }
    };

    initKeycloak();

    // Setup token refresh mechanism
    const refreshInterval = setInterval(() => {
      if (keycloak.authenticated) {
        keycloak.updateToken(70).then((refreshed: boolean) => {
          if (refreshed) {
            console.log('Token refreshed' + refreshed);
          } else {
            const expiresAt = keycloak.tokenParsed?.exp ?? 0;
            const validForSeconds = Math.round(expiresAt + (keycloak.timeSkew ?? 0) - new Date().getTime() / 1000);
            console.warn('Token not refreshed, valid for ' + validForSeconds + ' seconds');
          }
        }).catch(() => {
          console.error('Failed to refresh token');
        });
      }
    }, 60000) // Refresh every 60 seconds

    return () => clearInterval(refreshInterval);

  }, [navigate]);

  if (!isKeycloakInitialized) {
    return <Loading />;
  }

  return (
    <div className="h-screen w-full">
      <NavigationHelper /> {/* Include the helper to set up global navigation functions */}
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<RouteErrorBoundary><DemoBannerFrame><AuthEntryPoint /></DemoBannerFrame></RouteErrorBoundary>} />
        
        {/* Protected routes: each page is wrapped in an auth guard and an error boundary. */}
        <Route path="/home" element={<ProtectedPage><HomePage /></ProtectedPage>} />
        <Route path="/home-cdo" element={<ProtectedPage><HomePageCdo /></ProtectedPage>} />
        <Route path="/home-exec" element={<ProtectedPage><HomePageExec /></ProtectedPage>} />
        <Route path="/home-dir" element={<ProtectedPage><HomePageDir /></ProtectedPage>} /> 
        <Route path="/my-profile" element={<ProtectedPage><MyProfilePage /></ProtectedPage>} />

        <Route path="/policy-hub" element={<ProtectedPage><PolicyManagementHub /></ProtectedPage>} />
        <Route path="/policy-hub2" element={<ProtectedPage><PolicyManagementHub2 /></ProtectedPage>} />
        <Route path="/policy-editor" element={<ProtectedPage><PolicyEditor /></ProtectedPage>} />
        <Route path="/policy-wizard-flow" element={<ProtectedPage><PolicyWizardFlow /></ProtectedPage>} />
        <Route path="/data-catalog" element={<ProtectedPage><DataCatalog /></ProtectedPage>} />
        <Route path="/data-engineer" element={<ProtectedPage><DataEngineerDashboard /></ProtectedPage>} />
        <Route path="/compliance-agent" element={<ProtectedPage><ComplianceAgentView /></ProtectedPage>} />
        <Route path="/label-rule-config" element={<ProtectedPage><LabelRuleConfig /></ProtectedPage>} />
        <Route path="/delete-agent-config" element={<ProtectedPage><DeleteAgentConfig /></ProtectedPage>} />
        <Route path="/archival-agent-activity" element={<ProtectedPage><ArchivalAgentActivitySaving /></ProtectedPage>} />
        <Route path="/admin-control-hub" element={<ProtectedPage><AdminControlHub /></ProtectedPage>} />
        <Route path="/label-ml-config" element={<ProtectedPage><LabelMlConfig /></ProtectedPage>} />
        <Route path="/archival-agent-overview" element={<ProtectedPage><ArchivalAgentOverview /></ProtectedPage>} />
        <Route path="/label-create-new-policy-popup" element={<ProtectedPage><DemoBannerFrame><LabelCreateNewPolicyPopup /></DemoBannerFrame></ProtectedPage>} />
        <Route path="/archival-agent-policy-configuration" element={<ProtectedPage><ArchivalAgentPolicyConfiguration /></ProtectedPage>} />
        <Route path="/delete-agent-overview" element={<ProtectedPage><DeleteAgentOverview /></ProtectedPage>} />
        <Route path="/label-agent-overview" element={<ProtectedPage><LabelAgentOverview /></ProtectedPage>} />
        <Route path="/discovery-agent-overview" element={<ProtectedPage><DiscoveryAgentOverview /></ProtectedPage>} />
        <Route path="/data-discovery-agent-config" element={<ProtectedPage><DataDiscoveryAgentConfig /></ProtectedPage>} />
        <Route path="/discovery-agent-asset-log" element={<ProtectedPage><DiscoveryAgentAssetLog /></ProtectedPage>} />
        <Route path="/reporting-insights-hub" element={<ProtectedPage><ReportingInsightsHub /></ProtectedPage>} />
        <Route path="/expiry-report" element={<ProtectedPage><ExpiryReport /></ProtectedPage>} />
        <Route path="/approvals" element={<ProtectedPage><ApprovalInbox /></ProtectedPage>} />
        <Route path="/policy-detail-view" element={<ProtectedPage><PolicyDetailView /></ProtectedPage>} />
        <Route path="/asset-detail-view" element={<ProtectedPage><AssetDetailView /></ProtectedPage>} />
        <Route path="/platform-settings" element={<ProtectedPage><PlatformSettings /></ProtectedPage>} />
        <Route path="/event-center" element={<ProtectedPage><EventCenter /></ProtectedPage>} />
        <Route path="/event-subscriptions" element={<ProtectedPage><EventSubscriptions /></ProtectedPage>} />
        <Route path="/event-analytics" element={<ProtectedPage><EventAnalytics /></ProtectedPage>} />
        <Route path="/user-management" element={<ProtectedPage><UserManagement /></ProtectedPage>} />

        <Route path="*" element={<NotFound />} /> {/* Catch-all 404 route */}
      </Routes>
      </Suspense>
    </div>
  );
}

// Wrap App with BrowserRouter as App now uses useNavigate hook
const WrappedApp = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export default WrappedApp;
