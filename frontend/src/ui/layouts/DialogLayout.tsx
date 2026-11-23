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
 * Dialog Layout — https://app.subframe.com/5b130da4e598/library?component=Dialog+Layout_ff4920a8-df26-4012-934d-0a9edbf5e373
 * Dialog — https://app.subframe.com/5b130da4e598/library?component=Dialog_ca59db17-43fb-4247-8094-3c55162e902d
 */

import React from "react";
import * as SubframeUtils from "../utils";
import { Dialog } from "../components/Dialog";

interface DialogLayoutRootProps extends React.ComponentProps<typeof Dialog> {
  children?: React.ReactNode;
  className?: string;
}

const DialogLayoutRoot = React.forwardRef<HTMLElement, DialogLayoutRootProps>(
  function DialogLayoutRoot(
    { children, className, ...otherProps }: DialogLayoutRootProps,
    ref
  ) {
    return (
      <Dialog className={className} ref={ref as any} {...otherProps}>
        <Dialog.Content>
          {children ? (
            <div className="flex w-full grow shrink-0 basis-0 items-start gap-6">
              {children}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog>
    );
  }
);

export const DialogLayout = DialogLayoutRoot;
