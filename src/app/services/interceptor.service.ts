import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PLATFORM_ID } from '@angular/core';
import { NotificationService } from './notification.service';
import { Router } from '@angular/router';

function toAccessDeniedError(error: HttpErrorResponse): HttpErrorResponse {
  return new HttpErrorResponse({
    headers: error.headers,
    status: 403,
    statusText: error.statusText || 'Forbidden',
    url: error.url || undefined,
    error: { error: 'Access Denied' }
  });
}

// Functional interceptor for use with provideHttpClient
export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);
  const notification = inject(NotificationService);
  const router = inject(Router);

  const showAlert = (message: string): void => {
    if (isPlatformBrowser(platformId)) {
      try {
        notification.showError(message, 4000);
      } catch (e) {
        // fallback to console if notification service unavailable
        console.warn('Notification:', message);
      }
    }
  };

  const handleAccessDenied = (): void => {
    // Logout the user
    authService.logout();

    // Show notification
    showAlert('Access Denied - You have been logged out');

    // Redirect to login page
    if (isPlatformBrowser(platformId)) {
      try {
        router.navigate(['/login']);
      } catch (e) {
        console.warn('Navigation to login failed:', e);
        // Fallback to window.location if router navigation fails
        window.location.href = '/login';
      }
    }
  };

  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Skip access denied handling for login requests
      const isLoginRequest = req.url.includes('/login');

      // Check for 401 Unauthorized or 403 Forbidden status codes
      if ((error.status === 401 || error.status === 403) && !isLoginRequest) {
        handleAccessDenied();
        return throwError(() => error);
      }

      // Check for "access denied" in error message or response (skip for login)
      if (!isLoginRequest) {
        const errorMessage = error.error?.message || error.error?.error || error.message;
        if (errorMessage && typeof errorMessage === 'string' &&
            errorMessage.toLowerCase().includes('access denied')) {
          handleAccessDenied();
          return throwError(() => error);
        }

        // Check for "access denied" in response data
        if (error.error && typeof error.error === 'object') {
          const errorObj = error.error;
          if (errorObj.error === 'Access Denied' ||
              errorObj.message === 'Access Denied' ||
              errorObj.error?.toLowerCase().includes('access denied') ||
              errorObj.message?.toLowerCase().includes('access denied')) {
            handleAccessDenied();
            return throwError(() => error);
          }
        }
      }

      return throwError(() => error);
    })
  );
};
