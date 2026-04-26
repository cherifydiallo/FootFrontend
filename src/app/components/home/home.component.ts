import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FeatureAccessService } from '../../services/feature-access.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  currentUser = signal<any>(null);
  loading = signal(true);

  constructor(
    private authService: AuthService,
    private router: Router,
    private featureAccessService: FeatureAccessService
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated
    if (!this.authService.hasToken()) {
      this.router.navigate(['/login']);
      return;
    }

    // Show stored user immediately for instant render, then always refresh
    // from /profile/me so permissions are always up to date
    const storedUser = this.authService.getCurrentUser();
    if (storedUser) {
      this.currentUser.set(storedUser);
      this.loading.set(false);
    }

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

  can(actionKey: string): boolean {
    return this.featureAccessService.hasAccess(this.currentUser(), actionKey);
  }

  canAny(actionKeys: string[]): boolean {
    return actionKeys.some((key) => this.can(key));
  }

  goTo(route: string): void {
    this.router.navigate([route]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

