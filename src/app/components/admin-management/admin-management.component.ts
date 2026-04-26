import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GroupService, Group, CreateGroupDto, User, GroupPermissionRow, FeatureAction } from '../../services/group.service';
import { AuthService } from '../../services/auth.service';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FeatureAccessService, FEATURE_ACTIONS } from '../../services/feature-access.service';
import { NotificationService } from '../../services/notification.service';

interface GroupWithMembers extends Group {
  members?: User[];
}

interface PermissionActionGroup {
  key: string;
  label: string;
  actions: FeatureAction[];
}

@Component({
  selector: 'app-admin-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-management.component.html',
  styleUrl: './admin-management.component.scss'
})
export class AdminManagementComponent implements OnInit, OnDestroy {
  groups = signal<Group[]>([]);
  groupIdSearch = signal('');
  selectedGroupById = signal<Group | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  activeTab = signal<'groups' | 'group-members' | 'permissions'>('groups');
  selectedGroup = signal<GroupWithMembers | null>(null);
  showCreateGroupDialog = signal(false);
  showAddUserDialog = signal(false);
  showEditGroupDialog = signal(false);
  showDeleteGroupDialog = signal(false);
  pendingDeleteGroup = signal<Group | null>(null);
  showRemoveMemberDialog = signal(false);
  pendingRemoveGroup = signal<Group | null>(null);
  pendingRemoveMember = signal<User | null>(null);

  newGroupName = signal('');
  newGroupDescription = signal('');
  editingGroupName = signal('');
  editingGroupDescription = signal('');
  editingGroupId = signal<number | null>(null);

  groupMembers = signal<User[]>([]);
  loadingMembers = signal(false);

  userSearchTerm = signal('');
  userSearchResults = signal<User[]>([]);
  showUserSearchDropdown = signal(false);
  selectedUserForGroup = signal<User | null>(null);

  availableActions = FEATURE_ACTIONS;
  permissionActionGroups = this.buildPermissionActionGroups(this.availableActions);
  permissionMap = signal<Record<number, Record<string, boolean>>>({});
  savingPermissions = signal(false);
  currentUser = signal<any>(null);

  private subscriptions: Subscription[] = [];
  private userSearchSubscription: Subscription | null = null;

  constructor(
    private groupService: GroupService,
    private authService: AuthService,
    private router: Router,
    private featureAccessService: FeatureAccessService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.checkPageAccess();
    this.loadGroups();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private checkPageAccess(): void {
    const currentUser = this.authService.getCurrentUser();
    this.currentUser.set(currentUser);

    const canOpenGroups = this.canAny([
      'group_view',
      'group_permission_view',
      'group_permission_manage',
      'group_view_group',
      'group_view_members'
    ]);

    if (!canOpenGroups) {
      this.error.set('Access denied. Group permissions required.');
      setTimeout(() => this.router.navigate(['/home']), 2000);
      return;
    }

    if (!this.can('group_view') && this.canAny(['group_permission_view', 'group_permission_manage'])) {
      this.activeTab.set('permissions');
    }
  }

  loadGroups(): void {
    this.loading.set(true);
    this.error.set(null);

    const sub = this.groupService.getAllGroups().subscribe({
      next: (response) => {
        const groups = response?.groups || response || [];
        this.groups.set(Array.isArray(groups) ? groups : []);
        this.loadGroupPermissions();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading groups:', err);
        this.error.set('Failed to load groups');
        this.loading.set(false);
      }
    });

    this.subscriptions.push(sub);
  }

  openCreateGroupDialog(): void {
    this.newGroupName.set('');
    this.newGroupDescription.set('');
    this.showCreateGroupDialog.set(true);
  }

  closeCreateGroupDialog(): void {
    this.showCreateGroupDialog.set(false);
  }

  createGroup(): void {
    if (!this.can('group_create')) {
      this.error.set('Access denied for creating groups');
      return;
    }

    if (!this.newGroupName()) {
      this.error.set('Group name is required');
      return;
    }

    const createDto: CreateGroupDto = {
      name: this.newGroupName(),
      description: this.newGroupDescription()
    };

    const sub = this.groupService.createGroup(createDto).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('Group created successfully');
          this.notificationService.showSuccess('Group created successfully');
          this.closeCreateGroupDialog();
          this.loadGroups();
          setTimeout(() => this.successMessage.set(null), 3000);
        }
      },
      error: (err) => {
        console.error('Error creating group:', err);
        this.error.set('Failed to create group');
      }
    });

    this.subscriptions.push(sub);
  }

  openEditGroupDialog(group: Group): void {
    this.editingGroupId.set(group.id);
    this.editingGroupName.set(group.name);
    this.editingGroupDescription.set(group.description || '');
    this.showEditGroupDialog.set(true);
  }

  closeEditGroupDialog(): void {
    this.showEditGroupDialog.set(false);
    this.editingGroupId.set(null);
  }

  updateGroup(): void {
    if (!this.can('group_update_group')) {
      this.error.set('Access denied for updating groups');
      return;
    }

    const groupId = this.editingGroupId();
    if (!groupId || !this.editingGroupName()) {
      this.error.set('Group name is required');
      return;
    }

    const updateDto: CreateGroupDto = {
      name: this.editingGroupName(),
      description: this.editingGroupDescription()
    };

    const sub = this.groupService.updateGroup(groupId, updateDto).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('Group updated successfully');
          this.notificationService.showSuccess('Group updated successfully');
          this.closeEditGroupDialog();
          this.loadGroups();
          setTimeout(() => this.successMessage.set(null), 3000);
        }
      },
      error: (err) => {
        console.error('Error updating group:', err);
        this.error.set('Failed to update group');
      }
    });

    this.subscriptions.push(sub);
  }

  deleteGroup(group: Group): void {
    if (!this.can('group_delete_group')) {
      this.error.set('Access denied for deleting groups');
      return;
    }

    this.pendingDeleteGroup.set(group);
    this.showDeleteGroupDialog.set(true);
  }

  closeDeleteGroupDialog(): void {
    this.showDeleteGroupDialog.set(false);
    this.pendingDeleteGroup.set(null);
  }

  confirmDeleteGroup(): void {
    const group = this.pendingDeleteGroup();
    if (!group) {
      return;
    }

    const sub = this.groupService.deleteGroup(group.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('Group deleted successfully');
          this.notificationService.showSuccess('Group deleted successfully');
          this.closeDeleteGroupDialog();
          this.loadGroups();
          setTimeout(() => this.successMessage.set(null), 3000);
        }
      },
      error: (err) => {
        console.error('Error deleting group:', err);
        this.error.set('Failed to delete group');
        this.closeDeleteGroupDialog();
      }
    });

    this.subscriptions.push(sub);
  }

  selectGroupForMembers(group: Group): void {
    if (!this.can('group_view_members')) {
      this.error.set('Access denied for viewing group members');
      return;
    }

    this.selectedGroup.set(group as GroupWithMembers);
    this.activeTab.set('group-members');
    this.loadGroupMembers(group.id);
  }

  loadGroupMembers(groupId: number): void {
    this.loadingMembers.set(true);

    const sub = this.groupService.getGroupMembers(groupId).subscribe({
      next: (response) => {
        if (response.success && response.members) {
          this.groupMembers.set(response.members);
        }
        this.loadingMembers.set(false);
      },
      error: (err) => {
        console.error('Error loading group members:', err);
        this.error.set('Failed to load group members');
        this.loadingMembers.set(false);
      }
    });

    this.subscriptions.push(sub);
  }

  openAddUserDialog(group: Group): void {
    if (!this.can('group_add_user')) {
      this.error.set('Access denied for adding users to groups');
      return;
    }

    this.selectedGroup.set(group as GroupWithMembers);
    this.userSearchTerm.set('');
    this.userSearchResults.set([]);
    this.showUserSearchDropdown.set(false);
    this.selectedUserForGroup.set(null);
    this.showAddUserDialog.set(true);
  }

  closeAddUserDialog(): void {
    this.showAddUserDialog.set(false);
    this.userSearchTerm.set('');
    this.userSearchResults.set([]);
    this.showUserSearchDropdown.set(false);
    this.selectedUserForGroup.set(null);
  }

  onUserSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    const searchTerm = input.value.trim();

    this.userSearchTerm.set(searchTerm);

    // Only perform search if at least 3 characters
    if (!searchTerm || searchTerm.length < 3) {
      this.userSearchResults.set([]);
      this.showUserSearchDropdown.set(false);
      return;
    }

    // Unsubscribe from previous search if exists
    if (this.userSearchSubscription) {
      this.userSearchSubscription.unsubscribe();
    }

    // Subscribe to search
    this.userSearchSubscription = this.authService.searchUsers(searchTerm)
      .subscribe({
        next: (results: any[]) => {
          this.userSearchResults.set(Array.isArray(results) ? results : []);
          this.showUserSearchDropdown.set(Array.isArray(results) && results.length > 0);
        },
        error: () => {
          this.userSearchResults.set([]);
          this.showUserSearchDropdown.set(false);
        }
      });
  }

  selectUserForGroup(user: User): void {
    this.selectedUserForGroup.set(user);
    this.userSearchResults.set([]);
    this.showUserSearchDropdown.set(false);
  }

  clearSelectedUser(): void {
    this.selectedUserForGroup.set(null);
  }

  addUserToGroup(): void {
    if (!this.can('group_add_user')) {
      this.error.set('Access denied for adding users to groups');
      return;
    }

    const group = this.selectedGroup();
    const user = this.selectedUserForGroup();

    if (!group || !user) {
      this.error.set('Please select a user');
      return;
    }

    const sub = this.groupService.addUserToGroup(group.id, user.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('User added to group successfully');
          this.notificationService.showSuccess('User added to group successfully');
          this.closeAddUserDialog();
          this.loadGroups();
          if (group.id) {
            this.loadGroupMembers(group.id);
          }
          setTimeout(() => this.successMessage.set(null), 3000);
        }
      },
      error: (err) => {
        console.error('Error adding user to group:', err);
        this.error.set(err.error?.message || 'Failed to add user to group');
      }
    });

    this.subscriptions.push(sub);
  }

  removeUserFromGroup(group: Group, user: User): void {
    if (!this.can('group_remove_user')) {
      this.error.set('Access denied for removing users from groups');
      return;
    }

    this.pendingRemoveGroup.set(group);
    this.pendingRemoveMember.set(user);
    this.showRemoveMemberDialog.set(true);
  }

  closeRemoveMemberDialog(): void {
    this.showRemoveMemberDialog.set(false);
    this.pendingRemoveGroup.set(null);
    this.pendingRemoveMember.set(null);
  }

  confirmRemoveUserFromGroup(): void {
    const group = this.pendingRemoveGroup();
    const user = this.pendingRemoveMember();
    if (!group || !user) {
      return;
    }

    const sub = this.groupService.removeUserFromGroup(group.id, user.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('User removed from group successfully');
          this.notificationService.showSuccess('User removed from group successfully');
          this.closeRemoveMemberDialog();
          this.loadGroups();
          this.loadGroupMembers(group.id);
          setTimeout(() => this.successMessage.set(null), 3000);
        }
      },
      error: (err) => {
        console.error('Error removing user from group:', err);
        this.error.set('Failed to remove user from group');
        this.closeRemoveMemberDialog();
      }
    });

    this.subscriptions.push(sub);
  }

  findGroupById(): void {
    if (!this.can('group_view_group')) {
      this.error.set('Access denied for viewing group details');
      return;
    }

    this.error.set(null);
    this.selectedGroupById.set(null);
    const id = Number(this.groupIdSearch().trim());
    if (!id) {
      this.error.set('Please enter a valid group id');
      return;
    }

    const sub = this.groupService.getGroupById(id).subscribe({
      next: (response) => {
        this.selectedGroupById.set(response?.group || response || null);
      },
      error: () => {
        this.error.set('Group not found');
      }
    });

    this.subscriptions.push(sub);
  }

  loadGroupPermissions(): void {
    const groups = this.groups();

    if (!groups.length) {
      this.permissionMap.set({});
      return;
    }

    const permissionRequests = groups.map((group) =>
      this.groupService.getGroupPermissions(group.id).pipe(
        map((response) => {
          const list = (response?.permissions || response || []) as any[];
          const enabledActions = (Array.isArray(list) ? list : [])
            .filter((entry) => entry?.enabled !== false)
            .map((entry) => String(entry?.permissionKey || entry?.key || '').trim())
            .filter((key) => !!key);

          return {
            groupId: group.id,
            actions: enabledActions
          } as GroupPermissionRow;
        }),
        catchError(() => of({ groupId: group.id, actions: [] } as GroupPermissionRow))
      )
    );

    const sub = forkJoin(permissionRequests).subscribe({
      next: (rows) => {
        const map = this.featureAccessService.toPermissionMap(groups, rows);
        this.permissionMap.set(map);
        this.featureAccessService.savePermissionsToStorage(rows);
      },
      error: () => {
        const fallbackRows = this.featureAccessService.loadPermissionsFromStorage();
        const map = this.featureAccessService.toPermissionMap(groups, fallbackRows);
        this.permissionMap.set(map);
      }
    });

    this.subscriptions.push(sub);
  }

  hasGroupAction(groupId: number, actionKey: string): boolean {
    return !!this.permissionMap()[groupId]?.[actionKey];
  }

  toggleGroupAction(groupId: number, actionKey: string, checked: boolean): void {
    const group = this.groups().find((entry) => entry.id === groupId);
    if (!group || !this.canEditGroupPermissions(group)) {
      return;
    }

    this.permissionMap.update((currentMap) => {
      const nextMap: Record<number, Record<string, boolean>> = { ...currentMap };
      nextMap[groupId] = { ...(nextMap[groupId] || {}) };
      nextMap[groupId][actionKey] = checked;
      return nextMap;
    });
  }

  savePermissions(): void {
    if (!this.can('group_permission_manage')) {
      this.error.set('Access denied for managing group permissions');
      return;
    }

    this.error.set(null);
    this.savingPermissions.set(true);

    const rows = this.featureAccessService.toPermissionRows(this.groups(), this.permissionMap());
    const requests = rows.flatMap((row) => {
      const group = this.groups().find((entry) => entry.id === row.groupId);
      if (!group || !this.canEditGroupPermissions(group)) {
        return [];
      }

      const enabled = new Set(row.actions || []);

      return this.availableActions.map((action) => {
        if (enabled.has(action.key)) {
          return this.groupService.upsertGroupPermission(row.groupId, {
            permissionKey: action.key,
            enabled: true,
            description: action.description
          }).pipe(catchError(() => of(null)));
        }

        return this.groupService.deleteGroupPermission(row.groupId, action.key)
          .pipe(catchError(() => of(null)));
      });
    });

    if (!requests.length) {
      this.savingPermissions.set(false);
      return;
    }

    const sub = forkJoin(requests).subscribe({
      next: () => {
        this.featureAccessService.savePermissionsToStorage(rows);
        this.successMessage.set('Permission parameters saved successfully');
        this.notificationService.showSuccess('Permission parameters saved successfully');
        this.savingPermissions.set(false);
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: () => {
        this.featureAccessService.savePermissionsToStorage(rows);
        this.successMessage.set('Permission parameters saved locally (backend unavailable)');
        this.notificationService.showSuccess('Permission parameters saved locally');
        this.savingPermissions.set(false);
        setTimeout(() => this.successMessage.set(null), 3500);
      }
    });

    this.subscriptions.push(sub);
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  can(actionKey: string): boolean {
    return this.featureAccessService.hasAccess(this.currentUser(), actionKey);
  }

  canAny(actionKeys: string[]): boolean {
    return actionKeys.some((key) => this.can(key));
  }

  isAdminGroup(group: Group): boolean {
    const name = String(group?.name || '').trim().toLowerCase();
    return name.includes('admin');
  }

  canEditGroupPermissions(group: Group): boolean {
    return this.can('group_permission_manage') && !this.isAdminGroup(group);
  }

  private buildPermissionActionGroups(actions: FeatureAction[]): PermissionActionGroup[] {
    const grouped = new Map<string, FeatureAction[]>();

    for (const action of actions) {
      const domain = this.extractPermissionDomain(action.key);
      const list = grouped.get(domain) || [];
      list.push(action);
      grouped.set(domain, list);
    }

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, groupedActions]) => ({
        key,
        label: this.formatPermissionDomainLabel(key),
        actions: groupedActions
      }));
  }

  private extractPermissionDomain(permissionKey: string): string {
    const [domain] = String(permissionKey || '').split('_');
    return domain || 'general';
  }

  private formatPermissionDomainLabel(domain: string): string {
    const labels: Record<string, string> = {
      academy: 'Academies',
      category: 'Categories',
      group: 'Groups',
      player: 'Players',
      profile: 'Profile',
      user: 'Users',
      general: 'General'
    };

    if (labels[domain]) {
      return labels[domain];
    }

    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
}
