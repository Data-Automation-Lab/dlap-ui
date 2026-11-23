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

import * as SubframeCore from "@subframe/core";
import {
  FeatherAlertTriangle,
  FeatherArrowRight,
  FeatherChevronDown,
  FeatherDatabase,
  FeatherLogOut,
  FeatherSettings,
  FeatherShieldCheck,
  FeatherUser,
  FeatherZap,
} from "@subframe/core";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import keycloak from "../keycloak";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { DropdownMenu } from "../ui/components/DropdownMenu";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Table } from "../ui/components/Table";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import EventCenterApiService, { EventStreamData } from "../utils/eventCenterApi";

// Public project documentation and support channels. The repository README is
// the canonical entry point for both (docs/ tree and GitHub issues).
const DOCS_URL = "https://github.com/Data-Automation-Lab/dlap/tree/main/docs";
const SUPPORT_URL = "https://github.com/Data-Automation-Lab/dlap/issues";

/** Badge color for an event severity. */
const severityBadgeVariant = (
  severity: EventStreamData["severity"]
): "error" | "warning" | "neutral" => {
  switch (severity) {
    case "CRITICAL":
    case "HIGH":
      return "error";
    case "MEDIUM":
      return "warning";
    default:
      return "neutral";
  }
};

/** Icon background color for an event severity. */
const severityIconVariant = (
  severity: EventStreamData["severity"]
): "error" | "warning" | "neutral" => severityBadgeVariant(severity);

/** Up-to-two-letter initials for an identifier (no stock photos). */
const initialsOf = (value: string): string =>
  value
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Real event timestamp rendered locally; em dash when absent/invalid. */
const formatEventTime = (timestamp: string): string => {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

function HomePage() {
  const [events, setEvents] = useState<EventStreamData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(false);
    try {
      const stream = await EventCenterApiService.getEventStream(10);
      setEvents(Array.isArray(stream) ? stream : []);
    } catch (error) {
      console.error("Failed to load recent activity from Event Center:", error);
      setEventsError(true);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start">
        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-12 py-4">
          <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
            DLAP Platform
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="neutral-tertiary"
              onClick={() => {
                window.open(DOCS_URL, "_blank", "noopener,noreferrer");
              }}
            >
              Documentation
            </Button>
            <Button
              variant="neutral-tertiary"
              onClick={() => {
                window.open(SUPPORT_URL, "_blank", "noopener,noreferrer");
              }}
            >
              Support
            </Button>
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <Button
                  variant="neutral-tertiary"
                  iconRight={<FeatherChevronDown />}
                >
                  Profile
                </Button>
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu>
                    <DropdownMenu.DropdownItem
                      icon={<FeatherUser />}
                      onClick={() => window.navigateToMyProfile?.()}
                    >
                      Account
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownItem
                      icon={<FeatherSettings />}
                      onClick={() =>
                        window.navigateToPlatformSettings?.()
                      }
                    >
                      Settings
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownDivider />
                    <DropdownMenu.DropdownItem
                      icon={<FeatherLogOut />}
                      onClick={async () => {
                        try {
                          await keycloak.logout({
                            redirectUri: window.location.origin,
                          });
                        } catch (error) {
                          console.error("Logout failed:", error);
                          // Fallback to basic redirect if Keycloak logout fails
                          window.location.href = "/";
                        }
                      }}
                    >
                      Log out
                    </DropdownMenu.DropdownItem>
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
          </div>
        </div>
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-8 bg-default-background px-12 py-12 overflow-auto">
          <div className="flex w-full items-center gap-4">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Welcome to DLAP
            </span>
          </div>
          <div className="flex w-full flex-wrap items-start gap-6">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-4">
                <IconWithBackground
                  size="medium"
                  icon={<FeatherDatabase />}
                  square={true}
                />
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Data Estate
                </span>
              </div>
              <span className="text-body font-body text-subtext-color">
                Browse and manage your organization&#39;s data assets
              </span>
              <Button
                variant="brand-tertiary"
                iconRight={<FeatherArrowRight />}
                onClick={() => window.navigateToDataCatalog?.()}
              >
                Explore catalog
              </Button>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-4">
                <IconWithBackground
                  variant="neutral"
                  size="medium"
                  icon={<FeatherShieldCheck />}
                  square={true}
                />
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Policy Center
                </span>
              </div>
              <span className="text-body font-body text-subtext-color">
                Define and manage data governance policies
              </span>
              <Button
                variant="brand-tertiary"
                iconRight={<FeatherArrowRight />}
                onClick={() => window.navigateToPolicyHub2?.()}
              >
                View policies
              </Button>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-4">
                <IconWithBackground
                  variant="success"
                  size="medium"
                  icon={<FeatherZap />}
                  square={true}
                />
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Smart Agents
                </span>
              </div>
              <span className="text-body font-body text-subtext-color">
                Configure automated data management tools
              </span>
              <Button
                variant="brand-tertiary"
                iconRight={<FeatherArrowRight />}
                onClick={() =>
                  window.navigateToDiscoveryAgentOverview?.()
                }
              >
                Manage agents
              </Button>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Recent Activity
            </span>
            {eventsLoading ? (
              <span className="text-body font-body text-subtext-color">
                Loading recent activity...
              </span>
            ) : eventsError ? (
              <ErrorState
                message="Couldn't load recent activity from the Event Center."
                onRetry={() => void loadEvents()}
              />
            ) : events.length === 0 ? (
              <EmptyState
                title="No recent activity"
                message="Events will appear here as discovery scans, labeling runs, and policy evaluations execute."
              />
            ) : (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Event</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Source</Table.HeaderCell>
                    <Table.HeaderCell>Time</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {events.map((event) => {
                  const source = event.userId || event.sourceService || "—";
                  return (
                    <Table.Row key={event.eventId}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <IconWithBackground
                            variant={severityIconVariant(event.severity)}
                            icon={
                              event.severity === "LOW" ||
                              event.severity === "INFO" ? (
                                <FeatherZap />
                              ) : (
                                <FeatherAlertTriangle />
                              )
                            }
                          />
                          <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                            {event.title || event.eventType}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant={severityBadgeVariant(event.severity)}>
                          {event.eventType || event.severity}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <Avatar size="small">{initialsOf(source)}</Avatar>
                          <span className="whitespace-nowrap text-body font-body text-default-font">
                            {source}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="whitespace-nowrap text-body font-body text-subtext-color">
                          {formatEventTime(event.timestamp)}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table>
            )}
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default HomePage;
