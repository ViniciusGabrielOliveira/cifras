# Liturgias e sugestões de repertório

Implementado em 2026-10-23. Entrada: **Painel Admin → Liturgias e repertórios**.

- Vincular listas públicas existentes ou criar uma lista com o serviço atual e abrir o editor existente. Nenhum editor de músicas paralelo.
- `listas.liturgiasIds` contém identificadores estáveis de celebrações/tempos. Uma lista pode ser vinculada a vários identificadores.
- `listas.ciclosLiturgicos` filtra A/B/C; vazio significa todos. O campo pode ser editado no editor atual.
- `listas.datasLiturgicas` fixa sugestões em datas específicas e tem prioridade sobre os demais critérios, inclusive intervalos antigos.
- Listas vazias ou privadas não aparecem nas sugestões. As públicas sem `tipo` explícito aparecem na administração e recebem `tipo: publica` ao serem vinculadas; visitantes consultam somente listas explicitamente públicas, conforme as consultas permitidas do Firestore.

## Seleção

1. Escolha explícita para a data.
2. Programações antigas por data/intervalo, sem vínculo litúrgico.
3. Vínculo com a celebração, dando preferência ao ciclo exato.
4. Vínculo com o tempo; depois, categorias antigas equivalentes.

Intervalos continuam restringindo a validade das listas vinculadas. Celebrações com estrutura própria (Ramos, Cinzas, Tríduo, Páscoa, Natal, Pentecostes e Finados) não recebem repertórios genéricos. Seleciona-se a lista completa, preservando músicas, partes, ordem e tons.

A escolha aleatória fica em `localStorage`, por data, para cada visitante; é revalidada contra as opções disponíveis. “Outra sugestão” evita repetir a lista atual. Links com `listaId` têm prioridade sobre a seleção automática. A antiga última lista salva não substitui mais o repertório de hoje.

## Calendário e manutenção

Dados brasileiros em `public/liturgia`, gerados para 2025–2035 com versões exatas de `romcal` e `@romcal/calendar.brazil` registradas em `package.json` (dependências de desenvolvimento). O navegador baixa apenas o JSON anual, sem chamar uma API externa. A licença MIT acompanha os dados.

Gerar novamente: `npm run calendar:generate`, ou `node scripts/generate-liturgical-calendar.cjs 2025 2035`. Ao ampliar os anos, atualizar também os limites da consulta na página administrativa e mensagens de indisponibilidade.

O gerador aplica Epifania e Ascensão no domingo, Corpus Christi na quinta-feira, São Pedro e São Paulo no domingo entre 28/6 e 4/7, Assunção no domingo entre 15 e 21/8 e Todos os Santos no primeiro domingo de novembro, preservando 1/11 quando 2/11 é domingo. Esses ajustes corrigem regras do pacote utilizado e são aplicados antes do cálculo de precedência. O ciclo A/B/C é produzido pelo calendário, inclusive na mudança do Advento.

Fontes consultadas:

- https://github.com/romcal/romcal — motor e dados brasileiros.
- https://www.cnbb.org.br/solenidade-de-sao-pedro-e-sao-paulo-apostolos-4/ — 28/06/2026.
- https://diocesesa.org.br/abc-liturgico/ — Assunção em 16/08/2026.
- https://www.cnbb.org.br/dia-2-de-novembro-todos-os-santos-ou-fieis-defuntos/ — exceção de Todos os Santos em 2025.

A sugestão padrão de Quinta-feira Santa é a Missa da Ceia do Senhor; a de Sábado Santo é a Vigília Pascal. São sugestões de repertório da celebração, não uma determinação automática de horários de missas. A consulta administrativa permite selecionar as outras opções que o calendário oferece naquela data.

Celebrações locais e ajustes por data ficam em `config/liturgia`, com leitura pública e escrita restrita a administradores pelas regras existentes de `config`. Para uma celebração local, cadastrar o nome e atribuir a data desejada; renovar a atribuição no ano seguinte. Não se presume precedência de um padroeiro sobre o calendário universal.

Validação: `node --test scripts/liturgical-calendar.test.cjs`; testes Angular em `src/app/core/liturgia.spec.ts`; build Angular padrão. Não exige migração de regras nem índices novos.

## Validação executada em 2026-10-23

- Testes Angular: 14 arquivos, 126 testes aprovados.
- Teste do calendário brasileiro: aprovado, incluindo cobertura das datas de 2025–2035 e transferências brasileiras.
- Build de produção: aprovado. A primeira tentativa não conseguiu baixar Google Fonts por restrição de rede; a repetição com rede concluiu.
- Avisos do build: pacote inicial de 689,32 kB acima da meta de 500 kB; `painel.scss` com 20,12 kB acima da meta de 20 kB. Ambos abaixo dos limites de erro configurados; não foram alterados os limites para ocultar avisos.
- `git diff --check`: sem erros de whitespace.

## Ampliação para repertórios externos — 2026-10-23

A importação de sugestões de `musicasparamissa.com.br`, solicitada pelo administrador, usa apenas referências a cifras públicas existentes. Títulos, origem, partes da celebração, ciclos e pendências ficam registrados no lote local `ignore/mpm-liturgias-2026-10-23`.

`ciclosFeriales` distingue I (anos ímpares) de II (anos pares), para os dias da semana do Tempo Comum. Memórias podem recorrer ao repertório da féria correspondente (`feriaId`) quando não há repertório da memória; festas e solenidades não recebem esse vínculo ferial automático. Missas de vigília diferentes da missa do dia são cadastradas como celebrações selecionáveis separadas.

A home consulta somente listas vinculadas à celebração/féria/tempo e programações por datas, deduplicando os resultados; não baixa o catálogo inteiro para escolher o repertório do dia. Os quatro índices correspondentes estão em `firestore.indexes.json`, já criados em produção. Consultas públicas verificadas via REST sem credenciais, para validar também as regras de acesso.

Validação desta ampliação: build de produção aprovado, 128 testes Angular aprovados e 3 verificações do calendário aprovadas. Permanecem os mesmos avisos de orçamento do build.
