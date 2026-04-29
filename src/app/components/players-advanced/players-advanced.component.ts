import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerService, Player } from '../../services/player.service';
import { AcademyService, Academy, AcademyCategory } from '../../services/academy.service';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-players-advanced',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
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

  // Player viewer signals
  viewedPlayer = signal<Player | null>(null);
  photoLoadError = signal(false);

  constructor(private playerService: PlayerService, private academyService: AcademyService, private router: Router) {}

  ngOnInit(): void {
    this.loadAcademies();
  }

  loadAcademies(): void {
    this.loadingAcademies.set(true);
    this.academyService.getAllAcademies().subscribe({
      next: (resp) => {
        const academies = resp?.academies || resp || [];
        this.academies.set(Array.isArray(academies) ? academies : []);
        // aggregate categories from all academies by default
        const cats: AcademyCategory[] = [];
        if (Array.isArray(academies)) {
          for (const a of academies) {
            if (Array.isArray((a as any).categories)) {
              for (const c of (a as any).categories) {
                cats.push(c as AcademyCategory);
              }
            }
          }
        }
        this.categories.set(cats);
        this.loadingAcademies.set(false);
      },
      error: () => {
        this.loadingAcademies.set(false);
      }
    });
  }

  onAcademyChange(value: string | number): void {
    const academyId = Number(value);
    if (!academyId || Number.isNaN(academyId)) {
      // show all categories when no academy selected
      this.academyId.set('');
      this.loadAcademies();
      return;
    }

    this.academyId.set(String(academyId));
    this.loadingCategories.set(true);
    this.academyService.getCategoriesByAcademy(academyId).subscribe({
      next: (resp) => {
        const categories = resp?.categories || resp || [];
        this.categories.set(Array.isArray(categories) ? categories : []);
        this.loadingCategories.set(false);
      },
      error: () => {
        this.loadingCategories.set(false);
      }
    });
  }

  back(): void {
    this.router.navigate(['/home', 'players']);
  }

  search(): void {
    this.error.set(null);
    const params: Record<string, string> = {};
    const n = this.name().trim();
    if (n) {
      if (n.length < 3) {
        this.error.set('Le nom doit contenir au moins 3 caractères pour la recherche');
        return;
      }
      params['name'] = n;
    }

    const cid = String(this.categoryId()).trim();
    if (cid) params['categoryId'] = cid;

    const aid = String(this.academyId()).trim();
    if (aid) params['academyId'] = aid;

    const bd = String(this.birthDate()).trim();
    if (bd) params['birthDate'] = bd;

    const h = String(this.heightCm()).trim();
    if (h) params['heightCm'] = h;

    const w = String(this.weightKg()).trim();
    if (w) params['weightKg'] = w;

    const ca = String(this.createdAt()).trim();
    if (ca) params['createdAt'] = ca;

    if (Object.keys(params).length === 0) {
      this.error.set('Please provide at least one search criterion');
      return;
    }

    this.loading.set(true);
    this.playerService.searchAdvanced(params).subscribe({
      next: (resp) => {
        const list = resp?.players || resp || [];
        // Normalize each player so academy and category are displayed as strings
        const normalized = Array.isArray(list)
          ? list.map((p) => this.normalizePlayer(p as any))
          : [];
        this.players.set(normalized);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to perform advanced search');
        this.loading.set(false);
      }
    });
  }

  openPlayer(player: Player): void {
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

  private normalizePlayer(raw: any): Player {
    if (!raw || typeof raw !== 'object') {
      return raw as Player;
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
