import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { routes } from './app.routes';
import { CifraRepository } from './repositories/cifra.repository';
import { CifraMockRepository } from './repositories/cifra-mock.repository';
import { ListaRepository } from './repositories/lista.repository';
import { ListaMockRepository } from './repositories/lista-mock.repository';
import { AcordeRepository } from './repositories/acorde.repository';
import { AcordeMockRepository } from './repositories/acorde-mock.repository';
import { AuthRepository } from './repositories/auth.repository';
import { AuthFirebaseRepository } from './repositories/auth-firebase.repository';

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
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),

    // ── Repositories ───────────────────────────────────────────────
    { provide: CifraRepository, useClass: CifraMockRepository },
    { provide: ListaRepository, useClass: ListaMockRepository },
    { provide: AcordeRepository, useClass: AcordeMockRepository },
    { provide: AuthRepository, useClass: AuthFirebaseRepository },
  ],
};
