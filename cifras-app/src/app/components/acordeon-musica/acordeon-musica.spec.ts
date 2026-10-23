import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AcordeonMusicaComponent } from './acordeon-musica';
import { CifraService } from '../../services/cifra.service';
import { AuthService } from '../../services/auth.service';
import { Lista, MusicaLista } from '../../models/lista.model';

const musica = (id: string, parte: string, ordem: number): MusicaLista => ({ id, cifraId: id, nome: 'Mesmo título', autor: '', parte, ordem, tom: 'G', observacao: 'Manter observação' });

describe('reordenação de músicas na home', () => {
    beforeEach(() => TestBed.configureTestingModule({
        imports: [AcordeonMusicaComponent],
        providers: [{ provide: CifraService, useValue: {} }, { provide: AuthService, useValue: {} }],
    }));

    function setup() {
        const fixture = TestBed.createComponent(AcordeonMusicaComponent);
        const entrada = musica('entrada', 'entrada', 0);
        const primeira = musica('gloria-1', 'gloria', 0);
        const segunda = musica('gloria-2', 'gloria', 1);
        const lista: Lista = { id: 'lista', titulo: 'Repertório', criadaEm: '', atualizadaEm: '', musicas: [entrada, primeira, segunda] };
        fixture.componentRef.setInput('lista', lista);
        fixture.componentRef.setInput('musicas', [primeira, segunda]);
        fixture.componentRef.setInput('canEdit', true);
        const emitidas: Lista[] = [];
        fixture.componentInstance.musicasReordenadas.subscribe(l => emitidas.push(l));
        return { fixture, component: fixture.componentInstance, lista, emitidas };
    }

    it('reordena pelos IDs, preservando outras categorias, tons e observações', () => {
        const { component, lista, emitidas } = setup();
        component.moverMusica(1, 0);
        const salva = emitidas[0];
        expect(salva.musicas.filter(m => m.parte === 'gloria').sort((a, b) => a.ordem - b.ordem).map(m => m.id)).toEqual(['gloria-2', 'gloria-1']);
        expect(salva.musicas.find(m => m.id === 'entrada')).toBe(lista.musicas[0]);
        expect(salva.musicas.find(m => m.id === 'gloria-2')).toMatchObject({ tom: 'G', observacao: 'Manter observação' });
        expect(lista.musicas.map(m => m.ordem)).toEqual([0, 0, 1]);
    });

    it('não permite reordenar sem permissão de edição', () => {
        const { fixture, component, emitidas } = setup();
        fixture.componentRef.setInput('canEdit', false);
        component.moverMusica(1, 0);
        expect(emitidas).toHaveLength(0);
    });

    it('bloqueia outro movimento enquanto a ordem está sendo salva', () => {
        const { fixture, component, emitidas } = setup();
        fixture.componentRef.setInput('reordenando', true);
        component.moverMusica(1, 0);
        expect(emitidas).toHaveLength(0);
    });

    it('ignora movimentos além dos limites e movimentos sem mudança', () => {
        const { component, emitidas } = setup();
        component.moverMusica(0, -1);
        component.moverMusica(1, 2);
        component.moverMusica(0, 0);
        expect(emitidas).toHaveLength(0);
    });
});
