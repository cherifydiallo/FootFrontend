import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = signal(false);
  submitted = signal(false);
  error = signal<string | null>(null);
  hidePassword = signal(true);

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Redirect if already logged in
    if (this.authService.hasToken()) {
      if (!this.authService.getCurrentUser()) {
        this.authService.fetchCurrentUser().subscribe({
          next: () => this.router.navigate(['/home']),
          error: () => this.router.navigate(['/home'])
        });
      } else {
        this.router.navigate(['/home']);
      }
    }

    this.loginForm = this.formBuilder.group({
      identifiant: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.error.set(null);

    if (this.loginForm.invalid) {
      return;
    }

    this.loading.set(true);
    this.authService.login(this.loginForm.value).pipe(
      switchMap(() => this.authService.fetchCurrentUser())
    ).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/home']);
      },
      error: (error) => {
        this.loading.set(false);
        const errorMessage = this.getErrorMessage(error);
        this.error.set(errorMessage);
        try {
          this.snackBar.open(errorMessage, 'Close', { duration: 5000, panelClass: ['snackbar-error'] });
        } catch (e) {
          // ignore if snackBar unavailable in some environments
        }
      }
    });
  }

  private getErrorMessage(error: any): string {
    // Handle 401 Unauthorized - Invalid credentials
    if (error?.status === 401) {
      return 'Invalid identifiant or password. Please try again.';
    }

    // Handle 403 Forbidden - Access denied
    if (error?.status === 403) {
      this.authService.logout();
      return 'Access denied. Please contact your administrator.';
    }

    // Handle 400 Bad Request
    if (error?.status === 400) {
      return error?.error?.message || 'Invalid login credentials. Please check and try again.';
    }

    // Handle 500 Server Error
    if (error?.status === 500) {
      return 'Server error. Please try again later.';
    }

    // Handle network errors
    if (error?.status === 0) {
      return 'Connection error. Please check your internet connection.';
    }

    // Fallback error message
    return error?.error?.message || 'Login failed. Please try again.';
  }
}
