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

import { FeatherActivity, FeatherAlertTriangle, FeatherArchive, FeatherSave } from "@subframe/core";
import React, { useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Switch } from "../ui/components/Switch";
import { Tabs } from "../ui/components/Tabs";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { archivalApi } from "../utils/api";

// -----------------------------------------------------------------------------
// Real da-autoarchival config shape (ArchivalConfigController / ArchivalConfigDTO):
//   GET /api/v1/archival/config -> ArchivalConfigDTO
//   PUT /api/v1/archival/config -> ArchivalConfigDTO (updated)
// da-autoarchival exposes no "list archival policies" endpoint, so the previous
// hardcoded policy table was removed. This page now edits the real global
// archival configuration and shows live KPI counts from /overview/kpis.
// -----------------------------------------------------------------------------
interface ArchivalConfig {
  enabled?: boolean;
  defaultArchivalTier?: string;
  defaultRetentionDays?: number;
  requireApprovalForArchival?: boolean;
  requireApprovalForRestore?: boolean;
}

interface ArchivalKpis {
  activePolicies?: number;
  pendingArchival?: number;
}

function ArchivalAgentPolicyConfiguration() {
  const [config, setConfig] = useState<ArchivalConfig | null>(null);
  const [kpis, setKpis] = useState<ArchivalKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [configRes, kpisRes] = await Promise.all([
        archivalApi.get("/config"),
        archivalApi.get("/overview/kpis").catch(() => ({ data: null })),
      ]);
      setConfig(configRes.data ?? {});
      setKpis(kpisRes.data ?? null);
    } catch (e) {
      console.error("Error loading archival configuration:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = <K extends keyof ArchivalConfig>(key: K, value: ArchivalConfig[K]) => {
    setConfig((prev) => ({ ...(prev ?? {}), [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await archivalApi.put("/config", config);
      setConfig(res.data ?? config);
      setSaved(true);
    } catch (e) {
      console.error("Error saving archival configuration:", e);
      setSaveError("Failed to save configuration. You may not have permission to update it.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-heading-2 font-heading-2 text-default-font">
              AutoArchival Management
            </span>
            {config?.enabled ? (
              <Badge variant="success">Enabled</Badge>
            ) : (
              <Badge variant="neutral">Disabled</Badge>
            )}
          </div>
        </div>
        <Tabs>
          <Tabs.Item onClick={() => window.navigateToArchivalAgentOverview?.()}>Overview</Tabs.Item>
          <Tabs.Item active={true} onClick={() => window.navigateToArchivalAgentPolicyConfiguration?.()}>Policy Configuration</Tabs.Item>
          <Tabs.Item onClick={() => window.navigateToArchivalAgentActivity?.()}>Archival Activity &amp; Savings</Tabs.Item>
        </Tabs>

        {loading ? (
          <div className="flex w-full items-center justify-center py-12">
            <span className="text-body font-body text-subtext-color">Loading configuration…</span>
          </div>
        ) : error || !config ? (
          <ErrorState message="Could not load archival configuration." onRetry={load} />
        ) : (
          <div className="flex w-full flex-col items-start gap-6">
            <div className="flex w-full flex-wrap items-start gap-4">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
                <div className="flex w-full items-center gap-2">
                  <IconWithBackground variant="success" icon={<FeatherActivity />} />
                  <span className="text-body-bold font-body-bold text-subtext-color">
                    Active Policies
                  </span>
                </div>
                <span className="text-heading-1 font-heading-1 text-default-font">
                  {kpis?.activePolicies ?? 0}
                </span>
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
                <div className="flex w-full items-center gap-2">
                  <IconWithBackground variant="warning" icon={<FeatherAlertTriangle />} />
                  <span className="text-body-bold font-body-bold text-subtext-color">
                    Pending Archival
                  </span>
                </div>
                <span className="text-heading-1 font-heading-1 text-default-font">
                  {kpis?.pendingArchival ?? 0}
                </span>
              </div>
            </div>

            <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground icon={<FeatherArchive />} />
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Archival Configuration
                </span>
              </div>

              <div className="flex w-full items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">Auto-Archival Enabled</span>
                  <span className="text-caption font-caption text-subtext-color">
                    Globally enable or disable automated archival.
                  </span>
                </div>
                <Switch
                  checked={config.enabled ?? false}
                  onCheckedChange={(checked: boolean) => update("enabled", checked)}
                />
              </div>

              <div className="flex w-full flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">Default Archival Tier</span>
                <TextField className="w-full" label="" helpText="e.g. S3_GLACIER_DEEP_ARCHIVE, AZURE_ARCHIVE">
                  <TextField.Input
                    placeholder="S3_GLACIER_DEEP_ARCHIVE"
                    value={config.defaultArchivalTier ?? ""}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => update("defaultArchivalTier", event.target.value)}
                  />
                </TextField>
              </div>

              <div className="flex w-full flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">Default Retention (Days)</span>
                <TextField className="w-full" label="" helpText="Retention before eligibility for permanent deletion.">
                  <TextField.Input
                    type="number"
                    placeholder="0"
                    value={config.defaultRetentionDays != null ? String(config.defaultRetentionDays) : ""}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      const v = event.target.value;
                      update("defaultRetentionDays", v === "" ? undefined : Number(v));
                    }}
                  />
                </TextField>
              </div>

              <div className="flex w-full items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">Require Approval for Archival</span>
                  <span className="text-caption font-caption text-subtext-color">
                    Require manual approval before archiving assets.
                  </span>
                </div>
                <Switch
                  checked={config.requireApprovalForArchival ?? false}
                  onCheckedChange={(checked: boolean) => update("requireApprovalForArchival", checked)}
                />
              </div>

              <div className="flex w-full items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">Require Approval for Restore</span>
                  <span className="text-caption font-caption text-subtext-color">
                    Require manual approval before restoring archived assets.
                  </span>
                </div>
                <Switch
                  checked={config.requireApprovalForRestore ?? false}
                  onCheckedChange={(checked: boolean) => update("requireApprovalForRestore", checked)}
                />
              </div>

              <div className="flex w-full items-center gap-3">
                <Button icon={<FeatherSave />} loading={saving} onClick={handleSave}>
                  Save Configuration
                </Button>
                {saved ? (
                  <span className="text-body font-body text-success-600">Configuration saved.</span>
                ) : null}
                {saveError ? (
                  <span className="text-body font-body text-error-600">{saveError}</span>
                ) : null}
              </div>
            </div>

            <EmptyState
              title="Rule-based archival policies live in Policy Hub"
              message="Detailed archival policy rules are managed by the Policy Engine. Use the Policy Wizard to create or edit them."
              icon={<IconWithBackground variant="neutral" size="large" icon={<FeatherArchive />} />}
            />
            <Button variant="neutral-secondary" onClick={() => window.navigateToPolicyWizardFlow?.()}>
              Open Policy Wizard
            </Button>
          </div>
        )}
      </div>
    </DefaultPageLayout>
  );
}

export default ArchivalAgentPolicyConfiguration;
