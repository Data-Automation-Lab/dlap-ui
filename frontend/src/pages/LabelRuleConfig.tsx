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

import { FeatherPlus } from "@subframe/core";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../ui/components/Button";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";

/**
 * Rule Configuration tab of the AutoLabel agent.
 *
 * da-autolabel exposes no rule-CRUD endpoint (its rule data is limited to the
 * read-only /api/v1/label-agent/rule-activities and /rule-performance
 * dashboard feeds shown on the Overview tab), so this page honestly reports
 * that rule management is not yet available instead of rendering fabricated
 * rule rows. Rule-based labeling policies are authored through the policy
 * wizard (da-policyengine); ML-based labeling is configured on the ML
 * Configuration tab.
 */
function LabelRuleConfig() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full items-center justify-between">
          <span className="text-heading-2 font-heading-2 text-default-font">
            AutoLabel Management
          </span>
        </div>
        <Tabs>
          <Tabs.Item
            onClick={() => window.navigateToLabelAgentOverview?.()}
          >
            Overview
          </Tabs.Item>
          <Tabs.Item active={true}>Rule Configuration</Tabs.Item>
          <Tabs.Item
            onClick={() => window.navigateToLabelMlConfig?.()}
          >
            ML Configuration
          </Tabs.Item>
        </Tabs>
        <div className="flex w-full flex-col items-start gap-6">
          <div className="flex w-full items-center justify-between">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Rule-based Labeling Policies
            </span>
            <Button
              icon={<FeatherPlus />}
              onClick={() => window.navigateToPolicyWizardFlow?.()}
            >
              Manage Labeling Policies
            </Button>
          </div>
          <EmptyState
            title="Rule management not yet available"
            message="The labeling service does not yet expose an API for creating or editing labeling rules directly. Labeling policies can be managed through the policy wizard, and LLM-powered labeling is configured on the ML Configuration tab. Rule activity and performance are shown on the Overview tab."
          />
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default LabelRuleConfig;
