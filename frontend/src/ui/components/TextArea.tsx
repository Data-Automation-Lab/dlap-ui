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
 * Text Area — https://app.subframe.com/5b130da4e598/library?component=Text+Area_4ec05ee8-8f1c-46b2-b863-5419aa7f5cce
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";

interface InputProps
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "placeholder"
  > {
  placeholder?: React.ReactNode;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

const Input = React.forwardRef<HTMLElement, InputProps>(function Input(
  { placeholder, className, ...otherProps }: InputProps,
  ref
) {
  return (
    <textarea
      className={SubframeUtils.twClassNames(
        "min-h-[96px] w-full border-none bg-transparent px-2 py-1.5 text-body font-body text-default-font outline-none placeholder:text-neutral-400",
        className
      )}
      placeholder={placeholder as string}
      ref={ref as any}
      {...otherProps}
    />
  );
});

interface TextAreaRootProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  error?: boolean;
  variant?: "outline" | "filled";
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const TextAreaRoot = React.forwardRef<HTMLElement, TextAreaRootProps>(
  function TextAreaRoot(
    {
      error = false,
      variant = "outline",
      label,
      helpText,
      children,
      className,
      ...otherProps
    }: TextAreaRootProps,
    ref
  ) {
    return (
      <label
        className={SubframeUtils.twClassNames(
          "group/4ec05ee8 flex flex-col items-start gap-1",
          className
        )}
        ref={ref as any}
        {...otherProps}
      >
        {label ? (
          <span className="text-caption-bold font-caption-bold text-default-font">
            {label}
          </span>
        ) : null}
        {children ? (
          <div
            className={SubframeUtils.twClassNames(
              "flex w-full grow shrink-0 basis-0 flex-col items-start rounded-md border border-solid border-neutral-border bg-default-background pl-1 group-focus-within/4ec05ee8:border group-focus-within/4ec05ee8:border-solid group-focus-within/4ec05ee8:border-brand-primary",
              {
                "border border-solid border-neutral-100 bg-neutral-100 group-hover/4ec05ee8:border group-hover/4ec05ee8:border-solid group-hover/4ec05ee8:border-neutral-border group-focus-within/4ec05ee8:bg-default-background":
                  variant === "filled",
                "border border-solid border-error-600": error,
              }
            )}
          >
            {children}
          </div>
        ) : null}
        {helpText ? (
          <span
            className={SubframeUtils.twClassNames(
              "text-caption font-caption text-subtext-color",
              { "text-error-700": error }
            )}
          >
            {helpText}
          </span>
        ) : null}
      </label>
    );
  }
);

export const TextArea = Object.assign(TextAreaRoot, {
  Input,
});
