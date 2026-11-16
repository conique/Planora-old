/* Cabeçalho padrão do Planora — usado em todas as páginas.
   Cada página define (opcionalmente): window.aoBuscar(texto) e window.aoNovoRegistro().
   Com data-simples="true" no <header>, mostra só a logo e o caminho (sem busca nem botão). */
(function () {
    const topo = document.getElementById('topo');
    if (!topo) return;
    const atual = topo.dataset.atual || '';
    const simples = topo.dataset.simples === 'true';
    const acaoPagina = topo.dataset.acao || '';

    topo.innerHTML = `
        <div class="topo-esq">
            <button class="btn-menu-lateral" id="topo-menu-lateral" type="button" title="Abrir painel lateral" aria-label="Abrir painel lateral" aria-expanded="false" aria-controls="painel-lateral">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <a class="marca-P" href="index.html" data-pasta="" data-drop-pasta="" title="Workspaces" aria-label="Planora: voltar para workspaces"><img src="assets/planora-logo.png" alt="" width="34" height="34"></a>
            <nav class="migalha" id="migalha" aria-label="Navegação"></nav>
        </div>
        <div class="topo-dir${simples ? ' solo' : ''}">
            ${simples ? '' : '<span class="topo-visao" id="topo-visao" hidden></span>'}
            <div class="controle-historico" role="group" aria-label="Controle de alterações">
                <button class="btn-historico" id="topo-desfazer" type="button" title="Desfazer" aria-label="Desfazer" disabled>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-15-6.7L3 13"></path></svg>
                </button>
                <button class="btn-historico" id="topo-refazer" type="button" title="Refazer" aria-label="Refazer" disabled>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 15-6.7L21 13"></path></svg>
                </button>
            </div>
            ${acaoPagina ? `<button class="btn-novo" id="topo-acao" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                <span>${acaoPagina}</span>
            </button>` : ''}
            ${simples ? '' : `<label class="busca">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
                <input id="topo-busca" type="search" placeholder="Buscar páginas..." autocomplete="off">
            </label>
            ${topo.dataset.filtros === 'true' ? `<button class="btn-filtros-topo" id="topo-filtros" type="button" title="Abrir filtros" aria-label="Abrir filtros" aria-expanded="false" aria-controls="barra-filtros">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.5v5L10 19v-6.5L4 5z"></path></svg>
            </button>` : ''}
            <button class="btn-novo" id="topo-novo" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                <span>Nova Página</span>
            </button>`}
            ${simples ? '' : `<button class="btn-novo" id="topo-nova-pasta" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10v8M8 14h8"></path><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                <span>Nova pasta</span>
            </button>`}
            <div class="topo-perfil">
                <button class="btn-perfil" id="topo-perfil" type="button" title="Abrir menu do perfil" aria-label="Abrir menu do perfil" aria-haspopup="menu" aria-expanded="false" aria-controls="menu-perfil">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 21v-1.5a7 7 0 0 1 14 0V21z"></path></svg>
                </button>
                <div class="menu-perfil" id="menu-perfil" role="menu" hidden>
                    <button type="button" role="menuitem" id="perfil-criar-rotulo">Criar ou editar rótulo</button>
                    <button type="button" role="menuitem" id="perfil-criar-area">Criar ou editar área</button>
                    <button type="button" role="menuitem" id="perfil-alternar-tema"></button>
                    <button type="button" role="menuitem" id="perfil-sair">Sair da conta</button>
                </div>
            </div>
        </div>`;

    const painelLateral = document.createElement('aside');
    painelLateral.className = 'painel-lateral';
    painelLateral.id = 'painel-lateral';
    painelLateral.setAttribute('aria-label', 'Workspaces e áreas');
    painelLateral.setAttribute('aria-hidden', 'true');
    painelLateral.inert = true;
    painelLateral.innerHTML = `
        <div class="painel-lateral-topo">
            <h2>Planora</h2>
            <button class="btn-fechar-painel" id="fechar-painel-lateral" type="button" aria-label="Fechar painel lateral">×</button>
        </div>
        <section class="painel-secao" aria-labelledby="painel-tit-ws">
            <h3 class="painel-secao-titulo" id="painel-tit-ws">Workspaces</h3>
            <div class="painel-ws" id="painel-ws">
                <p class="painel-lateral-vazio">Os workspaces da sua conta aparecem aqui quando a nuvem estiver ativa.</p>
            </div>
        </section>`;
    const fundoPainel = document.createElement('button');
    fundoPainel.className = 'fundo-painel-lateral';
    fundoPainel.type = 'button';
    fundoPainel.setAttribute('aria-label', 'Fechar painel lateral');
    fundoPainel.hidden = true;
    document.body.append(painelLateral, fundoPainel);
    function atualizarTopoPainel() {
        document.documentElement.style.setProperty('--topo-altura', `${Math.ceil(topo.getBoundingClientRect().bottom)}px`);
    }
    atualizarTopoPainel();
    window.addEventListener('resize', atualizarTopoPainel);

    const btnPainel = document.getElementById('topo-menu-lateral');
    const btnFecharPainel = document.getElementById('fechar-painel-lateral');
    function fecharPainelLateral(devolverFoco) {
        painelLateral.classList.remove('aberto');
        painelLateral.setAttribute('aria-hidden', 'true');
        painelLateral.inert = true;
        fundoPainel.hidden = true;
        btnPainel.setAttribute('aria-expanded', 'false');
        btnPainel.title = 'Abrir painel lateral';
        btnPainel.setAttribute('aria-label', btnPainel.title);
        if (devolverFoco) btnPainel.focus();
    }
    function abrirPainelLateral() {
        desenharWorkspaces();
        painelLateral.classList.add('aberto');
        painelLateral.setAttribute('aria-hidden', 'false');
        painelLateral.inert = false;
        fundoPainel.hidden = false;
        btnPainel.setAttribute('aria-expanded', 'true');
        btnPainel.title = 'Fechar painel lateral';
        btnPainel.setAttribute('aria-label', btnPainel.title);
        btnFecharPainel.focus();
    }
    btnPainel.addEventListener('click', () => {
        if (btnPainel.getAttribute('aria-expanded') === 'true') fecharPainelLateral(true);
        else abrirPainelLateral();
    });
    btnFecharPainel.addEventListener('click', () => fecharPainelLateral(true));
    fundoPainel.addEventListener('click', () => fecharPainelLateral(true));
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && btnPainel.getAttribute('aria-expanded') === 'true') fecharPainelLateral(true);
    });

    /* Sistema de pastas: Workspace é a pasta base; dentro dela ficam os projetos.
       Na pasta base, "Workspace" é o local atual. Dentro de um projeto, vira link. */
    const migalha = document.getElementById('migalha');
    let nomeRaiz = 'Workspace', segsAtuais = [];
    /* Caminho em pastas: segmentos = [{ nome, href?, pasta? }]; o último (sem href) é o local atual.
       Os links levam data-drop-pasta, para soltar itens arrastados em cima deles. */
    function montarCaminho(segs) {
        segsAtuais = segs;
        migalha.innerHTML = '';
        const sep = () => { const e = document.createElement('span'); e.className = 'sep'; e.textContent = '/'; return e; };
        migalha.appendChild(sep());
        if (!segs.length) {
            const raiz = document.createElement('span');
            raiz.className = 'migalha-atual';
            raiz.textContent = nomeRaiz;
            migalha.appendChild(raiz);
            return;
        }
        const raizLink = document.createElement('a');
        raizLink.className = 'migalha-link';
        const apiWorkspaces = window.Planora_Workspaces;
        raizLink.href = apiWorkspaces && apiWorkspaces.atual
            ? urlWorkspace(apiWorkspaces.atual.id)
            : 'index.html';
        raizLink.dataset.pasta = '';
        raizLink.dataset.dropPasta = '';
        raizLink.textContent = nomeRaiz;
        migalha.appendChild(raizLink);
        segs.forEach(s => {
            migalha.appendChild(sep());
            if (s.href) {
                const l = document.createElement('a');
                l.className = 'migalha-link';
                l.href = s.href;
                if (s.pasta) { l.dataset.pasta = s.pasta; l.dataset.dropPasta = s.pasta; }
                l.textContent = s.nome;
                migalha.appendChild(l);
            } else {
                const c = document.createElement('span');
                c.className = 'migalha-atual';
                c.textContent = s.nome;
                migalha.appendChild(c);
            }
        });
    }
    function montarMigalha(nomePasta) { montarCaminho(nomePasta ? [{ nome: nomePasta }] : []); }
    montarMigalha(atual);

    const busca = document.getElementById('topo-busca'), novo = document.getElementById('topo-novo');
    const acao = document.getElementById('topo-acao');
    const btnFiltros = document.getElementById('topo-filtros');
    if (btnFiltros) btnFiltros.addEventListener('click', () => {
        if (typeof window.aoAlternarFiltros === 'function') window.aoAlternarFiltros();
    });
    if (acao) acao.addEventListener('click', () => {
        if (typeof window.aoNovoRegistro === 'function') window.aoNovoRegistro();
    });
    const novaPasta = document.getElementById('topo-nova-pasta');
    if (busca) busca.addEventListener('input', e => {
        if (typeof window.aoBuscar === 'function') window.aoBuscar(e.target.value.trim().toLowerCase());
    });
    if (novo) novo.addEventListener('click', () => {
        if (typeof window.aoNovoRegistro === 'function') window.aoNovoRegistro();
    });
    if (novaPasta) novaPasta.addEventListener('click', () => {
        if (typeof window.aoNovaPasta === 'function') window.aoNovaPasta();
    });

    /* Modo claro / escuro (a escolha fica salva neste navegador). */
    const btnTema = document.getElementById('perfil-alternar-tema');
    function atualizarBotaoTema() {
        const claro = document.documentElement.dataset.tema === 'claro';
        btnTema.textContent = claro ? 'Ativar modo escuro' : 'Ativar modo claro';
    }
    btnTema.addEventListener('click', () => {
        const novo = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
        document.documentElement.dataset.tema = novo;
        try { localStorage.setItem('Planora_tema', novo); } catch (e) { /* sem armazenamento */ }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = novo === 'claro' ? '#f3f5f9' : '#111316';
        atualizarBotaoTema();
    });
    atualizarBotaoTema();

    const btnDesfazer = document.getElementById('topo-desfazer');
    const btnRefazer = document.getElementById('topo-refazer');
    function atualizarHistorico() {
        const historico = window.Planora_Historico;
        btnDesfazer.disabled = !historico || !historico.podeDesfazer();
        btnRefazer.disabled = !historico || !historico.podeRefazer();
    }
    btnDesfazer.addEventListener('click', () => {
        if (window.Planora_Historico) window.Planora_Historico.desfazer();
    });
    btnRefazer.addEventListener('click', () => {
        if (window.Planora_Historico) window.Planora_Historico.refazer();
    });
    window.addEventListener('Planora-historico-atualizado', atualizarHistorico);
    atualizarHistorico();

    /* Workspaces da conta: lista no painel lateral e nome do workspace aberto no início do caminho. */
    const painelWs = document.getElementById('painel-ws');
    function desenharWorkspaces() {
        const api = window.Planora_Workspaces;
        if (!api || !api.atual) return;
        nomeRaiz = api.atual.nome;
        montarCaminho(segsAtuais);
        painelWs.innerHTML = '';
        const lista = document.createElement('ul');
        lista.className = 'ws-painel-lista';
        api.lista.forEach(w => {
            const li = document.createElement('li');
            li.className = 'ws-painel-linha';
            const b = document.createElement('button');
            const ativo = w.id === api.atual.id;
            b.type = 'button';
            b.className = 'ws-painel-item' + (ativo ? ' ativo' : '');
            if (ativo) b.setAttribute('aria-current', 'true');
            const av = document.createElement('span');
            av.className = 'ws-painel-inicial';
            av.textContent = (w.nome.trim()[0] || '?').toUpperCase();
            const nome = document.createElement('span');
            nome.className = 'ws-painel-nome';
            nome.textContent = w.nome;
            b.append(av, nome);
            b.addEventListener('click', () => {
                if (ativo) { fecharPainelLateral(true); return; }
                b.disabled = true;
                Promise.resolve(api.selecionar(w.id)).then(ok => { if (ok === false) b.disabled = false; });
            });
            li.appendChild(b);
            const renomear = document.createElement('button');
            renomear.type = 'button';
            renomear.className = 'ws-painel-renomear';
            renomear.textContent = '✎';
            renomear.title = 'Renomear ' + w.nome;
            renomear.setAttribute('aria-label', 'Renomear ' + w.nome);
            renomear.addEventListener('click', e => {
                e.stopPropagation();
                renomear.disabled = true;
                Promise.resolve(api.renomear(w.id))
                    .catch(erro => { console.error(erro); alert('Não foi possível renomear o workspace: ' + (erro.message || erro)); })
                    .finally(() => { renomear.disabled = false; });
            });
            li.appendChild(renomear);
            lista.appendChild(li);
        });
        const acoes = document.createElement('div');
        acoes.className = 'ws-painel-acoes';
        const novo = document.createElement('button');
        novo.type = 'button';
        novo.className = 'ws-painel-acao principal';
        novo.textContent = '+ Novo workspace';
        novo.addEventListener('click', () => { fecharPainelLateral(false); api.criarNovo(); });
        acoes.append(novo);
        painelWs.append(lista, acoes);
    }
    window.addEventListener('Planora-workspace-atualizado', desenharWorkspaces);
    desenharWorkspaces();

    document.querySelector('.marca-P').addEventListener('click', e => {
        const api = window.Planora_Workspaces;
        if (!api || typeof api.telaInicial !== 'function') return;
        e.preventDefault();
        api.telaInicial();
    });

    const btnPerfil = document.getElementById('topo-perfil');
    const menuPerfil = document.getElementById('menu-perfil');
    function fecharMenuPerfil(devolverFoco) {
        menuPerfil.hidden = true;
        btnPerfil.setAttribute('aria-expanded', 'false');
        if (devolverFoco) btnPerfil.focus();
    }
    btnPerfil.addEventListener('click', e => {
        e.stopPropagation();
        menuPerfil.hidden = !menuPerfil.hidden;
        btnPerfil.setAttribute('aria-expanded', String(!menuPerfil.hidden));
    });
    document.getElementById('perfil-criar-area').addEventListener('click', () => {
        fecharMenuPerfil();
        if (window.Planora_Areas) window.Planora_Areas.gerenciar();
    });
    document.getElementById('perfil-criar-rotulo').addEventListener('click', () => {
        fecharMenuPerfil();
        if (typeof window.abrirGerenciadorRotulos === 'function') window.abrirGerenciadorRotulos();
    });
    btnTema.addEventListener('click', () => fecharMenuPerfil());
    document.getElementById('perfil-sair').addEventListener('click', () => {
        fecharMenuPerfil();
        window.sairDaConta();
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.topo-perfil')) fecharMenuPerfil();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !menuPerfil.hidden) fecharMenuPerfil(true);
    });

    window.Planora_Topo = { definirAtual: montarMigalha, definirCaminho: montarCaminho };
})();