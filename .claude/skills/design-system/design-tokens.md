# Design System — Cifras

Extraído das telas de referência (Task Management App). Aplicar em todas as páginas do projeto.

---

## Parâmetros `DesignStylePreferences`

```ts
const designSystem: DesignStylePreferences = {
  minimalism:        'balanced',
  borderRadius:      'large',
  shadowStyle:       'subtle',
  surfaceStyle:      'elevated',
  density:           'comfortable',
  contrastLevel:     'medium',
  typographyStyle:   'modern',
  fontWeight:        'bold',       // títulos heavy; body regular
  scale:             'medium',
  buttonStyle:       'pill',
  cardStyle:         'elevated',
  sectionLayout:     'linear',
  alignment:         'left',       // center apenas em hero/onboarding
  iconStyle:         'filled',
  illustrationStyle: '3d',         // onboarding; demais telas sem ilustração
  imageTreatment:    'rounded',
  dividerStyle:      'none',
  motionLevel:       'subtle',
  interactionStyle:  'microinteractions',
  visualMood:        'friendly',
};
```

---

## Paleta de cores

| Token               | Valor hex   | Uso                                      |
|---------------------|-------------|------------------------------------------|
| `--color-primary`   | `#6C63FF`   | Botões principais, destaques, hero card  |
| `--color-accent-1`  | `#FF6B35`   | Progress rings, tags laranja             |
| `--color-accent-2`  | `#38B2AC`   | Progress rings, tags azul-verde          |
| `--color-accent-3`  | `#F6AD55`   | Progress rings, tags amarelo             |
| `--color-bg`        | `#FAFAFA`   | Background de página                     |
| `--color-surface`   | `#FFFFFF`   | Cards, inputs, bottom nav                |
| `--color-text-1`    | `#1A1A2E`   | Títulos, texto principal                 |
| `--color-text-2`    | `#6B7280`   | Subtítulos, labels, placeholders         |
| `--color-text-inv`  | `#FFFFFF`   | Texto sobre fundos escuros/primary       |
| `--color-chip-bg`   | `#EDE9FE`   | Chips/badges de categoria (violeta suave)|

Hero card usa gradiente: `linear-gradient(135deg, #6C63FF 0%, #8B83FF 100%)`.

---

## Tipografia

- **Família**: `'Poppins', 'Inter', sans-serif` (nesta ordem de preferência)
- Títulos de página: `font-size: 22–24px`, `font-weight: 700`
- Subtítulos / seções: `font-size: 16–18px`, `font-weight: 600`
- Body / labels: `font-size: 14px`, `font-weight: 400`
- Captions / meta: `font-size: 12px`, `font-weight: 400`, cor `--color-text-2`
- Botões: `font-size: 14–16px`, `font-weight: 600`

---

## Border Radius

| Elemento         | Valor       |
|------------------|-------------|
| Cards            | `16px`      |
| Botões pill      | `9999px`    |
| Inputs / selects | `12px`      |
| Chips / tags     | `9999px`    |
| Ícones container | `12px`      |
| Bottom nav       | `20px` (top)|
| Progress rings   | circular    |

---

## Sombras

```css
/* card padrão */
box-shadow: 0 4px 20px rgba(108, 99, 255, 0.08), 0 1px 4px rgba(0,0,0,0.04);

/* card hover / elevado */
box-shadow: 0 8px 32px rgba(108, 99, 255, 0.14), 0 2px 8px rgba(0,0,0,0.06);

/* bottom nav */
box-shadow: 0 -4px 24px rgba(0,0,0,0.06);
```

Nunca usar sombras duras (`black 50%`). Sempre sombras coloridas (tint do primary) ou neutras muito suaves.

---

## Componentes

### Botão primário
```css
background: var(--color-primary);
color: #fff;
border-radius: 9999px;
padding: 14px 32px;
font-weight: 600;
font-size: 15px;
box-shadow: 0 6px 20px rgba(108,99,255,0.35);
transition: transform 120ms ease, box-shadow 120ms ease;

&:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(108,99,255,0.45); }
&:active { transform: translateY(0); }
```

### Card padrão
```css
background: var(--color-surface);
border-radius: 16px;
padding: 16px;
box-shadow: 0 4px 20px rgba(108,99,255,0.08);
/* sem border */
```

### Input / Select
```css
background: #F5F5FF; /* tint levíssimo do primary */
border: 1.5px solid transparent;
border-radius: 12px;
padding: 12px 16px;
font-size: 14px;
color: var(--color-text-1);

&:focus { border-color: var(--color-primary); background: #fff; }
```

### Chip / Tag de categoria
```css
background: var(--color-chip-bg);
color: var(--color-primary);
border-radius: 9999px;
padding: 4px 12px;
font-size: 12px;
font-weight: 500;
```

### Progress ring
- SVG circular; stroke colorida conforme categoria; fundo: `rgba(cor, 0.15)`; label percentual no centro em `font-weight: 700`

### Bottom navigation
- Fundo branco, `border-radius: 20px 20px 0 0`, sombra suave
- Ícone ativo: `--color-primary`; inativo: `--color-text-2`
- FAB central: pill/circle, `background: --color-primary`, sombra colorida

---

## Espaçamento (escala de 4px)

| Token     | Valor |
|-----------|-------|
| `--sp-1`  | `4px` |
| `--sp-2`  | `8px` |
| `--sp-3`  | `12px`|
| `--sp-4`  | `16px`|
| `--sp-5`  | `20px`|
| `--sp-6`  | `24px`|
| `--sp-8`  | `32px`|
| `--sp-10` | `40px`|

Padding interno de página: `16–24px` laterais.  
Gap entre cards: `12–16px`.

---

## Layout e grid

- Layout principal: **linear** (lista vertical com seções)
- Seções agrupadas em cards separados; nunca misturar conteúdo de seções distintas no mesmo card
- Header: saudação + avatar à esquerda; ícone de notificação à direita
- Hero card: largura total, gradiente primary, texto branco, CTA em branco outline ou white pill
- Grids internos (ex: projetos em andamento): 2 colunas de cards lado a lado

---

## Mood & motion

- **Visual mood**: friendly + professional — cores vibrantes mas organizadas, sem excesso de elementos
- **Microinteractions**: feedback visual em tap/hover (scale leve, sombra aumenta)
- **Transições**: `120–200ms ease` para hover; `300ms ease` para modais/sheets
- **Sem animações distrativas** — motion a serviço de feedback, não de decoração

---

## O que NÃO fazer

- Não usar `border` visível em cards (usar sombra)
- Não usar font-weight abaixo de 400
- Não usar cores totalmente saturadas sem tint (sempre suavizar backgrounds)
- Não misturar mais de 3 cores de acento na mesma tela
- Não usar sombras pretas duras
- Não centralizar texto de lista/form (só hero)
- Não usar border-radius abaixo de `8px` em nenhum componente interativo
