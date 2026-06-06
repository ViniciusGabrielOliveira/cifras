import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, FirebaseOptions, initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FirebaseApp');

const CYPRESS_CONFIG: FirebaseOptions = {
  projectId: 'demo-cifras',
  apiKey: 'demo-key',
  authDomain: 'localhost',
  storageBucket: '',
  messagingSenderId: '0',
  appId: '0',
};

const isCypress = typeof window !== 'undefined' && 'Cypress' in window;

export function provideFirebase(config: FirebaseOptions) {
  return makeEnvironmentProviders([
    {
      provide: FIREBASE_APP,
      useFactory: () => {
        if (getApps().length > 0) return getApp();
        const app = initializeApp(isCypress ? CYPRESS_CONFIG : config);
        const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
        if (isCypress) {
          connectFirestoreEmulator(db, 'localhost', 8080);
          connectAuthEmulator(getAuth(app), 'http://localhost:9099', { disableWarnings: true });
        }
        return app;
      },
    },
  ]);
}

export function fromFirebaseListener<T>(
  subscribe: (
    next: (value: T) => void,
    error: (err: Error) => void
  ) => () => void
): Observable<T> {
  return new Observable<T>((subscriber) => {
    const unsubscribe = subscribe(
      (value) => subscriber.next(value),
      (err) => subscriber.error(err)
    );
    return () => unsubscribe();
  }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
}
