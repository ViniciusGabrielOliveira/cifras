import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, FirebaseOptions, initializeApp, getApp } from 'firebase/app';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FirebaseApp');

export function provideFirebase(config: FirebaseOptions) {
  return makeEnvironmentProviders([
    {
      provide: FIREBASE_APP,
      useFactory: () => initializeApp(config),
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
