import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { provideFirebase } from './firebase.providers';

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

const firebaseConfig = {
  apiKey: 'AIzaSyDihm0_8iGOEY7QL0V145K-U1eOU-6XXcE',
  authDomain: 'cifras-9c3b7.firebaseapp.com',
  projectId: 'cifras-9c3b7',
  storageBucket: 'cifras-9c3b7.firebasestorage.app',
  messagingSenderId: '91417786166',
  appId: '1:91417786166:web:87722215ac7f5e8506e597',
  measurementId: 'G-RL1TFP1R06',
};

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
    provideFirebase(firebaseConfig),

    // ── Repositories ───────────────────────────────────────────────
    { provide: CifraRepository, useClass: CifraFirebaseRepository },
    { provide: ListaRepository, useClass: ListaFirebaseRepository },
    { provide: AcordeRepository, useClass: AcordeFirebaseRepository },
    { provide: AuthRepository, useClass: AuthFirebaseRepository },
    { provide: ConfigRepository, useClass: ConfigFirebaseRepository },
  ],
};
