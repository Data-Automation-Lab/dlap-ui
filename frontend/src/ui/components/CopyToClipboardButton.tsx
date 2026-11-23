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
 * Copy to clipboard button — https://app.subframe.com/5b130da4e598/library?component=Copy+to+clipboard+button_e8c76626-6462-4f2f-b595-38d530d427e8
 * Tooltip — https://app.subframe.com/5b130da4e598/library?component=Tooltip_ccebd1e9-f6ac-4737-8376-0dfacd90c9f3
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";
import { FeatherClipboard } from "@subframe/core";
import { Tooltip } from "./Tooltip";

interface CopyToClipboardButtonRootProps
  extends Omit<
    React.ComponentProps<typeof SubframeCore.CopyToClipboard.Root>,
    "clipboardText"
  > {
  clipboardText?: React.ReactNode;
  tooltipText?: React.ReactNode;
  icon?: React.ReactNode;
  onCopy?: () => void;
  className?: string;
}

const CopyToClipboardButtonRoot = React.forwardRef<
  HTMLElement,
  CopyToClipboardButtonRootProps
>(function CopyToClipboardButtonRoot(
  {
    clipboardText,
    tooltipText,
    icon = <FeatherClipboard />,
    className,
    ...otherProps
  }: CopyToClipboardButtonRootProps,
  ref
) {
  return (
    <SubframeCore.Tooltip.Provider>
      <SubframeCore.Tooltip.Root>
        <SubframeCore.Tooltip.Trigger asChild={true}>
          <SubframeCore.CopyToClipboard.Root
            clipboardText={clipboardText as string}
            {...otherProps}
          >
            <div
              className={SubframeUtils.twClassNames(
                "group/e8c76626 flex h-6 w-6 cursor-pointer flex-col items-center justify-center gap-2 rounded-md hover:bg-neutral-100",
                className
              )}
              ref={ref as any}
            >
              {icon ? (
                <SubframeCore.IconWrapper className="text-body font-body text-subtext-color group-hover/e8c76626:text-default-font">
                  {icon}
                </SubframeCore.IconWrapper>
              ) : null}
            </div>
          </SubframeCore.CopyToClipboard.Root>
        </SubframeCore.Tooltip.Trigger>
        <SubframeCore.Tooltip.Portal>
          <SubframeCore.Tooltip.Content
            side="bottom"
            align="center"
            sideOffset={8}
            asChild={true}
          >
            <Tooltip>{tooltipText}</Tooltip>
          </SubframeCore.Tooltip.Content>
        </SubframeCore.Tooltip.Portal>
      </SubframeCore.Tooltip.Root>
    </SubframeCore.Tooltip.Provider>
  );
});

export const CopyToClipboardButton = CopyToClipboardButtonRoot;
