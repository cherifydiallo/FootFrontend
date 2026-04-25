import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Player, PlayerPayload, PlayerService } from '../../services/player.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { FeatureAccessService } from '../../services/feature-access.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './players.component.html',
  styleUrl: './players.component.scss'
})
export class PlayersComponent implements OnInit {
  players = signal<Player[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  showDeletePlayerDialog = signal(false);
  deletingPlayer = signal<Player | null>(null);
  registerSearch = signal('');
  idSearch = signal('');
  editingPlayer = signal<Player | null>(null);
  viewedPlayer = signal<Player | null>(null);
  photoLoadError = signal(false);

  form = signal<PlayerPayload>({
    fullName: '',
    birthDate: '',
    academy: '',
    category: '',
    registerNumber: '',
    heightCm: 0,
    weightKg: 0,
    fatherName: '',
    motherName: '',
    photo: ''
  });

  constructor(
    private playerService: PlayerService,
    private authService: AuthService,
    private router: Router,
    private featureAccessService: FeatureAccessService,
    private notificationService: NotificationService
  ) {}

  updateField<K extends keyof PlayerPayload>(field: K, value: PlayerPayload[K]): void {
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
  }

  can(actionKey: string): boolean {
    return this.featureAccessService.hasAccess(this.authService.getCurrentUser(), actionKey);
  }

  loadPlayers(): void {
    this.loading.set(true);
    this.playerService.getAllPlayers().subscribe({
      next: (response) => {
        this.players.set(response?.players || response || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load players');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    const value = this.registerSearch().trim();
    if (!value) {
      this.loadPlayers();
      return;
    }

    this.loading.set(true);
    this.playerService.searchByRegisterNumber(value).subscribe({
      next: (response) => {
        const player = response?.player || response;
        this.players.set(player ? [player] : []);
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
        const player = response?.player || response;
        this.players.set(player ? [player] : []);
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
    this.editingPlayer.set(player);
    this.form.set({
      fullName: player.fullName,
      birthDate: player.birthDate,
      academy: player.academy,
      category: player.category,
      registerNumber: player.registerNumber,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      fatherName: player.fatherName,
      motherName: player.motherName,
      photo: player.photo || ''
    });
  }

  resetForm(): void {
    this.editingPlayer.set(null);
    this.error.set(null);
    this.success.set(null);
    this.form.set({
      fullName: '',
      birthDate: '',
      academy: '',
      category: '',
      registerNumber: '',
      heightCm: 0,
      weightKg: 0,
      fatherName: '',
      motherName: '',
      photo: ''
    });
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

    const payload = this.form();
    if (!payload.fullName || !payload.registerNumber) {
      this.error.set('Full name and register number are required');
      return;
    }

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
        this.resetForm();
        this.loadPlayers();
      },
      error: () => this.error.set('Failed to create player')
    });
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
}
