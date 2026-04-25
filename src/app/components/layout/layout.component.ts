import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FeatureAccessService } from '../../services/feature-access.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent implements OnInit {
  currentUser = signal<any>(null);
  sidebarOpen = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router,
    private featureAccessService: FeatureAccessService
  ) {}

  ngOnInit(): void {
    const storedUser = this.authService.getCurrentUser();
    if (storedUser) {
      this.currentUser.set(storedUser);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    if (window.innerWidth < 768) {
      this.sidebarOpen.set(false);
    }
  }

  can(actionKey: string): boolean {
    return this.featureAccessService.hasAccess(this.currentUser(), actionKey);
  }

  canAny(actionKeys: string[]): boolean {
    return actionKeys.some((key) => this.can(key));
  }
}
