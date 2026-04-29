import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FeatureAccessService } from '../../services/feature-access.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  currentUser = signal<any>(null);
  loading = signal(true);
  permissionLabels: Record<string, string> = {};

  constructor(
    private authService: AuthService,
    private router: Router,
    private featureAccessService: FeatureAccessService
  ) {
    this.permissionLabels = Object.fromEntries(
      this.featureAccessService.getFeatureActions().map((a) => [a.key, a.label])
    );
  }

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    this.authService.fetchCurrentUser().subscribe({
      next: (user) => {
        this.currentUser.set(user);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  get groupedPermissions(): { name: string; label: string; perms: string[] }[] {
    const perms: string[] = this.currentUser()?.permissions || [];
    const map: Record<string, string[]> = {};

    for (const p of perms) {
      const parts = (p || '').split('_');
      const key = parts.length > 1 ? parts[0] : 'other';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }

    // Map to array with friendly labels
    return Object.keys(map).map((k) => ({
      name: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      perms: map[k]
    }));
  }
}
