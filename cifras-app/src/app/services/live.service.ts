import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { FIREBASE_APP } from '../firebase.providers';
import { LiveEstado } from '../models/live.model';

@Injectable({ providedIn: 'root' })
export class LiveService {
    private firestore = getFirestore(inject(FIREBASE_APP));

    getEstado(listaId: string): Observable<LiveEstado | null> {
        return new Observable(subscriber => {
            const ref = doc(this.firestore, `listas/${listaId}/live/estado`);
            const unsub = onSnapshot(
                ref,
                snap => subscriber.next(snap.exists() ? (snap.data() as LiveEstado) : null),
                err => subscriber.error(err),
            );
            return () => unsub();
        });
    }

    atualizar(listaId: string, update: Partial<LiveEstado>): Promise<void> {
        const ref = doc(this.firestore, `listas/${listaId}/live/estado`);
        return setDoc(ref, { ...update, atualizadoEm: new Date().toISOString() }, { merge: true });
    }
}
