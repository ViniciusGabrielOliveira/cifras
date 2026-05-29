# Requisitos do Sistema — Cifras

## Autenticação e Roles

- **R01** — Roles disponíveis: `admin`, `editor`, `convidado`, `membro`, `visitante` (hierarquia: admin > editor > convidado > membro > visitante)
- **R02** — Após login/cadastro, usuários `admin` e `editor` são redirecionados para `/admin/painel`; usuários `convidado` e `membro` são redirecionados para `/minha-area`
- **R03** — O guard `roleGuard('membro')` bloqueia visitantes não autenticados; `roleGuard('editor')` bloqueia membros comuns
- **R04** — Usuários bloqueados (`role: 'blocked'`) não podem ler cifras nem listas públicas

## Páginas Públicas

- **R05** — A página home (`/` e `/repertorio`) é acessível sem login e exibe o índice de cifras públicas
- **R06** — A página de detalhe da cifra (`/cifra/:id`) é pública para cifras com `status: 'publica'`
- **R07** — O popup de diagrama de acorde (violão) é carregado do Firestore collection `acordes`

## Painel Admin (`/admin/painel`)

- **R08** — Acesso restrito a `editor` ou superior
- **R09** — Admin pode criar/editar/excluir listas públicas com músicas organizadas por parte da missa
- **R10** — Admin pode importar cifras do Cifra Club (via API Python) ou colar texto no formato de cifra
- **R11** — Admin pode gerenciar cifras: listar, editar, excluir do índice
- **R12** — Admin pode gerenciar configurações: categorias litúrgicas e partes da missa

## Nova Cifra / Editor de Cifra

- **R13** — `nova-cifra` e `cifra-editor` são componentes compartilhados entre o fluxo admin e o fluxo do usuário (via `data: { userMode: true }` na rota)
- **R14** — No modo admin: cifra salva sem `status` (pública por padrão); após salvar, redireciona para `/admin/painel`
- **R15** — No modo `userMode`: cifra salva com `status: 'privada'` e `donoUid` do usuário; busca do Cifra Club é sempre ocultada; após salvar, redireciona para a lista ou `/minha-area`
- **R16** — Ao salvar uma cifra, o backend Python (`POST /acordes/sync`) é chamado para sincronizar acordes novos no Firestore (fire-and-forget)

## Área do Usuário (`/minha-area`)

- **R17** — Acesso restrito a `membro` ou superior
- **R18** — Usuário pode criar, visualizar e excluir suas próprias listas privadas
- **R19** — Lista privada pertence a um `donoUid`; outros usuários só acessam se forem participantes
- **R20** — Dono da lista pode convidar outros usuários via link (`/join/:token`); convidado entra como `visualizador`
- **R21** — Dono pode gerenciar participantes: alterar role para `editor` ou `visualizador`, ou remover
- **R22** — Participante `editor` tem acesso completo de CRUD nas músicas da lista; `visualizador` só lê
- **R23** — Limite de **25 músicas personalizadas** por usuário (total entre todas as listas, não por lista)
- **R24** — Usuário pode adicionar músicas às suas listas: buscar no índice público OU criar nova cifra privada; usuários com role `convidado` ou superior também podem importar via Cifra Club diretamente no modal de adição
- **R25** — Usuário pode editar cifras dentro do contexto de suas listas via `/minha-area/editar-musica/:id`
- **R26** — Músicas privadas criadas pelo usuário são marcadas com `privada: true` no campo `MusicaLista`

## Regras do Firestore

- **R27** — Cifras com `status: 'publica'` são legíveis por todos (não bloqueados); cifras `privadas` ou `pendente_revisao` são legíveis pelo `donoUid` ou por participantes de listas onde a cifra está adicionada (campo `listasIds` no documento da cifra)
- **R28** — Listas `privadas` só são legíveis pelo `donoUid` ou por participantes registrados no array `participantes`
- **R29** — Participante `editor` pode fazer `update` na lista; `visualizador` só leitura
- **R30** — Collection `acordes` é legível por todos; escrita restrita a `editor` ou superior
- **R31** — Collection `cifras_indice` é legível por todos (não bloqueados); escrita restrita a `editor` ou superior

## Integração com API Python (cifras-api)

- **R32** — API Python hospedada no Render.com, com variável `CIFRAS_API_URL` injetada no build do Angular via GitHub Actions
- **R33** — Chamadas autenticadas com header `X-API-Key` (variável `CIFRAS_API_KEY`)
- **R34** — Endpoint `POST /acordes/sync` recebe lista de nomes de acordes e adiciona ao Firestore os que ainda não existem
- **R35** — Credenciais do Firebase na API são armazenadas como `FIREBASE_CREDENTIALS_B64` (JSON base64) no Render.com

## Dados e Modelos

- **R36** — `Cifra` possui campos: `id`, `titulo`, `artista`, `tom`, `instrumento`, `dificuldade`, `secoes`, `status?`, `donoUid?`, `categorias?`, `partesMissa?`, `listasIds?` (IDs das listas onde a cifra está adicionada, para controle de visibilidade)
- **R37** — `Lista` possui campos: `id`, `titulo`, `categoria`, `musicas`, `tipo?` (`publica`|`privada`), `donoUid?`, `participantes?`, `tokenConvite?`, `todosDias?` (boolean — aparece em todos os dias), `dataInicio?` + `dataFim?` (intervalo de datas; aparece nos dias dentro do range); se `todosDias` for true ignora as datas; campo legado `data?` ainda é suportado para backwards compat
- **R38** — `Participante` possui: `uid`, `nome`, `role` (`editor`|`visualizador`)
- **R39** — Padrão de arquitetura: repositório (interface abstrata + implementação Firebase/Mock) → serviço → componente. Componentes nunca injetam repositórios diretamente

## Sistema de Versionamento via Pull Requests

- **R44** — Ao salvar uma cifra no modo `userMode`, se for cifra nova o editor oferece a opção de torná-la pública via PR; se aceitar, cria documento em `cifras_pr` com `status: 'pendente'`; se recusar, salva apenas como `privada`
- **R45** — Ao salvar uma cifra existente no modo `userMode`, o editor detecta se há uma versão pública e pergunta se o usuário quer criar uma nova versão via PR, solicitando o motivo (enum: `simplificada`, `original_errada`, `tom_diferente`, `arranjo_diferente`, `letra_atualizada`, `outro_instrumento`, `outros`; campo livre quando `outros`)
- **R46** — Admin aprova ou rejeita PRs no painel admin; ao aprovar uma cifra nova, ela é salva em `cifras` com `status: 'publica'`; ao aprovar uma nova versão, o conteúdo anterior é arquivado em `cifras/{id}/versoes/{vId}` e a cifra pública é atualizada
- **R47** — Cifra pendente (`status: 'pendente_revisao'`) é visível apenas ao `donoUid` e a participantes de listas onde ela está adicionada; campo `listasIds: string[]` no documento controla isso via Firestore rules
- **R48** — Viewer de cifra exibe seletor de versão quando há versões arquivadas em `cifras/{id}/versoes`
- **R49** — Painel admin inclui aba de PRs pendentes com diff textual (formato texto plano) comparando versão atual vs submetida, e opções de aprovar/rejeitar com nota opcional
- **R50** — `CifraPR` possui campos: `id`, `cifraId` (null se nova), `tipo` (`nova_cifra`|`nova_versao`), `dados` (snapshot completo da Cifra), `autorUid`, `autorNome`, `motivo`, `motivoCustom?`, `status` (`pendente`|`aprovado`|`rejeitado`), `criadoEm`, `resolvidoEm?`, `reviewerUid?`, `reviewerNota?`
- **R51** — Ao adicionar/remover uma cifra de uma lista, o campo `listasIds` da cifra é atualizado com `arrayUnion`/`arrayRemove`

## Busca de Músicas

- **R52** — O componente `musica-search` suporta filtros multi-select de Partes da Missa e Categorias via selects com pills removíveis; filtros sozinhos (sem texto digitado) já retornam resultados; as opções vêm do `ConfigService`; o filtro avançado é habilitado via input `[mostrarFiltros]="true"` e está ativo na Home e na Minha Lista, mas não no modal do admin (que já conhece a parte de destino)

## Player de Vídeo

- **R53** — A página de detalhe da cifra exibe um player embutido do YouTube quando o campo `videoLink` estiver preenchido; o player usa `<iframe>` com `allow="autoplay"` e é responsivo (largura 100%, aspect-ratio 16/9); o vídeo não inicia automaticamente

## Segurança e Boas Práticas

- **R43** — Lista pode ter campo `partes?: string[]` que define a ordem e seleção das partes da missa para aquela lista; se ausente, usa a ordem global do `ConfigService`; editor ou dono pode adicionar (a partir das partes do config global), remover (apenas partes sem música) e reordenar partes via drag-and-drop na tela `minha-lista`

- **R40** — `environment.prod.ts` nunca deve ser commitado (contém API key)
- **R41** — `service-account.json` e `*-firebase-adminsdk-*.json` estão no `.gitignore` e nunca devem ser commitados
- **R42** — Nunca rodar `npm run build`, `ng build` ou `npm test` automaticamente — deixar para o usuário executar
