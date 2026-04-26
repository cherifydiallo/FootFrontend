import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Academy {
  id: number;
  academyName: string;
  localite?: string;
  numeroTelephone?: string;
  description?: string;
}

export interface AcademyCategory {
  id: number;
  name: string;
  academyId?: number;
}

export interface CreateAcademyPayload {
  academyName: string;
  localite: string;
  numeroTelephone: string;
  description: string;
}

export interface CreateAcademyCategoryPayload {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AcademyService {
  private apiUrl = `${environment.backendUrl}/academies`;

  constructor(private http: HttpClient) {}

  createAcademy(payload: CreateAcademyPayload): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }

  getAllAcademies(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/all`);
  }

  getAcademyById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  updateAcademy(id: number, payload: CreateAcademyPayload): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, payload);
  }

  deleteAcademy(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  getCategoriesByAcademy(academyId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${academyId}/categories`);
  }

  addCategoryToAcademy(academyId: number, payload: CreateAcademyCategoryPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${academyId}/categories`, payload);
  }

  deleteCategory(categoryId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/categories/${categoryId}`);
  }
}
