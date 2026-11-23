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

"use client";
/*
 * Documentation:
 * Default Page Layout — https://app.subframe.com/5b130da4e598/library?component=Default+Page+Layout_a57b1c43-310a-493f-b807-8cc88e2452cf
 * Sidebar with sections — https://app.subframe.com/5b130da4e598/library?component=Sidebar+with+sections_f4047c8b-cfb4-4761-b9cf-fbcae8a9b9b5
 * Avatar — https://app.subframe.com/5b130da4e598/library?component=Avatar_bec25ae6-5010-4485-b46b-cf79e3943ab2
 * Dropdown Menu — https://app.subframe.com/5b130da4e598/library?component=Dropdown+Menu_99951515-459b-4286-919e-a89e7549b43b
 * Icon Button — https://app.subframe.com/5b130da4e598/library?component=Icon+Button_af9405b1-8c54-4e01-9786-5aad308224f6
 */

import * as SubframeCore from "@subframe/core";
import { FeatherActivity, FeatherArchive, FeatherBarChart2, FeatherCheckCheck, FeatherCheckSquare, FeatherClock, FeatherFocus, FeatherGauge, FeatherHome, FeatherLogOut, FeatherMoreHorizontal, FeatherSearch, FeatherSettings, FeatherTags, FeatherTrash2, FeatherUser, FeatherUsers, FeatherWand2, FeatherWebhook } from "@subframe/core";
import React from "react";
import { useLocation } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { DropdownMenu } from "../components/DropdownMenu";
import { IconButton } from "../components/IconButton";
import { SidebarWithSections } from "../components/SidebarWithSections";
import * as SubframeUtils from "../utils";
import keycloak from "../../keycloak";
import { useCurrentUser } from "../../utils/currentUser";
import type { NavigationHelperName } from "../../types/window";
import { ROUTES, useAppNavigate } from "../../utils/useAppNavigate";
import { DemoBanner, DemoPageUnavailable } from "../../components/DemoBanner";
import { isDemoMode, isDemoPageAllowed } from "../../demo/pageAllowlist";
import { APPROVALS_ROUTE, canReadApprovals } from "../../utils/approvalApi";
import { canReadExpiryReport } from "../../utils/reportApi";

/**
 * The home page each persona lands on, in priority order, with the legacy
 * window shim that App.tsx wires to the same route. The first role the user
 * holds wins; everyone else gets the generic home.
 */
const ROLE_HOMES = [
  { role: "ROLE_CDO", route: ROUTES.homeCdo, shim: "navigateToHomeCdo" },
  { role: "ROLE_DIRECTOR", route: ROUTES.homeDir, shim: "navigateToHomeDir" },
  { role: "ROLE_ADMIN", route: ROUTES.homeExec, shim: "navigateToHomeExec" },
  {
    role: "ROLE_DATA_ENGINEER",
    route: ROUTES.dataEngineer,
    shim: "navigateToDataEngineer",
  },
] as const;

/** Resolves the dashboard route and shim for a set of realm roles. */
function roleHome(roles: string[]): { route: string; shim: string } {
  const match = ROLE_HOMES.find((home) => roles.includes(home.role));
  return match ?? { route: ROUTES.home, shim: "navigateToHome" };
}

interface DefaultPageLayoutRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const DefaultPageLayoutRoot = React.forwardRef<
  HTMLElement,
  DefaultPageLayoutRootProps
>(function DefaultPageLayoutRoot(
  { children, className, ...otherProps }: DefaultPageLayoutRootProps,
  ref
) {
  const { roles } = useCurrentUser();
  // Idiomatic react-router navigation for the primary sidebar items (C8
  // incremental migration off the window.navigateToX shim). The remaining
  // window.* call sites (the role-home dispatcher and the footer dropdown)
  // still use the shim wired up in App.tsx and are migrated in a follow-up.
  const nav = useAppNavigate();
  const { pathname } = useLocation();

  // Demo build (DEMO-03): show the banner and only the allowlisted pages. With
  // the flag off, demoMode is false and every check below passes, so the layout
  // renders exactly as before.
  const demoMode = isDemoMode();
  const visible = (route: string) => isDemoPageAllowed(route, demoMode);
  const pageHidden = demoMode && !isDemoPageAllowed(pathname, demoMode);

  // Route the "Dashboard" nav item to the signed-in persona's home. ROLE_ADMIN
  // maps to the executive home; unknown roles fall back to the generic /home.
  const home = roleHome(roles);
  const navigateToRoleHome = () => {
    window[home.shim as NavigationHelperName]?.();
  };

  // Real logout (IAM-01). The footer menu used to call window.navigateToLogin(),
  // which only routed to "/" and left the Keycloak SSO session alive, so the
  // next check-sso silently signed the user back in. keycloak.logout() ends the
  // SSO session and returns to the app root, which must match a
  // post.logout.redirect.uris entry of the dlap-ui client (the realm uses "+").
  const logout = async () => {
    try {
      await keycloak.logout({ redirectUri: `${window.location.origin}/` });
    } catch (error) {
      console.error("Logout failed:", error);
      // Fall back to a plain redirect so the user still leaves the app shell.
      window.location.href = "/";
    }
  };

  // In a demo build the banner sits above the layout, so the layout fills the
  // remaining height instead of the whole viewport.
  const layout = (
    <div
      className={SubframeUtils.twClassNames(
        "flex h-screen w-full items-start",
        demoMode && "h-auto min-h-0 grow",
        className
      )}
      ref={ref as React.Ref<HTMLDivElement>}
      {...otherProps}
    >
      <SidebarWithSections
        className="mobile:hidden"
        header={
          <img
            className="h-9 flex-none object-cover"
            src="https://res.cloudinary.com/subframe/image/upload/v1747952082/uploads/13082/hyvutu5fi9i500lxovur.jpg"
            alt="Data Automation Lab logo"
          />
        }
        footer={
          <>
            <div className="flex grow shrink-0 basis-0 items-start gap-2">
              <Avatar image="https://res.cloudinary.com/subframe/image/upload/v1711417513/shared/kwut7rhuyivweg8tmyzl.jpg">
                A
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-caption-bold font-caption-bold text-default-font">
                  Irvin
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  Founder
                </span>
              </div>
            </div>
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <IconButton size="small" icon={<FeatherMoreHorizontal />} />
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu>
                    {visible(ROUTES.myProfile) ? (
                      <DropdownMenu.DropdownItem icon={<FeatherUser />} onClick={() => window.navigateToMyProfile?.() }>
                        Account
                      </DropdownMenu.DropdownItem>
                    ) : null}
                    {visible(ROUTES.platformSettings) ? (
                      <DropdownMenu.DropdownItem icon={<FeatherSettings />} onClick={() => window.navigateToPlatformSettings?.() }>
                        Settings
                      </DropdownMenu.DropdownItem>
                    ) : null}
                    <DropdownMenu.DropdownItem icon={<FeatherLogOut />} onClick={() => void logout() }>
                      Log out
                    </DropdownMenu.DropdownItem>
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
          </>
        }
      >
        {visible(ROUTES.home) ? (
          <SidebarWithSections.NavItem icon={<FeatherHome />} onClick={() => nav.go("home") } >
            Home
          </SidebarWithSections.NavItem>
        ) : null}
        {visible(home.route) ? (
          <SidebarWithSections.NavItem icon={<FeatherGauge />} onClick={() => navigateToRoleHome() }>
            Dashboard
          </SidebarWithSections.NavItem>
        ) : null}
        {visible(ROUTES.dataCatalog) ? (
          <SidebarWithSections.NavItem icon={<FeatherSearch />} onClick={() => nav.go("dataCatalog") }>
            Data Estate
          </SidebarWithSections.NavItem>
        ) : null}
        {visible(ROUTES.policyHub2) ? (
          <SidebarWithSections.NavItem icon={<FeatherWand2 />} onClick={() => nav.go("policyHub2") }>
            Data Policy Center
          </SidebarWithSections.NavItem>
        ) : null}
        {visible(ROUTES.reportingInsightsHub) ? (
          <SidebarWithSections.NavItem icon={<FeatherBarChart2 />} onClick={() => nav.go("reportingInsightsHub") }>
            Analytics
          </SidebarWithSections.NavItem>
        ) : null}
        {visible(ROUTES.expiryReport) && canReadExpiryReport(roles) ? (
          <SidebarWithSections.NavItem icon={<FeatherClock />} onClick={() => nav.go("expiryReport") }>
            Expiry Report
          </SidebarWithSections.NavItem>
        ) : null}
        {visible(ROUTES.eventCenter) ? (
          <SidebarWithSections.NavItem icon={<FeatherActivity />} onClick={() => nav.go("eventCenter") }>
            Event Center
          </SidebarWithSections.NavItem>
        ) : null}
        {visible(APPROVALS_ROUTE) && canReadApprovals(roles) ? (
          <SidebarWithSections.NavItem icon={<FeatherCheckSquare />} onClick={() => nav.goTo(APPROVALS_ROUTE) }>
            Approvals
          </SidebarWithSections.NavItem>
        ) : null}
        <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
        <SidebarWithSections.NavSection label="Smart Agents">
          {visible(ROUTES.discoveryAgentOverview) ? (
            <SidebarWithSections.NavItem icon={<FeatherFocus />} onClick={() => nav.go("discoveryAgentOverview") }>
              Smart Discovery
            </SidebarWithSections.NavItem>
          ) : null}
          {visible(ROUTES.labelAgentOverview) ? (
            <SidebarWithSections.NavItem icon={<FeatherTags />} onClick={() => nav.go("labelAgentOverview") }>
              Smart Label
            </SidebarWithSections.NavItem>
          ) : null}
          {visible(ROUTES.complianceAgent) ? (
            <SidebarWithSections.NavItem icon={<FeatherCheckCheck />} onClick={() => nav.go("complianceAgent") }>
              Smart Compliance
            </SidebarWithSections.NavItem>
          ) : null}
          {visible(ROUTES.archivalAgentOverview) ? (
            <SidebarWithSections.NavItem icon={<FeatherArchive />} onClick={() => nav.go("archivalAgentOverview") }>
              Smart Archival
            </SidebarWithSections.NavItem>
          ) : null}
          {visible(ROUTES.deleteAgentOverview) ? (
            <SidebarWithSections.NavItem icon={<FeatherTrash2 />} onClick={() => nav.go("deleteAgentOverview") }>
              Smart Deletion
            </SidebarWithSections.NavItem>
          ) : null}
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
        </SidebarWithSections.NavSection>
        {visible(ROUTES.userManagement) || visible(ROUTES.platformSettings) ? (
          <>
            <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
            <SidebarWithSections.NavSection label="Admin Center">
              {visible(ROUTES.userManagement) ? (
                <SidebarWithSections.NavItem icon={<FeatherUsers />} onClick={() => window.navigateToUserManagement?.() }>
                  User Management
                </SidebarWithSections.NavItem>
              ) : null}
              {visible(ROUTES.platformSettings) ? (
                <SidebarWithSections.NavItem icon={<FeatherWebhook />} onClick={() => window.navigateToPlatformSettings?.() }>
                  Platform Settings
                </SidebarWithSections.NavItem>
              ) : null}
            </SidebarWithSections.NavSection>
          </>
        ) : null}
      </SidebarWithSections>
      {pageHidden || children ? (
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 self-stretch overflow-y-auto bg-default-background">
          {pageHidden ? (
            <DemoPageUnavailable onGoHome={() => nav.go("home")} />
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );

  if (!demoMode) {
    return layout;
  }
  return (
    <div className="flex h-screen w-full flex-col">
      <DemoBanner />
      {layout}
    </div>
  );
});

export const DefaultPageLayout = DefaultPageLayoutRoot;
