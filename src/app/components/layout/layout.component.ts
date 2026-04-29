import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FeatureAccessService } from '../../services/feature-access.service';
import { MatSidenavModule, MatDrawer } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatListModule,
    MatDividerModule
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit {
  @ViewChild('drawer') drawer!: MatDrawer;
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

  isHome(): boolean {
    try {
      const raw = this.router.url || '';
      const url = raw.split('?')[0].replace(/\/+$/, '');
      // Consider only exact `/home` as home; subpaths (e.g. /home/players) are NOT home
      return url === '/home' || url === '/home/';
    } catch {
      return false;
    }
  }

  goHome(): void {
    this.router.navigate(['/home']);
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
