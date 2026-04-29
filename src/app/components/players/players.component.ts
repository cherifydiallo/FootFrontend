import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Player, PlayerPayload, PlayerService } from '../../services/player.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { FeatureAccessService } from '../../services/feature-access.service';
import { NotificationService } from '../../services/notification.service';
import { Academy, AcademyCategory, AcademyService } from '../../services/academy.service';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './players.component.html',
  styleUrls: ['./players.component.scss']
})
export class PlayersComponent implements OnInit {
  players = signal<Player[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  showDeletePlayerDialog = signal(false);
  deletingPlayer = signal<Player | null>(null);
  showCreatePlayerDialog = signal(false);
  showEditPlayerDialog = signal(false);
  showAdvancedSearchDialog = signal(false);
  registerSearch = signal('');
  idSearch = signal('');
  advancedSearchName = signal('');
  advancedSearchCategoryId = signal('');
  advancedSearchBirthDate = signal('');
  advancedSearchHeightCm = signal('');
  advancedSearchWeightKg = signal('');
  advancedSearchCreatedAt = signal('');
  editingPlayer = signal<Player | null>(null);
  viewedPlayer = signal<Player | null>(null);
  photoLoadError = signal(false);
  academies = signal<Academy[]>([]);
  categories = signal<AcademyCategory[]>([]);
  loadingAcademies = signal(false);
  loadingCategories = signal(false);

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

    this.loadPlayers();
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
    const value = this.registerSearch().trim();
    if (!value) {
      this.loadPlayers();
      return;
    }

    this.loading.set(true);
    this.playerService.searchByRegisterNumber(value).subscribe({
      next: (response) => {
        const player = this.normalizePlayer(response?.player || response);
        this.players.set(player ? [player] : []);
        this.error.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.players.set([]);
        this.error.set('No player found for this register number');
        this.loading.set(false);
      }
    });
  }

  searchById(): void {
    this.error.set(null);
    const id = Number(this.idSearch().trim());
    if (!id) {
      this.error.set('Please enter a valid player id');
      return;
    }

    this.loading.set(true);
    this.playerService.getPlayerById(id).subscribe({
      next: (response) => {
        const player = this.normalizePlayer(response?.player || response);
        this.players.set(player ? [player] : []);
        this.error.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.players.set([]);
        this.error.set('Player not found');
        this.loading.set(false);
      }
    });
  }

  edit(player: Player): void {
    const academyId = Number(player.academyId) || null;
    const categoryId = Number(player.categoryId) || null;

    this.editingPlayer.set(player);
    this.form.set({
      fullName: player.fullName,
      birthDate: player.birthDate,
      academyId,
      categoryId,
      registerNumber: player.registerNumber,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      fatherName: player.fatherName,
      motherName: player.motherName,
      photo: player.photo || ''
    });

    if (academyId) {
      this.loadCategories(academyId, categoryId || undefined);
    } else {
      this.categories.set([]);
    }

    // open edit modal
    this.showEditPlayerDialog.set(true);
  }

  openEditPlayerDialog(player: Player): void {
    this.edit(player);
    // edit() already opens the dialog by setting showEditPlayerDialog
  }

  closeEditPlayerDialog(): void {
    this.showEditPlayerDialog.set(false);
    this.resetForm();
    this.editingPlayer.set(null);
  }

  resetForm(): void {
    this.editingPlayer.set(null);
    this.error.set(null);
    this.success.set(null);
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
    if (this.editingPlayer() && !this.can('player_edit')) {
      this.error.set('Access denied for editing players');
      return;
    }

    if (!this.editingPlayer() && !this.can('player_write')) {
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

    const editing = this.editingPlayer();
    if (editing) {
      this.playerService.updatePlayer(editing.id, payload).subscribe({
        next: () => {
          this.success.set('Player updated successfully');
          this.notificationService.showSuccess('Player updated successfully');
          this.resetForm();
          this.loadPlayers();
        },
        error: () => this.error.set('Failed to update player')
      });
      return;
    }

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

  openAdvancedSearchDialog(): void {
    // reset advanced search fields
    this.advancedSearchName.set('');
    this.advancedSearchCategoryId.set('');
    this.advancedSearchBirthDate.set('');
    this.advancedSearchHeightCm.set('');
    this.advancedSearchWeightKg.set('');
    this.advancedSearchCreatedAt.set('');
    // ensure categories are loaded for academy/category selection if needed
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

    // If no params provided, just reload players
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
      },
      error: () => {
        this.error.set('Failed to perform advanced search');
        this.loading.set(false);
      }
    });
  }

  closeCreatePlayerDialog(): void {
    this.showCreatePlayerDialog.set(false);
    this.resetForm();
  }

  remove(player: Player): void {
    if (!this.can('player_delete')) {
      this.error.set('Access denied for deleting players');
      return;
    }

    this.deletingPlayer.set(player);
    this.showDeletePlayerDialog.set(true);
  }

  closeDeletePlayerDialog(): void {
    this.showDeletePlayerDialog.set(false);
    this.deletingPlayer.set(null);
  }

  confirmDeletePlayer(): void {
    const player = this.deletingPlayer();
    if (!player) {
      return;
    }

    this.playerService.deletePlayer(player.id).subscribe({
      next: () => {
        this.success.set('Player deleted successfully');
        this.notificationService.showSuccess('Player deleted successfully');
        if (this.viewedPlayer()?.id === player.id) {
          this.closeViewer();
        }
        this.closeDeletePlayerDialog();
        this.loadPlayers();
      },
      error: () => {
        this.error.set('Failed to delete player');
        this.closeDeletePlayerDialog();
      }
    });
  }

  openViewer(player: Player): void {
    this.photoLoadError.set(false);
    this.viewedPlayer.set(player);
  }

  closeViewer(): void {
    this.viewedPlayer.set(null);
    this.photoLoadError.set(false);
  }

  onPhotoError(): void {
    this.photoLoadError.set(true);
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

  getPhotoUrl(player: Player): string {
    return player.photo || '';
  }

  getInitials(player: Player): string {
    return player.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'P';
  }

  formatBirthDate(value: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  formatHeightCm(heightCm: number): string {
    if (!heightCm) {
      return '-';
    }

    const meters = Math.floor(heightCm / 100);
    const centimeters = heightCm % 100;
    return `${meters}m${String(centimeters).padStart(2, '0')}`;
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
