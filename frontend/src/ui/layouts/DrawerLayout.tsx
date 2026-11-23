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
 * Drawer Layout — https://app.subframe.com/5b130da4e598/library?component=Drawer+Layout_2f6803ed-5ed0-4934-b093-a1a46df2d1d1
 * Drawer — https://app.subframe.com/5b130da4e598/library?component=Drawer_1e71b2cb-8d72-4e67-b368-8805179e9444
 */

import React from "react";
import * as SubframeUtils from "../utils";
import { Drawer } from "../components/Drawer";

interface DrawerLayoutRootProps extends React.ComponentProps<typeof Drawer> {
  children?: React.ReactNode;
  className?: string;
}

const DrawerLayoutRoot = React.forwardRef<HTMLElement, DrawerLayoutRootProps>(
  function DrawerLayoutRoot(
    { children, className, ...otherProps }: DrawerLayoutRootProps,
    ref
  ) {
    return (
      <Drawer className={className} ref={ref as any} {...otherProps}>
        <Drawer.Content>
          {children ? (
            <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-8">
              {children}
            </div>
          ) : null}
        </Drawer.Content>
      </Drawer>
    );
  }
);

export const DrawerLayout = DrawerLayoutRoot;
