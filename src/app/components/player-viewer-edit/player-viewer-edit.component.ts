import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Player, PlayerPayload, PlayerService } from '../../services/player.service';
import { Academy, AcademyCategory, AcademyService } from '../../services/academy.service';
import { NotificationService } from '../../services/notification.service';
import { MatIconModule } from '@angular/material/icon';

interface PlayerFormState {
  fullName: string;
  birthDate: string;
  academyId: number | undefined;
  categoryId: number | undefined;
  registerNumber: string;
  heightCm: number;
  weightKg: number;
  fatherName: string;
  motherName: string;
  photo: string;
}

@Component({
  selector: 'app-player-viewer-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule
  ],
  templateUrl: './player-viewer-edit.component.html',
  styleUrls: ['./player-viewer-edit.component.scss']
})
export class PlayerViewerEditComponent {
  // Input signals
  player = input<Player | null>(null);
  canEdit = input<boolean>(false);
  canDelete = input<boolean>(false);
  triggerView = input<boolean>(false);
  triggerEdit = input<boolean>(false);
  triggerDelete = input<boolean>(false);

  // Output signals
  playerDeleted = output<Player>();
  playerUpdated = output<Player>();
  viewerClosed = output<void>();

  // Internal state
  showViewer = signal(false);
  showEditPlayerDialog = signal(false);
  showDeletePlayerDialog = signal(false);
  showPhotoViewer = signal(false);
  showViewPhotoViewer = signal(false);
  photoLoadError = signal(false);

  // Form state
  form = signal<PlayerFormState>({
    fullName: '',
    birthDate: '',
    academyId: undefined,
    categoryId: undefined,
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

  error = signal<string | null>(null);

  constructor(
    private playerService: PlayerService,
    private academyService: AcademyService,
    private notificationService: NotificationService
  ) {
    // Watch for view trigger from parent
    effect(() => {
      if (this.triggerView()) {
        this.showViewer.set(true);
      }
    });

    // Watch for edit trigger from parent
    effect(() => {
      if (this.triggerEdit()) {
        this.edit();
      }
    });

    // Watch for delete trigger from parent
    effect(() => {
      if (this.triggerDelete()) {
        this.remove();
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
      && this.hasAcademyOrCategory(player.academy)
      && this.hasAcademyOrCategory(player.category)
      && this.hasValue(player.registerNumber)
      && this.hasNumber(player.heightCm)
      && this.hasNumber(player.weightKg)
      && this.hasValue(player.fatherName)
      && this.hasValue(player.motherName);
  }

  private hasAcademyOrCategory(value: unknown): boolean {
    if (!value) {
      return false;
    }

    // If it's a string, check if it's not empty or "-"
    if (typeof value === 'string') {
      const normalized = value.trim();
      return !!normalized && normalized !== '-';
    }

    // If it's an object, check if it has required properties
    if (typeof value === 'object') {
      const obj = value as Academy | AcademyCategory;
      // For Academy, check academyName
      if ('academyName' in obj) {
        return !!obj.academyName && obj.academyName.trim() !== '';
      }
      // For AcademyCategory, check name
      if ('name' in obj) {
        return !!obj.name && obj.name.trim() !== '';
      }
    }

    return false;
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

  /** Open edit dialog */
  edit(): void {
    const player = this.player();
    if (!player) {
      return;
    }

    // Extract academyId and categoryId from objects if available
    let academyId: number | undefined = player.academyId;
    let categoryId: number | undefined = player.categoryId;

    // If academyId is not available but academy object is, extract it
    if (!academyId && player.academy && typeof player.academy === 'object') {
      academyId = (player.academy as Academy).id;
    }

    // If categoryId is not available but category object is, extract it
    if (!categoryId && player.category && typeof player.category === 'object') {
      categoryId = (player.category as AcademyCategory).id;
    }

    // Convert to numbers
    academyId = academyId ? Number(academyId) : undefined;
    categoryId = categoryId ? Number(categoryId) : undefined;

    this.error.set(null);
    this.form.set({
      fullName: player.fullName,
      birthDate: player.birthDate,
      academyId: academyId,
      categoryId: categoryId,
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

  /** Open delete confirmation dialog */
  remove(): void {
    if (!this.player()) {
      return;
    }
    this.showDeletePlayerDialog.set(true);
  }

  /** Close edit dialog */
  closeEditPlayerDialog(): void {
    this.showEditPlayerDialog.set(false);
    this.error.set(null);
    this.resetForm();
  }

  /** Close delete confirmation dialog */
  closeDeletePlayerDialog(): void {
    this.showDeletePlayerDialog.set(false);
  }

  /** Confirm delete player */
  confirmDeletePlayer(): void {
    const player = this.player();
    if (!player) {
      return;
    }

    this.playerService.deletePlayer(player.id).subscribe({
      next: () => {
        this.notificationService.showSuccess('Player deleted successfully');
        this.closeDeletePlayerDialog();
        this.playerDeleted.emit(player);
      },
      error: () => {
        this.error.set('Failed to delete player');
        this.closeDeletePlayerDialog();
      }
    });
  }

  /** Reset form to initial state */
  resetForm(): void {
    this.error.set(null);
    this.form.set({
      fullName: '',
      birthDate: '',
      academyId: undefined,
      categoryId: undefined,
      registerNumber: '',
      heightCm: 0,
      weightKg: 0,
      fatherName: '',
      motherName: '',
      photo: ''
    });
    this.editFormCategories.set([]);
  }

  /** Update form field */
  updateField<K extends keyof PlayerFormState>(field: K, value: PlayerFormState[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  /** Update number field */
  updateNumberField(field: 'heightCm' | 'weightKg', value: string | number): void {
    const numericValue = Number(value) || 0;
    this.form.update((current) => ({ ...current, [field]: numericValue }));
  }

  /** Load academies for edit form */
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

  /** Load categories for edit form */
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
          categoryId: categoryStillValid ? preferredCategoryId ?? undefined : undefined
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

  /** Handle academy change in edit form */
  onEditFormAcademyChange(value: string | number): void {
    const academyId = Number(value);
    if (!academyId || Number.isNaN(academyId)) {
      this.form.update((current) => ({ ...current, academyId: undefined, categoryId: undefined }));
      this.editFormCategories.set([]);
      return;
    }

    this.form.update((current) => ({ ...current, academyId, categoryId: undefined }));
    this.loadEditFormCategories(academyId);
  }

  /** Handle category change in edit form */
  onEditFormCategoryChange(value: string | number): void {
    const categoryId = Number(value);
    this.form.update((current) => ({
      ...current,
      categoryId: !categoryId || Number.isNaN(categoryId) ? undefined : categoryId
    }));
  }

  /** Handle photo file selection */
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

  /** Open photo viewer */
  openPhotoViewer(): void {
    if (this.form().photo) {
      this.showPhotoViewer.set(true);
    }
  }

  /** Close photo viewer */
  closePhotoViewer(): void {
    this.showPhotoViewer.set(false);
  }

  /** Open view photo viewer */
  openViewPhotoViewer(): void {
    if (this.player()?.photo && !this.photoLoadError()) {
      this.showViewPhotoViewer.set(true);
    }
  }

  /** Close view photo viewer */
  closeViewPhotoViewer(): void {
    this.showViewPhotoViewer.set(false);
  }

  /** Close player viewer */
  closeViewer(): void {
    this.showViewer.set(false);
    this.viewerClosed.emit();
  }

  /** Handle birth date change */
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

  /** Submit edit form */
  submit(): void {
    const player = this.player();
    if (!player) {
      this.error.set('No player selected for editing');
      this.notificationService.showError('No player selected for editing');
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

    this.playerService.updatePlayer(player.id, payload).subscribe({
      next: () => {
        this.notificationService.showSuccess('Player updated successfully');
        this.closeEditPlayerDialog();
        this.playerUpdated.emit(player);
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
}