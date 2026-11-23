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

import { FeatherEye, FeatherEyeOff } from "@subframe/core";
import React, { useState } from "react";
import keycloak from "../keycloak"; // Import the Keycloak instance
import { Button } from "../ui/components/Button";
import { LinkButton } from "../ui/components/LinkButton";
import { OAuthSocialButton } from "../ui/components/OAuthSocialButton";
import { TextField } from "../ui/components/TextField";

function AuthEntryPoint() {
  // State management for form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form validation
  const isFormValid = email.trim() !== "" && password.trim() !== "";

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Initiate login with Keycloak
      // The redirectUri should be configured in your Keycloak client settings
      await keycloak.login({ redirectUri: window.location.origin + '/' }); 
      // If login is successful, Keycloak will redirect. 
      // If there's an error before redirect (e.g. misconfiguration), it might throw here.
      // However, most common errors (bad credentials) are handled by Keycloak's pages.
    } catch (err) {
      setError("Login initialization failed. Please try again or contact support.");
      console.error("Keycloak login error:", err);
      setLoading(false); // Only set loading false if login init itself failed
    }
    // setLoading(false) is typically not reached if redirect happens.
  };
      
  // OAuth login handlers
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      console.log("Attempting Keycloak login with Google IdP");
      await keycloak.login({ idpHint: 'google', redirectUri: window.location.origin + '/' });
    } catch (err) {
      setError("Google login initialization failed. Please try again or contact support.");
      console.error("Keycloak Google login error:", err);
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    setError("");
    try {
      console.log("Attempting Keycloak login with Facebook IdP");
      await keycloak.login({ idpHint: 'facebook', redirectUri: window.location.origin + '/' });
    } catch (err) {
      setError("Facebook login initialization failed. Please try again or contact support.");
      console.error("Keycloak Facebook login error:", err);
      setLoading(false);
    }
  };

  // Navigation handlers
  const handleForgotPassword = () => {
    setLoading(true);
    setError("");
    try {
      console.log("Redirecting to Keycloak password reset");
      // Construct the Keycloak account management URL for password reset
      // This is a more direct way than keycloak.login({ action: ... }) for some flows
      const passwordResetUrl = `${keycloak.authServerUrl}/realms/${keycloak.realm}/login-actions/reset-credentials?client_id=${keycloak.clientId}&redirect_uri=${encodeURIComponent(window.location.origin + '/')}`;
      window.location.href = passwordResetUrl;
    } catch (err) {
      setError("Failed to initiate password reset. Please try again or contact support.");
      console.error("Keycloak password reset error:", err);
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    console.log("Sign up clicked");
    // Navigate to sign up page
    window.navigateToSignUp?.();
  };

  const handleContactSupport = () => {
    console.log("Contact support clicked");
    // Open contact support page or modal - to be implemented
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="flex h-full w-full flex-wrap items-start bg-default-background mobile:flex-col mobile:flex-wrap mobile:gap-0">
      <div className="flex max-w-[576px] grow shrink-0 basis-0 flex-col items-center gap-12 self-stretch bg-neutral-950 px-12 py-12 mobile:h-auto mobile:w-full mobile:flex-none">
        <div className="flex w-full max-w-[448px] grow shrink-0 basis-0 flex-col items-start justify-center gap-12 mobile:h-auto mobile:w-full mobile:max-w-[448px]">
          <div className="flex w-full items-center justify-center">
            <img
              className="h-9 w-9 flex-none rounded-md object-cover"
              src="https://res.cloudinary.com/subframe/image/upload/v1747952082/uploads/13082/hyvutu5fi9i500lxovur.jpg"
              alt="Data Automation Lab Logo"
            />
          </div>
          <div className="flex flex-col items-start justify-center gap-16 pb-32 mobile:px-0 mobile:py-0">
            <div className="flex flex-col items-start gap-2">
              <span className="text-heading-2 font-heading-2 text-white">
                Welcome to Data Automation Lab
              </span>
              <span className="text-heading-3 font-heading-3 text-brand-200">
                Streamline your data workflows with intelligent automation.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-8">
              <img
                className="w-6 flex-none grayscale"
                src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
                alt="Partner logo 1"
              />
              <img
                className="w-6 flex-none grayscale"
                src="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
                alt="Partner logo 2"
              />
              <img
                className="w-6 flex-none grayscale"
                src="https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
                alt="Partner logo 3"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex grow shrink-0 basis-0 flex-col items-center justify-center gap-6 self-stretch border-l border-solid border-neutral-border px-12 py-12">
        <div className="flex w-full max-w-[448px] flex-col items-start justify-center gap-8">
          <div className="flex w-full flex-col items-start gap-1">
            <span className="w-full text-heading-2 font-heading-2 text-default-font">
              Login
            </span>
            <span className="text-body font-body text-subtext-color">
              Welcome back! Please enter your details
            </span>
          </div>
          {error && (
            <div className="w-full rounded bg-red-100 p-2 text-red-600">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex w-full flex-col items-start justify-center gap-4">
            <TextField
              className="h-auto w-full flex-none"
              label="Email"
              helpText=""
            >
              <TextField.Input
                placeholder="Enter your email"
                type="email"
                value={email}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                required
              />
            </TextField>
            <TextField
              className="h-auto w-full flex-none"
              label="Password"
              helpText=""
              iconRight={
                showPassword ? (
                  <div onClick={togglePasswordVisibility} className="cursor-pointer">
                    <FeatherEyeOff />
                  </div>
                ) : (
                  <div onClick={togglePasswordVisibility} className="cursor-pointer">
                    <FeatherEye />
                  </div>
                )
              }
            >
              <TextField.Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                required
              />
            </TextField>
            <div className="flex w-full items-center justify-between">
              <LinkButton
                size="small"
                onClick={handleForgotPassword}
              >
                Forgot password?
              </LinkButton>
            </div>
          </form>
          <div className="flex w-full flex-col items-start justify-center gap-4">
            <Button
              className="h-10 w-full flex-none"
              size="large"
              type="submit"
              disabled={!isFormValid || loading}
              loading={loading}
              onClick={handleSubmit}
            >
              Sign in
            </Button>
            <OAuthSocialButton
              className="h-10 w-full flex-none"
              logo="https://res.cloudinary.com/subframe/image/upload/v1711417516/shared/z0i3zyjjqkobzuaecgno.svg"
              onClick={handleGoogleLogin}
            >
              Continue with Google
            </OAuthSocialButton>
            <OAuthSocialButton
              className="h-10 w-full flex-none"
              logo="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
              onClick={handleFacebookLogin}
            >
              Continue with Facebook
            </OAuthSocialButton>
          </div>
          <div className="flex w-full flex-col items-center justify-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-body text-subtext-color">
                Don&#39;t have an account?
              </span>
              <LinkButton
                variant="brand"
                onClick={handleSignUp}
              >
                Sign up
              </LinkButton>
            </div>
            <LinkButton
              onClick={handleContactSupport}
            >
              Need help? Contact Support
            </LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthEntryPoint; 