import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePtBR from '@angular/common/locales/pt';

import { provideFirebase } from './firebase.providers';
import { environment } from '../environments/environment';

import { routes } from './app.routes';
import { CifraRepository } from './repositories/cifra.repository.interface';
import { CifraFirebaseRepository } from './repositories/cifra-firebase.repository';
import { ListaRepository } from './repositories/lista.repository.interface';
import { ListaFirebaseRepository } from './repositories/lista-firebase.repository';
import { AcordeRepository } from './repositories/acorde.repository.interface';
import { AcordeFirebaseRepository } from './repositories/acorde-firebase.repository';
import { AuthRepository } from './repositories/auth.repository.interface';
import { AuthFirebaseRepository } from './repositories/auth-firebase.repository';
import { ConfigRepository } from './repositories/config.repository.interface';
import { ConfigFirebaseRepository } from './repositories/config-firebase.repository';

registerLocaleData(localePtBR);

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: LOCALE_ID,
      useValue: 'pt-BR'
    },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),

    // ── Firebase ────────────────────────────────────────────────────
    provideFirebase(environment.firebaseConfig),

    // ── Repositories ───────────────────────────────────────────────
    { provide: CifraRepository, useClass: CifraFirebaseRepository },
    { provide: ListaRepository, useClass: ListaFirebaseRepository },
    { provide: AcordeRepository, useClass: AcordeFirebaseRepository },
    { provide: AuthRepository, useClass: AuthFirebaseRepository },
    { provide: ConfigRepository, useClass: ConfigFirebaseRepository },
  ],
};
