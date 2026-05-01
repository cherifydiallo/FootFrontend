import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FeatureAccessService } from '../../services/feature-access.service';
import { NotificationService } from '../../services/notification.service';

interface User {
  id: number;
  identifiant?: string;
  username?: string;
  fullname?: string;
  fullName?: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  users = signal<User[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  showCreateUserDialog = signal(false);
  showEditUserDialog = signal(false);
  showDeleteUserDialog = signal(false);
  deletingUser = signal<User | null>(null);
  createIdentifiant = signal('');
  createFullname = signal('');
  createEmail = signal('');
  createPassword = signal('');
  createRole = signal('standard');
  searchUsername = signal('');
  selected = signal<User | null>(null);
  editIdentifiant = signal('');
  editFullname = signal('');
  editEmail = signal('');
  editRole = signal('standard');
  editPassword = signal('');

  constructor(
    private authService: AuthService,
    private router: Router,
    private featureAccessService: FeatureAccessService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (!this.can('user_read')) {
      this.router.navigate(['/home']);
      return;
    }

    this.loadUsers();
  }

  can(actionKey: string): boolean {
    return this.featureAccessService.hasAccess(this.authService.getCurrentUser(), actionKey);
  }

  isAdminUser(user: User): boolean {
    return String(user.role || '').toLowerCase() === 'admin';
  }

  openCreateUserDialog(): void {
    if (!this.can('user_write')) {
      this.error.set('Access denied for creating users');
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.resetCreateUserForm();
    this.showCreateUserDialog.set(true);
  }

  closeCreateUserDialog(): void {
    this.showCreateUserDialog.set(false);
    this.resetCreateUserForm();
  }

  createUser(): void {
    if (!this.can('user_write')) {
      this.error.set('Access denied for creating users');
      return;
    }

    this.error.set(null);
    this.success.set(null);

    const identifiant = this.createIdentifiant().trim();
    const fullname = this.createFullname().trim();
    const email = this.createEmail().trim();
    const password = this.createPassword();
    const role = this.createRole();

    if (!identifiant || !fullname || !email || !password) {
      this.error.set('All create user fields are required');
      return;
    }

    this.authService.register({
      identifiant,
      fullname,
      email,
      password,
      role
    }).subscribe({
      next: () => {
        this.success.set('User created successfully');
        this.notificationService.showSuccess('User created successfully');
        this.closeCreateUserDialog();
        this.loadUsers();
      },
      error: (error) => {
        this.error.set(error?.error?.message || error?.error?.error || 'Failed to create user');
      }
    });
  }

  resetCreateUserForm(): void {
    this.createIdentifiant.set('');
    this.createFullname.set('');
    this.createEmail.set('');
    this.createPassword.set('');
    this.createRole.set('standard');
  }

  loadUsers(): void {
    this.loading.set(true);
    this.authService.getAllUsers().subscribe({
      next: (users) => {
        this.users.set(Array.isArray(users) ? users : []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load users');
        this.loading.set(false);
      }
    });
  }

  search(): void {
    const username = this.searchUsername().trim();
    if (!username) {
      this.loadUsers();
      return;
    }

    this.loading.set(true);
    this.authService.searchUsers(username).subscribe({
      next: (results) => {
        this.users.set(results || []);
        this.loading.set(false);
      },
      error: () => {
        this.users.set([]);
        this.error.set('Search failed');
        this.loading.set(false);
      }
    });
  }

  startEdit(user: User): void {
    this.selected.set(user);
    this.editIdentifiant.set(user.identifiant || user.username || '');
    this.editFullname.set(user.fullname || user.fullName || '');
    this.editEmail.set(user.email || '');
    this.editRole.set(user.role || 'standard');
    this.editPassword.set('');
    this.showEditUserDialog.set(true);
  }

  closeEditUserDialog(): void {
    this.showEditUserDialog.set(false);
    this.selected.set(null);
    this.editIdentifiant.set('');
    this.editFullname.set('');
    this.editEmail.set('');
    this.editRole.set('standard');
    this.editPassword.set('');
  }

  cancelEdit(): void {
    this.selected.set(null);
  }

  save(): void {
    const user = this.selected();
    if (!user) {
      return;
    }

    if (!this.can('user_edit')) {
      this.error.set('Access denied for editing users');
      return;
    }

    this.authService.updateUser(user.id, {
      fullname: this.editFullname(),
      email: this.editEmail(),
      password: this.editPassword(),
      role: this.editRole()
    }).subscribe({
      next: () => {
        this.success.set('User updated successfully');
        this.notificationService.showSuccess('User updated successfully');
        this.closeEditUserDialog();
        this.loadUsers();
      },
      error: () => {
        this.error.set('Failed to update user');
      }
    });
  }

  remove(user: User): void {
    if (!this.can('user_delete')) {
      this.error.set('Access denied for deleting users');
      return;
    }

    if (this.isAdminUser(user)) {
      this.error.set('Admin users cannot be deleted');
      return;
    }

    this.deletingUser.set(user);
    this.showDeleteUserDialog.set(true);
  }

  closeDeleteUserDialog(): void {
    this.showDeleteUserDialog.set(false);
    this.deletingUser.set(null);
  }

  confirmDeleteUser(): void {
    const user = this.deletingUser();
    if (!user) {
      return;
    }

    this.authService.deleteUser(user.id).subscribe({
      next: () => {
        this.success.set('User deleted successfully');
        this.notificationService.showSuccess('User deleted successfully');
        this.closeDeleteUserDialog();
        this.loadUsers();
      },
      error: () => {
        this.error.set('Failed to delete user');
        this.closeDeleteUserDialog();
      }
    });
  }
}
