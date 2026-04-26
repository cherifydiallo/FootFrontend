import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { HomeComponent } from './components/home/home.component';
import { ProfileComponent } from './components/profile/profile.component';
import { LayoutComponent } from './components/layout/layout.component';
import { AuthGuardService } from './guards/auth.guard';
import { AdminManagementComponent } from './components/admin-management/admin-management.component';
import { PlayersComponent } from './components/players/players.component';
import { UsersComponent } from './components/users/users.component';
import { AcademiesComponent } from './components/academies/academies.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'home',
    component: LayoutComponent,
    canActivate: [AuthGuardService],
    children: [
      { path: '', component: HomeComponent },
      { path: 'groups', component: AdminManagementComponent },
      { path: 'academies', component: AcademiesComponent },
      { path: 'players', component: PlayersComponent },
      { path: 'users', component: UsersComponent },
      { path: 'profile', component: ProfileComponent },
    ]
  },
  { path: '**', redirectTo: '/login' }
];
