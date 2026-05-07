import { Injectable } from '@angular/core';

const ADMIN_EMAIL = 'admin@cifras.missa';
const ADMIN_PASSWORD = 'missa2025';
const AUTH_KEY = 'cifras_admin_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
    isLogado(): boolean {
        return localStorage.getItem(AUTH_KEY) === '1';
    }

    login(email: string, senha: string): boolean {
        if (email === ADMIN_EMAIL && senha === ADMIN_PASSWORD) {
            localStorage.setItem(AUTH_KEY, '1');
            return true;
        }
        return false;
    }

    logout(): void {
        localStorage.removeItem(AUTH_KEY);
    }
}
