import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = signal(false);
  submitted = signal(false);
  error = signal<string | null>(null);

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
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
        if (error?.accessDenied) {
          this.authService.logout();
          this.error.set('Access denied. Please contact your administrator.');
        } else {
          this.error.set(error?.error?.message || 'Login failed. Please try again.');
        }
      }
    });
  }
}
