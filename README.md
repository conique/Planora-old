# Planora

Aplicação web para organizar projetos, tarefas e workspaces.

## Executar localmente

Sirva o projeto por HTTP:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080/index.html`.

## Estrutura

- `js/core`: armazenamento, histórico, sincronização e inicialização.
- `js/features`: áreas, autenticação, workspaces, mídia, tags, projetos e cards.
- `js/layout`: cabeçalho, painel lateral e barra de rolagem.
- `css`: estilos base, componentes, layout e funcionalidades.
- `assets`: identidade visual.

## Supabase

Configure as credenciais públicas em `js/config/supabase.config.js`. Nunca coloque uma chave `service_role` no navegador. Mantenha RLS habilitado nas tabelas e as políticas adequadas no bucket `midias`.
