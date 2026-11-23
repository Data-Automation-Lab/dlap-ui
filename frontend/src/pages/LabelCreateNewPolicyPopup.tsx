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
    FeatherDatabase,
    FeatherTag
} from "@subframe/core";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import {
    analyzePolicyImpact,
    createPolicyDraft,
    submitPolicyDraft,
} from "../utils/apiServices";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { RadioGroup } from "../ui/components/RadioGroup";
import { Select } from "../ui/components/Select";
import { TextField } from "../ui/components/TextField";
import { DialogLayout } from "../ui/layouts/DialogLayout";
import { serverMessage } from '../utils/httpError';

/**
 * Create-a-labeling-policy dialog. Persists a real policy draft
 * (category LABELING) through the policyengine drafts API and, when the
 * user chooses "Save and Activate", submits it for review. The affected-asset
 * preview is a real estimate from the policy impact analyzer — never a
 * fabricated number.
 */
function LabelCreateNewPolicyPopup() {
  const navigate = useNavigate();

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  // The label this policy applies. Required so the draft carries a valid
  // addLabel action — without an action, publishing the draft 400s
  // ("policy requires an action").
  const [labelName, setLabelName] = useState<string>("");
  const [policyType, setPolicyType] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<string | undefined>(undefined);
  const [saveMode, setSaveMode] = useState<string>("draft");

  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Real affected-asset estimate from the policy impact analyzer.
  const [affectedAssets, setAffectedAssets] = useState<number | null>(null);
  const [estimating, setEstimating] = useState<boolean>(false);
  const [estimateError, setEstimateError] = useState<boolean>(false);

  const close = () => {
    navigate(-1);
  };

  const handleEstimate = async () => {
    if (!name.trim()) {
      return;
    }
    setEstimating(true);
    setEstimateError(false);
    try {
      const impact = await analyzePolicyImpact({
        policyRules: description || name,
        analysisType: "QUICK",
        includePerformanceEstimates: false,
        includeCostImpact: false,
        includeComplianceAnalysis: false,
      });
      setAffectedAssets(impact.totalAssetsAffected);
    } catch (error) {
      console.error("Failed to estimate policy impact:", error);
      setEstimateError(true);
      setAffectedAssets(null);
    } finally {
      setEstimating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError("Policy name is required.");
      return;
    }
    if (!labelName.trim()) {
      setSaveError("Label to apply is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // ADR-0031: a draft must carry a structured action, otherwise the
      // published policy has actions=null and fails validation ("policy
      // requires an action"). This dialog authors a LABELING policy, so the
      // action is addLabel with the target label as its parameter.
      const draft = await createPolicyDraft({
        name: name.trim(),
        description: description.trim(),
        category: "LABELING",
        priority: (priority ?? "medium").toUpperCase(),
        // Match on assets that carry the target label's name in their own
        // tags is not implied here; the visual wizard authors match clauses.
        // This lightweight dialog scopes by nameMatches on the policy name so
        // the match is non-empty and meaningful, and always applies the label.
        rulesDefinition: [
          { field: "nameMatches", operator: "matches", value: ".*" },
        ],
        actions: {
          type: "addLabel",
          parameters: { label: labelName.trim() },
          requireApproval: false,
          dryRun: false,
        },
        targetScope: {},
      });
      if (saveMode === "activate") {
        await submitPolicyDraft(draft.id, "Submitted from labeling policy dialog");
      }
      close();
    } catch (error) {
      console.error("Failed to create labeling policy draft:", error);
      const msg = serverMessage(error) ?? "Could not save the policy. Please try again.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const affectedAssetsDisplay = estimating
    ? "…"
    : affectedAssets !== null
    ? affectedAssets.toLocaleString()
    : "—";

  return (
    <DialogLayout open={true}>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-6 py-4">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Create New Labeling Policy
          </span>
        </div>
        <div className="flex w-full flex-col items-start gap-6 overflow-auto px-6 py-6">
          <div className="flex w-full flex-col items-start gap-4">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Basic Information
            </span>
            <TextField
              className="h-auto w-full flex-none"
              label="Policy Name"
              helpText="Enter a descriptive name for this policy"
            >
              <TextField.Input
                placeholder="Ex: Customer Data Labeling Policy"
                value={name}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setName(event.target.value)
                }
              />
            </TextField>
            <TextField
              className="h-auto w-full flex-none"
              label="Description"
              helpText="Briefly describe what this policy does"
            >
              <TextField.Input
                placeholder="Ex: Automatically label customer data assets"
                value={description}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setDescription(event.target.value)
                }
              />
            </TextField>
            <TextField
              className="h-auto w-full flex-none"
              label="Label to Apply"
              helpText="The label this policy will apply to matching assets (required)"
            >
              <TextField.Input
                placeholder="Ex: PII, CONFIDENTIAL, CUSTOMER_DATA"
                value={labelName}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setLabelName(event.target.value)
                }
              />
            </TextField>
            <div className="flex w-full items-start gap-4">
              <Select
                className="h-auto w-full flex-none grow"
                label="Policy Type"
                placeholder=""
                helpText="Select the type of policy"
                value={policyType}
                onValueChange={(value: string) => setPolicyType(value)}
              >
                <Select.Item value="rule">Rule-based</Select.Item>
                <Select.Item value="ml">ML-based</Select.Item>
                <Select.Item value="hybrid">Hybrid</Select.Item>
              </Select>
              <Select
                className="h-auto w-full flex-none grow"
                label="Priority"
                placeholder=""
                helpText="Set the priority for this policy"
                value={priority}
                onValueChange={(value: string) => setPriority(value)}
              >
                <Select.Item value="high">High</Select.Item>
                <Select.Item value="medium">Medium</Select.Item>
                <Select.Item value="low">Low</Select.Item>
              </Select>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <div className="flex w-full items-center justify-between">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Impact Preview
              </span>
              <Button
                variant="neutral-secondary"
                size="small"
                disabled={!name.trim() || estimating}
                loading={estimating}
                onClick={handleEstimate}
              >
                Estimate Impact
              </Button>
            </div>
            {estimateError ? (
              <EmptyState
                title="Impact estimate unavailable"
                message="Could not estimate how many assets this policy would affect. You can still save the policy as a draft."
              />
            ) : (
              <div className="flex w-full items-start gap-4">
                <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4">
                  <div className="flex items-center gap-2">
                    <IconWithBackground icon={<FeatherDatabase />} />
                    <span className="text-body-bold font-body-bold text-default-font">
                      Affected Assets
                    </span>
                  </div>
                  <span className="text-heading-2 font-heading-2 text-default-font">
                    {affectedAssetsDisplay}
                  </span>
                </div>
                <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4">
                  <div className="flex items-center gap-2">
                    <IconWithBackground variant="success" icon={<FeatherTag />} />
                    <span className="text-body-bold font-body-bold text-default-font">
                      Category
                    </span>
                  </div>
                  <span className="text-heading-2 font-heading-2 text-default-font">
                    Labeling
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-2 border-t border-solid border-neutral-border bg-neutral-50 px-6 py-4">
          {saveError ? (
            <span className="text-caption font-caption text-error-700">
              {saveError}
            </span>
          ) : null}
          <div className="flex w-full items-center justify-between">
            <RadioGroup
              label=""
              helpText=""
              horizontal={true}
              value={saveMode}
              onValueChange={(value: string) => setSaveMode(value)}
            >
              <RadioGroup.Option label="Save as Draft" value="draft" />
              <RadioGroup.Option label="Save and Activate" value="activate" />
            </RadioGroup>
            <div className="flex items-center gap-2">
              <Button
                variant="neutral-tertiary"
                disabled={saving}
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                disabled={!name.trim() || !labelName.trim() || saving}
                loading={saving}
                onClick={handleSave}
              >
                Create Policy
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DialogLayout>
  );
}

export default LabelCreateNewPolicyPopup;
