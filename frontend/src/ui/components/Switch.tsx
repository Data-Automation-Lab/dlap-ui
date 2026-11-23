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
 * Switch — https://app.subframe.com/5b130da4e598/library?component=Switch_7a464794-9ea9-4040-b1de-5bfb2ce599d9
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";

interface ThumbProps
  extends React.ComponentProps<typeof SubframeCore.Switch.Thumb> {
  className?: string;
}

const Thumb = React.forwardRef<HTMLElement, ThumbProps>(function Thumb(
  { className, ...otherProps }: ThumbProps,
  ref
) {
  return (
    <SubframeCore.Switch.Thumb asChild={true} {...otherProps}>
      <div
        className={SubframeUtils.twClassNames(
          "flex h-3.5 w-3.5 flex-col items-start gap-2 rounded-full bg-white shadow-sm",
          className
        )}
        ref={ref as any}
      />
    </SubframeCore.Switch.Thumb>
  );
});

interface SwitchRootProps
  extends React.ComponentProps<typeof SubframeCore.Switch.Root> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

const SwitchRoot = React.forwardRef<HTMLElement, SwitchRootProps>(
  function SwitchRoot({ className, ...otherProps }: SwitchRootProps, ref) {
    return (
      <SubframeCore.Switch.Root asChild={true} {...otherProps}>
        <div
          className={SubframeUtils.twClassNames(
            "group/7a464794 flex h-5 w-8 cursor-pointer flex-col items-start justify-center gap-2 rounded-full border border-solid border-neutral-200 bg-neutral-200 px-0.5 py-0.5 aria-[checked=true]:border aria-[checked=true]:border-solid aria-[checked=true]:border-brand-600 aria-[checked=true]:bg-brand-600",
            className
          )}
          ref={ref as any}
        >
          <Thumb />
        </div>
      </SubframeCore.Switch.Root>
    );
  }
);

export const Switch = Object.assign(SwitchRoot, {
  Thumb,
});
