// Import necessary Angular modules for dependency injection and HTTP requests
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
// Import platform detection utility to check if running in browser
import { isPlatformBrowser } from '@angular/common';
// Import HTTP client and headers for making API requests
import { HttpClient, HttpHeaders } from '@angular/common/http';
// Import RxJS observables for reactive data management
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
// Import map operator to transform observable data
import { map, switchMap } from 'rxjs/operators';
// Import API URL from environment configuration
import { environment } from '../../environments/environment';

// Interface for login request payload sent to the backend
export interface LoginRequest {
  identifiant: string;  // Username or email identifier
  password: string;     // User password
}

// Interface for the login response from the backend
export interface LoginResponse {
  token: string;        // JWT authentication token
  user: {
    id: string;         // User unique identifier
    username: string;   // User's username
    email: string;      // User's email address
  };
}

// Interface for user registration request payload
export interface RegisterRequest {
  identifiant: string;  // Username or email identifier
  password: string;     // User password
  fullname: string;     // User's full name
  email: string;        // User's email address
  role: string;         // User's role (e.g., admin, user)
}

// Interface for the registration response from the backend
export interface RegisterResponse {
  message: string;      // Response message from server
  user?: {
    id: string;         // Created user's ID
    identifiant: string;// User's identifier
    email: string;      // User's email
  };
}

// Injectable service available application-wide for authentication operations
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Base API URL for authentication endpoints from environment config
  private apiUrl = `${environment.backendUrl}/auth`;

  // Platform ID injected to detect if running in browser or server
  private platformId = inject(PLATFORM_ID);

  // BehaviorSubject to track the currently logged-in user (starts with stored user or null)
  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  // Observable stream for components to subscribe to current user changes
  public currentUser$ = this.currentUserSubject.asObservable();

  // BehaviorSubject to track authentication state (true if token exists, false otherwise)
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  // Observable stream for components to check authentication status
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Sends login credentials to backend and handles token/user storage
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      // Transform the response before returning to caller
      map((response) => {
        // Store token in localStorage only if running in browser (not server-side)
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('authToken', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
        }

        // Update the user subject so all subscribed components receive the update
        this.currentUserSubject.next(response.user);
        // Update authentication status to true
        this.isAuthenticatedSubject.next(true);

        return response;
      })
    );
  }

  // Fetch current user info from backend endpoint /api/profile/me
  fetchCurrentUser(): Observable<any> {
    return this.http.get<any>(`${environment.backendUrl}/profile/me`).pipe(
      switchMap((response) => {
        // Backend returned Access Denied (user lacks profile_view permission)
        if (response.error === 'Access Denied') {
          return throwError(() => ({ accessDenied: true }));
        }

        // Handle the wrapped response format { success: true, user: {...} }
        if (response.success && response.user) {
          const user = response.user;

          // Store user in localStorage and update subject
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('user', JSON.stringify(user));
          }
          this.currentUserSubject.next(user);
          return of(user);
        } else {
          // If response doesn't have success flag, treat response as user data directly
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('user', JSON.stringify(response));
          }
          this.currentUserSubject.next(response);
          return of(response);
        }
      })
    );
  }

  // Sends registration data to backend to create a new user account
  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/signup`, data).pipe(
      // Simply pass through the response (registration doesn't auto-login user)
      map((response) => {
        return response;
      })
    );
  }

  checkToken(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/check`);
  }

  refreshToken(refreshToken: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      map((response: any) => {
        const newToken = response?.token || response?.accessToken || response?.refreshToken;
        if (newToken && isPlatformBrowser(this.platformId)) {
          localStorage.setItem('authToken', newToken);
        }
        return response;
      })
    );
  }

  // Clears authentication data from storage and resets authentication state
  logout(): void {
    // Clear stored token and user data from browser localStorage
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
    // Update subjects to clear current user and authentication status
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  // Retrieves the stored authentication token from localStorage
  getToken(): string | null {
    // Return null if running in server-side environment (no localStorage available)
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem('authToken');
  }

  // Checks if a valid authentication token exists in storage
  hasToken(): boolean {
    // Return false if running in server-side environment
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    // Returns true if token exists, false otherwise
    return !!localStorage.getItem('authToken');
  }

  // Retrieves and parses the stored user object from localStorage
  private getUserFromStorage(): any {
    // Return null if running in server-side environment
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    // Get the stored user JSON string from localStorage
    const user = localStorage.getItem('user');
    // Return null if user data doesn't exist or is undefined
    if (!user || user === 'undefined') {
      return null;
    }
    try {
      // Parse and return the user object
      return JSON.parse(user);
    } catch (e) {
      // Return null if JSON parsing fails
      return null;
    }
  }

  // Returns the currently logged-in user object from the BehaviorSubject
  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  // Searches for users by username from the backend
  searchUsers(username: string): Observable<any[]> {
    const token = this.getToken();
    let headers = new HttpHeaders();

    // Add authorization header if token exists
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<any>(`${environment.backendUrl}/auth/user/search`, {
      params: { username },
      headers: headers
    }).pipe(
      map((response: any) => {
        // Extract users array from response object
        return response?.users || [];
      })
    );
  }

  getAllUsers(): Observable<any[]> {
    return this.http.get<any>(`${environment.backendUrl}/auth/users`).pipe(
      map((response: any) => response?.users || response || [])
    );
  }

  updateUser(userId: number, data: { fullname: string; email: string; password?: string; role: string }): Observable<any> {
    return this.http.put<any>(`${environment.backendUrl}/auth/users/${userId}`, data);
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete<any>(`${environment.backendUrl}/auth/users/${userId}`);
  }
}
