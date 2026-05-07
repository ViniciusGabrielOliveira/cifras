import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { CifraRepository } from './repositories/cifra.repository';
import { CifraMockRepository } from './repositories/cifra-mock.repository';
import { ListaRepository } from './repositories/lista.repository';
import { ListaMockRepository } from './repositories/lista-mock.repository';
import { AcordeRepository } from './repositories/acorde.repository';
import { AcordeMockRepository } from './repositories/acorde-mock.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    { provide: CifraRepository, useClass: CifraMockRepository },
    { provide: ListaRepository, useClass: ListaMockRepository },
    { provide: AcordeRepository, useClass: AcordeMockRepository },
  ],
};
