import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreateGroupDto {
  name: string;
  description?: string;
}

export interface AddUserToGroupDto {
  userId: number;
  groupId: number;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  createdDate?: string;
  updatedDate?: string;
  memberCount?: number;
}

export interface User {
  id: number;
  identifiant: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  username?: string;
}

export interface FeatureAction {
  key: string;
  label: string;
  description: string;
}

export interface GroupPermissionRow {
  groupId: number;
  actions: string[];
}

export interface GroupPermissionPayload {
  permissions: GroupPermissionRow[];
}

export interface UpsertGroupPermissionDto {
  permissionKey: string;
  enabled: boolean;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private apiUrl = `${environment.backendUrl}/groups`;
  private allGroupsUrl = `${environment.backendUrl}/groups/all`;

  constructor(private http: HttpClient) {}

  /**
   * Create a new group
   */
  createGroup(createGroupDto: CreateGroupDto): Observable<any> {
    return this.http.post<any>(this.apiUrl, createGroupDto);
  }

  /**
   * Get all groups
   */
  getAllGroups(): Observable<any> {
    return this.http.get<any>(this.allGroupsUrl);
  }

  /**
   * Get group by ID
   */
  getGroupById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Update group
   */
  updateGroup(id: number, updateGroupDto: CreateGroupDto): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, updateGroupDto);
  }

  /**
   * Delete group
   */
  deleteGroup(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Add user to group
   */
  addUserToGroup(groupId: number, userId: number): Observable<any> {
    const dto: AddUserToGroupDto = { groupId, userId };
    return this.http.post<any>(`${this.apiUrl}/add-user`, dto);
  }

  /**
   * Remove user from group
   */
  removeUserFromGroup(groupId: number, userId: number): Observable<any> {
    const dto: AddUserToGroupDto = { groupId, userId };
    return this.http.post<any>(`${this.apiUrl}/remove-user`, dto);
  }

  /**
   * Get group members
   */
  getGroupMembers(groupId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${groupId}/members`);
  }

  /**
   * Get group permission matrix
   */
  getGroupPermissions(groupId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${groupId}/permissions`);
  }

  /**
   * Upsert a group permission
   */
  upsertGroupPermission(groupId: number, payload: UpsertGroupPermissionDto): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${groupId}/permissions`, payload);
  }

  /**
   * Delete a group permission
   */
  deleteGroupPermission(groupId: number, permissionKey: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${groupId}/permissions/${encodeURIComponent(permissionKey)}`);
  }
}
