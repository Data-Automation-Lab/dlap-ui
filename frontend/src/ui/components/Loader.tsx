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
 * Loader — https://app.subframe.com/5b130da4e598/library?component=Loader_f2e570c8-e463-45c2-aae9-a960146bc5d5
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";

interface LoaderRootProps
  extends React.ComponentProps<typeof SubframeCore.Loader> {
  size?: "small" | "medium" | "large";
  className?: string;
}

const LoaderRoot = React.forwardRef<HTMLElement, LoaderRootProps>(
  function LoaderRoot(
    { size = "medium", className, ...otherProps }: LoaderRootProps,
    ref
  ) {
    return (
      <SubframeCore.Loader
        className={SubframeUtils.twClassNames(
          "group/f2e570c8 text-body font-body text-brand-600",
          {
            "text-heading-2 font-heading-2": size === "large",
            "text-caption font-caption": size === "small",
          },
          className
        )}
        ref={ref as any}
        {...otherProps}
      />
    );
  }
);

export const Loader = LoaderRoot;
