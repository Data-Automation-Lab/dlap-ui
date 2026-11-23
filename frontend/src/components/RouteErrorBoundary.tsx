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

import { FeatherAlertTriangle, FeatherHome, FeatherRefreshCw } from "@subframe/core";
import React from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";

/**
 * Props for the class boundary. `resetKey` clears a caught error when it
 * changes, so navigating to another route leaves the failed page behind.
 */
interface BoundaryProps {
  resetKey?: string;
  children?: React.ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Catches render-time exceptions thrown by one routed page so a bad API shape
 * blanks that page only, never the whole application (no white screen).
 *
 * React only supports error boundaries as classes. Use {@link RouteErrorBoundary}
 * (the default export), which supplies `resetKey` from the router location.
 */
export class RouteErrorBoundaryInner extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  /** Records the thrown value so the next render shows the fallback. */
  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  /** Logs the failure with its component stack. Never logs props or user data. */
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("Route render failed:", error.message, info.componentStack);
  }

  componentDidUpdate(prev: BoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  private goHome = (): void => {
    this.setState({ error: null });
    window.navigateToHome?.();
  };

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <div
        role="alert"
        className="flex h-full min-h-screen w-full flex-col items-center justify-center gap-4 bg-default-background px-6 py-12 text-center"
      >
        <IconWithBackground variant="error" size="large" icon={<FeatherAlertTriangle />} />
        <span className="text-heading-2 font-heading-2 text-default-font">
          This page ran into a problem
        </span>
        <span className="max-w-[448px] text-body font-body text-subtext-color">
          The rest of the application is still working. Try again, or go back to your home page. If
          the problem continues, the data this page received may not match what it expects.
        </span>
        <div className="flex items-center gap-2">
          <Button variant="neutral-secondary" icon={<FeatherRefreshCw />} onClick={this.reset}>
            Try again
          </Button>
          <Button variant="neutral-tertiary" icon={<FeatherHome />} onClick={this.goHome}>
            Go to home
          </Button>
        </div>
      </div>
    );
  }
}

/**
 * Error boundary for one protected route. Must render inside a Router. The
 * boundary resets whenever the location changes.
 */
export function RouteErrorBoundary({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  return <RouteErrorBoundaryInner resetKey={location.pathname}>{children}</RouteErrorBoundaryInner>;
}

export default RouteErrorBoundary;
