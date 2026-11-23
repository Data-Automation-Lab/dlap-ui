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
    FeatherBrain,
    FeatherCheck,
    FeatherPieChart,
    FeatherRefreshCw,
    FeatherSave,
    FeatherSettings,
    FeatherZap,
} from "@subframe/core";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "../components/EmptyState";
import { Alert } from "../ui/components/Alert";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { Select } from "../ui/components/Select";
import { Switch } from "../ui/components/Switch";
import { Tabs } from "../ui/components/Tabs";
import { TextArea } from "../ui/components/TextArea";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import apiClient, { labelingApi } from "../utils/api";
import { httpStatus, serverMessage } from '../utils/httpError';

/**
 * Mirrors da-autolabel MLConfigRequest
 * (com.dlap.autolabel.client.rest.dto.MLConfigRequest).
 */
interface MlConfigDto {
  providerType?: string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  modelName?: string | null;
  promptTemplate?: string | null;
  additionalParameters?: Record<string, unknown> | null;
  suggestionConfig?: {
    maxSuggestions?: number | null;
    includeConfidenceScores?: boolean | null;
  } | null;
  confidenceConfig?: {
    minThreshold?: number | null;
    actionBelowThreshold?: string | null;
  } | null;
}

/** Response of POST /api/v1/autolabel/labeling/config/ml/test. */
interface MlTestResult {
  provider?: string;
  connectionTest?: string;
  configurationTest?: string;
  overallStatus?: string;
  status?: string;
  message?: string;
}

/** Form state — numeric fields held as strings while editing. */
interface MlConfigForm {
  providerType: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  promptTemplate: string;
  temperature: string;
  maxTokens: string;
  maxSuggestions: string;
  includeConfidenceScores: boolean;
  minThreshold: string;
  actionBelowThreshold: string;
}

const EMPTY_FORM: MlConfigForm = {
  providerType: "",
  apiKey: "",
  baseUrl: "",
  modelName: "",
  promptTemplate: "",
  temperature: "",
  maxTokens: "",
  maxSuggestions: "",
  includeConfidenceScores: false,
  minThreshold: "",
  actionBelowThreshold: "",
};

/** Map the backend DTO into editable form state (view mapping only). */
function dtoToForm(dto: MlConfigDto): MlConfigForm {
  const params = dto.additionalParameters ?? {};
  return {
    providerType: dto.providerType ?? "",
    apiKey: dto.apiKey ?? "",
    baseUrl: dto.baseUrl ?? "",
    modelName: dto.modelName ?? "",
    promptTemplate: dto.promptTemplate ?? "",
    temperature: params.temperature != null ? String(params.temperature) : "",
    maxTokens: params.maxTokens != null ? String(params.maxTokens) : "",
    maxSuggestions:
      dto.suggestionConfig?.maxSuggestions != null
        ? String(dto.suggestionConfig.maxSuggestions)
        : "",
    includeConfidenceScores:
      dto.suggestionConfig?.includeConfidenceScores ?? false,
    minThreshold:
      dto.confidenceConfig?.minThreshold != null
        ? String(dto.confidenceConfig.minThreshold)
        : "",
    actionBelowThreshold: dto.confidenceConfig?.actionBelowThreshold ?? "",
  };
}

/**
 * Build the MLConfigRequest payload from the form. `extraParams` carries any
 * additionalParameters keys the backend returned that this form does not
 * edit, so a round-trip never drops them.
 */
function formToDto(
  form: MlConfigForm,
  extraParams: Record<string, unknown>
): MlConfigDto {
  const additionalParameters: Record<string, unknown> = { ...extraParams };
  if (form.temperature.trim() !== "" && !isNaN(Number(form.temperature))) {
    additionalParameters.temperature = Number(form.temperature);
  }
  if (form.maxTokens.trim() !== "" && !isNaN(Number(form.maxTokens))) {
    additionalParameters.maxTokens = Number(form.maxTokens);
  }
  return {
    providerType: form.providerType || null,
    apiKey: form.apiKey || null,
    baseUrl: form.baseUrl || null,
    modelName: form.modelName || null,
    promptTemplate: form.promptTemplate || null,
    additionalParameters,
    suggestionConfig: {
      maxSuggestions:
        form.maxSuggestions.trim() !== "" && !isNaN(Number(form.maxSuggestions))
          ? Number(form.maxSuggestions)
          : null,
      includeConfidenceScores: form.includeConfidenceScores,
    },
    confidenceConfig: {
      minThreshold:
        form.minThreshold.trim() !== "" && !isNaN(Number(form.minThreshold))
          ? Number(form.minThreshold)
          : null,
      actionBelowThreshold: form.actionBelowThreshold || null,
    },
  };
}

interface Banner {
  variant: "success" | "error" | "neutral" | "warning";
  title: string;
  description?: string;
}

function LabelMlConfig() {
  const [form, setForm] = useState<MlConfigForm>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<MlConfigForm>(EMPTY_FORM);
  const [extraParams, setExtraParams] = useState<Record<string, unknown>>({});
  const [configured, setConfigured] = useState<boolean>(false);
  const [providers, setProviders] = useState<string[] | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<Banner | null>(null);
  const [testBanner, setTestBanner] = useState<Banner | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSaveBanner(null);
    setTestBanner(null);
    try {
      // GET /api/v1/labeling/config/ml — 404 means "not configured yet".
      const response = await labelingApi.get<MlConfigDto>("/config/ml");
      const dto = response.data ?? {};
      const nextForm = dtoToForm(dto);
      const params = { ...(dto.additionalParameters ?? {}) };
      delete params.temperature;
      delete params.maxTokens;
      setForm(nextForm);
      setSavedForm(nextForm);
      setExtraParams(params);
      setConfigured(true);
    } catch (err) {
      if (httpStatus(err) === 404) {
        // No configuration persisted yet — start from an empty form.
        setForm(EMPTY_FORM);
        setSavedForm(EMPTY_FORM);
        setExtraParams({});
        setConfigured(false);
      } else {
        setLoadError(
          httpStatus(err)
            ? `Failed to load ML configuration (HTTP ${httpStatus(err)}).`
            : "Failed to load ML configuration. The labeling service is unreachable."
        );
      }
    } finally {
      setLoading(false);
    }

    // Supported providers come from GET /api/v1/autolabel/providers. If this
    // call fails we fall back to a free-text provider field — never a
    // hardcoded list.
    try {
      const provResponse = await apiClient.get<{
        supportedProviders?: string[];
      }>("/api/v1/autolabel/providers");
      const supported = provResponse.data?.supportedProviders;
      setProviders(Array.isArray(supported) && supported.length > 0 ? supported : null);
    } catch {
      setProviders(null);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateForm = (patch: Partial<MlConfigForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    if (!form.providerType.trim()) {
      setSaveBanner({
        variant: "error",
        title: "Provider is required",
        description: "Select or enter an LLM provider before saving.",
      });
      return;
    }
    setSaving(true);
    setSaveBanner(null);
    try {
      // PUT /api/v1/labeling/config/ml — persists in the autolabel database.
      await labelingApi.put("/config/ml", formToDto(form, extraParams));
      setSavedForm(form);
      setConfigured(true);
      setSaveBanner({
        variant: "success",
        title: "ML configuration saved",
        description: "The configuration is persisted and survives restarts.",
      });
    } catch (err) {
      const status = httpStatus(err);
      setSaveBanner({
        variant: "error",
        title: "Failed to save ML configuration",
        description:
          status === 403
            ? "Your account does not have the ADMIN role required to change this configuration."
            : status
            ? `The labeling service rejected the update (HTTP ${status}).`
            : "The labeling service is unreachable.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(savedForm);
    setSaveBanner(null);
    setTestBanner(null);
  };

  const handleTestConnection = async () => {
    if (!form.providerType.trim()) {
      setTestBanner({
        variant: "error",
        title: "Provider is required",
        description: "Select or enter an LLM provider before testing.",
      });
      return;
    }
    setTesting(true);
    setTestBanner(null);
    try {
      // POST /api/v1/autolabel/labeling/config/ml/test — validates the
      // supplied configuration and probes provider connectivity.
      const response = await apiClient.post<MlTestResult>(
        "/api/v1/autolabel/labeling/config/ml/test",
        formToDto(form, extraParams)
      );
      const result = response.data ?? {};
      const passed = result.overallStatus === "SUCCESS";
      setTestBanner({
        variant: passed ? "success" : "error",
        title: passed
          ? "Configuration test passed"
          : "Configuration test failed",
        description: `Connection: ${result.connectionTest ?? "UNKNOWN"} · Configuration: ${
          result.configurationTest ?? "UNKNOWN"
        }`,
      });
    } catch (err) {
      const status = httpStatus(err);
      const message = serverMessage(err);
      setTestBanner({
        variant: "error",
        title: "Configuration test failed",
        description:
          message ||
          (status
            ? `The labeling service returned HTTP ${status}.`
            : "The labeling service is unreachable."),
      });
    } finally {
      setTesting(false);
    }
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        {/* Header */}
        <div className="flex w-full flex-wrap items-center gap-2 px-6 pt-6 pb-2">
          <div className="flex grow shrink-0 basis-0 items-center gap-2">
            <FeatherBrain className="text-heading-2 font-heading-2 text-default-font" />
            <span className="text-heading-2 font-heading-2 text-default-font">
              SmartLabel Management
            </span>
            {!loading && !loadError ? (
              <Badge variant={configured ? "success" : "neutral"}>
                {configured ? "Configured" : "Not configured"}
              </Badge>
            ) : null}
          </div>
          <Button
            variant="neutral-primary"
            icon={<FeatherRefreshCw />}
            onClick={loadData}
            disabled={loading || saving || testing}
          >
            Refresh
          </Button>
          {isDirty ? (
            <Button
              variant="neutral-secondary"
              onClick={handleCancel}
              disabled={saving || testing}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            icon={<FeatherSave />}
            onClick={handleSave}
            loading={saving}
            disabled={loading || saving || !!loadError}
          >
            Save Configuration
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex w-full items-end border-b border-solid border-neutral-border">
          <Tabs>
            <Tabs.Item
              icon={<FeatherPieChart />}
              onClick={() => window.navigateToLabelAgentOverview?.()}
            >
              Overview
            </Tabs.Item>
            <Tabs.Item
              icon={<FeatherSettings />}
              onClick={() => window.navigateToLabelRuleConfig?.()}
            >
              Rule Configuration
            </Tabs.Item>
            <Tabs.Item active={true} icon={<FeatherZap />}>
              ML Configuration
            </Tabs.Item>
          </Tabs>
        </div>

        {/* Main Content */}
        <div className="container max-w-none flex w-full grow shrink-0 basis-0 flex-col items-center gap-6 py-12 overflow-auto">
          <div className="flex w-full max-w-[768px] flex-col items-start gap-8">
            {loading ? (
              <div className="flex w-full items-center justify-center py-12">
                <span className="text-body font-body text-subtext-color">
                  Loading ML configuration...
                </span>
              </div>
            ) : loadError ? (
              <ErrorState message={loadError} onRetry={loadData} />
            ) : (
              <>
                {!configured ? (
                  <Alert
                    variant="neutral"
                    title="No ML configuration yet"
                    description="The labeling service has no persisted ML configuration. Fill in the settings below and save to enable LLM-powered auto-labeling."
                  />
                ) : null}
                {saveBanner ? (
                  <Alert
                    variant={saveBanner.variant}
                    title={saveBanner.title}
                    description={saveBanner.description}
                  />
                ) : null}

                {/* LLM Provider Settings */}
                <div className="flex w-full flex-col items-start gap-6">
                  <div className="flex w-full flex-col items-start gap-1">
                    <span className="text-heading-3 font-heading-3 text-default-font">
                      LLM Provider Settings
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      Configure the large language model used for automated
                      labeling
                    </span>
                  </div>

                  <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                    <div className="grid grid-cols-2 gap-4 w-full">
                      {providers ? (
                        <Select
                          label="Provider"
                          placeholder="Select provider"
                          value={form.providerType || undefined}
                          onValueChange={(providerType) =>
                            updateForm({ providerType })
                          }
                        >
                          {providers.map((p) => (
                            <Select.Item key={p} value={p}>
                              {p}
                            </Select.Item>
                          ))}
                        </Select>
                      ) : (
                        <TextField
                          label="Provider"
                          helpText="e.g. OPENAI or OLLAMA"
                          className="w-full"
                        >
                          <TextField.Input
                            value={form.providerType}
                            onChange={(e) =>
                              updateForm({ providerType: e.target.value })
                            }
                            placeholder="Provider type"
                          />
                        </TextField>
                      )}

                      <TextField label="Model" className="w-full">
                        <TextField.Input
                          value={form.modelName}
                          onChange={(e) =>
                            updateForm({ modelName: e.target.value })
                          }
                          placeholder="e.g. gpt-4-turbo or llama2"
                        />
                      </TextField>
                    </div>

                    <TextField label="API Key" className="w-full">
                      <TextField.Input
                        type="password"
                        value={form.apiKey}
                        onChange={(e) => updateForm({ apiKey: e.target.value })}
                        placeholder="Provider API key (if required)"
                      />
                    </TextField>

                    <TextField
                      label="Base URL"
                      helpText="Provider API endpoint — required for self-hosted models such as Ollama"
                      className="w-full"
                    >
                      <TextField.Input
                        value={form.baseUrl}
                        onChange={(e) => updateForm({ baseUrl: e.target.value })}
                        placeholder="https://api.openai.com/v1"
                      />
                    </TextField>

                    <div className="grid grid-cols-2 gap-4 w-full">
                      <TextField label="Temperature" className="w-full">
                        <TextField.Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={form.temperature}
                          onChange={(e) =>
                            updateForm({ temperature: e.target.value })
                          }
                          placeholder="e.g. 0.3"
                        />
                      </TextField>

                      <TextField label="Max Tokens" className="w-full">
                        <TextField.Input
                          type="number"
                          min="1"
                          value={form.maxTokens}
                          onChange={(e) =>
                            updateForm({ maxTokens: e.target.value })
                          }
                          placeholder="e.g. 4096"
                        />
                      </TextField>
                    </div>

                    <TextArea
                      label="Prompt Template"
                      helpText="Template used to generate labels; may include metadata placeholders such as {metadata_summary}"
                      className="w-full"
                    >
                      <TextArea.Input
                        value={form.promptTemplate}
                        onChange={(e) =>
                          updateForm({ promptTemplate: e.target.value })
                        }
                        placeholder="Based on the following metadata, suggest relevant labels: {metadata_summary}"
                      />
                    </TextArea>

                    {testBanner ? (
                      <Alert
                        variant={testBanner.variant}
                        title={testBanner.title}
                        description={testBanner.description}
                      />
                    ) : null}

                    <Button
                      variant="neutral-tertiary"
                      onClick={handleTestConnection}
                      loading={testing}
                      disabled={testing || saving}
                      icon={<FeatherCheck />}
                    >
                      Test Connection
                    </Button>
                  </div>
                </div>

                <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />

                {/* Suggestion Settings */}
                <div className="flex w-full flex-col items-start gap-6">
                  <div className="flex w-full flex-col items-start gap-1">
                    <span className="text-heading-3 font-heading-3 text-default-font">
                      Suggestion Settings
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      Control how many labels are suggested and how confidence
                      is handled
                    </span>
                  </div>

                  <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                    <div className="grid grid-cols-2 gap-4 w-full">
                      <TextField label="Max Suggestions" className="w-full">
                        <TextField.Input
                          type="number"
                          min="1"
                          value={form.maxSuggestions}
                          onChange={(e) =>
                            updateForm({ maxSuggestions: e.target.value })
                          }
                          placeholder="e.g. 5"
                        />
                      </TextField>

                      <TextField
                        label="Minimum Confidence Threshold"
                        helpText="Between 0.0 and 1.0"
                        className="w-full"
                      >
                        <TextField.Input
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          value={form.minThreshold}
                          onChange={(e) =>
                            updateForm({ minThreshold: e.target.value })
                          }
                          placeholder="e.g. 0.7"
                        />
                      </TextField>
                    </div>

                    <TextField
                      label="Action Below Threshold"
                      helpText="What to do when a suggestion falls below the threshold, e.g. REJECT or FLAG_FOR_REVIEW"
                      className="w-full"
                    >
                      <TextField.Input
                        value={form.actionBelowThreshold}
                        onChange={(e) =>
                          updateForm({ actionBelowThreshold: e.target.value })
                        }
                        placeholder="REJECT"
                      />
                    </TextField>

                    <div className="flex w-full items-center justify-between">
                      <span className="text-body font-body text-default-font">
                        Include confidence scores with suggestions
                      </span>
                      <Switch
                        checked={form.includeConfidenceScores}
                        onCheckedChange={(includeConfidenceScores) =>
                          updateForm({ includeConfidenceScores })
                        }
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default LabelMlConfig;
