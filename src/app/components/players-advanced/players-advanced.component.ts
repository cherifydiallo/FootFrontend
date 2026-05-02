import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerService, Player, Academy, AcademyCategory } from '../../services/player.service';
import { AcademyService } from '../../services/academy.service';
import { AuthService } from '../../services/auth.service';
import { FeatureAccessService } from '../../services/feature-access.service';

// Angular Material - only for icons in modals
import { MatIconModule } from '@angular/material/icon';
import { PlayerViewerEditComponent } from '../player-viewer-edit/player-viewer-edit.component';

@Component({
  selector: 'app-players-advanced',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PlayerViewerEditComponent
  ],
  templateUrl: './players-advanced.component.html',
  styleUrls: ['./players-advanced.component.scss']
})
export class PlayersAdvancedComponent implements OnInit {
  players = signal<Player[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  name = signal('');
  categoryId = signal('');
  academyId = signal('');
  birthDate = signal('');
  heightCm = signal('');
  weightKg = signal('');
  createdAt = signal('');

  categories = signal<AcademyCategory[]>([]);
  loadingCategories = signal(false);
  academies = signal<Academy[]>([]);
  loadingAcademies = signal(false);

  // Shared component state
  selectedPlayer = signal<Player | null>(null);
  photoLoadErrors = signal<Map<number, boolean>>(new Map());
  triggerView = signal(false);
  triggerEdit = signal(false);
  triggerDelete = signal(false);

  constructor(
    private router: Router,
    private playerService: PlayerService,
    private academyService: AcademyService,
    private authService: AuthService,
    private featureAccessService: FeatureAccessService
  ) {}

  ngOnInit(): void {
    // Initialize with empty arrays to ensure they are iterable
    this.academies.set([]);
    this.categories.set([]);
    this.players.set([]);
    this.loadAcademies();
  }

  private loadCategories(): void {
    if (!this.academyId()) {
      this.categories.set([]);
      return;
    }

    this.loadingCategories.set(true);
    // Ensure categories is initialized as an array
    this.categories.set([]);

    this.academyService.getCategoriesByAcademy(Number(this.academyId())).subscribe({
      next: (response) => {
        // Extract categories from response structure
        const categories = response?.categories || response || [];
        this.categories.set(Array.isArray(categories) ? categories : []);
        this.loadingCategories.set(false);
      },
      error: (err) => {
        console.error('Error loading categories:', err);
        this.categories.set([]);
        this.loadingCategories.set(false);
      }
    });
  }

  private loadAcademies(): void {
    this.loadingAcademies.set(true);
    // Ensure academies is initialized as an array
    this.academies.set([]);

    this.academyService.getAllAcademies().subscribe({
      next: (response) => {
        // Extract academies from response structure
        const academies = response?.academies || response || [];
        this.academies.set(Array.isArray(academies) ? academies : []);
        this.loadingAcademies.set(false);
      },
      error: (err) => {
        console.error('Error loading academies:', err);
        this.academies.set([]);
        this.loadingAcademies.set(false);
      }
    });
  }

  // Shared component handlers
  onPlayerDeleted(_player: Player): void {
    this.search();
  }

  onPlayerUpdated(_player: Player): void {
    this.search();
  }

  // View player using shared component
  viewPlayer(player: Player): void {
    this.selectedPlayer.set(player);
    this.triggerView.set(true);
    // Reset trigger after a short delay
    setTimeout(() => this.triggerView.set(false), 100);
  }

  // Edit player using shared component
  editPlayer(player: Player): void {
    this.selectedPlayer.set(player);
    this.triggerEdit.set(true);
    // Reset trigger after a short delay
    setTimeout(() => this.triggerEdit.set(false), 100);
  }

  // Delete player using shared component
  deletePlayer(player: Player): void {
    this.selectedPlayer.set(player);
    this.triggerDelete.set(true);
    // Reset trigger after a short delay
    setTimeout(() => this.triggerDelete.set(false), 100);
  }

  can(actionKey: string): boolean {
    const user = this.authService.getCurrentUser();
    return this.featureAccessService.hasAccess(user, actionKey);
  }

  onPhotoError(playerId: number): void {
    const errors = this.photoLoadErrors();
    errors.set(playerId, true);
    this.photoLoadErrors.set(new Map(errors));
  }

  photoLoadError(playerId: number): boolean {
    return this.photoLoadErrors().get(playerId) || false;
  }

  onAcademyChange(value: string): void {
    this.academyId.set(value);
    this.categoryId.set('');
    this.loadCategories();
  }

  search(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: Record<string, string | number> = {};

    if (this.name()) {
      params['name'] = this.name();
    }

    if (this.academyId()) {
      params['academyId'] = Number(this.academyId());
    }

    if (this.categoryId()) {
      params['categoryId'] = Number(this.categoryId());
    }

    if (this.birthDate()) {
      params['birthDate'] = this.birthDate();
    }

    if (this.heightCm()) {
      params['heightCm'] = Number(this.heightCm());
    }

    if (this.weightKg()) {
      params['weightKg'] = Number(this.weightKg());
    }

    if (this.createdAt()) {
      params['createdAt'] = this.createdAt();
    }

    this.playerService.searchAdvanced(params).subscribe({
      next: (response: any) => {
        const players = response?.players || response || [];
        this.players.set(Array.isArray(players) ? players : []);
        this.loading.set(false);

        // Auto-scroll to results if players are found
        if (players.length > 0) {
          setTimeout(() => {
            const resultsElement = document.getElementById('player-results');
            if (resultsElement) {
              resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      },
      error: (err: any) => {
        console.error('Error searching players:', err);
        this.error.set('Failed to search players');
        this.players.set([]);
        this.loading.set(false);
      }
    });
  }

  back(): void {
    this.router.navigate(['/players']);
  }

  // Helper methods for player display
  getInitials(player: Player): string {
    return player.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'P';
  }

  formatBirthDate(dateStr: string): string {
    if (!dateStr) {
      return '-';
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  formatHeightCm(height: number | string): string {
    if (!height) {
      return '-';
    }

    const heightCm = Number(height);
    if (isNaN(heightCm) || heightCm <= 0) {
      return '-';
    }

    const meters = Math.floor(heightCm / 100);
    const centimeters = heightCm % 100;
    return `${meters}m${String(centimeters).padStart(2, '0')}`;
  }

  formatCategory(category: AcademyCategory | string | undefined): string {
    if (!category) {
      return '-';
    }
    if (typeof category === 'string') {
      return category;
    }
    return category.name || '-';
  }

  formatAcademy(academy: Academy | string | undefined): string {
    if (!academy) {
      return '-';
    }
    if (typeof academy === 'string') {
      return academy;
    }
    return academy.academyName || '-';
  }

  isPlayerProfileComplete(player: Player): boolean {
    return this.hasValue(player.fullName)
      && this.hasValue(player.birthDate)
      && this.hasValue(player.academy)
      && this.hasValue(player.category)
      && this.hasValue(player.registerNumber)
      && this.hasNumber(player.heightCm)
      && this.hasNumber(player.weightKg)
      && this.hasValue(player.fatherName)
      && this.hasValue(player.motherName);
  }

  private hasValue(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const normalized = value.trim();
    return !!normalized && normalized !== '-';
  }

  private hasNumber(value: unknown): boolean {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
  }

  getPhotoUrl(player: Player): string {
    return player.photo || '';
  }

  // Action handlers for player cards
  openPlayer(player: Player): void {
    this.viewPlayer(player);
  }

  edit(player: Player): void {
    this.editPlayer(player);
  }

  remove(player: Player): void {
    this.deletePlayer(player);
  }
}