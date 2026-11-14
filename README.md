# Planora refatorado

Refatoração estrutural e não destrutiva dos arquivos fornecidos. O comportamento original foi preservado, mas os monólitos foram separados por responsabilidade.

## Executar localmente

O projeto usa Supabase e precisa ser servido por HTTP:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080/workspaces.html`.

## Estrutura

- `js/core`: armazenamento, histórico, sincronização e inicialização.
- `js/features`: áreas, autenticação, workspaces, mídia, tags, projetos e cards.
- `js/layout`: cabeçalho e painel lateral.
- `css`: tokens, base, layout, componentes e estilos por feature.
- `assets`: identidade visual.

## Segurança

A chave presente em `js/config/supabase.config.js` é a chave pública `anon`. Nunca coloque uma chave `service_role` no navegador. Mantenha RLS habilitado nas tabelas e políticas no bucket `midias`.

## Compartilhamento de workspaces

Depois de aplicar a migração de registros individuais já usada pelo projeto, execute `supabase_workspace_collaboration.sql` no SQL Editor do Supabase. Ela cria a associação de membros, papéis Editor/Visualizador, políticas RLS, RPCs de gerenciamento e a publicação Realtime. Só publique o frontend depois que o SQL terminar com sucesso.

O dono pode compartilhar pela tela de workspaces com o e-mail de uma conta Planora existente; não há envio automático de convite por e-mail. O convidado verá o convite na tela de workspaces e poderá aceitá-lo ou recusá-lo. Só convites aceitos liberam o acesso ao workspace. A autoria de registros antigos permanece sem atribuição. Novas mídias ficam na pasta do workspace; mídias antigas precisam ser migradas pelo dono ao abrir o workspace para ficarem acessíveis aos colaboradores.

## Observação arquitetural

Esta versão é uma refatoração segura de transição em JavaScript clássico. Os arquivos são carregados em ordem para preservar as dependências globais existentes. O próximo passo recomendado é migrar cada feature para módulos ES ou componentes Angular, eliminando gradualmente `window.Planora_*` e manipulação direta do DOM.
