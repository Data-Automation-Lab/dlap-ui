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
 * Skeleton Text — https://app.subframe.com/5b130da4e598/library?component=Skeleton+Text_a9aae3f0-955e-4607-a272-374f1dc18f4b
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";

interface SkeletonTextRootProps
  extends React.ComponentProps<typeof SubframeCore.Skeleton> {
  size?: "default" | "label" | "subheader" | "section-header" | "header";
  className?: string;
}

const SkeletonTextRoot = React.forwardRef<HTMLElement, SkeletonTextRootProps>(
  function SkeletonTextRoot(
    { size = "default", className, ...otherProps }: SkeletonTextRootProps,
    ref
  ) {
    return (
      <SubframeCore.Skeleton
        className={SubframeUtils.twClassNames(
          "group/a9aae3f0 flex h-5 w-full flex-col items-start gap-2 rounded-md bg-neutral-200",
          {
            "h-10 w-full": size === "header",
            "h-9 w-full": size === "section-header",
            "h-7 w-full": size === "subheader",
            "h-4 w-full": size === "label",
          },
          className
        )}
        ref={ref as any}
        {...otherProps}
      />
    );
  }
);

export const SkeletonText = SkeletonTextRoot;
