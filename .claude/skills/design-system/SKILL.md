---
name: design-system
description: Exibe e aplica o padrão de design visual do projeto Cifras. Use antes de criar ou modificar qualquer componente de UI para garantir consistência de cores, tipografia, espaçamento, sombras e componentes.
---

Leia o arquivo `.claude/skills/design-system/design-tokens.md` e exiba o conteúdo completo para o usuário.

Em seguida, ao implementar qualquer componente ou página, aplique obrigatoriamente os tokens e padrões documentados ali:

1. **Cores**: use os tokens CSS `--color-*` definidos na paleta; nunca hardcode cores arbitrárias.
2. **Tipografia**: família Poppins/Inter; pesos 400 (body), 600 (labels/botões), 700 (títulos).
3. **Border-radius**: mínimo `8px`; cards `16px`; botões e chips `9999px` (pill).
4. **Sombras**: apenas sombras suaves com tint do primary (`rgba(108,99,255,…)`); nunca sombra preta dura.
5. **Botões primários**: pill, fundo `--color-primary`, sombra colorida.
6. **Cards**: fundo branco, `border-radius: 16px`, sombra suave, sem border.
7. **Inputs**: fundo levemente tintado do primary, border transparente, `border-radius: 12px`.
8. **Espaçamento**: escala de 4px; padding de página `16–24px`; gap entre cards `12–16px`.
9. **Layout**: linear/vertical por padrão; 2 colunas internas para grupos de cards.
10. **Motion**: transições `120–200ms ease`; microinterações de feedback; sem animações distrativas.

Se o usuário pedir para adicionar ou alterar algum padrão, atualize o arquivo `design-tokens.md` correspondente.
