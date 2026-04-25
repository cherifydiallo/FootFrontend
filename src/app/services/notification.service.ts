import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationState {
  message: string;
  type: NotificationType;
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  notification = signal<NotificationState | null>(null);
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

  show(message: string, type: NotificationType = 'success', durationMs = 1000): void {
    this.notification.set({
      message,
      type,
      visible: true
    });

    if (this.hideTimeoutId) {
      clearTimeout(this.hideTimeoutId);
    }

    this.hideTimeoutId = setTimeout(() => {
      this.notification.set(null);
      this.hideTimeoutId = null;
    }, durationMs);
  }

  showSuccess(message: string, durationMs = 1000): void {
    this.show(message, 'success', durationMs);
  }

  showError(message: string, durationMs = 1000): void {
    this.show(message, 'error', durationMs);
  }

  clear(): void {
    if (this.hideTimeoutId) {
      clearTimeout(this.hideTimeoutId);
      this.hideTimeoutId = null;
    }

    this.notification.set(null);
  }
}
