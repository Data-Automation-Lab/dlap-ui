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

import { useEffect } from "react";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";

/**
 * Data-source configuration is fully owned by AdminCloudConnections, which is
 * wired to the real da-admin GET/POST/PUT/DELETE /api/v1/admin/cloud-connections
 * endpoints (create/test/manage cloud connections). This page previously held a
 * static, hardcoded mockup (fixed "Connected"/"Needs Attention" statuses and
 * no-op "Manage Connection" / "Save Changes" buttons) that duplicated — and
 * conflicted with — that live view. Rather than fabricate connection state here,
 * redirect to the canonical AdminCloudConnections page on mount and render
 * nothing. If the navigation global is unavailable we surface a plain message
 * with a link instead of a dead button.
 */
function DataSourceConfiguration() {
  useEffect(() => {
    window.navigateToAdminCloudConnections?.();
  }, []);

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-body font-body text-subtext-color">
          Redirecting to Cloud Connections…{" "}
          <button
            type="button"
            className="text-brand-600 underline"
            onClick={() => window.navigateToAdminCloudConnections?.()}
          >
            Open Cloud Connections
          </button>
        </span>
      </div>
    </DefaultPageLayout>
  );
}

export default DataSourceConfiguration;
