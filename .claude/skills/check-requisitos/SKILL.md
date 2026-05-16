---
name: check-requisitos
description: Antes de implementar uma nova funcionalidade, verifica se ela conflita com os requisitos existentes do sistema. Se não conflitar, registra o novo requisito automaticamente. Use sempre que for implementar algo novo.
---

## O que fazer

Você recebeu uma descrição de algo a implementar (nos argumentos do comando, ou na mensagem anterior do usuário).

**Passo 1 — Ler os requisitos atuais**

Leia o arquivo `.claude/skills/requisitos/requisitos.md`.

**Passo 2 — Análise de conflito**

Compare a nova funcionalidade com cada requisito existente. Verifique:
- Contradições diretas (ex: "usuário membro acessa /admin/painel" conflita com R02 e R08)
- Violações de segurança (ex: cifra pública de outro usuário sendo editável conflita com R27)
- Quebra de padrões de arquitetura (ex: componente injetando repositório diretamente conflita com R39)
- Conflitos com limites de dados (ex: mais de 25 músicas por usuário conflita com R23)

**Passo 3 — Reportar resultado**

Se houver conflito:
- Liste os requisitos conflitantes (número + descrição)
- Explique por que conflita
- Sugira como adaptar a implementação para não conflitar
- **NÃO prossiga com a implementação conflitante sem confirmação do usuário**

Se não houver conflito:
- Confirme que está livre para implementar
- Derive o número do próximo requisito (R{N+1} onde N é o maior número existente)
- Adicione o novo requisito ao arquivo `.claude/skills/requisitos/requisitos.md` na seção mais adequada
- Informe o usuário qual requisito foi adicionado

**Formato de adição ao arquivo:**
```
- **R{N}** — {descrição concisa do novo requisito, em português}
```

**Passo 4 — Implementar**

Prossiga com a implementação normalmente.
