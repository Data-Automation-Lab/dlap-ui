# Application Sitemap

This document outlines the structure of the user-facing pages in the application.

## I. Authentication

-   **Login Page** (`AuthEntryPoint.tsx`)
    -   Entry point for user authentication.
-   **Sign Up Page** (`SignUp.tsx`)
    -   Allows new users to register.

## II. Main Application Areas

-   **Home Page (Default)** (`HomePage.tsx`)
    -   General landing page after login.
-   **Dashboard (CDO)** (`HomePageCdo.tsx`)
    -   Dashboard tailored for Chief Data Officers.
-   **Dashboard (Executive)** (`HomePageExec.tsx`)
    -   Dashboard tailored for Executive users.
-   **Dashboard (Director)** (`HomePageDir.tsx`)
    -   Dashboard tailored for Engineering Directors.
-   **Dashboard (Data Engineer)** (`DataEngineerDashboard.tsx`)
    -   Dashboard tailored for Data Engineers.
-   **Data Catalog** (`DataCatalog.tsx`)
    -   Browse and manage data assets.
-   **Policy Center** (`PolicyManagementHub2.tsx`)
    -   Central hub for managing all types of policies.
    -   *Legacy/Alternate*: `PolicyManagementHub.tsx`
-   **Policy Creation/Editing Wizard** (`PolicyWizardFlow.tsx`)
    -   Step-by-step flow for creating or modifying policies.
-   **Reporting & Insights Hub** (`ReportingInsightsHub.tsx`)
    -   View reports and analytics (e.g., cost savings, compliance).

## III. Smart Agents Management

### A. Discovery Agent

-   **Discovery Agent Overview** (`DiscoveryAgentOverview.tsx`)
    -   Dashboard and summary for data discovery operations.
-   **Discovery Agent Configuration** (`DataDiscoveryAgentConfig.tsx`)
    -   Settings and configuration for the discovery agent.
-   **Discovery Agent Asset Log** (`DiscoveryAgentAssetLog.tsx`)
    -   Logs of discovered assets.

### B. Label Agent

-   **Label Agent Overview** (`LabelAgentOverview.tsx`)
    -   Dashboard and summary for data labeling operations.
-   **Label Rule Configuration** (`LabelRuleConfig.tsx`)
    -   Manage rule-based labeling policies.
-   **Label ML Configuration** (`LabelMlConfig.tsx`)
    -   Manage machine learning models for labeling.
-   **Label Create New Policy Popup/Form** (`LabelCreateNewPolicyPopup.tsx`)
    -   Likely a modal/popup for quick policy creation related to labels (could be part of `PolicyWizardFlow` or a standalone form).

### C. Archival Agent

-   **Archival Agent Overview** (`ArchivalAgentOverview.tsx`)
    -   Dashboard and summary for data archival operations.
-   **Archival Agent Policy Configuration** (`ArchivalAgentPolicyConfiguration.tsx`)
    -   Settings and policies for data archival.
-   **Archival Agent Activity & Savings** (`ArchivalAgentActivitySaving.tsx`)
    -   Logs and metrics for archival activities and cost savings.

### D. Deletion Agent

-   **Deletion Agent Overview** (`DeleteAgentOverview.tsx`)
    -   Dashboard and summary for data deletion operations.
-   **Deletion Agent Configuration** (`DeleteAgentConfig.tsx`)
    -   Settings and policies for data deletion.

### E. Compliance Agent

-   **Compliance Agent View** (`ComplianceAgentView.tsx`)
    -   Dashboard and summary for compliance monitoring.

## IV. Administration & Settings

-   **Admin Control Hub** (`AdminControlHub.tsx`)
    -   Central dashboard for platform administrators.
-   **Admin Cloud Connections** (`AdminCloudConnections.tsx`)
    -   Manage connections to cloud providers.
-   **Admin Cloud Connection Wizard** (`AdminCloudConnectionWizard1.tsx`)
    -   Step-by-step flow for adding/editing cloud connections.
-   **Data Source Configuration** (`DataSourceConfiguration.tsx`)
    -   General platform settings, possibly including data source management at a higher level.


*This sitemap is generated based on the filenames in `frontend/src/pages` and their apparent roles within the application. Specific user flows and access points between pages are detailed in `docs/how-to/page-mapping.md` and through implemented navigation links.* 