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
/*
 * Documentation:
 * Progress — https://app.subframe.com/5b130da4e598/library?component=Progress_60964db0-a1bf-428b-b9d5-f34cdf58ea77
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";

interface IndicatorProps
  extends React.ComponentProps<typeof SubframeCore.Progress.Indicator> {
  className?: string;
}

const Indicator = React.forwardRef<HTMLElement, IndicatorProps>(
  function Indicator({ className, ...otherProps }: IndicatorProps, ref) {
    return (
      <SubframeCore.Progress.Indicator asChild={true} {...otherProps}>
        <div
          className={SubframeUtils.twClassNames(
            "flex h-2 w-full flex-col items-start gap-2 rounded-full bg-brand-600",
            className
          )}
          ref={ref as any}
        />
      </SubframeCore.Progress.Indicator>
    );
  }
);

interface ProgressRootProps
  extends React.ComponentProps<typeof SubframeCore.Progress.Root> {
  value?: number;
  className?: string;
}

const ProgressRoot = React.forwardRef<HTMLElement, ProgressRootProps>(
  function ProgressRoot(
    { value = 30, className, ...otherProps }: ProgressRootProps,
    ref
  ) {
    return (
      <SubframeCore.Progress.Root asChild={true} value={value} {...otherProps}>
        <div
          className={SubframeUtils.twClassNames(
            "flex w-full flex-col items-start gap-2 overflow-hidden rounded-full bg-neutral-100",
            className
          )}
          ref={ref as any}
        >
          <Indicator />
        </div>
      </SubframeCore.Progress.Root>
    );
  }
);

export const Progress = Object.assign(ProgressRoot, {
  Indicator,
});
