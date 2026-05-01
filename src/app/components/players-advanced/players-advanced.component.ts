import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerService, Player, Academy, AcademyCategory, PlayerPayload } from '../../services/player.service';
import { AcademyService } from '../../services/academy.service';
import { AuthService } from '../../services/auth.service';
import { FeatureAccessService } from '../../services/feature-access.service';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../environments/environment';

// Angular Material - only for icons in modals
import { MatIconModule } from '@angular/material/icon';

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
  selector: 'app-players-advanced',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule
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

  // Form state for editing
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

  // Academies and categories for edit form
  editFormAcademies = signal<Academy[]>([]);
  editFormCategories = signal<AcademyCategory[]>([]);
  loadingEditFormAcademies = signal(false);
  loadingEditFormCategories = signal(false);

  viewedPlayer = signal<Player | null>(null);
  photoLoadError = signal(false);

  editingPlayer = signal<Player | null>(null);
  deletingPlayer = signal<Player | null>(null);
  showEditPlayerDialog = signal(false);
  showDeletePlayerDialog = signal(false);
  showCreatePlayerDialog = signal(false);
  showPhotoViewer = signal(false);
  showViewPhotoViewer = signal(false);

  constructor(
    private router: Router,
    private playerService: PlayerService,
    private academyService: AcademyService,
    private authService: AuthService,
    private featureAccessService: FeatureAccessService,
    private notificationService: NotificationService
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

  /** Called when a player's photo fails to load */
  onPhotoError(): void {
    this.photoLoadError.set(true);
  }

  /** Returns the initials of a player's name */
  getInitials(player: Player): string {
    return player.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'P';
  }

  /** Formats a birth date string into a readable format */
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

  /** Formats height in centimeters */
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

  /** Formats category name */
  formatCategory(category: AcademyCategory | string | undefined): string {
    if (!category) {
      return '-';
    }
    if (typeof category === 'string') {
      return category;
    }
    return category.name || '-';
  }

  /** Formats academy name */
  formatAcademy(academy: Academy | string | undefined): string {
    if (!academy) {
      return '-';
    }
    if (typeof academy === 'string') {
      return academy;
    }
    return academy.academyName || '-';
  }

  /** Determines if a player profile has all required fields filled */
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

  can(actionKey: string): boolean {
    const user = this.authService.getCurrentUser();
    return this.featureAccessService.hasAccess(user, actionKey);
  }

  openPlayer(player: Player): void {
    this.viewedPlayer.set(player);
    this.photoLoadError.set(false);
  }

  edit(player: Player): void {
    const academyId = Number(player.academyId) || null;
    const categoryId = Number(player.categoryId) || null;

    this.editingPlayer.set(player);
    this.error.set(null); // Reset error when opening edit modal
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

    // Load academies and categories for edit form
    this.loadEditFormAcademies();
    if (academyId) {
      this.loadEditFormCategories(academyId, categoryId || undefined);
    } else {
      this.editFormCategories.set([]);
    }

    this.showEditPlayerDialog.set(true);
  }

  remove(player: Player): void {
    this.deletingPlayer.set(player);
    this.showDeletePlayerDialog.set(true);
  }

  closeEditPlayerDialog(): void {
    this.showEditPlayerDialog.set(false);
    this.error.set(null); // Reset error when closing modal
    this.resetForm();
    this.editingPlayer.set(null);
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
        this.notificationService.showSuccess('Player deleted successfully');
        if (this.viewedPlayer()?.id === player.id) {
          this.closeViewer();
        }
        this.closeDeletePlayerDialog();
        this.search(); // Refresh the search results
      },
      error: () => {
        this.error.set('Failed to delete player');
        this.closeDeletePlayerDialog();
      }
    });
  }

  resetForm(): void {
    this.editingPlayer.set(null);
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
    this.editFormCategories.set([]);
  }

  updateField<K extends keyof PlayerFormState>(field: K, value: PlayerFormState[K]): void {
    console.log(`Updating field ${field}:`, value);
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  updateNumberField(field: 'heightCm' | 'weightKg', value: string | number): void {
    const numericValue = Number(value) || 0;
    this.form.update((current) => ({ ...current, [field]: numericValue }));
  }

  loadEditFormAcademies(): void {
    this.loadingEditFormAcademies.set(true);
    this.editFormAcademies.set([]);

    this.academyService.getAllAcademies().subscribe({
      next: (response) => {
        const academies = response?.academies || response || [];
        this.editFormAcademies.set(Array.isArray(academies) ? academies : []);
        this.loadingEditFormAcademies.set(false);
      },
      error: (err) => {
        console.error('Error loading academies:', err);
        this.editFormAcademies.set([]);
        this.loadingEditFormAcademies.set(false);
      }
    });
  }

  loadEditFormCategories(academyId: number, preferredCategoryId?: number): void {
    this.loadingEditFormCategories.set(true);
    this.editFormCategories.set([]);

    this.academyService.getCategoriesByAcademy(academyId).subscribe({
      next: (response) => {
        const categories = response?.categories || response || [];
        const parsed = Array.isArray(categories) ? categories : [];
        this.editFormCategories.set(parsed);

        const categoryStillValid = parsed.some((item) => item.id === preferredCategoryId);
        this.form.update((current) => ({
          ...current,
          categoryId: categoryStillValid ? preferredCategoryId ?? null : null
        }));

        this.loadingEditFormCategories.set(false);
      },
      error: (err) => {
        console.error('Error loading categories:', err);
        this.editFormCategories.set([]);
        this.loadingEditFormCategories.set(false);
      }
    });
  }

  onEditFormAcademyChange(value: string | number): void {
    const academyId = Number(value);
    if (!academyId || Number.isNaN(academyId)) {
      this.form.update((current) => ({ ...current, academyId: null, categoryId: null }));
      this.editFormCategories.set([]);
      return;
    }

    this.form.update((current) => ({ ...current, academyId, categoryId: null }));
    this.loadEditFormCategories(academyId);
  }

  onEditFormCategoryChange(value: string | number): void {
    const categoryId = Number(value);
    this.form.update((current) => ({
      ...current,
      categoryId: !categoryId || Number.isNaN(categoryId) ? null : categoryId
    }));
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

  openPhotoViewer(): void {
    if (this.form().photo) {
      this.showPhotoViewer.set(true);
    }
  }

  closePhotoViewer(): void {
    this.showPhotoViewer.set(false);
  }

  openViewPhotoViewer(): void {
    if (this.viewedPlayer()?.photo && !this.photoLoadError()) {
      this.showViewPhotoViewer.set(true);
    }
  }

  closeViewPhotoViewer(): void {
    this.showViewPhotoViewer.set(false);
  }

  onBirthDateChange(value: Date | string | null): void {
    if (!value) {
      this.updateField('birthDate', '');
      return;
    }

    // Convert Date to string format
    if (value instanceof Date) {
      const dateStr = value.toISOString().split('T')[0];
      this.updateField('birthDate', dateStr);
    } else {
      this.updateField('birthDate', value);
    }
  }

  submit(): void {
    if (!this.can('player_edit')) {
      this.error.set('Access denied for editing players');
      this.notificationService.showError('Access denied for editing players');
      return;
    }

    this.error.set(null);

    const form = this.form();

    // Debug logging
    console.log('Form data:', form);
    console.log('Validation check:', {
      fullName: !!form.fullName,
      registerNumber: !!form.registerNumber,
      academyId: !!form.academyId,
      categoryId: !!form.categoryId
    });

    if (!form.fullName || !form.registerNumber) {
      this.error.set('Full name and register number are required');
      this.notificationService.showError('Full name and register number are required');
      return;
    }

    if (!form.academyId || !form.categoryId) {
      this.error.set('Academy and category are required');
      this.notificationService.showError('Academy and category are required');
      return;
    }

    const editing = this.editingPlayer();
    if (!editing) {
      this.error.set('No player selected for editing');
      this.notificationService.showError('No player selected for editing');
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

    console.log('Submitting payload:', payload);

    this.playerService.updatePlayer(editing.id, payload).subscribe({
      next: () => {
        this.notificationService.showSuccess('Player updated successfully');
        this.closeEditPlayerDialog();
        this.search(); // Refresh the search results
      },
      error: (err) => {
        console.error('Error updating player:', err);

        // Check for specific error message about register number
        const errorMessage = err?.error?.message || err?.message || 'Failed to update player';

        if (errorMessage.includes('numéro d\'inscription existe déjà') ||
            errorMessage.includes('numéro d\'enregistrement existe déjà') ||
            errorMessage.includes('register number already exists') ||
            errorMessage.includes('inscription exists')) {
          this.error.set(errorMessage);
          this.notificationService.showError(errorMessage);
        } else {
          this.error.set('Failed to update player');
          this.notificationService.showError('Failed to update player');
        }
      }
    });
  }

  closeViewer(): void {
    this.viewedPlayer.set(null);
  }

  getPhotoUrl(player: Player): string {
    return player.photo || '';
  }

  /** Handle academy selection change */
  onAcademyChange(academyId: string): void {
    this.academyId.set(academyId);
    this.categoryId.set(''); // Reset category when academy changes
    this.loadCategories(); // Load categories for the selected academy
    // Don't auto-search on academy change to avoid conflicts
  }

  /** Trigger search based on current filter signals */
  search(): void {
    this.loading.set(true);
    this.error.set(null);
    // Ensure players is initialized as an array
    this.players.set([]);

    const filters: Record<string, any> = {};
    if (this.name().trim()) filters['name'] = this.name().trim();
    if (this.categoryId()) filters['categoryId'] = this.categoryId();
    if (this.academyId()) filters['academyId'] = this.academyId();
    if (this.birthDate()) filters['birthDate'] = this.birthDate();
    if (this.heightCm()) filters['heightCm'] = this.heightCm();
    if (this.weightKg()) filters['weightKg'] = this.weightKg();
    if (this.createdAt()) filters['createdAt'] = this.createdAt();

    this.playerService.searchAdvanced(filters).subscribe({
      next: (response) => {
        // Extract players from response structure and normalize
        const players = response?.players || response || [];
        this.players.set(this.normalizePlayers(players));
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
      error: (err) => {
        this.error.set(err?.message || 'Error searching players');
        this.players.set([]);
        this.loading.set(false);
      }
    });
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

  /** Navigate back to previous view or home */
  back(): void {
    this.router.navigate(['/home/players']);
  }
}
