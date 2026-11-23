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
 * Breadcrumbs — https://app.subframe.com/5b130da4e598/library?component=Breadcrumbs_8898334b-a66f-4ee8-8bd1-afcfa8e37cc0
 */

import React from "react";
import * as SubframeUtils from "../utils";
import { FeatherChevronRight } from "@subframe/core";

interface ItemProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  active?: boolean;
  className?: string;
}

const Item = React.forwardRef<HTMLElement, ItemProps>(function Item(
  { children, active = false, className, ...otherProps }: ItemProps,
  ref
) {
  return children ? (
    <span
      className={SubframeUtils.twClassNames(
        "group/bbdc1640 line-clamp-1 cursor-pointer break-words text-body font-body text-subtext-color hover:text-default-font",
        { "text-default-font": active },
        className
      )}
      ref={ref as any}
      {...otherProps}
    >
      {children}
    </span>
  ) : null;
});

interface DividerProps
  extends React.ComponentProps<typeof FeatherChevronRight> {
  className?: string;
}

const Divider = React.forwardRef<HTMLElement, DividerProps>(function Divider(
  { className, ...otherProps }: DividerProps,
  ref
) {
  return (
    <FeatherChevronRight
      className={SubframeUtils.twClassNames(
        "text-body font-body text-subtext-color",
        className
      )}
      ref={ref as any}
      {...otherProps}
    />
  );
});

interface BreadcrumbsRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const BreadcrumbsRoot = React.forwardRef<HTMLElement, BreadcrumbsRootProps>(
  function BreadcrumbsRoot(
    { children, className, ...otherProps }: BreadcrumbsRootProps,
    ref
  ) {
    return children ? (
      <div
        className={SubframeUtils.twClassNames(
          "flex items-center gap-2",
          className
        )}
        ref={ref as any}
        {...otherProps}
      >
        {children}
      </div>
    ) : null;
  }
);

export const Breadcrumbs = Object.assign(BreadcrumbsRoot, {
  Item,
  Divider,
});
