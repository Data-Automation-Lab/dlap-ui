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
 * Toast — https://app.subframe.com/5b130da4e598/library?component=Toast_2c7966c2-a95d-468a-83fe-bf196b95be7a
 * Button — https://app.subframe.com/5b130da4e598/library?component=Button_3b777358-b86b-40af-9327-891efc6826fe
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";
import { FeatherInfo } from "@subframe/core";

interface ToastRootProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: "brand" | "neutral" | "error" | "success";
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

const ToastRoot = React.forwardRef<HTMLElement, ToastRootProps>(
  function ToastRoot(
    {
      variant = "neutral",
      icon = <FeatherInfo />,
      title,
      description,
      actions,
      className,
      ...otherProps
    }: ToastRootProps,
    ref
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          "group/2c7966c2 flex w-80 items-center gap-4 rounded-md bg-default-background px-4 py-3 shadow-lg",
          className
        )}
        ref={ref as any}
        {...otherProps}
      >
        {icon ? (
          <SubframeCore.IconWrapper
            className={SubframeUtils.twClassNames(
              "text-heading-3 font-heading-3 text-neutral-700",
              {
                "text-success-700": variant === "success",
                "text-error-700": variant === "error",
                "text-brand-600": variant === "brand",
              }
            )}
          >
            {icon}
          </SubframeCore.IconWrapper>
        ) : null}
        <div className="flex grow shrink-0 basis-0 flex-col items-start">
          {title ? (
            <span
              className={SubframeUtils.twClassNames(
                "w-full text-body-bold font-body-bold text-default-font",
                {
                  "text-success-700": variant === "success",
                  "text-error-700": variant === "error",
                  "text-brand-800": variant === "brand",
                }
              )}
            >
              {title}
            </span>
          ) : null}
          {description ? (
            <span className="w-full text-caption font-caption text-subtext-color">
              {description}
            </span>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center justify-end gap-1">{actions}</div>
        ) : null}
      </div>
    );
  }
);

export const Toast = ToastRoot;
