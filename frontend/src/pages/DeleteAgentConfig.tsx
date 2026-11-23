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

import {
    FeatherPlus,
    FeatherRefreshCw,
    FeatherSave,
    FeatherTrash2,
} from "@subframe/core";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "../components/EmptyState";
import { Alert } from "../ui/components/Alert";
import { Badge } from "../ui/components/Badge";
import { Breadcrumbs } from "../ui/components/Breadcrumbs";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Switch } from "../ui/components/Switch";
import { Tabs } from "../ui/components/Tabs";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { deletionApi } from "../utils/api";
import { httpStatus } from '../utils/httpError';

/**
 * Mirrors da-autodelete DeletionConfigDTO
 * (com.dlap.autodelete.dto.DeletionConfigDTO).
 */
interface DeletionConfigDto {
  enabled?: boolean | null;
  softDeleteByDefault?: boolean;
  defaultSoftDeleteRetentionDays?: number | null;
  requireApprovalForHardDelete?: boolean;
  requireApprovalForSoftDelete?: boolean;
  notificationEmailsOnError?: string[] | null;
}

/** Form state — retention days held as a string while editing. */
interface DeletionConfigForm {
  enabled: boolean;
  softDeleteByDefault: boolean;
  defaultSoftDeleteRetentionDays: string;
  requireApprovalForHardDelete: boolean;
  requireApprovalForSoftDelete: boolean;
  notificationEmailsOnError: string;
}

function dtoToForm(dto: DeletionConfigDto): DeletionConfigForm {
  return {
    enabled: dto.enabled ?? false,
    softDeleteByDefault: dto.softDeleteByDefault ?? false,
    defaultSoftDeleteRetentionDays:
      dto.defaultSoftDeleteRetentionDays != null
        ? String(dto.defaultSoftDeleteRetentionDays)
        : "",
    requireApprovalForHardDelete: dto.requireApprovalForHardDelete ?? false,
    requireApprovalForSoftDelete: dto.requireApprovalForSoftDelete ?? false,
    notificationEmailsOnError: (dto.notificationEmailsOnError ?? []).join(", "),
  };
}

function formToDto(form: DeletionConfigForm): DeletionConfigDto {
  return {
    enabled: form.enabled,
    softDeleteByDefault: form.softDeleteByDefault,
    defaultSoftDeleteRetentionDays:
      form.defaultSoftDeleteRetentionDays.trim() !== "" &&
      !isNaN(Number(form.defaultSoftDeleteRetentionDays))
        ? Number(form.defaultSoftDeleteRetentionDays)
        : null,
    requireApprovalForHardDelete: form.requireApprovalForHardDelete,
    requireApprovalForSoftDelete: form.requireApprovalForSoftDelete,
    notificationEmailsOnError: form.notificationEmailsOnError
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0),
  };
}

interface Banner {
  variant: "success" | "error";
  title: string;
  description?: string;
}

function DeleteAgentConfig() {
  const [form, setForm] = useState<DeletionConfigForm | null>(null);
  const [savedForm, setSavedForm] = useState<DeletionConfigForm | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setBanner(null);
    try {
      // GET /api/v1/deletion/config (da-autodelete).
      const response = await deletionApi.get<DeletionConfigDto>("/config");
      const nextForm = dtoToForm(response.data ?? {});
      setForm(nextForm);
      setSavedForm(nextForm);
    } catch (err) {
      const status = httpStatus(err);
      setLoadError(
        status === 403
          ? "Your account does not have permission to view the deletion configuration (requires ADMIN or CDO)."
          : status
          ? `Failed to load deletion configuration (HTTP ${status}).`
          : "Failed to load deletion configuration. The deletion service is unreachable."
      );
      setForm(null);
      setSavedForm(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateForm = (patch: Partial<DeletionConfigForm>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSave = async () => {
    if (!form) {
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      // PUT /api/v1/deletion/config (da-autodelete, ADMIN only).
      await deletionApi.put("/config", formToDto(form));
      setSavedForm(form);
      setBanner({
        variant: "success",
        title: "Deletion configuration saved",
      });
    } catch (err) {
      const status = httpStatus(err);
      setBanner({
        variant: "error",
        title: "Failed to save deletion configuration",
        description:
          status === 403
            ? "Your account does not have the ADMIN role required to change this configuration."
            : status
            ? `The deletion service rejected the update (HTTP ${status}).`
            : "The deletion service is unreachable.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (savedForm) {
      setForm(savedForm);
    }
    setBanner(null);
  };

  const isDirty =
    form !== null &&
    savedForm !== null &&
    JSON.stringify(form) !== JSON.stringify(savedForm);

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full flex-col items-start gap-4">
          <Breadcrumbs>
            <Breadcrumbs.Item>Smart Agents</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>
              AutoDelete Management
            </Breadcrumbs.Item>
          </Breadcrumbs>
          <div className="flex w-full items-center gap-2">
            <div className="flex grow shrink-0 basis-0 items-center gap-2">
              <IconWithBackground size="medium" icon={<FeatherTrash2 />} />
              <span className="text-heading-2 font-heading-2 text-default-font">
                AutoDelete Management
              </span>
              {form ? (
                <Badge variant={form.enabled ? "success" : "neutral"}>
                  {form.enabled ? "Enabled" : "Disabled"}
                </Badge>
              ) : null}
            </div>
            <Button
              variant="neutral-secondary"
              icon={<FeatherRefreshCw />}
              onClick={loadConfig}
              disabled={loading || saving}
            >
              Refresh
            </Button>
          </div>
          <Tabs>
            <Tabs.Item
              onClick={() => window.navigateToDeleteAgentOverview?.()}
            >
              Overview
            </Tabs.Item>
            <Tabs.Item active={true}>Policy Configuration</Tabs.Item>
          </Tabs>
        </div>

        <div className="flex w-full flex-col items-start gap-6">
          <div className="flex w-full items-center justify-between">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Global Deletion Configuration
            </span>
            <Button
              icon={<FeatherPlus />}
              onClick={() => window.navigateToPolicyWizardFlow?.()}
            >
              Manage Deletion Policies
            </Button>
          </div>

          {loading ? (
            <div className="flex w-full items-center justify-center py-12">
              <span className="text-body font-body text-subtext-color">
                Loading deletion configuration...
              </span>
            </div>
          ) : loadError || !form ? (
            <ErrorState
              message={loadError ?? "Failed to load deletion configuration."}
              onRetry={loadConfig}
            />
          ) : (
            <>
              {banner ? (
                <Alert
                  variant={banner.variant}
                  title={banner.title}
                  description={banner.description}
                />
              ) : null}

              <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Enable auto-deletion
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Global switch for the deletion agent
                    </span>
                  </div>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(enabled) => updateForm({ enabled })}
                  />
                </div>

                <div className="flex h-px w-full flex-none bg-neutral-border" />

                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Soft delete by default
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Mark assets as deleted instead of permanently removing
                      them
                    </span>
                  </div>
                  <Switch
                    checked={form.softDeleteByDefault}
                    onCheckedChange={(softDeleteByDefault) =>
                      updateForm({ softDeleteByDefault })
                    }
                  />
                </div>

                <TextField
                  label="Soft-delete retention (days)"
                  helpText="How long soft-deleted assets are kept before permanent deletion"
                  className="w-64"
                >
                  <TextField.Input
                    type="number"
                    min="0"
                    value={form.defaultSoftDeleteRetentionDays}
                    onChange={(e) =>
                      updateForm({
                        defaultSoftDeleteRetentionDays: e.target.value,
                      })
                    }
                    placeholder="e.g. 30"
                  />
                </TextField>

                <div className="flex h-px w-full flex-none bg-neutral-border" />

                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Require approval for hard delete
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Permanent deletions need manual approval before running
                    </span>
                  </div>
                  <Switch
                    checked={form.requireApprovalForHardDelete}
                    onCheckedChange={(requireApprovalForHardDelete) =>
                      updateForm({ requireApprovalForHardDelete })
                    }
                  />
                </div>

                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Require approval for soft delete
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Soft deletions need manual approval before running
                    </span>
                  </div>
                  <Switch
                    checked={form.requireApprovalForSoftDelete}
                    onCheckedChange={(requireApprovalForSoftDelete) =>
                      updateForm({ requireApprovalForSoftDelete })
                    }
                  />
                </div>

                <div className="flex h-px w-full flex-none bg-neutral-border" />

                <TextField
                  label="Error notification emails"
                  helpText="Comma-separated list notified when a deletion task fails"
                  className="w-full"
                >
                  <TextField.Input
                    value={form.notificationEmailsOnError}
                    onChange={(e) =>
                      updateForm({ notificationEmailsOnError: e.target.value })
                    }
                    placeholder="ops@example.com, dpo@example.com"
                  />
                </TextField>

                <div className="flex w-full items-center justify-end gap-2 pt-2">
                  <Button
                    variant="neutral-secondary"
                    onClick={handleCancel}
                    disabled={saving || !isDirty}
                  >
                    Cancel
                  </Button>
                  <Button
                    icon={<FeatherSave />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={saving}
                  >
                    Save Configuration
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default DeleteAgentConfig;
