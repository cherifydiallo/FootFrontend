import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FeatureAction, Group, GroupPermissionRow } from './group.service';

export const FEATURE_ACTIONS: FeatureAction[] = [
  { key: 'group_permission_view', label: 'View Group Permissions', description: 'Can read group permission parameters' },
  { key: 'group_permission_manage', label: 'Manage Group Permissions', description: 'Can grant or revoke group permissions' },
  { key: 'group_create', label: 'Create Group', description: 'Create a new group' },
  { key: 'group_view', label: 'List Groups', description: 'List all groups' },
  { key: 'group_view_group', label: 'View Group Details', description: 'Read one group detail by id' },
  { key: 'group_update_group', label: 'Update Group', description: 'Update a group' },
  { key: 'group_delete_group', label: 'Delete Group', description: 'Delete a group' },
  { key: 'group_add_user', label: 'Add User To Group', description: 'Attach a user to a group' },
  { key: 'group_remove_user', label: 'Remove User From Group', description: 'Remove a user from a group' },
  { key: 'group_view_members', label: 'View Group Members', description: 'List members of a group' },
  { key: 'player_read', label: 'View Players', description: 'Read players' },
  { key: 'player_write', label: 'Create Player', description: 'Create players' },
  { key: 'player_edit', label: 'Edit Player', description: 'Update players' },
  { key: 'player_delete', label: 'Delete Player', description: 'Delete players' },
  { key: 'academy_read', label: 'View Academies', description: 'Read academies' },
  { key: 'academy_write', label: 'Create Academy', description: 'Create academies' },
  { key: 'academy_edit', label: 'Edit Academy', description: 'Update academies' },
  { key: 'academy_delete', label: 'Delete Academy', description: 'Delete academies' },
  { key: 'profile_view', label: 'View Profile', description: 'Read own profile' },
  { key: 'user_read', label: 'View Users', description: 'Read users' },
  { key: 'user_write', label: 'Create User', description: 'Create users' },
  { key: 'user_edit', label: 'Edit User', description: 'Update users' },
  { key: 'user_delete', label: 'Delete User', description: 'Delete users' }
];

const PERMISSIONS_STORAGE_KEY = 'groupPermissionMatrix';

@Injectable({
  providedIn: 'root'
})
export class FeatureAccessService {
  private platformId = inject(PLATFORM_ID);

  getFeatureActions(): FeatureAction[] {
    return FEATURE_ACTIONS;
  }

  savePermissionsToStorage(rows: GroupPermissionRow[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(rows));
  }

  loadPermissionsFromStorage(): GroupPermissionRow[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    try {
      const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  hasAccess(user: any, actionKey: string): boolean {
    if (this.isAdmin(user)) {
      return true;
    }

    // Use permissions array from the user profile (returned by /profile/me)
    if (Array.isArray(user?.permissions) && user.permissions.length > 0) {
      return user.permissions.includes(actionKey);
    }

    const allowedActions = this.resolveAllowedActions(user);
    return allowedActions.has(actionKey);
  }

  resolveAllowedActions(user: any): Set<string> {
    if (this.isAdmin(user)) {
      return new Set(FEATURE_ACTIONS.map((a) => a.key));
    }

    // Use permissions array from the user profile (returned by /profile/me)
    if (Array.isArray(user?.permissions) && user.permissions.length > 0) {
      return new Set<string>(user.permissions);
    }

    const groupIds = this.extractGroupIds(user);
    const storedRows = this.loadPermissionsFromStorage();
    const allowed = new Set<string>();

    for (const row of storedRows) {
      if (groupIds.has(row.groupId)) {
        for (const action of row.actions || []) {
          allowed.add(action);
        }
      }
    }

    return allowed;
  }

  toPermissionRows(groups: Group[], permissionMap: Record<number, Record<string, boolean>>): GroupPermissionRow[] {
    return groups.map((group) => {
      const row = permissionMap[group.id] || {};
      const actions = Object.keys(row).filter((action) => !!row[action]);
      return {
        groupId: group.id,
        actions
      };
    });
  }

  toPermissionMap(groups: Group[], rows: GroupPermissionRow[]): Record<number, Record<string, boolean>> {
    const map: Record<number, Record<string, boolean>> = {};

    for (const group of groups) {
      map[group.id] = {};
      for (const action of FEATURE_ACTIONS) {
        map[group.id][action.key] = false;
      }
    }

    for (const row of rows) {
      if (!map[row.groupId]) {
        continue;
      }
      for (const action of row.actions || []) {
        if (Object.prototype.hasOwnProperty.call(map[row.groupId], action)) {
          map[row.groupId][action] = true;
        }
      }
    }

    return map;
  }

  private isAdmin(user: any): boolean {
    return !!user && typeof user.role === 'string' && user.role.toUpperCase() === 'ADMIN';
  }

  private extractGroupIds(user: any): Set<number> {
    const ids = new Set<number>();

    if (!user) {
      return ids;
    }

    const directGroupId = Number(user.groupId);
    if (!Number.isNaN(directGroupId) && directGroupId > 0) {
      ids.add(directGroupId);
    }

    if (Array.isArray(user.groupIds)) {
      for (const groupId of user.groupIds) {
        const id = Number(groupId);
        if (!Number.isNaN(id) && id > 0) {
          ids.add(id);
        }
      }
    }

    if (Array.isArray(user.groups)) {
      for (const group of user.groups) {
        const id = Number(group?.id);
        if (!Number.isNaN(id) && id > 0) {
          ids.add(id);
        }
      }
    }

    return ids;
  }
}
