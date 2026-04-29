import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import {
  Academy,
  AcademyCategory,
  AcademyService,
  CreateAcademyCategoryPayload,
  CreateAcademyPayload
} from '../../services/academy.service';
import { AuthService } from '../../services/auth.service';
import { FeatureAccessService } from '../../services/feature-access.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-academies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './academies.component.html',
  styleUrls: ['./academies.component.scss']
})
export class AcademiesComponent implements OnInit {
  academies = signal<Academy[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  idSearch = signal('');
  showCreateAcademyDialog = signal(false);
  showEditAcademyDialog = signal(false);
  showDeleteAcademyDialog = signal(false);
  editingAcademyId = signal<number | null>(null);
  deletingAcademy = signal<Academy | null>(null);
  selectedAcademyId = signal<number | null>(null);
  categories = signal<AcademyCategory[]>([]);
  loadingCategories = signal(false);
  newCategoryName = signal('');
  createCategoryInput = signal('');
  createCategoryList = signal<string[]>([]);

  form = signal<CreateAcademyPayload>({
    academyName: '',
    localite: '',
    numeroTelephone: '',
    description: ''
  });

  constructor(
    private academyService: AcademyService,
    private authService: AuthService,
    private featureAccessService: FeatureAccessService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.canRead()) {
      this.router.navigate(['/home']);
      return;
    }

    this.loadAcademies();
  }

  canRead(): boolean {
    const user = this.authService.getCurrentUser();
    return this.featureAccessService.hasAccess(user, 'academy_read');
  }

  canCreate(): boolean {
    const user = this.authService.getCurrentUser();
    return this.featureAccessService.hasAccess(user, 'academy_write');
  }

  canEdit(): boolean {
    const user = this.authService.getCurrentUser();
    return this.featureAccessService.hasAccess(user, 'academy_edit');
  }

  canDelete(): boolean {
    const user = this.authService.getCurrentUser();
    return this.featureAccessService.hasAccess(user, 'academy_delete');
  }

  updateField<K extends keyof CreateAcademyPayload>(field: K, value: CreateAcademyPayload[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  openCreateAcademyDialog(): void {
    this.error.set(null);
    this.success.set(null);
    this.form.set({
      academyName: '',
      localite: '',
      numeroTelephone: '',
      description: ''
    });
    this.createCategoryInput.set('');
    this.createCategoryList.set([]);
    this.showCreateAcademyDialog.set(true);
  }

  closeCreateAcademyDialog(): void {
    this.showCreateAcademyDialog.set(false);
  }

  openEditAcademyDialog(academy: Academy): void {
    if (!this.canEdit()) {
      this.error.set('Access denied for academy update');
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.editingAcademyId.set(academy.id);
    this.form.set({
      academyName: academy.academyName || '',
      localite: academy.localite || '',
      numeroTelephone: academy.numeroTelephone || '',
      description: academy.description || ''
    });
    this.showEditAcademyDialog.set(true);
  }

  closeEditAcademyDialog(): void {
    this.showEditAcademyDialog.set(false);
    this.editingAcademyId.set(null);
  }

  openDeleteAcademyDialog(academy: Academy): void {
    if (!this.canDelete()) {
      this.error.set('Access denied for academy deletion');
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.deletingAcademy.set(academy);
    this.showDeleteAcademyDialog.set(true);
  }

  closeDeleteAcademyDialog(): void {
    this.showDeleteAcademyDialog.set(false);
    this.deletingAcademy.set(null);
  }

  loadAcademies(): void {
    this.loading.set(true);
    this.error.set(null);

    this.academyService.getAllAcademies().subscribe({
      next: (response) => {
        const academies = response?.academies || response || [];
        this.academies.set(Array.isArray(academies) ? academies : []);

        const selectedId = this.selectedAcademyId();
        if (selectedId && !this.academies().some((academy) => academy.id === selectedId)) {
          this.selectedAcademyId.set(null);
          this.categories.set([]);
        }

        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load academies');
        this.loading.set(false);
      }
    });
  }

  searchById(): void {
    this.error.set(null);
    const id = Number(this.idSearch().trim());
    if (!id) {
      this.error.set('Please enter a valid academy id');
      return;
    }

    this.loading.set(true);
    this.academyService.getAcademyById(id).subscribe({
      next: (response) => {
        const academy = response?.academy || response;
        this.academies.set(academy ? [academy] : []);
        this.loading.set(false);
      },
      error: () => {
        this.academies.set([]);
        this.error.set('Academy not found');
        this.loading.set(false);
      }
    });
  }

  onAcademySelectForCategories(value: string | number): void {
    const academyId = Number(value);
    if (!academyId || Number.isNaN(academyId)) {
      this.selectedAcademyId.set(null);
      this.categories.set([]);
      return;
    }

    this.selectedAcademyId.set(academyId);
    this.loadCategories();
  }

  loadCategories(): void {
    const academyId = this.selectedAcademyId();
    if (!academyId) {
      this.categories.set([]);
      return;
    }

    this.loadingCategories.set(true);
    this.academyService.getCategoriesByAcademy(academyId).subscribe({
      next: (response) => {
        const categories = response?.categories || response || [];
        this.categories.set(Array.isArray(categories) ? categories : []);
        this.loadingCategories.set(false);
      },
      error: () => {
        this.error.set('Failed to load categories');
        this.loadingCategories.set(false);
      }
    });
  }

  createCategory(): void {
    if (!this.canCreate()) {
      this.error.set('Access denied for category creation');
      return;
    }

    const academyId = this.selectedAcademyId();
    if (!academyId) {
      this.error.set('Please select an academy first');
      return;
    }

    const name = this.newCategoryName().trim();
    if (!name) {
      this.error.set('Category name is required');
      return;
    }

    const payload: CreateAcademyCategoryPayload = { name };
    this.academyService.addCategoryToAcademy(academyId, payload).subscribe({
      next: () => {
        this.notificationService.showSuccess('Category added successfully');
        this.newCategoryName.set('');
        this.loadCategories();
      },
      error: () => {
        this.error.set('Failed to add category');
      }
    });
  }

  deleteCategory(categoryId: number): void {
    if (!this.canCreate()) {
      this.error.set('Access denied for category deletion');
      return;
    }

    this.error.set(null);
    this.success.set(null);

    this.academyService.deleteCategory(categoryId).subscribe({
      next: () => {
        this.notificationService.showSuccess('Category deleted successfully');
        this.success.set('Category deleted successfully');
        this.loadCategories();
      },
      error: () => {
        this.error.set('Failed to delete category');
      }
    });
  }

  addCreateCategoryToList(): void {
    const name = this.createCategoryInput().trim();
    if (!name) {
      return;
    }

    const exists = this.createCategoryList().some((item) => item.toLowerCase() === name.toLowerCase());
    if (exists) {
      this.error.set('This category is already in the creation list');
      return;
    }

    this.error.set(null);
    this.createCategoryList.update((list) => [...list, name]);
    this.createCategoryInput.set('');
  }

  removeCreateCategoryFromList(name: string): void {
    this.createCategoryList.update((list) => list.filter((item) => item !== name));
  }

  createAcademy(): void {
    if (!this.canCreate()) {
      this.error.set('Access denied for academy creation');
      return;
    }

    const payload = this.form();
    const createCategories = this.createCategoryList();
    if (!payload.academyName.trim()) {
      this.error.set('Academy name is required');
      return;
    }

    this.error.set(null);
    this.success.set(null);

    this.academyService.createAcademy(payload).subscribe({
      next: (response) => {
        const academyId = Number(response?.academy?.id) || null;

        const completeCreationFlow = (): void => {
          this.closeCreateAcademyDialog();
          this.form.set({
            academyName: '',
            localite: '',
            numeroTelephone: '',
            description: ''
          });
          this.createCategoryInput.set('');
          this.createCategoryList.set([]);
          if (academyId) {
            this.selectedAcademyId.set(academyId);
            this.loadCategories();
          }
          this.loadAcademies();
        };

        if (!academyId || createCategories.length === 0) {
          this.success.set('Academy created successfully');
          this.notificationService.showSuccess('Academy created successfully');
          completeCreationFlow();
          return;
        }

        const categoryRequests = createCategories.map((name) =>
          this.academyService.addCategoryToAcademy(academyId, { name }).pipe(
            map(() => true),
            catchError(() => of(false))
          )
        );

        forkJoin(categoryRequests).subscribe((results) => {
          const successCount = results.filter((ok) => ok).length;
          const failedCount = results.length - successCount;

          if (failedCount === 0) {
            this.success.set('Academy and categories created successfully');
            this.notificationService.showSuccess('Academy and categories created successfully');
          } else if (successCount === 0) {
            this.success.set('Academy created successfully');
            this.error.set('Academy created, but failed to create categories');
            this.notificationService.showSuccess('Academy created successfully');
          } else {
            this.success.set('Academy created with partial categories');
            this.error.set(`Created ${successCount} categories, ${failedCount} failed`);
            this.notificationService.showSuccess('Academy created with partial categories');
          }

          completeCreationFlow();
        });
      },
      error: () => {
        this.error.set('Failed to create academy');
      }
    });
  }

  updateAcademy(): void {
    if (!this.canEdit()) {
      this.error.set('Access denied for academy update');
      return;
    }

    const academyId = this.editingAcademyId();
    if (!academyId) {
      this.error.set('No academy selected for update');
      return;
    }

    const payload = this.form();
    if (!payload.academyName.trim()) {
      this.error.set('Academy name is required');
      return;
    }

    this.error.set(null);
    this.success.set(null);

    this.academyService.updateAcademy(academyId, payload).subscribe({
      next: () => {
        this.success.set('Academy updated successfully');
        this.notificationService.showSuccess('Academy updated successfully');
        this.closeEditAcademyDialog();
        this.loadAcademies();
      },
      error: () => {
        this.error.set('Failed to update academy');
      }
    });
  }

  deleteAcademy(): void {
    if (!this.canDelete()) {
      this.error.set('Access denied for academy deletion');
      return;
    }

    const academy = this.deletingAcademy();
    if (!academy) {
      return;
    }

    this.error.set(null);
    this.success.set(null);

    this.academyService.deleteAcademy(academy.id).subscribe({
      next: () => {
        this.success.set('Academy deleted successfully');
        this.notificationService.showSuccess('Academy deleted successfully');
        this.closeDeleteAcademyDialog();
        this.loadAcademies();
      },
      error: () => {
        this.error.set('Failed to delete academy');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
