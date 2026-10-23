import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, map, shareReplay, forkJoin } from 'rxjs';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { FIREBASE_APP } from '../firebase.providers';
import { CalendarioLiturgico, CatalogoLiturgico, ConfigLiturgia, DiaLiturgico } from '../models/liturgia.model';

@Injectable({ providedIn: 'root' })
export class LiturgiaService {
  private http = inject(HttpClient);
  private db = getFirestore(inject(FIREBASE_APP));
  private configRef = doc(this.db, 'config/liturgia');
  private anos = new Map<string, Observable<CalendarioLiturgico>>();
  private configCache?: Observable<ConfigLiturgia>;
  readonly catalogo$ = this.http.get<CatalogoLiturgico>('liturgia/catalogo.json').pipe(shareReplay(1));

  getConfig(): Observable<ConfigLiturgia> {
    return this.configCache ??= from(getDoc(this.configRef)).pipe(
      map(snap => ({ locais: [], ajustes: {}, ...(snap.exists() ? snap.data() : {}) }) as ConfigLiturgia),
      shareReplay(1),
    );
  }

  async salvarConfig(config: ConfigLiturgia): Promise<void> {
    await setDoc(this.configRef, config);
    this.configCache = undefined;
  }

  calendario(ano: string): Observable<CalendarioLiturgico> {
    let resultado = this.anos.get(ano);
    if (!resultado) {
      resultado = this.http.get<CalendarioLiturgico>(`liturgia/${ano}.json`).pipe(shareReplay(1));
      this.anos.set(ano, resultado);
    }
    return resultado;
  }

  opcoesDoDia(data: string): Observable<DiaLiturgico[]> {
    return this.calendario(data.slice(0, 4)).pipe(map(cal => cal.dias[data] ?? []));
  }

  dia(data: string): Observable<DiaLiturgico> {
    return forkJoin([this.opcoesDoDia(data), this.getConfig()]).pipe(map(([dias, config]) => {
      const base = dias[0];
      if (!base) throw new Error('Data fora do calendário disponível.');
      const ajuste = config.ajustes[data];
      if (!ajuste) return base;
      return dias.find(d => d.id === ajuste.liturgiaId) ?? { ...base, ...ajuste, id: ajuste.liturgiaId, grau: 'celebração local', opcional: false };
    }));
  }

  catalogoCompleto() {
    return forkJoin([this.catalogo$, this.getConfig()]).pipe(
      map(([catalogo, config]) => ({ ...catalogo, liturgias: [...catalogo.liturgias, ...config.locais] })),
    );
  }
}
