import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export interface RegisterRequest {
  identifiant: string;
  password: string;
  fullname: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  loading = signal(false);
  submitted = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  // Custom validator to check if passwords match
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  ngOnInit(): void {
    // Redirect if already logged in
    if (this.authService.hasToken()) {
      this.router.navigate(['/home']);
    }

    this.registerForm = this.formBuilder.group({
      identifiant: ['', [Validators.required, Validators.minLength(3)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        ]
      ],
      confirmPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8)
        ]
      ],
      fullname: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['standard']
    }, {
      validators: this.passwordMatchValidator.bind(this)
    });
  }

  get f() {
    return this.registerForm.controls;
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.error.set(null);
    this.success.set(null);

    if (this.registerForm.invalid) {
      return;
    }

    // Remove confirmPassword before sending to backend
    const { confirmPassword, ...formData } = this.registerForm.value;

    this.loading.set(true);
    this.authService.register(formData).subscribe({
      next: (response) => {
        this.success.set('Registration successful! Redirecting to login...');
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (error) => {
        this.error.set(error?.error?.message || 'Registration failed. Please try again.');
        this.loading.set(false);
      }
    });
  }

  getPasswordErrorMessage(): string {
    const passwordControl = this.f['password'];
    if (passwordControl.hasError('required')) {
      return 'Password is required';
    }
    if (passwordControl.hasError('minlength')) {
      return 'Password must be at least 8 characters';
    }
    if (passwordControl.hasError('pattern')) {
      return 'Password must contain uppercase, lowercase, and numbers';
    }
    return '';
  }

  getConfirmPasswordErrorMessage(): string {
    const confirmPasswordControl = this.f['confirmPassword'];
    if (confirmPasswordControl.hasError('required')) {
      return 'Please confirm your password';
    }
    if (confirmPasswordControl.hasError('minlength')) {
      return 'Password must be at least 8 characters';
    }
    if (this.registerForm.hasError('passwordMismatch') && confirmPasswordControl.touched) {
      return 'Passwords do not match';
    }
    return '';
  }
}
