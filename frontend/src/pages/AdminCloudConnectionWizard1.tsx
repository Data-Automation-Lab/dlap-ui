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
  FeatherAlertCircle,
  FeatherCheck,
  FeatherShield,
} from "@subframe/core";
import React, { useState } from "react";
import { Alert } from "../ui/components/Alert";
import { Breadcrumbs } from "../ui/components/Breadcrumbs";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Select } from "../ui/components/Select";
import { TextArea } from "../ui/components/TextArea";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { adminApi } from "../utils/api";

/**
 * Registers a NAMED cloud connection reference — no credentials.
 *
 * By design this form never collects secrets (access keys, service-account
 * JSON, client secrets, passwords, tokens). Credentials are provisioned
 * server-side by an administrator (secret manager / federated short-lived
 * roles); the DTO's write-only `sensitiveCredentials` field is never sent.
 */

/** Provider enum as defined by da-admin-service CloudProviderType. */
type CloudProviderType = "AWS" | "AZURE" | "GCP" | "OTHER";

const PROVIDER_OPTIONS: { value: CloudProviderType; label: string }[] = [
  { value: "AWS", label: "Amazon Web Services" },
  { value: "AZURE", label: "Microsoft Azure" },
  { value: "GCP", label: "Google Cloud Platform" },
  { value: "OTHER", label: "Other" },
];

/**
 * Optional non-secret scope identifier per provider. These are resource
 * identifiers (not credentials): AWS account ID, GCP project ID, Azure
 * subscription ID.
 */
const SCOPE_FIELDS: Record<
  CloudProviderType,
  { key: string; label: string; helpText: string; placeholder: string }
> = {
  AWS: {
    key: "accountId",
    label: "AWS Account ID (optional)",
    helpText: "Non-secret account identifier used to scope discovery.",
    placeholder: "123456789012",
  },
  GCP: {
    key: "projectId",
    label: "GCP Project ID (optional)",
    helpText: "Non-secret project identifier used to scope discovery.",
    placeholder: "my-project-id",
  },
  AZURE: {
    key: "subscriptionId",
    label: "Azure Subscription ID (optional)",
    helpText: "Non-secret subscription identifier used to scope discovery.",
    placeholder: "00000000-0000-0000-0000-000000000000",
  },
  OTHER: {
    key: "scopeId",
    label: "Scope identifier (optional)",
    helpText: "Non-secret identifier used to scope discovery.",
    placeholder: "environment or tenant identifier",
  },
};

function navigateBackToConnections() {
  window.navigateToAdminCloudConnections?.();
}

function AdminCloudConnectionWizard1() {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [providerType, setProviderType] = useState<CloudProviderType | "">("");
  const [environment, setEnvironment] = useState<string>("");
  const [scopeValue, setScopeValue] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scopeField = providerType ? SCOPE_FIELDS[providerType] : null;
  const isValid = name.trim().length > 0 && providerType !== "";

  const handleProviderChange = (value: string) => {
    setProviderType(value as CloudProviderType);
    // Scope identifiers are provider-specific; clear when switching provider.
    setScopeValue("");
  };

  // Register the named connection reference. sensitiveCredentials is
  // intentionally never set — the UI does not handle raw secrets.
  const saveConnection = async () => {
    // isValid already guarantees name is set and a provider is chosen.
    if (!isValid) {
      return;
    }
    setSaving(true);
    setError(null);

    const connectionParameters: Record<string, string> = {};
    if (environment) {
      connectionParameters.environment = environment;
    }
    if (region.trim()) {
      connectionParameters.region = region.trim();
    }
    if (scopeField && scopeValue.trim()) {
      connectionParameters[scopeField.key] = scopeValue.trim();
    }

    try {
      await adminApi.post("/cloud-connections", {
        name: name.trim(),
        description: description.trim() || undefined,
        providerType,
        connectionParameters,
      });
      navigateBackToConnections();
    } catch (err) {
      console.error("Error registering cloud connection:", err);
      setError(
        "Failed to register the connection. Verify you have administrator access and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full flex-col items-start gap-4">
          <Breadcrumbs>
            <Breadcrumbs.Item>Administration</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item>Cloud Connections</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>
              Register Connection
            </Breadcrumbs.Item>
          </Breadcrumbs>
          <span className="text-heading-2 font-heading-2 text-default-font">
            Register Cloud Connection
          </span>
        </div>

        <div className="flex w-full items-center gap-4 rounded-md bg-brand-50 p-4">
          <IconWithBackground variant="brand" icon={<FeatherShield />} />
          <div className="flex grow shrink-0 basis-0 flex-col items-start">
            <span className="text-body-bold font-body-bold text-default-font">
              Credentials are provisioned server-side
            </span>
            <span className="text-body font-body text-subtext-color">
              Credentials are provisioned server-side by an administrator
              (secret manager / federated short-lived roles). This registers a
              named connection; it becomes usable once server-side credentials
              are configured.
            </span>
          </div>
        </div>

        {error && (
          <Alert
            variant="error"
            icon={<FeatherAlertCircle />}
            title="Registration failed"
            description={error}
          />
        )}

        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 rounded-md border border-solid border-neutral-border bg-default-background p-6">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Connection Details
          </span>
          <TextField
            className="h-auto w-full flex-none"
            label="Connection Name"
            helpText="A descriptive name for this connection"
          >
            <TextField.Input
              placeholder="e.g., Production AWS Account"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
            />
          </TextField>
          <Select
            className="h-auto w-full flex-none"
            label="Provider"
            helpText="The cloud provider this connection refers to"
            placeholder="Select provider"
            value={providerType || undefined}
            onValueChange={handleProviderChange}
          >
            {PROVIDER_OPTIONS.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select>
          <TextArea
            className="h-auto w-full flex-none"
            label="Description"
            helpText="Optional description for this connection"
          >
            <TextArea.Input
              placeholder="Enter description..."
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
            />
          </TextArea>
          <Select
            className="h-auto w-full flex-none"
            label="Environment (optional)"
            helpText="Stored as a non-secret connection parameter"
            placeholder="Select environment"
            value={environment || undefined}
            onValueChange={setEnvironment}
          >
            <Select.Item value="development">Development</Select.Item>
            <Select.Item value="staging">Staging</Select.Item>
            <Select.Item value="production">Production</Select.Item>
          </Select>
          {scopeField && (
            <TextField
              className="h-auto w-full flex-none"
              label={scopeField.label}
              helpText={scopeField.helpText}
            >
              <TextField.Input
                placeholder={scopeField.placeholder}
                value={scopeValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setScopeValue(e.target.value)
                }
              />
            </TextField>
          )}
          <TextField
            className="h-auto w-full flex-none"
            label="Default Region (optional)"
            helpText="Non-secret default region for discovery, e.g. us-east-1"
          >
            <TextField.Input
              placeholder="us-east-1"
              value={region}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setRegion(e.target.value)
              }
            />
          </TextField>
        </div>

        <div className="flex w-full max-w-[768px] items-center justify-end gap-4 pt-2">
          <Button
            variant="neutral-tertiary"
            disabled={saving}
            onClick={navigateBackToConnections}
          >
            Cancel
          </Button>
          <Button
            icon={<FeatherCheck />}
            loading={saving}
            disabled={saving || !isValid}
            onClick={saveConnection}
          >
            {saving ? "Registering..." : "Register Connection"}
          </Button>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default AdminCloudConnectionWizard1;
