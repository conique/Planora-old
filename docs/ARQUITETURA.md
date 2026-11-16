# Mapa da refatoração

## Monólito `db.js`

| Responsabilidade | Novo arquivo |
|---|---|
| Estado e cache local | `js/core/storage.js` |
| Áreas | `js/features/areas/areas.js` |
| Histórico | `js/core/history.js` |
| Sincronização | `js/core/sync.js` |
| Autenticação | `js/features/auth/auth.js` |
| Regras de workspace | `js/features/workspaces/workspaces.js` |
| Interface de workspaces | `js/features/workspaces/workspaces-ui.js` |
| Mídias | `js/features/media/media.js` |
| Tags compartilhadas | `js/features/tags/tag-utils.js` |
| Inicialização | `js/core/bootstrap.js` |

## Páginas

- `index.html`: entrada para selecionar, criar e gerenciar workspaces.
- `workspace.html`: projetos e Kanban do workspace selecionado.
- `cards.html`: HTML limpo e scripts da feature `cards`.
- `workspaces.html`: redirecionamento de compatibilidade para `index.html`.

Os links do workspace e dos projetos carregam o identificador do workspace na URL,
para que uma página possa ser aberta diretamente sem depender do workspace ativo na aba.

## CSS

A antiga folha única foi dividida em tokens, base, layout, componentes e features. `css/main.css` mantém a ordem por meio de `@import`.


## Correções visuais e de ordenação (v2)

- Pílulas de rótulo, área, prazo e tags padronizadas em 30 px de altura.
- Indicadores de ordenação usam escapes CSS Unicode (`\2191` e `\2193`) para evitar caracteres corrompidos.
- Ordenação por rótulo usa a ordem configurada em `opcoesRotulos`; rótulos antigos fora da configuração são agrupados alfabeticamente no final.
