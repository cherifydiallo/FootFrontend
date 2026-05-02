import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Player, PlayerPayload, PlayerService } from '../../services/player.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { FeatureAccessService } from '../../services/feature-access.service';
import { NotificationService } from '../../services/notification.service';
import { Academy, AcademyCategory, AcademyService } from '../../services/academy.service';
import { MatIconModule } from '@angular/material/icon';
import { PlayerViewerEditComponent } from '../player-viewer-edit/player-viewer-edit.component';

interface PlayerFormState {
  fullName: string;
  birthDate: string;
  academyId: number | null;
  categoryId: number | null;
  registerNumber: string;
  heightCm: number;
  weightKg: number;
  fatherName: string;
  motherName: string;
  photo: string;
}

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PlayerViewerEditComponent],
  templateUrl: './players.component.html',
  styleUrls: ['./players.component.scss']
})
export class PlayersComponent implements OnInit {
  players = signal<Player[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  hasSearched = signal(false);
  showCreatePlayerDialog = signal(false);
  showAdvancedSearchDialog = signal(false);
  registerSearch = signal('');
  idSearch = signal('');
  advancedSearchName = signal('');
  advancedSearchCategoryId = signal('');
  advancedSearchBirthDate = signal('');
  advancedSearchHeightCm = signal('');
  advancedSearchWeightKg = signal('');
  advancedSearchCreatedAt = signal('');

  // Shared component state
  selectedPlayer = signal<Player | null>(null);
  triggerView = signal(false);
  triggerEdit = signal(false);
  triggerDelete = signal(false);

  form = signal<PlayerFormState>({
    fullName: '',
    birthDate: '',
    academyId: null,
    categoryId: null,
    registerNumber: '',
    heightCm: 0,
    weightKg: 0,
    fatherName: '',
    motherName: '',
    photo: ''
  });

  academies = signal<Academy[]>([]);
  categories = signal<AcademyCategory[]>([]);
  loadingAcademies = signal(false);
  loadingCategories = signal(false);

  constructor(
    private playerService: PlayerService,
    private academyService: AcademyService,
    private authService: AuthService,
    private router: Router,
    private featureAccessService: FeatureAccessService,
    private notificationService: NotificationService
  ) {}

  updateField<K extends keyof PlayerFormState>(field: K, value: PlayerFormState[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  updateNumberField(field: 'heightCm' | 'weightKg', value: string | number): void {
    const numericValue = Number(value) || 0;
    this.form.update((current) => ({ ...current, [field]: numericValue }));
  }

  ngOnInit(): void {
    if (!this.can('player_read')) {
      this.router.navigate(['/home']);
      return;
    }

    // Don't load players automatically - only load when searching
    this.loadAcademies();
  }

  can(actionKey: string): boolean {
    return this.featureAccessService.hasAccess(this.authService.getCurrentUser(), actionKey);
  }

  loadPlayers(): void {
    this.error.set(null);
    this.loading.set(true);
    this.playerService.getAllPlayers().subscribe({
      next: (response) => {
        const list = response?.players || response || [];
        this.players.set(this.normalizePlayers(list));
        this.error.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load players');
        this.loading.set(false);
      }
    });
  }

  loadAcademies(): void {
    this.loadingAcademies.set(true);
    this.academyService.getAllAcademies().subscribe({
      next: (response) => {
        const academies = response?.academies || response || [];
        this.academies.set(Array.isArray(academies) ? academies : []);
        this.loadingAcademies.set(false);
      },
      error: () => {
        this.loadingAcademies.set(false);
        this.error.set('Failed to load academies');
      }
    });
  }

  loadCategories(academyId: number, preferredCategoryId?: number): void {
    this.loadingCategories.set(true);
    this.categories.set([]);

    this.academyService.getCategoriesByAcademy(academyId).subscribe({
      next: (response) => {
        const categories = response?.categories || response || [];
        const parsed = Array.isArray(categories) ? categories : [];
        this.categories.set(parsed);

        const categoryStillValid = parsed.some((item) => item.id === preferredCategoryId);
        this.form.update((current) => ({
          ...current,
          categoryId: categoryStillValid ? preferredCategoryId ?? null : null
        }));

        this.loadingCategories.set(false);
      },
      error: () => {
        this.loadingCategories.set(false);
        this.categories.set([]);
        this.error.set('Failed to load categories for this academy');
      }
    });
  }

  onAcademyChange(value: string | number): void {
    const academyId = Number(value);
    if (!academyId || Number.isNaN(academyId)) {
      this.form.update((current) => ({ ...current, academyId: null, categoryId: null }));
      this.categories.set([]);
      return;
    }

    this.form.update((current) => ({ ...current, academyId, categoryId: null }));
    this.loadCategories(academyId);
  }

  onCategoryChange(value: string | number): void {
    const categoryId = Number(value);
    this.form.update((current) => ({
      ...current,
      categoryId: !categoryId || Number.isNaN(categoryId) ? null : categoryId
    }));
  }

  onSearch(): void {
    this.error.set(null);
    this.hasSearched.set(true);
    const value = this.registerSearch().trim();
    if (!value) {
      this.players.set([]);
      return;
    }

    this.loading.set(true);
    this.playerService.searchByRegisterNumber(value).subscribe({
      next: (response) => {
        const player = this.normalizePlayer(response?.player || response);
        this.players.set(player ? [player] : []);
        this.error.set(null);
        this.loading.set(false);

        // Show notification if no player found
        if (!player) {
          this.notificationService.show('Pas de joueurs trouvés', 'info', 3000);
        }

        // Auto-scroll to results if players are found
        if (player) {
          setTimeout(() => {
            const resultsElement = document.getElementById('player-results');
            if (resultsElement) {
              resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      },
      error: () => {
        this.players.set([]);
        this.error.set('No player found for this register number');
        this.loading.set(false);
      }
    });
  }

  clearResults(): void {
    this.players.set([]);
    this.hasSearched.set(false);
    this.error.set(null);
  }

  // Shared component handlers
  onPlayerDeleted(player: Player): void {
    this.loadPlayers();
  }

  onPlayerUpdated(player: Player): void {
    this.loadPlayers();
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

  getInitials(player: Player): string {
    return player.fullName
      .split(' ')
      .filter((part) => part)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'P';
  }

  resetForm(): void {
    this.success.set(null);
    this.error.set(null);
    this.form.set({
      fullName: '',
      birthDate: '',
      academyId: null,
      categoryId: null,
      registerNumber: '',
      heightCm: 0,
      weightKg: 0,
      fatherName: '',
      motherName: '',
      photo: ''
    });
    this.categories.set([]);
  }

  submit(): void {
    if (!this.can('player_write')) {
      this.error.set('Access denied for creating players');
      return;
    }

    this.error.set(null);
    this.success.set(null);

    const form = this.form();
    if (!form.fullName || !form.registerNumber) {
      this.error.set('Full name and register number are required');
      return;
    }

    if (!form.academyId || !form.categoryId) {
      this.error.set('Academy and category are required');
      return;
    }

    const payload: PlayerPayload = {
      fullName: form.fullName,
      birthDate: form.birthDate,
      academyId: form.academyId,
      categoryId: form.categoryId,
      registerNumber: form.registerNumber,
      heightCm: form.heightCm,
      weightKg: form.weightKg,
      fatherName: form.fatherName,
      motherName: form.motherName,
      photo: form.photo?.trim() ? form.photo : null
    };

    this.playerService.createPlayer(payload).subscribe({
      next: () => {
        this.success.set('Player created successfully');
        this.notificationService.showSuccess('Player created successfully');
        this.closeCreatePlayerDialog();
        this.loadPlayers();
      },
      error: () => this.error.set('Failed to create player')
    });
  }

  openCreatePlayerDialog(): void {
    this.resetForm();
    this.loadAcademies();
    this.showCreatePlayerDialog.set(true);
  }

  closeCreatePlayerDialog(): void {
    this.showCreatePlayerDialog.set(false);
    this.resetForm();
  }

  openAdvancedSearchDialog(): void {
    this.advancedSearchName.set('');
    this.advancedSearchCategoryId.set('');
    this.advancedSearchBirthDate.set('');
    this.advancedSearchHeightCm.set('');
    this.advancedSearchWeightKg.set('');
    this.advancedSearchCreatedAt.set('');
    this.loadAcademies();
    this.showAdvancedSearchDialog.set(true);
  }

  closeAdvancedSearchDialog(): void {
    this.showAdvancedSearchDialog.set(false);
  }

  goToAdvancedSearch(): void {
    this.router.navigate(['/home', 'players', 'advanced-search']).then((ok) => {
      if (!ok) {
        console.warn('Router.navigate returned false, falling back to location change');
        try {
          window.location.href = '/home/players/advanced-search';
        } catch (e) {
          console.error('Navigation fallback failed', e);
        }
      }
    }).catch((err) => {
      console.error('Router.navigate error', err);
      try {
        window.location.href = '/home/players/advanced-search';
      } catch (e) {
        console.error('Navigation fallback failed', e);
      }
    });
  }

  advancedSearch(): void {
    this.error.set(null);
    const params: Record<string, string> = {};

    const name = this.advancedSearchName().trim();
    if (name) {
      if (name.length < 3) {
        this.error.set('Le nom doit contenir au moins 3 caractères pour la recherche');
        return;
      }
      params['name'] = name;
    }

    const categoryId = String(this.advancedSearchCategoryId()).trim();
    if (categoryId) params['categoryId'] = categoryId;

    const birthDate = String(this.advancedSearchBirthDate()).trim();
    if (birthDate) params['birthDate'] = birthDate;

    const height = String(this.advancedSearchHeightCm()).trim();
    if (height) params['heightCm'] = height;

    const weight = String(this.advancedSearchWeightKg()).trim();
    if (weight) params['weightKg'] = weight;

    const createdAt = String(this.advancedSearchCreatedAt()).trim();
    if (createdAt) params['createdAt'] = createdAt;

    if (Object.keys(params).length === 0) {
      this.loadPlayers();
      this.closeAdvancedSearchDialog();
      return;
    }

    this.loading.set(true);
    this.playerService.searchAdvanced(params).subscribe({
      next: (response) => {
        const list = response?.players || response || [];
        this.players.set(this.normalizePlayers(list));
        this.loading.set(false);
        this.showAdvancedSearchDialog.set(false);

        // Auto-scroll to results if players are found
        if (list.length > 0) {
          setTimeout(() => {
            const resultsElement = document.getElementById('player-results');
            if (resultsElement) {
              resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      },
      error: () => {
        this.error.set('Failed to perform advanced search');
        this.loading.set(false);
      }
    });
  }

  // Photo handling for create player
  showPhotoViewer = signal(false);

  openPhotoViewer(): void {
    if (this.form().photo) {
      this.showPhotoViewer.set(true);
    }
  }

  closePhotoViewer(): void {
    this.showPhotoViewer.set(false);
  }

  onPhotoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.updateField('photo', reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  private normalizePlayers(list: any): Player[] {
    if (!Array.isArray(list)) {
      return [];
    }

    return list
      .map((item) => this.normalizePlayer(item))
      .filter((player): player is Player => !!player);
  }

  private normalizePlayer(raw: any): Player | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const academyObject = raw.academy && typeof raw.academy === 'object' ? raw.academy : null;
    const categoryObject = raw.category && typeof raw.category === 'object' ? raw.category : null;

    return {
      ...raw,
      academyId: Number(raw.academyId ?? academyObject?.id) || undefined,
      categoryId: Number(raw.categoryId ?? categoryObject?.id) || undefined,
      academy: this.extractDisplayLabel(raw.academy, ['academyName', 'name', 'label']),
      category: this.extractDisplayLabel(raw.category, ['name', 'categoryName', 'label'])
    } as Player;
  }

  private extractDisplayLabel(value: unknown, preferredKeys: string[]): string {
    if (typeof value === 'string') {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return '-';
    }

    const record = value as Record<string, unknown>;
    for (const key of preferredKeys) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }

    const fallback = Object.values(record).find((entry) => typeof entry === 'string' && entry.trim());
    return typeof fallback === 'string' ? fallback : '-';
  }
}
