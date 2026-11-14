/* ---------- inicialização: carrega da nuvem antes de a página montar ---------- */
async function iniciarBanco() {
    const paginaWorkspaces = ehTelaWorkspaces();
    const configurado = typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.startsWith('COLE')
        && typeof SUPABASE_ANON_KEY !== 'undefined' && !SUPABASE_ANON_KEY.startsWith('COLE');
    if (!configurado || typeof supabase === 'undefined') {
        if (paginaWorkspaces) {
            location.replace(urlRetornoWorkspaces());
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

    let alvo, importouLocal = false;
    try {
        listaWorkspaces = await carregarWorkspaces();
        if (paginaWorkspaces) {
            alvo = await telaBoasVindas(listaWorkspaces);
        } else {
            alvo = workspaceDaSessao(listaWorkspaces);
            if (!alvo) {
                window.Planora_REDIRECIONANDO_WORKSPACES = true;
                location.replace(urlTelaWorkspaces(location.pathname + location.search + location.hash));
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
            '\n\nConfirme se o SQL de compartilhamento supabase_workspace_collaboration.sql foi executado e se as políticas RLS estão ativas.');
        return;
    }
    const workspaceAtivado = await ativarWorkspace(alvo, importouLocal);
    if (!workspaceAtivado) {
        const aviso = mensagemFalhaAberturaWorkspace();
        if (paginaWorkspaces && sb && usuario) {
            await telaBoasVindas(listaWorkspaces, aviso);
        } else {
            mostrarFalhaAberturaWorkspace(aviso);
        }
        return;
    }
    if (paginaWorkspaces) location.replace(urlRetornoWorkspaces());
}
function mensagemFalhaAberturaWorkspace() {
    if (ultimoStatus === 'Cache local preservado; aguardando confirmação') {
        return 'Há alterações locais antigas neste workspace. Clique nele novamente, baixe o backup das duas versões e, após conferir o arquivo, escolha “Sincronizar versão local”.';
    }
    if (ultimoStatus === 'Migração SQL incompleta') {
        return 'A função de sincronização não foi encontrada no Supabase. Confira se as migrações de registros e colaboração foram aplicadas.';
    }
    if (ultimoStatus === 'Alterações locais pendentes: modo visualizador') {
        return 'Este workspace está em modo visualizador e há alterações locais pendentes. Elas foram preservadas neste navegador e não podem ser enviadas com este papel.';
    }
    if (ultimoStatus === 'Erro ao carregar da nuvem (somente leitura local)') {
        return 'Não foi possível ler os dados deste workspace no Supabase. Confira a conexão e as políticas de acesso para membros aceitos.';
    }
    if (ultimoStatus === 'Erro ao carregar os registros do workspace') {
        return 'Não foi possível carregar os registros individuais. Confira se a migração de registros e colaboração está atualizada no Supabase.';
    }
    if (ultimoStatus === 'Falha ao preparar a recuperação local') {
        return 'Não foi possível preparar a recuperação dos dados locais. O cache foi mantido; faça backup antes de tentar novamente.';
    }
    return 'Não foi possível sincronizar ou preparar este workspace. Confira a conexão e as permissões de Editor no Supabase.';
}
function mostrarFalhaAberturaWorkspace(mensagem) {
    const overlay = document.createElement('div');
    overlay.className = 'lg-overlay';
    const cartao = document.createElement('div');
    cartao.className = 'lg-card';
    cartao.setAttribute('role', 'alertdialog');
    cartao.setAttribute('aria-modal', 'true');
    const titulo = document.createElement('h2');
    titulo.textContent = 'Não foi possível abrir o workspace';
    const descricao = document.createElement('p');
    descricao.className = 'lg-sub';
    descricao.textContent = mensagem;
    const voltar = document.createElement('button');
    voltar.className = 'lg-principal';
    voltar.type = 'button';
    voltar.textContent = 'Voltar à seleção de workspaces';
    voltar.addEventListener('click', () => {
        const haPendencias = Object.keys(localStorage).some(chave =>
            (chave === PEND_FLAG || chave.startsWith(PEND_FLAG + ':')) &&
            localStorage.getItem(chave) === '1');
        if (haPendencias && !confirm('As alterações pendentes continuarão salvas neste navegador, mas ainda não estão na nuvem. Deseja voltar à seleção?')) return;
        permitirNavegacaoComPendencias();
        location.href = urlTelaWorkspaces(location.pathname + location.search + location.hash);
    });
    cartao.append(titulo, descricao, voltar);
    overlay.appendChild(cartao);
    document.body.appendChild(overlay);
    voltar.focus();
}
const Planora_PRONTO = iniciarBanco().catch(e => { console.error(e); setStatus('Erro de conexão'); });

