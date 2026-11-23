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

import React from "react";
import { isDemoMode } from "../demo/pageAllowlist";
import { Button } from "../ui/components/Button";

/** The notice every demo page carries. Shown verbatim; tests pin the text. */
export const DEMO_BANNER_TEXT =
  "Demo on synthetic data. No cloud account connected. Not production.";

/**
 * Persistent notice at the top of every page in a demo build. It is a pure
 * view component: the caller decides when to render it (demo mode only).
 */
export function DemoBanner() {
  return (
    <div
      role="note"
      aria-label="Demo notice"
      data-testid="demo-banner"
      className="flex w-full flex-none items-center justify-center border-b border-solid border-warning-200 bg-warning-100 px-4 py-2 text-center text-caption-bold font-caption-bold text-warning-900"
    >
      {DEMO_BANNER_TEXT}
    </div>
  );
}

export interface DemoPageUnavailableProps {
  /** Called when the visitor chooses to return to the demo start page. */
  onGoHome: () => void;
}

/**
 * Shown in place of a page that is not part of the demo. The sidebar already
 * hides the link; this covers a bookmarked or typed URL.
 */
export function DemoPageUnavailable({ onGoHome }: DemoPageUnavailableProps) {
  return (
    <div
      role="status"
      data-testid="demo-page-unavailable"
      className="flex w-full flex-col items-center justify-center gap-4 px-6 py-12 text-center"
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">
          This page is not part of the demo
        </span>
        <span className="max-w-[448px] text-body font-body text-subtext-color">
          The demo shows a guided set of pages on synthetic data. Use the menu
          to open one of them.
        </span>
      </div>
      <Button variant="brand-secondary" onClick={onGoHome}>
        Go to the demo start page
      </Button>
    </div>
  );
}

export interface DemoBannerFrameProps {
  children: React.ReactNode;
}

/**
 * Puts the demo banner above a page that does not render inside
 * DefaultPageLayout, such as the sign-in page and the label dialog. Outside a
 * demo build it returns the children untouched.
 *
 * App.tsx is the one place that can apply it to those routes, for example
 * element={<DemoBannerFrame><AuthEntryPoint /></DemoBannerFrame>}.
 */
export function DemoBannerFrame({ children }: DemoBannerFrameProps) {
  if (!isDemoMode()) {
    return <>{children}</>;
  }
  return (
    <div className="flex h-screen w-full flex-col">
      <DemoBanner />
      <div className="min-h-0 w-full grow overflow-y-auto">{children}</div>
    </div>
  );
}
