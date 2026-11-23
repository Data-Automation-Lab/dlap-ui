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
 * Skeleton Circle — https://app.subframe.com/5b130da4e598/library?component=Skeleton+Circle_8b6e7a84-358f-4dc5-9de8-792a18fa9955
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";

interface SkeletonCircleRootProps
  extends React.ComponentProps<typeof SubframeCore.Skeleton> {
  size?: "default" | "small" | "x-small";
  className?: string;
}

const SkeletonCircleRoot = React.forwardRef<
  HTMLElement,
  SkeletonCircleRootProps
>(function SkeletonCircleRoot(
  { size = "default", className, ...otherProps }: SkeletonCircleRootProps,
  ref
) {
  return (
    <SubframeCore.Skeleton
      className={SubframeUtils.twClassNames(
        "group/8b6e7a84 flex h-9 w-9 flex-col items-start gap-2 rounded-full bg-neutral-200",
        { "h-5 w-5": size === "x-small", "h-7 w-7": size === "small" },
        className
      )}
      ref={ref as any}
      {...otherProps}
    />
  );
});

export const SkeletonCircle = SkeletonCircleRoot;
