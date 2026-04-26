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
  styleUrl: './profile.component.scss'
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
}
