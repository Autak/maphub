/**
 * API service layer — wraps all fetch() calls to the backend.
 * JWT token is stored in localStorage and sent as a Bearer header.
 */

const API_BASE = '/api';

function getToken(): string | null {
    return localStorage.getItem('token');
}

export function setToken(token: string) {
    localStorage.setItem('token', token);
}

export function clearToken() {
    localStorage.removeItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Request failed: ${res.status}`);
    }

    return res.json();
}

// ───── AUTH ─────

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    bio: string;
    avatarUrl: string;
    color: string;
    joinedAt: number;
    bookmarks: string[];
}

export interface LoginResponse {
    token: string;
    user: AuthUser;
}

export interface RegisterResponse {
    message: string;
    autoVerified: boolean;
}

export const api = {
    // Auth
    register: (data: { username: string; email: string; password: string }) =>
        request<RegisterResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
        request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    getMe: () =>
        request<AuthUser>('/auth/me'),

    updateProfile: (data: { username?: string; bio?: string; avatarUrl?: string }) =>
        request<AuthUser>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

    // Trips
    getTrips: () =>
        request<any[]>('/trips'),

    createTrip: (data: any) =>
        request<any>('/trips', { method: 'POST', body: JSON.stringify(data) }),

    deleteTrip: (id: string) =>
        request<any>(`/trips/${id}`, { method: 'DELETE' }),

    toggleVisibility: (id: string) =>
        request<any>(`/trips/${id}/visibility`, { method: 'PATCH' }),

    updateTrip: (id: string, data: any) =>
        request<any>(`/trips/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    likeTrip: (id: string) =>
        request<any>(`/trips/${id}/like`, { method: 'POST' }),

    // Locations
    getLocations: () =>
        request<any[]>('/locations'),

    createLocation: (data: any) =>
        request<any>('/locations', { method: 'POST', body: JSON.stringify(data) }),

    deleteLocation: (id: string) =>
        request<any>(`/locations/${id}`, { method: 'DELETE' }),

    updateLocation: (id: string, data: any) =>
        request<any>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Users
    getUsers: () =>
        request<AuthUser[]>('/users'),
};
