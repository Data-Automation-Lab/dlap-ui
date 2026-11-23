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

import {
    FeatherEdit2,
    FeatherRefreshCw,
    FeatherSearch,
    FeatherTrash,
    FeatherUser,
    FeatherUserCheck,
    FeatherUserPlus,
    FeatherUsers,
    FeatherUserX
} from "@subframe/core";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { Dialog } from "../ui/components/Dialog";
import { IconButton } from "../ui/components/IconButton";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Select } from "../ui/components/Select";
import { Table } from "../ui/components/Table";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { adminApi } from "../utils/api";
import { confirmAction } from "../utils/confirm";

/**
 * User Management is wired to the real da-admin UserController
 * (/api/v1/admin/users) and RoleController (/api/v1/admin/roles), all backed by
 * Keycloak:
 *   GET    /users                -> List<UserDTO>
 *   POST   /users                -> UserDTO (create)
 *   PUT    /users/{id}           -> UserDTO (update; also carries enabled flag)
 *   DELETE /users/{id}           -> 204
 *   GET    /roles                -> List<RoleDTO>  (available realm roles)
 *   POST   /users/{id}/roles     -> 204 (replace realm roles, body: string[])
 * UserDTO = { id, username, email, firstName, lastName, password, enabled,
 * roles: string[] }. There is NO stats endpoint and no dedicated
 * reset-password endpoint, so summary counts are derived honestly from the
 * fetched list and the reset-password action was removed.
 */
interface IUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  roles: string[];
}

interface IRole {
  id: string;
  name: string;
  description?: string;
}

interface ICreateUserForm {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  temporaryPassword: string;
}

interface IEditUserForm {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  enabled: boolean;
}

function UserManagement() {
  const [users, setUsers] = useState<IUser[]>([]);
  const [roles, setRoles] = useState<IRole[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showEditDialog, setShowEditDialog] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<ICreateUserForm>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: '',
    temporaryPassword: ''
  });
  const [editForm, setEditForm] = useState<IEditUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    enabled: true
  });
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const mapUser = (u: Partial<IUser>): IUser => ({
    id: u.id ?? '',
    username: u.username ?? '',
    email: u.email ?? '',
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    enabled: u.enabled === true,
    roles: Array.isArray(u.roles) ? u.roles : [],
  });

  const fetchUsers = async (): Promise<IUser[]> => {
    const response = await adminApi.get('/users');
    const rows: Array<Partial<IUser>> = Array.isArray(response.data) ? response.data : [];
    return rows.map(mapUser);
  };

  const fetchRoles = async (): Promise<IRole[]> => {
    const response = await adminApi.get('/roles');
    const rows: Array<Partial<IRole>> = Array.isArray(response.data) ? response.data : [];
    return rows.map((r) => ({ id: r.id ?? r.name ?? '', name: r.name ?? '', description: r.description }));
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [usersData, rolesData] = await Promise.all([fetchUsers(), fetchRoles()]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error loading user management data:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load; loadData is recreated on every render and is also the Retry handler
  }, []);

  // Derived, honest summary counts from the real user list. UserDTO exposes no
  // pending/locked/login-failure state, so only totals we can back with data
  // are shown.
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.enabled).length;
  const disabledUsers = users.filter((u) => !u.enabled).length;

  const getStatusVariant = (enabled: boolean) => (enabled ? 'success' : 'neutral');

  const roleLabel = (roleName: string) => {
    const match = roles.find((r) => r.name === roleName);
    return match?.description || roleName;
  };

  const primaryRole = (user: IUser): string => (user.roles.length > 0 ? user.roles[0] : '');

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      user.firstName.toLowerCase().includes(term) ||
      user.lastName.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.username.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.enabled) ||
      (statusFilter === 'inactive' && !user.enabled);

    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);

    return matchesSearch && matchesStatus && matchesRole;
  });

  const handleCreateUser = async () => {
    if (!createForm.username || !createForm.email || !createForm.firstName || !createForm.lastName) {
      setActionError('Please fill in all required fields.');
      return;
    }
    setActionError(null);
    setIsCreating(true);
    try {
      await adminApi.post('/users', {
        username: createForm.username,
        email: createForm.email,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        password: createForm.temporaryPassword || undefined,
        enabled: true,
        roles: createForm.role ? [createForm.role] : [],
      });
      setShowCreateDialog(false);
      setCreateForm({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: '',
        temporaryPassword: ''
      });
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error creating user:', error);
      setActionError('Failed to create user. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = (user: IUser) => {
    setActionError(null);
    setSelectedUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: primaryRole(user),
      enabled: user.enabled,
    });
    setShowEditDialog(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setActionError(null);
    setIsUpdating(true);
    try {
      const newRoles = editForm.role ? [editForm.role] : selectedUser.roles;
      await adminApi.put(`/users/${selectedUser.id}`, {
        id: selectedUser.id,
        username: selectedUser.username,
        email: editForm.email,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        enabled: editForm.enabled,
        roles: newRoles,
      });
      // Realm-role assignment is a separate endpoint; apply it when the primary
      // role changed so the Keycloak realm roles stay in sync.
      if (editForm.role && editForm.role !== primaryRole(selectedUser)) {
        await adminApi.post(`/users/${selectedUser.id}/roles`, newRoles);
      }
      setShowEditDialog(false);
      setSelectedUser(null);
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error updating user:', error);
      setActionError('Failed to update user. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleUserStatus = async (user: IUser) => {
    setActionError(null);
    try {
      await adminApi.put(`/users/${user.id}`, {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: !user.enabled,
        roles: user.roles,
      });
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error toggling user status:', error);
      setActionError('Failed to update user status. Please try again.');
    }
  };

  const handleDeleteUser = async (user: IUser) => {
    if (!confirmAction(`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`)) {
      return;
    }
    setActionError(null);
    try {
      await adminApi.delete(`/users/${user.id}`);
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error deleting user:', error);
      setActionError('Failed to delete user. Please try again.');
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-body font-body text-subtext-color">Loading user management data...</span>
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        {/* Header */}
        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-12 py-4">
          <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
            User Management
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="neutral-tertiary"
              icon={<FeatherRefreshCw />}
              onClick={loadData}
            >
              Refresh
            </Button>
            <Button
              icon={<FeatherUserPlus />}
              onClick={() => { setActionError(null); setShowCreateDialog(true); }}
            >
              Create User
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-8 px-12 py-8">
          {loadError ? (
            <ErrorState
              message="Unable to load users from the admin service."
              onRetry={loadData}
            />
          ) : (
            <>
              {actionError && (
                <div className="w-full">
                  <ErrorState message={actionError} />
                </div>
              )}

              {/* User Statistics — derived from the real user list only */}
              <div className="grid grid-cols-3 gap-4 w-full">
                <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherUsers />} variant="brand" />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Total Users
                    </span>
                  </div>
                  <span className="text-heading-1 font-heading-1 text-default-font">
                    {totalUsers}
                  </span>
                </div>

                <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherUserCheck />} variant="success" />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Active Users
                    </span>
                  </div>
                  <span className="text-heading-1 font-heading-1 text-default-font">
                    {activeUsers}
                  </span>
                </div>

                <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherUserX />} variant="neutral" />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Disabled Users
                    </span>
                  </div>
                  <span className="text-heading-1 font-heading-1 text-default-font">
                    {disabledUsers}
                  </span>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex w-full items-center gap-4">
                <TextField
                  variant="filled"
                  label=""
                  helpText=""
                  icon={<FeatherSearch />}
                  className="w-80"
                >
                  <TextField.Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </TextField>

                <Select
                  className="w-48"
                  label=""
                  placeholder="Filter by status"
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <Select.Item value="all">All Status</Select.Item>
                  <Select.Item value="active">Active</Select.Item>
                  <Select.Item value="inactive">Disabled</Select.Item>
                </Select>

                <Select
                  className="w-48"
                  label=""
                  placeholder="Filter by role"
                  value={roleFilter}
                  onValueChange={setRoleFilter}
                >
                  <Select.Item value="all">All Roles</Select.Item>
                  {roles.map((r) => (
                    <Select.Item key={r.id || r.name} value={r.name}>
                      {r.description || r.name}
                    </Select.Item>
                  ))}
                </Select>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-body font-body text-subtext-color">
                    {filteredUsers.length} of {users.length} users
                  </span>
                </div>
              </div>

              {/* Users Table */}
              <div className="flex w-full flex-col items-start gap-4">
                {users.length === 0 ? (
                  <EmptyState
                    title="No users"
                    message="No user accounts were returned by the admin service."
                  />
                ) : (
                  <Table
                    header={
                      <Table.HeaderRow>
                        <Table.HeaderCell>User</Table.HeaderCell>
                        <Table.HeaderCell>Roles</Table.HeaderCell>
                        <Table.HeaderCell>Status</Table.HeaderCell>
                        <Table.HeaderCell>Actions</Table.HeaderCell>
                      </Table.HeaderRow>
                    }
                  >
                    {filteredUsers.map((user) => (
                      <Table.Row key={user.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              {`${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}` || (user.username[0] ?? 'U').toUpperCase()}
                            </Avatar>
                            <div className="flex flex-col items-start">
                              <span className="text-body-bold font-body-bold text-default-font">
                                {user.firstName} {user.lastName}
                              </span>
                              <span className="text-caption font-caption text-subtext-color">
                                {user.email}
                              </span>
                              <span className="text-caption font-caption text-subtext-color">
                                @{user.username}
                              </span>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-wrap items-center gap-1">
                            {user.roles.length === 0 ? (
                              <span className="text-caption font-caption text-subtext-color">No roles</span>
                            ) : (
                              user.roles.map((r) => (
                                <Badge key={r} variant="neutral">
                                  {roleLabel(r)}
                                </Badge>
                              ))
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge
                            variant={getStatusVariant(user.enabled)}
                            icon={user.enabled ? <FeatherUserCheck /> : <FeatherUser />}
                          >
                            {user.enabled ? 'active' : 'disabled'}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-1">
                            <IconButton
                              icon={<FeatherEdit2 />}
                              variant="neutral-tertiary"
                              size="small"
                              onClick={() => handleEditUser(user)}
                            />
                            <IconButton
                              icon={user.enabled ? <FeatherUserX /> : <FeatherUserCheck />}
                              variant={user.enabled ? 'destructive-tertiary' : 'brand-tertiary'}
                              size="small"
                              onClick={() => handleToggleUserStatus(user)}
                            />
                            <IconButton
                              icon={<FeatherTrash />}
                              variant="destructive-tertiary"
                              size="small"
                              onClick={() => handleDeleteUser(user)}
                            />
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table>
                )}
              </div>
            </>
          )}
        </div>

        {/* Create User Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <Dialog.Content className="max-w-2xl">
            <div className="flex flex-col gap-2 p-6">
              <h2 className="text-heading-2 font-heading-2 text-default-font">Create New User</h2>
              <p className="text-body font-body text-subtext-color">
                Add a new user account to Keycloak.
              </p>
            </div>

            <div className="flex flex-col gap-6 py-6">
              {actionError && <ErrorState message={actionError} />}
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Username"
                  helpText="Unique username for login"
                >
                  <TextField.Input
                    placeholder="john.doe"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  />
                </TextField>
                <TextField
                  label="Email Address"
                  helpText="User's email address"
                >
                  <TextField.Input
                    type="email"
                    placeholder="john.doe@company.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </TextField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField label="First Name">
                  <TextField.Input
                    placeholder="John"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  />
                </TextField>
                <TextField label="Last Name">
                  <TextField.Input
                    placeholder="Doe"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  />
                </TextField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Role"
                  placeholder="Select a role"
                  value={createForm.role}
                  onValueChange={(value) => setCreateForm({ ...createForm, role: value })}
                >
                  {roles.map((r) => (
                    <Select.Item key={r.id || r.name} value={r.name}>
                      {r.description || r.name}
                    </Select.Item>
                  ))}
                </Select>

                <TextField
                  label="Temporary Password"
                  helpText="User will be required to change this on first login"
                >
                  <TextField.Input
                    type="password"
                    placeholder="Enter temporary password"
                    value={createForm.temporaryPassword}
                    onChange={(e) => setCreateForm({ ...createForm, temporaryPassword: e.target.value })}
                  />
                </TextField>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-solid border-neutral-border px-6 py-4">
              <Button
                variant="neutral-tertiary"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="brand-primary"
                loading={isCreating}
                onClick={handleCreateUser}
                disabled={isCreating || !createForm.username || !createForm.email || !createForm.firstName || !createForm.lastName}
              >
                Create User
              </Button>
            </div>
          </Dialog.Content>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <Dialog.Content className="max-w-2xl">
            <div className="flex flex-col gap-2 p-6">
              <h2 className="text-heading-2 font-heading-2 text-default-font">Edit User</h2>
              <p className="text-body font-body text-subtext-color">
                Update user information and settings.
              </p>
            </div>

            <div className="flex flex-col gap-6 py-6">
              {actionError && <ErrorState message={actionError} />}
              <div className="grid grid-cols-2 gap-4">
                <TextField label="First Name">
                  <TextField.Input
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </TextField>
                <TextField label="Last Name">
                  <TextField.Input
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </TextField>
              </div>
              <TextField label="Email Address">
                <TextField.Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </TextField>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Role"
                  placeholder="Select a role"
                  value={editForm.role}
                  onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                >
                  {roles.map((r) => (
                    <Select.Item key={r.id || r.name} value={r.name}>
                      {r.description || r.name}
                    </Select.Item>
                  ))}
                </Select>

                <Select
                  label="Status"
                  value={editForm.enabled ? 'active' : 'inactive'}
                  onValueChange={(value) => setEditForm({ ...editForm, enabled: value === 'active' })}
                >
                  <Select.Item value="active">Active</Select.Item>
                  <Select.Item value="inactive">Disabled</Select.Item>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-solid border-neutral-border px-6 py-4">
              <Button
                variant="neutral-tertiary"
                onClick={() => setShowEditDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="brand-primary"
                loading={isUpdating}
                onClick={handleUpdateUser}
                disabled={isUpdating || !editForm.firstName || !editForm.lastName || !editForm.email}
              >
                Update User
              </Button>
            </div>
          </Dialog.Content>
        </Dialog>
      </div>
    </DefaultPageLayout>
  );
}

export default UserManagement;
