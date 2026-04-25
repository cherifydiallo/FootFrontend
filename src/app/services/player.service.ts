import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Player {
  id: number;
  fullName: string;
  birthDate: string;
  academy: string;
  category: string;
  registerNumber: string;
  heightCm: number;
  weightKg: number;
  fatherName: string;
  motherName: string;
  photo?: string;
}

export type PlayerPayload = Omit<Player, 'id'>;

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private apiUrl = `${environment.backendUrl}/players`;

  constructor(private http: HttpClient) {}

  createPlayer(payload: PlayerPayload): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }

  getAllPlayers(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/all`);
  }

  getPlayerById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  searchByRegisterNumber(registerNumber: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/search`, {
      params: { registerNumber }
    });
  }

  updatePlayer(id: number, payload: PlayerPayload): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, payload);
  }

  deletePlayer(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
