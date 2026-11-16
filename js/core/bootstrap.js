/* ---------- inicialização: carrega da nuvem antes de a página montar ---------- */
async function iniciarBanco() {
    const paginaWorkspaces = ehTelaWorkspaces();
    const configurado = typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.startsWith('COLE')
        && typeof SUPABASE_ANON_KEY !== 'undefined' && !SUPABASE_ANON_KEY.startsWith('COLE');
    if (!configurado || typeof supabase === 'undefined') {
        if (paginaWorkspaces) {
            location.replace('workspace.html');
            return;
        }
        setStatus(!configurado
            ? 'Modo local: preencha js/config.js para ativar a nuvem'
            : 'Modo local: biblioteca do Supabase não carregou (sem internet?)');
        document.querySelectorAll('.btn-rodape').forEach(b => b.remove());
        inicializarHistorico();
        return;
    }
    const cliente = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    sb = cliente;
    let { data: { session } } = await sb.auth.getSession();
    if (!session) session = await telaLogin();
    usuario = session.user;
    const elEmail = document.getElementById('email-usuario');
    if (elEmail) elEmail.textContent = 'Conectado como ' + usuario.email;

    let alvo, importouLocal = false, pastaInicial = null;
    try {
        listaWorkspaces = await carregarWorkspaces();
        if (paginaWorkspaces) {
            pastaInicial = new URLSearchParams(location.search).get('pasta');
            const workspaceAnterior = pastaInicial ? workspaceDaSessao(listaWorkspaces) : null;
            if (workspaceAnterior) {
                location.replace(urlWorkspace(workspaceAnterior.id, { pasta: pastaInicial }));
                return;
            }
            alvo = await telaBoasVindas(listaWorkspaces);
        } else {
            alvo = workspaceDaUrl(listaWorkspaces);
            if (!alvo) {
                window.Planora_REDIRECIONANDO_WORKSPACES = true;
                location.replace(urlTelaWorkspaces());
                return;
            }
        }
        importouLocal = !!alvo.__importouLocal;
    } catch (e) {
        console.error(e);
        sb = null; usuario = null; // não envia nada, para não sobrescrever a nuvem
        inicializarHistorico();
        setStatus('Erro ao carregar da nuvem (somente leitura local)');
        alert('Não foi possível acessar seus workspaces:\n' + (e.message || e) +
            '\n\nSe for erro de permissão, confirme se as políticas RLS foram criadas (supabase/02_politicas_workspaces.sql).');
        return;
    }
    await ativarWorkspace(alvo, importouLocal);
    if (paginaWorkspaces) location.replace(urlWorkspace(alvo.id, pastaInicial ? { pasta: pastaInicial } : {}));
}
const Planora_PRONTO = iniciarBanco().catch(e => { console.error(e); setStatus('Erro de conexão'); });

