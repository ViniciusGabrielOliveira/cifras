# Requisitos do Sistema — Cifras

## Autenticação e Roles

- **R01** — Roles disponíveis: `admin`, `editor`, `membro`, `visitante` (hierarquia: admin > editor > membro > visitante)
- **R02** — Após login/cadastro, usuários `admin` e `editor` são redirecionados para `/admin/painel`; usuários `membro` são redirecionados para `/minha-area`
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
- **R15** — No modo `userMode`: cifra salva com `status: 'privada'` e `donoUid` do usuário; busca do Cifra Club é ocultada; após salvar, redireciona para a lista ou `/minha-area`
- **R16** — Ao salvar uma cifra, o backend Python (`POST /acordes/sync`) é chamado para sincronizar acordes novos no Firestore (fire-and-forget)

## Área do Usuário (`/minha-area`)

- **R17** — Acesso restrito a `membro` ou superior
- **R18** — Usuário pode criar, visualizar e excluir suas próprias listas privadas
- **R19** — Lista privada pertence a um `donoUid`; outros usuários só acessam se forem participantes
- **R20** — Dono da lista pode convidar outros usuários via link (`/join/:token`); convidado entra como `visualizador`
- **R21** — Dono pode gerenciar participantes: alterar role para `editor` ou `visualizador`, ou remover
- **R22** — Participante `editor` tem acesso completo de CRUD nas músicas da lista; `visualizador` só lê
- **R23** — Limite de **25 músicas personalizadas** por usuário (total entre todas as listas, não por lista)
- **R24** — Usuário pode adicionar músicas às suas listas: buscar no índice público OU criar nova cifra privada
- **R25** — Usuário pode editar cifras dentro do contexto de suas listas via `/minha-area/editar-musica/:id`
- **R26** — Músicas privadas criadas pelo usuário são marcadas com `privada: true` no campo `MusicaLista`

## Regras do Firestore

- **R27** — Cifras com `status: 'publica'` são legíveis por todos (não bloqueados); cifras `privadas` só pelo `donoUid`
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

- **R36** — `Cifra` possui campos: `id`, `titulo`, `artista`, `tom`, `instrumento`, `dificuldade`, `secoes`, `status?`, `donoUid?`, `categorias?`, `partesMissa?`
- **R37** — `Lista` possui campos: `id`, `titulo`, `categoria`, `musicas`, `tipo?` (`publica`|`privada`), `donoUid?`, `participantes?`, `tokenConvite?`
- **R38** — `Participante` possui: `uid`, `nome`, `role` (`editor`|`visualizador`)
- **R39** — Padrão de arquitetura: repositório (interface abstrata + implementação Firebase/Mock) → serviço → componente. Componentes nunca injetam repositórios diretamente

## Segurança e Boas Práticas

- **R43** — Lista pode ter campo `partes?: string[]` que define a ordem e seleção das partes da missa para aquela lista; se ausente, usa a ordem global do `ConfigService`; editor ou dono pode adicionar (a partir das partes do config global), remover (apenas partes sem música) e reordenar partes via drag-and-drop na tela `minha-lista`

- **R40** — `environment.prod.ts` nunca deve ser commitado (contém API key)
- **R41** — `service-account.json` e `*-firebase-adminsdk-*.json` estão no `.gitignore` e nunca devem ser commitados
- **R42** — Nunca rodar `npm run build`, `ng build` ou `npm test` automaticamente — deixar para o usuário executar
