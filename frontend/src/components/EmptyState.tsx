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

import { FeatherAlertTriangle, FeatherInbox, FeatherRefreshCw } from "@subframe/core";
import React from "react";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";

/**
 * Presentational states shared across pages so they can render honest
 * empty/error UI instead of fabricated placeholder data. These are pure view
 * components — no data fetching, no business logic (CLAUDE.md §9).
 */

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

/**
 * Neutral "nothing here yet" state. Use when a real backend call succeeded but
 * returned no rows (e.g. no watched datasets, no policies configured).
 */
export function EmptyState({
  title = "Nothing to show yet",
  message,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-12 text-center">
      {icon !== undefined ? (
        icon
      ) : (
        <IconWithBackground variant="neutral" size="large" icon={<FeatherInbox />} />
      )}
      <div className="flex flex-col items-center gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">
          {title}
        </span>
        {message ? (
          <span className="max-w-[448px] text-body font-body text-subtext-color">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * Error state for when a backend call failed. Optionally renders a retry
 * button when the caller supplies an onRetry handler.
 */
export function ErrorState({
  message = "Something went wrong while loading this data.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 rounded-md border border-solid border-error-200 bg-error-50 px-6 py-12 text-center">
      <IconWithBackground
        variant="error"
        size="large"
        icon={<FeatherAlertTriangle />}
      />
      <span className="max-w-[448px] text-body font-body text-error-800">
        {message}
      </span>
      {onRetry ? (
        <Button
          variant="neutral-secondary"
          icon={<FeatherRefreshCw />}
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export default EmptyState;
