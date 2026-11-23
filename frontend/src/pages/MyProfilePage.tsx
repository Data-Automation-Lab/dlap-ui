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

import React, { ChangeEvent, useEffect, useState } from 'react';
import { ErrorState } from '../components/EmptyState';
import { Avatar } from '../ui/components/Avatar';
import { Badge } from '../ui/components/Badge';
import { Button } from '../ui/components/Button';
import { Switch } from '../ui/components/Switch';
import { TextField } from '../ui/components/TextField';
import { DefaultPageLayout } from '../ui/layouts/DefaultPageLayout';
import { adminApi, reportingApi } from '../utils/api';
import { useCurrentUser } from '../utils/currentUser';

/**
 * My Profile derives identity from the Keycloak token (useCurrentUser) and
 * hydrates the full account record from the real da-admin
 * GET /api/v1/admin/users/username/{username} (UserDTO). Editable account
 * fields and password changes go through da-admin PUT /users/{id}; that
 * controller is ADMIN-only, so those controls are enabled only when the signed
 * in user holds the ADMIN realm role and are otherwise shown read-only with an
 * explanation (never a dead/no-op button).
 *
 * The former profile-photo upload/remove was pure client-side simulation (no
 * backend endpoint exists to store an avatar) and has been removed. Notification
 * preferences are wired to the real da-reporting notification-preference API
 * (POST /preferences, GET /preferences/my) keyed by notificationTypeKey +
 * channel; only the EMAIL and SLACK channels exist server-side.
 */

interface IUserDTO {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  roles: string[];
}

// notificationTypeKey values persisted server-side (free-form strings on the
// NotificationPreferenceDTO). Channel is EMAIL for these two prefs.
const PREF_POLICY_ALERTS = 'POLICY_ALERTS';
const PREF_DATASET_UPDATES = 'DATASET_UPDATES';

interface NotificationPreference {
  id?: string;
  notificationTypeKey: string;
  channel: string;
  enabled: boolean;
}

const MyProfilePage: React.FC = () => {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser.roles.includes('ADMIN');

  const [profile, setProfile] = useState<IUserDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Account detail editing (firstName / lastName / email — the fields UserDTO
  // actually persists). jobTitle/department/phoneNumber were dropped: no backend
  // field backs them.
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editableDetails, setEditableDetails] = useState({ firstName: '', lastName: '', email: '' });
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Password change (new password only — the admin update endpoint resets it;
  // there is no current-password verification endpoint on the backend).
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notification preferences (real da-reporting API).
  const [emailPolicyAlerts, setEmailPolicyAlerts] = useState(false);
  const [emailDatasetUpdates, setEmailDatasetUpdates] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [existingPrefs, setExistingPrefs] = useState<NotificationPreference[]>([]);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!currentUser.username) return;
    setLoading(true);
    setLoadError(false);
    try {
      const response = await adminApi.get(`/users/username/${encodeURIComponent(currentUser.username)}`);
      const u = response.data ?? {};
      const mapped: IUserDTO = {
        id: u.id ?? '',
        username: u.username ?? currentUser.username,
        email: u.email ?? currentUser.email,
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        enabled: u.enabled === true,
        roles: Array.isArray(u.roles) ? u.roles : currentUser.roles,
      };
      setProfile(mapped);
      setEditableDetails({
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        email: mapped.email,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await reportingApi.get('/notifications/preferences/my');
      const rows: NotificationPreference[] = Array.isArray(response.data) ? response.data : [];
      const prefs: NotificationPreference[] = rows.map((r) => ({
        id: r.id,
        notificationTypeKey: r.notificationTypeKey,
        channel: r.channel,
        enabled: r.enabled === true,
      }));
      setExistingPrefs(prefs);
      const policy = prefs.find((p) => p.notificationTypeKey === PREF_POLICY_ALERTS && p.channel === 'EMAIL');
      const dataset = prefs.find((p) => p.notificationTypeKey === PREF_DATASET_UPDATES && p.channel === 'EMAIL');
      setEmailPolicyAlerts(policy?.enabled ?? false);
      setEmailDatasetUpdates(dataset?.enabled ?? false);
      setPrefsLoaded(true);
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      setPrefsError('Unable to load notification preferences.');
    }
  };

  useEffect(() => {
    loadProfile();
    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.username]);

  const handleDetailChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setEditableDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditDetailsToggle = () => {
    if (isEditingDetails && profile) {
      setEditableDetails({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
      });
    }
    setDetailsError(null);
    setIsEditingDetails(!isEditingDetails);
  };

  const handleSaveChanges = async () => {
    if (!profile) return;
    setDetailsError(null);
    setIsSavingDetails(true);
    try {
      await adminApi.put(`/users/${profile.id}`, {
        id: profile.id,
        username: profile.username,
        email: editableDetails.email,
        firstName: editableDetails.firstName,
        lastName: editableDetails.lastName,
        enabled: profile.enabled,
        roles: profile.roles,
      });
      setProfile({ ...profile, ...editableDetails });
      setIsEditingDetails(false);
    } catch (error) {
      console.error('Failed to save profile details:', error);
      setDetailsError('Failed to update details. Please try again.');
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleChangePassword = async () => {
    if (!profile) return;
    setPasswordMessage(null);
    setPasswordError(null);
    if (!newPassword || newPassword !== confirmNewPassword) {
      setPasswordError('New passwords must match and cannot be empty.');
      return;
    }
    setIsChangingPassword(true);
    try {
      await adminApi.put(`/users/${profile.id}`, {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        enabled: profile.enabled,
        roles: profile.roles,
        password: newPassword,
      });
      setPasswordMessage('Password updated successfully.');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Failed to change password:', error);
      setPasswordError('Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const savePreference = async (notificationTypeKey: string, enabled: boolean) => {
    if (!currentUser.id) return;
    const existing = existingPrefs.find(
      (p) => p.notificationTypeKey === notificationTypeKey && p.channel === 'EMAIL'
    );
    const payload = {
      id: existing?.id,
      userId: currentUser.id,
      notificationTypeKey,
      channel: 'EMAIL',
      enabled,
    };
    await reportingApi.post('/notifications/preferences', payload);
  };

  const handleSavePreferences = async () => {
    setPrefsMessage(null);
    setPrefsError(null);
    setIsSavingPreferences(true);
    try {
      await savePreference(PREF_POLICY_ALERTS, emailPolicyAlerts);
      await savePreference(PREF_DATASET_UPDATES, emailDatasetUpdates);
      await loadPreferences();
      setPrefsMessage('Notification preferences saved.');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      setPrefsError('Failed to save notification preferences. Please try again.');
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
    currentUser.name ||
    currentUser.username;
  const avatarInitial = (displayName || 'U').charAt(0).toUpperCase();

  return (
    <DefaultPageLayout>
      <div className="p-6 flex flex-col gap-6">
        <h1 className="text-heading-1 font-heading-1">My Profile</h1>

        {loadError && (
          <ErrorState
            message="Unable to load your account details from the admin service."
            onRetry={loadProfile}
          />
        )}

        {/* Account Details Section */}
        <div className="p-4 border border-neutral-border rounded-md">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <Avatar size="large">{avatarInitial}</Avatar>
              <h2 className="text-heading-2 font-heading-2 text-default-font">Account Details</h2>
            </div>
            {isAdmin && !isEditingDetails ? (
              <Button
                variant="neutral-secondary"
                onClick={handleEditDetailsToggle}
                disabled={loading || !profile}
                icon={undefined}
                iconRight={undefined}
              >
                Edit Details
              </Button>
            ) : null}
          </div>

          {!isAdmin && (
            <p className="text-caption font-caption text-subtext-color mb-4">
              Account details are managed by an administrator. Contact your admin to change your name or email.
            </p>
          )}

          {detailsError && (
            <div className="mb-4">
              <ErrorState message={detailsError} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isEditingDetails ? (
              <>
                <TextField label="First Name" className="w-full">
                  <TextField.Input
                    name="firstName"
                    value={editableDetails.firstName}
                    onChange={handleDetailChange}
                    disabled={isSavingDetails}
                  />
                </TextField>
                <TextField label="Last Name" className="w-full">
                  <TextField.Input
                    name="lastName"
                    value={editableDetails.lastName}
                    onChange={handleDetailChange}
                    disabled={isSavingDetails}
                  />
                </TextField>
                <TextField label="Email Address" className="w-full">
                  <TextField.Input
                    name="email"
                    type="email"
                    value={editableDetails.email}
                    onChange={handleDetailChange}
                    disabled={isSavingDetails}
                  />
                </TextField>
              </>
            ) : (
              <>
                <div>
                  <label className="text-caption-bold font-caption-bold text-subtext-color">Full Name</label>
                  <p className="text-body font-body text-default-font py-1">{displayName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-caption-bold font-caption-bold text-subtext-color">Email Address</label>
                  <p className="text-body font-body text-default-font py-1">{profile?.email || currentUser.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-caption-bold font-caption-bold text-subtext-color">Username</label>
                  <p className="text-body font-body text-default-font py-1">{profile?.username || currentUser.username || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-caption-bold font-caption-bold text-subtext-color">Roles</label>
                  <div className="flex flex-wrap gap-1 py-1">
                    {(profile?.roles ?? currentUser.roles).length === 0 ? (
                      <span className="text-body font-body text-default-font">N/A</span>
                    ) : (
                      (profile?.roles ?? currentUser.roles).map((r) => (
                        <Badge key={r} variant="neutral">{r}</Badge>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {isEditingDetails && (
            <div className="flex gap-2 mt-6 justify-end">
              <Button
                variant="neutral-secondary"
                onClick={handleEditDetailsToggle}
                disabled={isSavingDetails}
                icon={undefined}
                iconRight={undefined}
              >
                Cancel
              </Button>
              <Button
                variant="brand-primary"
                onClick={handleSaveChanges}
                loading={isSavingDetails}
                disabled={isSavingDetails}
                icon={undefined}
                iconRight={undefined}
              >
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* Change Password Section — admin-only (backend endpoint requires ADMIN) */}
        <div className="p-4 border border-neutral-border rounded-md">
          <h2 className="text-heading-2 font-heading-2 mb-4 text-default-font">Change Password</h2>
          {!isAdmin ? (
            <p className="text-body font-body text-subtext-color">
              Password changes require administrator privileges on the admin service. Contact your
              administrator to reset your password.
            </p>
          ) : (
            <div className="flex flex-col gap-4 max-w-md">
              {passwordMessage && (
                <span className="text-body font-body text-success-700">{passwordMessage}</span>
              )}
              {passwordError && <ErrorState message={passwordError} />}
              <TextField label="New Password">
                <TextField.Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                />
              </TextField>
              <TextField label="Confirm New Password">
                <TextField.Input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                />
              </TextField>
              <Button
                variant="brand-primary"
                onClick={handleChangePassword}
                loading={isChangingPassword}
                disabled={isChangingPassword || !newPassword || !confirmNewPassword || !profile}
                className="mt-2"
                icon={undefined}
                iconRight={undefined}
              >
                Change Password
              </Button>
            </div>
          )}
        </div>

        {/* Notification Preferences Section — real da-reporting API */}
        <div className="p-4 border border-neutral-border rounded-md">
          <h2 className="text-heading-2 font-heading-2 mb-4 text-default-font">Notification Preferences</h2>
          {prefsError && (
            <div className="mb-4">
              <ErrorState message={prefsError} onRetry={loadPreferences} />
            </div>
          )}
          {prefsMessage && (
            <span className="text-body font-body text-success-700 mb-4 block">{prefsMessage}</span>
          )}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-2 rounded hover:bg-neutral-50">
              <label htmlFor="emailPolicyAlertsSwitch" className="text-body font-body text-default-font cursor-pointer">
                Email notifications for new policy alerts
              </label>
              <Switch
                id="emailPolicyAlertsSwitch"
                checked={emailPolicyAlerts}
                onCheckedChange={setEmailPolicyAlerts}
                disabled={isSavingPreferences || !prefsLoaded}
              />
            </div>
            <div className="flex items-center justify-between p-2 rounded hover:bg-neutral-50">
              <label htmlFor="emailDatasetUpdatesSwitch" className="text-body font-body text-default-font cursor-pointer">
                Email notifications for dataset updates
              </label>
              <Switch
                id="emailDatasetUpdatesSwitch"
                checked={emailDatasetUpdates}
                onCheckedChange={setEmailDatasetUpdates}
                disabled={isSavingPreferences || !prefsLoaded}
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button
              variant="brand-primary"
              onClick={handleSavePreferences}
              loading={isSavingPreferences}
              disabled={isSavingPreferences || !prefsLoaded || !currentUser.id}
              icon={undefined}
              iconRight={undefined}
            >
              Save Preferences
            </Button>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
};

export default MyProfilePage;
