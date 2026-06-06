import { Component, inject, input, output, signal, computed, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Lista, MusicaLista, ParteLista } from '../../models/lista.model';
import { TONS } from '../../core/cifra-parser';
import { ListaService } from '../../services/lista.service';
import { CifraService } from '../../services/cifra.service';
import { ConfigService } from '../../services/config.service';
import { MusicaSearchComponent, MusicaSelecionada } from '../musica-search/musica-search';
import { AppSelectComponent } from '../app-select/app-select';
import { newId } from '../../utils/id.utils';
import { NotificationService } from '../../services/notification.service';

@Component({
    selector: 'app-musicas-lista',
    standalone: true,
    imports: [FormsModule, DragDropModule, MusicaSearchComponent, AppSelectComponent],
    templateUrl: './musicas-lista.html',
    styleUrl: './musicas-lista.scss',
})
export class MusicasListaComponent implements OnInit, OnDestroy {
    private listaService = inject(ListaService);
    private cifraService = inject(CifraService);
    private router = inject(Router);
    private config = inject(ConfigService);
    private destroyRef = inject(DestroyRef);
    private notif = inject(NotificationService);

    readonly lista = input.required<Lista | null>();
    readonly adminContext = input(false);
    readonly isEditor = input(false);
    readonly isDono = input(false);
    readonly podeAdicionarMusica = input(true);
    readonly limiteMusicas = input(25);

    readonly listaChange = output<Lista>();
    readonly salvandoChange = output<boolean>();

    cifrasExistentes = signal<Set<string>>(new Set());
    cifrasAutorMap   = signal<Map<string, string>>(new Map());

    private campoDebounceSave$ = new Subject<Lista>();
    private campoDebounceSub = this.campoDebounceSave$.pipe(
        debounceTime(400),
        switchMap(lista => this.listaService.salvarLista(lista)),
    ).subscribe({
        next: () => this.salvandoChange.emit(false),
        error: (err: Error) => {
            this.salvandoChange.emit(false);
            this.notif.mostrarErro(err.message || 'Erro ao salvar lista.');
        },
    });

    readonly tonsOptions = TONS;

    modalBuscaAberto     = signal(false);
    parteParaAdicionar   = signal('entrada');
    editandoParteId      = signal<string | null>(null);
    editandoParteLabel   = signal('');
    confirmandoRemoverMusica = signal<string | null>(null);

    readonly partesOrdem = computed((): ParteLista[] => {
        const lista = this.lista();
        if (!lista) return [];
        return lista.partes ?? this.config.partesIds().map(id => ({ id }));
    });

    readonly partesDisponiveis = computed(() => {
        const lista = this.lista();
        if (!lista?.partes) return [];
        const emUso = new Set(lista.partes.map(p => p.id));
        return this.config.partesIds().filter(p => !emUso.has(p));
    });

    readonly PARTES_LABELS = this.config.partesLabels;

    readonly musicasPorParte = computed<Map<string, MusicaLista[]>>(() => {
        const musicas = this.lista()?.musicas ?? [];
        const map = new Map<string, MusicaLista[]>();
        for (const m of musicas) {
            const arr = map.get(m.parte) ?? [];
            arr.push(m);
            map.set(m.parte, arr);
        }
        map.forEach(arr => arr.sort((a, b) => a.ordem - b.ordem));
        return map;
    });

    ngOnDestroy() { this.campoDebounceSub.unsubscribe(); }

    ngOnInit() {
        this.cifraService.getIndiceUmaVez()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(items => {
                this.cifrasExistentes.set(new Set(items.map(i => i.id)));
                this.cifrasAutorMap.set(new Map(items.map(i => [i.id, i.autor])));
            });
    }

    parteLabel(parte: ParteLista): string {
        return parte.label ?? this.PARTES_LABELS()[parte.id] ?? parte.id;
    }

    autorDaCifra(musica: MusicaLista): string {
        return musica.autor || this.cifrasAutorMap().get(musica.cifraId) || '';
    }

    cifraExiste(cifraId: string, privada?: boolean): boolean {
        if (this.adminContext()) return true;
        if (privada) return true;
        return this.cifrasExistentes().has(cifraId);
    }


    // ── Músicas ───────────────────────────────────────────────────────

    abrirModalBusca(parte: string) {
        this.parteParaAdicionar.set(parte);
        this.modalBuscaAberto.set(true);
    }

    fecharModalBusca() { this.modalBuscaAberto.set(false); }

    onMusicaSelecionada(selecionada: MusicaSelecionada) {
        const lista = this.lista();
        if (!lista) return;
        const novaMusica: MusicaLista = {
            id: newId('m'),
            cifraId: selecionada.cifraId,
            nome: selecionada.nome,
            autor: selecionada.autor,
            ...(selecionada.trecho !== undefined && { trecho: selecionada.trecho }),
            parte: this.parteParaAdicionar(),
            ordem: lista.musicas.filter(m => m.parte === this.parteParaAdicionar()).length,
        };
        const atualizada = { ...lista, musicas: [...lista.musicas, novaMusica] };
        this.fecharModalBusca();
        this.salvarLista(atualizada);
        this.cifraService.atualizarListasIds(selecionada.cifraId, lista.id, 'add').subscribe();
    }

    onCadastrarNova(nomeBuscado: string) {
        this.fecharModalBusca();
        const lista = this.lista();
        if (lista) this.listaService.setDraft(lista, 'editar-lista', this.parteParaAdicionar());
        if (this.adminContext()) {
            this.router.navigate(['/admin/nova-cifra'], { queryParams: { nome: nomeBuscado } });
        } else {
            this.router.navigate(['/minha-area/nova-musica'], {
                queryParams: { nome: nomeBuscado, retornoLista: lista?.id, parte: this.parteParaAdicionar() },
            });
        }
    }

    removerMusica(musicaId: string) {
        const lista = this.lista();
        if (!lista) return;
        const musicaRemovida = lista.musicas.find(m => m.id === musicaId);
        const atualizada = {
            ...lista,
            musicas: lista.musicas.filter(m => m.id !== musicaId).map((m, i) => ({ ...m, ordem: i })),
        };
        this.salvarLista(atualizada);
        if (musicaRemovida) {
            this.cifraService.atualizarListasIds(musicaRemovida.cifraId, lista.id, 'remove').subscribe();
        }
        this.confirmandoRemoverMusica.set(null);
    }

    atualizarMusicaCampo(musicaId: string, campo: keyof MusicaLista, val: string) {
        const lista = this.lista();
        if (!lista) return;
        const atualizada = {
            ...lista,
            musicas: lista.musicas.map(m => m.id === musicaId ? { ...m, [campo]: val || undefined } : m),
        };
        this.listaChange.emit(atualizada);
        this.salvandoChange.emit(true);
        this.campoDebounceSave$.next(atualizada);
    }

    onMusicasReorder(event: CdkDragDrop<MusicaLista[]>, parteId: string) {
        if (event.previousIndex === event.currentIndex) return;
        const lista = this.lista();
        if (!lista) return;
        const daParte = [...(this.musicasPorParte().get(parteId) ?? [])];
        moveItemInArray(daParte, event.previousIndex, event.currentIndex);
        const outras = lista.musicas.filter(m => m.parte !== parteId);
        const atualizada = { ...lista, musicas: [...outras, ...daParte.map((m, i) => ({ ...m, ordem: i }))] };
        this.salvarLista(atualizada);
    }

    editarMusica(musica: MusicaLista) {
        const lista = this.lista();
        if (lista) this.listaService.setDraft(lista, 'editar-lista');
        if (this.adminContext()) {
            this.router.navigate(['/admin/editar-cifra', musica.cifraId], {
                queryParams: { retorno: 'painel', edicaoCifra: 'true', retornoLista: lista?.id },
            });
        } else {
            this.router.navigate(['/minha-area/editar-musica', musica.cifraId], {
                queryParams: { retornoLista: lista?.id },
            });
        }
    }

    // ── Partes ────────────────────────────────────────────────────────

    iniciarEdicaoParte(parte: ParteLista) {
        this.editandoParteId.set(parte.id);
        this.editandoParteLabel.set(this.parteLabel(parte));
    }

    salvarLabelParte(parteId: string) {
        const lista = this.lista();
        if (!lista) return;
        const novoLabel = this.editandoParteLabel().trim();
        if (!novoLabel) { this.cancelarEdicaoParte(); return; }
        const partesAtuais = lista.partes ?? this.config.partesIds().map(id => ({ id }));
        const atualizada = {
            ...lista,
            partes: partesAtuais.map(p => p.id === parteId ? { ...p, label: novoLabel } : p),
        };
        this.salvarLista(atualizada);
        this.editandoParteId.set(null);
    }

    cancelarEdicaoParte() { this.editandoParteId.set(null); }

    addParte(parteId: string) {
        const lista = this.lista();
        if (!lista) return;
        const partesAtuais = lista.partes ?? this.config.partesIds().map(id => ({ id }));
        if (partesAtuais.some(p => p.id === parteId)) return;
        const atualizada = { ...lista, partes: [...partesAtuais, { id: parteId }] };
        this.salvarLista(atualizada);
    }

    removeParte(parteId: string) {
        const lista = this.lista();
        if (!lista) return;
        if (lista.musicas.some(m => m.parte === parteId)) return;
        const partesAtuais = lista.partes ?? this.config.partesIds().map(id => ({ id }));
        const atualizada = { ...lista, partes: partesAtuais.filter(p => p.id !== parteId) };
        this.salvarLista(atualizada);
    }

    onPartesReorder(event: CdkDragDrop<ParteLista[]>) {
        if (event.previousIndex === event.currentIndex) return;
        const lista = this.lista();
        if (!lista) return;
        const partes = [...(lista.partes ?? this.config.partesIds().map(id => ({ id })))];
        moveItemInArray(partes, event.previousIndex, event.currentIndex);
        const atualizada = { ...lista, partes };
        this.salvarLista(atualizada);
    }

    private salvarLista(lista: Lista) {
        this.salvandoChange.emit(true);
        this.listaChange.emit(lista);
        this.listaService.salvarLista(lista).subscribe({
            next: () => this.salvandoChange.emit(false),
            error: (err: Error) => {
                this.salvandoChange.emit(false);
                this.notif.mostrarErro(err.message || 'Erro ao salvar lista.');
            },
        });
    }

    trackById(_: number, item: { id: string }) { return item.id; }
}
