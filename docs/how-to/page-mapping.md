# Page to Navbar Mapping (`frontend/src/ui/layouts/DefaultPageLayout.tsx`)

This document maps the pages defined in `frontend/src/App.tsx` to the navigation items in the `DefaultPageLayout.tsx` component.

## Main Navigation

-   **Home** (`<SidebarWithSections.NavItem icon={<FeatherHome />}>`)
    -   Maps to: `HomePage.tsx` (`window.navigateToHome()`)
-   **Dashboard** (`<SidebarWithSections.NavItem icon={<FeatherGauge />}>`)
    -   Maps to: `HomePageCdo.tsx` (`window.navigateToHomeCdo()`)
    -   *Other Potential Pages (role-dependent)*: `HomePageDir.tsx`, `HomePageExec.tsx`, `DataEngineerDashboard.tsx`
-   **Data Catalog** (`<SidebarWithSections.NavItem icon={<FeatherSearch />}>`)
    -   Maps to: `DataCatalog.tsx` (`window.navigateToDataCatalog()`)
-   **Data Policy Center** (`<SidebarWithSections.NavItem icon={<FeatherWand2 />}>`)
    -   Maps to: `PolicyManagementHub2.tsx` (`window.navigateToPolicyHub2()`)
    -   *Related Pages*: `PolicyManagementHub.tsx` (older version), `PolicyWizardFlow.tsx`
-   **Analytics** (`<SidebarWithSections.NavItem icon={<FeatherBarChart2 />}>`)
    -   Maps to: `ReportingInsightsHub.tsx` (`window.navigateToReportingInsightsHub()`) (Previously mapped to ComplianceAgentView)


## Smart Agents (Section: `Smart Agents`)

-   **Smart Discovery** (`<SidebarWithSections.NavItem icon={<FeatherFocus />}>`)
    -   Maps to: `DiscoveryAgentOverview.tsx` (`window.navigateToDiscoveryAgentOverview()`)
    -   *Related Pages*: `DataDiscoveryAgentConfig.tsx`, `DiscoveryAgentAssetLog.tsx`
-   **Smart Label** (`<SidebarWithSections.NavItem icon={<FeatherTags />}>`)
    -   Maps to: `LabelAgentOverview.tsx` (`window.navigateToLabelAgentOverview()`)
    -   *Related Pages*: `LabelRuleConfig.tsx`, `LabelMlConfig.tsx`, `LabelCreateNewPolicyPopup.tsx`
-   **Smart Compliance** (`<SidebarWithSections.NavItem icon={<FeatherCheckCheck />}>`)
    -   Maps to: `ComplianceAgentView.tsx` (`window.navigateToComplianceAgent()`)
-   **Smart Archival** (`<SidebarWithSections.NavItem icon={<FeatherArchive />}>`)
    -   Maps to: `ArchivalAgentOverview.tsx` (`window.navigateToArchivalAgentOverview()`)
    -   *Related Pages*: `ArchivalAgentActivitySaving.tsx`, `ArchivalAgentPolicyConfiguration.tsx`
-   **Smart Deletion** (`<SidebarWithSections.NavItem icon={<FeatherTrash2 />}>`)
    -   Maps to: `DeleteAgentOverview.tsx` (`window.navigateToDeleteAgentOverview()`)
    -   *Related Pages*: `DeleteAgentConfig.tsx`

## Admin Center (Section: `Admin Center`)

-   **User Management** (`<SidebarWithSections.NavItem icon={<FeatherUsers />}>`)
    -   Maps to: `AdminControlHub.tsx` (`window.navigateToAdminControlHub()`)
-   **Cloud Connections** (`<SidebarWithSections.NavItem icon={<FeatherCloudy />}>`)
    -   Maps to: `AdminCloudConnections.tsx` (`window.navigateToAdminCloudConnections()`)
    -   *Related Pages*: `AdminCloudConnectionWizard1.tsx`
-   **Platform Settings** (`<SidebarWithSections.NavItem icon={<FeatherWebhook />}>`)
    -   Maps to: `DataSourceConfiguration.tsx` (`window.navigateToDataSourceConfig()`)

## User Profile Dropdown Menu

-   **Profile** (`<DropdownMenu.DropdownItem icon={<FeatherUser />}>`)
    -   *No direct page mapping yet.* (Could be a future user profile page)
-   **Settings** (`<DropdownMenu.DropdownItem icon={<FeatherSettings />}>`)
    -   Maps to: `DataSourceConfiguration.tsx` (`window.navigateToDataSourceConfig()`)
-   **Log out** (`<DropdownMenu.DropdownItem icon={<FeatherLogOut />}>`)
    -   Maps to: `AuthEntryPoint.tsx` (Login Page) (`window.navigateToLogin()`)

## Unmapped Pages (from `frontend/src/pages`):

The following pages exist but are not directly linked from the primary navigation structure in `DefaultPageLayout.tsx`. They are typically accessed via other pages, wizards, or popups.

*   `AuthEntryPoint.tsx` (Handled by logout and initial load)
*   `SignUp.tsx` (Accessed from Login page)
*   `AdminCloudConnectionWizard1.tsx` (Likely accessed from `AdminCloudConnections.tsx`)
*   `LabelCreateNewPolicyPopup.tsx` (Likely a popup from a Labeling configuration page)
*   `PolicyWizardFlow.tsx` (Likely accessed from a Policy Hub page to create new policies)
*   The various role-specific home pages (`HomePageCdo.tsx`, `HomePageDir.tsx`, `HomePageExec.tsx`) and `DataEngineerDashboard.tsx` would require logic to display based on user role, potentially under the "Dashboard" nav item or a modified "Home".
*   `PolicyManagementHub.tsx` (Older version of `PolicyManagementHub2.tsx`)

This mapping is based on the current structure and `onClick` handlers implemented in `DefaultPageLayout.tsx` and `App.tsx` as of the last review. The "Analytics" section was previously linked to `ComplianceAgentView` but seems more appropriate for `ReportingInsightsHub`. 