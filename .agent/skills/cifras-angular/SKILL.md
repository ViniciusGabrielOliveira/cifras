---
name: cifras-angular
description: >
  Guia completo para construir uma aplicação de cifras musicais estilo Cifra Club
  usando Angular. Cobre a estrutura de dados JSON para acordes, renderização
  responsiva com Web API, transposição de tom, popup de diagrama de violão com
  variações, e a arquitetura geral do projeto (componentes, serviços, modelos).
---

# Skill: Aplicação de Cifras Musicais em Angular

## Contexto do Projeto

Estamos construindo uma aplicação estilo **Cifra Club** em **Angular** com as
seguintes melhorias em relação ao site original:

| Aspecto | Cifra Club (original) | Nossa abordagem |
|---|---|---|
| Formato das cifras | Texto puro monoespaciado | **JSON estruturado** com posições absolutas |
| Mobile | Scroll horizontal (ruim) | Renderização responsiva com posição em px |
| Acordes | Texto inline sobre a letra | Componentes Angular independentes |
| Popup de acorde | Básico | Diagrama SVG do braço do violão + variações |
| Transposição | JS varredura de regex | Engine TypeScript puro, imutável |

---

## 1. Estrutura de Dados (Modelos TypeScript)

### 1.1 Modelo de Cifra

```typescript
// src/app/models/cifra.model.ts

export type Instrumento = 'violao' | 'guitarra' | 'cavaco' | 'ukulele';
export type Dificuldade = 'iniciante' | 'basico' | 'intermediario' | 'avancado';
export type StatusCifra = 'pendente' | 'aprovada' | 'rejeitada';

export interface AcordeLinha {
  posicao: number;   // índice do caractere na string `letra` onde o acorde começa
  acorde: string;    // ex: "A9", "D#m7", "G/B"
}

export interface Linhacifra {
  letra: string;           // texto da linha (ex: "Porque Ele vive")
  acordes: AcordeLinha[];  // acordes posicionados sobre esta linha
}

export interface Secao {
  tipo: 'intro' | 'verso' | 'pre-refrao' | 'refrao' | 'ponte' | 'outro' | 'solo';
  label: string;       // ex: "Refrão", "Verso 1"
  linhas: LinhaLinha[];
}

export interface Cifra {
  id: string;
  musicaId: string;
  titulo: string;
  artista: string;
  tom: string;              // tom base, ex: "A"
  instrumento: Instrumento;
  dificuldade: Dificuldade;
  versao: number;
  status: StatusCifra;
  colaboradores: string[];
  secoes: Secao[];
}
```

### 1.2 Exemplo de JSON de cifra

```json
{
  "tom": "A",
  "secoes": [
    {
      "tipo": "refrao",
      "label": "Refrão",
      "linhas": [
        {
          "letra": "Porque Ele vive",
          "acordes": [
            { "posicao": 0,  "acorde": "A9"    },
            { "posicao": 11, "acorde": "A9/C#" }
          ]
        },
        {
          "letra": "Posso crer no amanhã",
          "acordes": [
            { "posicao": 0, "acorde": "D" }
          ]
        }
      ]
    }
  ]
}
```

> **Regra de ouro:** `posicao` é o índice do caractere (0-based) da string
> `letra` onde o acorde deve ficar ancorado visualmente.

---

## 2. Engine de Transposição de Tom

O engine é uma **função pura TypeScript**, sem efeitos colaterais. Ele vive em
`src/app/core/transposicao.ts`.

```typescript
// src/app/core/transposicao.ts

const NOTAS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

const ENHARMONICOS: Record<string, string> = {
  'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#',
};

/** Normaliza bemóis → sustenidos e devolve o índice no array */
function indexNota(nota: string): number {
  const normalizada = ENHARMONICOS[nota] ?? nota;
  const idx = NOTAS.indexOf(normalizada);
  if (idx === -1) throw new Error(`Nota inválida: "${nota}"`);
  return idx;
}

/** Transpõe uma nota simples N semitons (pode ser negativo) */
export function transporNota(nota: string, delta: number): string {
  const novoIdx = ((indexNota(nota) + delta) % 12 + 12) % 12;
  return NOTAS[novoIdx];
}

// Regex: captura raiz [A-G + # ou b], modificador opcional, e baixo opcional após /
const REGEX_ACORDE = /^([A-G](?:#|b)?)([^/]*)(\/([A-G](?:#|b)?))?$/;

/** Transpõe um acorde completo, ex: "D#m7/A#" → "Em7/B" com delta=+1 */
export function transporAcorde(acorde: string, delta: number): string {
  const m = acorde.match(REGEX_ACORDE);
  if (!m) return acorde; // não reconhecido, devolve intacto
  const [, raiz, mod, , baixo] = m;
  return `${transporNota(raiz, delta)}${mod}${baixo ? '/' + transporNota(baixo, delta) : ''}`;
}

/** Transpõe a cifra inteira de forma IMUTÁVEL */
export function transporCifra(cifra: Cifra, delta: number): Cifra {
  return {
    ...cifra,
    tom: transporAcorde(cifra.tom, delta),
    secoes: cifra.secoes.map(secao => ({
      ...secao,
      linhas: secao.linhas.map(linha => ({
        ...linha,
        acordes: linha.acordes.map(({ posicao, acorde }) => ({
          posicao,
          acorde: transporAcorde(acorde, delta),
        })),
      })),
    })),
  };
}
```

---

## 3. Renderização Responsiva da Linha de Cifra

O problema do texto monoespaciado no mobile é resolvido **medindo a posição
real em pixels** do caractere usando a **Web API `Range`**.

### 3.1 Componente `LinhaCifraComponent`

```typescript
// src/app/components/linha-cifra/linha-cifra.component.ts
@Component({
  selector: 'app-linha-cifra',
  standalone: true,
  template: `
    <div class="linha-wrapper">
      <!-- camada de acordes posicionados absolutamente -->
      <div class="acordes-layer" aria-hidden="true">
        @for (item of acordes; track item.acorde) {
          <app-acorde-label
            [acorde]="item.acorde"
            [offsetPx]="offsets()[item.posicao] ?? 0"
          />
        }
      </div>
      <!-- texto da letra — referência para medir -->
      <span #letraEl class="letra">{{ letra }}</span>
    </div>
  `,
})
export class LinhaCifraComponent implements AfterViewInit {
  @Input() letra = '';
  @Input() acordes: AcordeLinha[] = [];
  @ViewChild('letraEl') letraEl!: ElementRef<HTMLSpanElement>;

  offsets = signal<Record<number, number>>({});

  ngAfterViewInit() {
    this.medirOffsets();
  }

  private medirOffsets() {
    const el = this.letraEl.nativeElement;
    const textNode = el.firstChild;
    if (!textNode) return;

    const map: Record<number, number> = {};
    const positions = [...new Set(this.acordes.map(a => a.posicao))];

    for (const pos of positions) {
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, Math.min(pos, this.letra.length));
      map[pos] = range.getBoundingClientRect().width
                 - el.getBoundingClientRect().left
                 + el.getBoundingClientRect().left
                 - el.getBoundingClientRect().left;
      // simplificado: width do range = offset left em px relativo ao pai
    }
    this.offsets.set(map);
  }
}
```

> **Nota:** Use `ResizeObserver` para recalcular os offsets quando o usuário
> redimensionar a janela ou mudar o tamanho da fonte.

### 3.2 CSS da linha

```scss
.linha-wrapper {
  position: relative;
  padding-top: 1.6em; /* espaço para os acordes acima */
  margin-bottom: 0.4rem;
}

.acordes-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 1.6em;
}

.letra {
  display: inline-block;
  white-space: pre; /* preserva espaços mas não força monospace */
  font-family: 'Inter', sans-serif;
}

app-acorde-label {
  position: absolute;
  top: 0;
  /* left é definido via [style.left.px]="offsetPx" no template */
  color: var(--cor-acorde);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}
```

---

## 4. Popup de Diagrama do Violão

Quando o usuário passa o mouse sobre um acorde, exibe um popup com:
- Diagrama SVG do braço do violão (6 cordas × N casas)
- Bolinhas nas posições dos dedos para o acorde
- Tabs para alternar entre variações do mesmo acorde

### 4.1 Modelo de diagrama

```typescript
// src/app/models/diagrama.model.ts

export interface Dedo {
  corda: number;   // 1 (mais grave, Mi grave) a 6 (mais aguda, Mi agudo)
  casa: number;    // 0 = corda solta, 1–5 = casas
}

export interface DiagramaAcorde {
  nome: string;       // ex: "A9"
  variacao: string;   // ex: "Posição 1", "Inversão"
  casaBase: number;   // casa inicial do diagrama (para acordes na pestana alta)
  pestana?: number;   // casa da pestana, se houver
  dedos: Dedo[];
  cordasMutadas: number[]; // números das cordas que não tocam (X)
  cordasSoltas: number[];  // números das cordas que tocam abertas (O)
}
```

### 4.2 Componente `DiagramaViolaoComponent`

O diagrama é um SVG gerado dinamicamente:

```typescript
@Component({
  selector: 'app-diagrama-violao',
  standalone: true,
  template: `
    <div class="diagrama-popup">
      <div class="diagrama-tabs">
        @for (v of variacoes(); track v.variacao; let i = $index) {
          <button
            [class.active]="selectedIdx() === i"
            (click)="selectedIdx.set(i)">
            {{ v.variacao }}
          </button>
        }
      </div>

      <svg [attr.viewBox]="viewBox" width="120" height="160">
        <!-- Grade de casas -->
        @for (casa of casas; track casa) {
          <line
            [attr.x1]="marginLeft" [attr.y1]="casa * cellH + marginTop"
            [attr.x2]="marginLeft + 5 * cellW" [attr.y2]="casa * cellH + marginTop"
            stroke="#555" stroke-width="1"/>
        }
        <!-- Cordas verticais -->
        @for (corda of cordas; track corda) {
          <line
            [attr.x1]="corda * cellW + marginLeft" [attr.y1]="marginTop"
            [attr.x2]="corda * cellW + marginLeft" [attr.y2]="5 * cellH + marginTop"
            stroke="#555" stroke-width="1.5"/>
        }
        <!-- Cabeça do braço (casa 0) -->
        <line [attr.x1]="marginLeft" [attr.y1]="marginTop"
              [attr.x2]="marginLeft + 5 * cellW" [attr.y2]="marginTop"
              stroke="#222" stroke-width="4"/>
        <!-- Pestana -->
        @if (diagrama().pestana) {
          <rect .../>
        }
        <!-- Bolinhas dos dedos -->
        @for (dedo of diagrama().dedos; track dedo.corda) {
          <circle
            [attr.cx]="(6 - dedo.corda) * cellW + marginLeft"
            [attr.cy]="(dedo.casa - 0.5) * cellH + marginTop"
            r="7" fill="var(--cor-acorde)"/>
        }
        <!-- X nas cordas mutadas -->
        @for (c of diagrama().cordasMutadas; track c) {
          <text [attr.x]="(6 - c) * cellW + marginLeft" [attr.y]="marginTop - 6"
                text-anchor="middle" font-size="12" fill="#e55">✕</text>
        }
        <!-- O nas cordas soltas -->
        @for (c of diagrama().cordasSoltas; track c) {
          <text [attr.x]="(6 - c) * cellW + marginLeft" [attr.y]="marginTop - 6"
                text-anchor="middle" font-size="11" fill="#555">○</text>
        }
      </svg>

      <div class="casa-base" *ngIf="diagrama().casaBase > 1">
        {{ diagrama().casaBase }}ª casa
      </div>
    </div>
  `,
})
export class DiagramaViolaoComponent {
  @Input() set acorde(nome: string) { this.carregarVariacoes(nome); }

  variacoes = signal<DiagramaAcorde[]>([]);
  selectedIdx = signal(0);
  diagrama = computed(() => this.variacoes()[this.selectedIdx()]);

  // Dimensões do SVG
  readonly marginTop = 20; readonly marginLeft = 15;
  readonly cellW = 18;     readonly cellH = 18;
  readonly casas = [0,1,2,3,4,5];
  readonly cordas = [0,1,2,3,4,5];

  private carregarVariacoes(nome: string) {
    // Buscar do AcordesService (injetado)
    // this.acordesService.getVariacoes(nome).subscribe(...)
  }
}
```

### 4.3 Serviço de Acordes

```typescript
// src/app/services/acordes.service.ts
@Injectable({ providedIn: 'root' })
export class AcordesService {
  // Banco local de diagramas (pode vir de JSON estático ou API)
  private DB: Record<string, DiagramaAcorde[]> = {
    'A': [
      {
        nome: 'A', variacao: 'Aberta', casaBase: 1, pestana: undefined,
        dedos: [
          { corda: 2, casa: 2 }, { corda: 3, casa: 2 }, { corda: 4, casa: 2 },
        ],
        cordasMutadas: [6], cordasSoltas: [1, 5],
      },
      // ... mais variações
    ],
    // ... mais acordes
  };

  getVariacoes(acorde: string): Observable<DiagramaAcorde[]> {
    return of(this.DB[acorde] ?? []);
  }
}
```

---

## 5. Componente de Controle de Tom

```typescript
@Component({
  selector: 'app-controle-tom',
  standalone: true,
  template: `
    <div class="tom-controles">
      <button (click)="mudar(-1)">− ½ tom</button>
      <span class="tom-atual">Tom: <strong>{{ cifra().tom }}</strong></span>
      <button (click)="mudar(+1)">+ ½ tom</button>
      <button class="restaurar" (click)="restaurar()" [disabled]="delta() === 0">
        Restaurar
      </button>
    </div>
  `,
})
export class ControleTomComponent {
  @Input({ required: true }) cifraOriginal!: Cifra;

  delta = signal(0);

  cifra = computed(() => transporCifra(this.cifraOriginal, this.delta()));

  mudar(semitom: number) { this.delta.update(d => d + semitom); }
  restaurar()            { this.delta.set(0); }
}
```

> **Importante:** o `delta` é o único estado. A cifra transposta é 100%
> derivada via `computed()`, nunca mutamos o objeto original.

---

## 6. Arquitetura de Pastas (Angular Standalone)

```
src/
├── app/
│   ├── core/
│   │   ├── transposicao.ts          ← engine puro (sem DI)
│   │   └── acorde-parser.ts         ← converte texto puro → JSON (migração)
│   ├── models/
│   │   ├── cifra.model.ts
│   │   └── diagrama.model.ts
│   ├── services/
│   │   ├── cifra.service.ts         ← CRUD de cifras (HTTP ou fake)
│   │   └── acordes.service.ts       ← diagramas de acordes
│   ├── components/
│   │   ├── linha-cifra/             ← renderiza 1 linha (letra + acordes)
│   │   ├── acorde-label/            ← chip clicável do acorde
│   │   ├── diagrama-violao/         ← popup SVG com variações
│   │   ├── controle-tom/            ← botões de transposição
│   │   └── secao-cifra/             ← agrupa linhas de uma seção
│   └── pages/
│       ├── cifra-detail/            ← página principal da cifra
│       └── home/
└── assets/
    └── acordes/                     ← JSONs de diagramas por instrumento
        ├── violao.json
        └── guitarra.json
```

---

## 7. Decisões Técnicas Importantes

1. **Signals em vez de RxJS** para estado local de componentes (tom, variação
   selecionada, offset de acordes).
2. **Standalone Components** — sem NgModules.
3. **Acordes como JSON** — nunca texto puro monoespaciado. O parser
   `acorde-parser.ts` converte formato legado se necessário.
4. **Fonte proporcional (não monospace)** — a posição do acorde é calculada
   em px via `Range`, não por contagem de caracteres.
5. **ResizeObserver** — recalcular offsets ao redimensionar ou mudar tamanho
   de fonte.
6. **Imutabilidade** — `transporCifra` sempre retorna um novo objeto, nunca
   muta o original.
7. **Popup via CDK Overlay** (Angular CDK) para posicionar o diagrama de
   acorde de forma inteligente (evitar sair da tela).

---

## 8. Fluxo de Popup do Acorde (UX)

```
mouseenter no <app-acorde-label>
        ↓
AcordeLabel emite @Output() hovered com nome do acorde
        ↓
AcordesService.getVariacoes(nome) → Observable<DiagramaAcorde[]>
        ↓
CDK Overlay abre DiagramaViolaoComponent ancorado ao acorde
        ↓
Usuário vê diagrama + tabs de variações
        ↓
mouseleave → overlay fecha
```

---

## 9. Próximos Passos Sugeridos

- [ ] Criar o projeto Angular com `ng new cifras --standalone --routing`
- [ ] Implementar os modelos (`cifra.model.ts`, `diagrama.model.ts`)
- [ ] Implementar o engine de transposição e seus testes unitários
- [ ] Criar o componente `LinhaCifraComponent` com medição via `Range`
- [ ] Criar o `DiagramaViolaoComponent` com SVG gerado
- [ ] Popular o `AcordesService` com um JSON de acordes comuns
- [ ] Integrar tudo na página `CifraDetailPage`
