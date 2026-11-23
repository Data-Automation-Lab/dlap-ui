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
 * Legacy Policy Center (v1). This route was a static mockup with
 * fabricated rows. It now redirects to the live Policy Center
 * (PolicyManagementHub2) which is wired to da-policyengine. The route
 * is retained for backward-compatible deep links.
 */
function PolicyManagementHub() {
  useEffect(() => {
    window.navigateToPolicyHub2?.();
  }, []);

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-body font-body text-subtext-color">
          Redirecting to Policy Center…
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default PolicyManagementHub;
