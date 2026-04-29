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
      if (error.status === 401) {
        // Unauthorized - token expired or invalid
        authService.logout();
        // Use app notification instead of native alert
        showAlert('Access Denied');
      }

      if (error.status === 403) {
        // Use app notification and propagate a typed 403 error
        showAlert('Access Denied');
        return throwError(() => toAccessDeniedError(error));
      }

      return throwError(() => error);
    })
  );
};
