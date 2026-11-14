/* ---------- tela de boas-vindas: escolher um workspace existente ou criar outro ---------- */
function telaBoasVindas(lista, avisoInicial) {
    return new Promise(res => {
        const o = document.createElement('div');
        o.className = 'lg-overlay ws-overlay';
        document.body.appendChild(o);
        const ultimoId = (() => { try { return localStorage.getItem(ULTIMO_WS + ':' + usuario.id); } catch (e) { return null; } })();
        const primeiroNome = escaparTag((usuario.email || '').split('@')[0] || 'por aqui');
        const matiz = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
        const vazio = !lista.length;
        const ICONE_EDITAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
        const ICONE_COMPARTILHAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"></path></svg>';
        let editandoId = null;
        const inicialDe = w => escaparTag((w.nome.trim()[0] || '?').toUpperCase());
        const cartao = w => {
            const h = matiz(w.id), ultimo = w.id === ultimoId, id = escaparTag(w.id);
            const meta = [w.created_at ? 'Criado em ' + dataCurta(w.created_at) : '', w.atualizado_em ? 'Atualizado em ' + dataCurta(w.atualizado_em) : ''].filter(Boolean).join(' · ');
            const papel = w.role === 'owner' ? '' : `<span class="ws-etiqueta ws-etiqueta-papel">${w.role === 'editor' ? 'Editor' : 'Visualizador'}</span>`;
            if (w.id === editandoId) {
                return `<div class="ws-item editando" role="listitem" data-id="${id}">
                    <form class="ws-editar-form" data-form="${id}" novalidate>
                        <span class="ws-avatar" style="--h:${h}" aria-hidden="true">${inicialDe(w)}</span>
                        <input class="ws-editar-campo" type="text" maxlength="60" autocomplete="off" value="${escaparTag(w.nome)}" aria-label="Novo nome do workspace">
                        <div class="ws-editar-acoes"><button class="btn-cancelar-edicao" type="button" data-cancelar>Cancelar</button><button class="btn-salvar-inline" type="submit">Salvar</button></div>
                        <p class="ws-editar-msg" role="alert" aria-live="polite"></p>
                    </form></div>`;
            }
            return `<div class="ws-item${ultimo ? ' ws-card-ultimo' : ''}" role="listitem" data-id="${id}">
                <button class="ws-card" type="button" data-id="${id}">
                    <span class="ws-avatar" style="--h:${h}" aria-hidden="true">${inicialDe(w)}</span>
                    <span class="ws-card-texto"><span class="ws-card-titulo"><span class="ws-card-nome">${escaparTag(w.nome)}</span>${papel}${ultimo ? '<span class="ws-etiqueta ws-etiqueta-ultimo">Último acesso</span>' : ''}</span><span class="ws-card-meta">${escaparTag(meta)}</span></span>
                </button>
                ${w.role === 'owner' ? `<button class="ws-compartilhar" type="button" data-compartilhar="${id}" title="Compartilhar workspace" aria-label="Compartilhar ${escaparTag(w.nome)}">${ICONE_COMPARTILHAR}</button>
                <button class="ws-editar" type="button" data-editar="${id}" title="Editar nome" aria-label="Editar nome de ${escaparTag(w.nome)}">${ICONE_EDITAR}</button>` : ''}
            </div>`;
        };
        o.innerHTML = `<button class="btn-tema ws-theme-toggle" id="ws-tema" type="button" aria-label="Ativar modo claro" title="Ativar modo claro"></button>
            <main class="ws-conteudo">
                <header class="ws-hero">
                    <div class="ws-marca"> <img src="assets/planora-logo.png" alt="Planora"> </div>
                    <p class="ws-ola">${vazio ? 'Que bom ter você aqui' : 'Olá'}, <strong>${primeiroNome}</strong></p>
                    <h1>Bem-vindo ao <span>Planora</span></h1>
                    <p class="ws-sub">${vazio
                        ? 'Vamos começar criando seu primeiro workspace, um espaço só seu para organizar projetos, páginas e cards.'
                        : 'Entre em um dos seus workspaces para continuar de onde parou, ou crie um novo espaço separado para outro contexto.'}</p>
                </header>
                ${avisoInicial ? `<p class="ws-msg" role="alert">${escaparTag(avisoInicial)}</p>` : ''}
                <section class="ws-secao ws-convites" id="ws-convites" aria-labelledby="ws-tit-convites" hidden>
                    <div class="ws-secao-topo">
                        <div class="ws-secao-titulo"><h2 id="ws-tit-convites">Convites recebidos</h2><span class="ws-contagem" id="ws-convites-contagem">0</span></div>
                    </div>
                    <div class="ws-convites-lista" id="ws-convites-lista"></div>
                    <p class="ws-msg" id="ws-convites-msg" role="alert" aria-live="polite"></p>
                </section>
                <section class="ws-secao ws-novo" aria-labelledby="ws-tit-novo"${vazio ? '' : ' hidden'}>
                    <div class="ws-secao-topo"><h2 id="ws-tit-novo">${vazio ? 'Criar meu primeiro workspace' : 'Novo workspace'}</h2></div>
                    <div class="ws-novo-linha">
                        <label class="ws-campo"><span class="ws-campo-rot">Nome do workspace</span>
                            <input id="ws-novo-nome" type="text" maxlength="60" autocomplete="off" placeholder="Ex.: Projetos 2026" value="${vazio ? 'Meu workspace' : ''}"></label>
                        <div class="ws-acoes-novo"><button class="ws-btn-criar" id="ws-novo-ok" type="button">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"></path></svg>
                            <span>Criar e entrar</span></button>${vazio ? '' : '<button class="ws-btn-cancelar" id="ws-novo-cancelar" type="button">Cancelar</button>'}</div>
                    </div>
                    <p class="ws-msg" id="ws-novo-msg" role="alert" aria-live="polite"></p>
                </section>
                ${vazio ? '' : `<section class="ws-secao ws-secao-lista" aria-labelledby="ws-tit-lista">
                    <div class="ws-secao-topo"><div class="ws-secao-titulo"><h2 id="ws-tit-lista">Entrar em um workspace</h2><span class="ws-contagem">${lista.length}</span></div>
                        <button class="ws-btn-novo-workspace" id="ws-adicionar" type="button" aria-expanded="false">+ Novo workspace</button></div>
                    <div class="ws-lista" role="list"></div>
                </section>`}
            </main>
            <footer class="footer-Planora ws-footer-padrao">
                <span class="ponto"></span><strong>Planora</strong><span>© 2026</span>
                <span id="status-nuvem" class="status-nuvem" role="img" aria-label="Status da nuvem"></span>
                <span id="email-usuario" class="email-usuario">${escaparTag(usuario.email || '')}</span>
                <button type="button" class="btn-rodape" id="ws-sair">Sair</button>
            </footer>`;
        const q = s => o.querySelector(s), msg = t => { q('#ws-novo-msg').textContent = t; };
        /* O footer é criado dinamicamente nesta tela. Reaplica o último status para desenhar o ícone da nuvem. */
        setStatus(ultimoStatus || 'Salvo na nuvem');
        const secaoConvites = q('#ws-convites');
        const listaConvites = q('#ws-convites-lista');
        const mensagemConvites = q('#ws-convites-msg');
        const carregarConvites = async () => {
            const { data, error } = await sb.rpc('planora_list_my_workspace_invitations');
            if (error) throw error;
            const convites = Array.isArray(data) ? data : [];
            listaConvites.replaceChildren();
            q('#ws-convites-contagem').textContent = String(convites.length);
            mensagemConvites.textContent = '';
            secaoConvites.hidden = convites.length === 0;
            convites.forEach(convite => {
                const item = document.createElement('article');
                item.className = 'ws-convite';
                const detalhes = document.createElement('div');
                detalhes.className = 'ws-convite-detalhes';
                const nome = document.createElement('strong');
                nome.textContent = convite.workspace_name || 'Workspace';
                const meta = document.createElement('span');
                meta.textContent = 'Convidado por ' + (convite.inviter_name || 'Dono') +
                    ' · ' + (convite.role === 'editor' ? 'Editor' : 'Visualizador') +
                    (convite.invited_at ? ' · ' + dataCurta(convite.invited_at) : '');
                detalhes.append(nome, meta);

                const acoes = document.createElement('div');
                acoes.className = 'ws-convite-acoes';
                const aceitar = document.createElement('button');
                aceitar.className = 'ws-convite-aceitar';
                aceitar.type = 'button';
                aceitar.textContent = 'Aceitar';
                const recusar = document.createElement('button');
                recusar.className = 'ws-convite-recusar';
                recusar.type = 'button';
                recusar.textContent = 'Recusar';
                const responder = async aceita => {
                    if (!aceita && !confirm('Recusar o convite para "' + (convite.workspace_name || 'Workspace') + '"?')) return;
                    aceitar.disabled = true;
                    recusar.disabled = true;
                    mensagemConvites.textContent = '';
                    try {
                        const { error: erroResposta } = await sb.rpc('planora_respond_workspace_invitation', {
                            p_workspace_id: convite.workspace_id,
                            p_accept: aceita
                        });
                        if (erroResposta) throw erroResposta;
                        if (aceita) {
                            location.reload();
                            return;
                        }
                        await carregarConvites();
                    } catch (erro) {
                        console.error('Não foi possível responder ao convite:', erro);
                        mensagemConvites.textContent = erro && erro.code === 'P0002'
                            ? 'Este convite não está mais disponível. Atualize a página.'
                            : (erro && erro.message ? erro.message : 'Não foi possível responder ao convite.');
                        aceitar.disabled = false;
                        recusar.disabled = false;
                    }
                };
                aceitar.addEventListener('click', () => responder(true));
                recusar.addEventListener('click', () => responder(false));
                acoes.append(aceitar, recusar);
                item.append(detalhes, acoes);
                listaConvites.appendChild(item);
            });
        };
        carregarConvites().catch(erro => {
            console.error('Não foi possível carregar os convites pendentes:', erro);
            secaoConvites.hidden = false;
            mensagemConvites.textContent = 'Não foi possível carregar os convites. Confirme se a migração de colaboração está atualizada no Supabase.';
        });
        const btnTema = q('#ws-tema');
        const ICONE_SOL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>';
        const ICONE_LUA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>';
        function atualizarBotaoTema() {
            if (!btnTema) return;
            const claro = document.documentElement.dataset.tema === 'claro';
            btnTema.innerHTML = claro ? ICONE_LUA : ICONE_SOL;
            btnTema.title = claro ? 'Ativar modo escuro' : 'Ativar modo claro';
            btnTema.setAttribute('aria-label', btnTema.title);
        }
        if (btnTema) {
            btnTema.addEventListener('click', () => {
                const novo = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
                document.documentElement.dataset.tema = novo;
                try { localStorage.setItem('Planora_tema', novo); } catch (e) { /* sem armazenamento */ }
                const meta = document.querySelector('meta[name="theme-color"]');
                if (meta) meta.content = novo === 'claro' ? '#f3f5f9' : '#111316';
                atualizarBotaoTema();
            });
            atualizarBotaoTema();
        }
        const concluir = ws => { o.remove(); res(ws); };
        /* lista de workspaces: entrar, editar o nome (inline) e cancelar */
        const elLista = q('.ws-lista');
        const desenharLista = () => { if (elLista) elLista.innerHTML = lista.map(cartao).join(''); };
        const abrirEdicao = id => {
            editandoId = id;
            desenharLista();
            const campo = elLista.querySelector('.ws-editar-campo');
            if (campo) { campo.focus(); campo.select(); }
        };
        if (elLista) {
            desenharLista();
            elLista.addEventListener('click', e => {
                const compartilhar = e.target.closest('[data-compartilhar]');
                if (compartilhar) {
                    compartilhar.disabled = true;
                    Promise.resolve(window.Planora_Workspaces.gerenciarCompartilhamento(compartilhar.dataset.compartilhar))
                        .catch(erro => { console.error(erro); alert('Não foi possível abrir o compartilhamento: ' + (erro.message || erro)); })
                        .finally(() => { compartilhar.disabled = false; });
                    return;
                }
                const editar = e.target.closest('[data-editar]');
                if (editar) return abrirEdicao(editar.dataset.editar);
                if (e.target.closest('[data-cancelar]')) { editandoId = null; return desenharLista(); }
                const entrar = e.target.closest('.ws-card[data-id]');
                if (entrar) concluir(lista.find(w => w.id === entrar.dataset.id));
            });
            elLista.addEventListener('keydown', e => {
                if (e.key === 'Escape' && editandoId) { e.stopPropagation(); editandoId = null; desenharLista(); }
            });
            elLista.addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target.closest('form[data-form]');
                if (!form) return;
                const campo = form.querySelector('.ws-editar-campo'), aviso = form.querySelector('.ws-editar-msg');
                const salvar = form.querySelector('[type="submit"]');
                salvar.disabled = true; aviso.textContent = '';
                try {
                    await salvarNomeWorkspace(form.dataset.form, campo.value);
                    editandoId = null;
                    desenharLista();
                } catch (erro) {
                    console.error(erro);
                    salvar.disabled = false;
                    aviso.textContent = erro.code === '42501'
                        ? 'Sem permissão para renomear. Confira a política de UPDATE no Supabase (supabase/02_politicas_workspaces.sql).'
                        : (erro.message || 'Não foi possível renomear o workspace.');
                    campo.focus();
                }
            });
        }
        const adicionar = q('#ws-adicionar');
        let formularioWsAberto = vazio;
        const abrirFecharWorkspace = (abrir, focar) => {
            const form = q('.ws-novo');
            formularioWsAberto = abrir;
            if (!adicionar || vazio) return;
            if (abrir) {
                form.hidden = false;
                form.classList.remove('fechando', 'entrando');
                void form.offsetWidth;
                form.classList.add('entrando');
                if (focar) setTimeout(() => q('#ws-novo-nome').focus(), 120);
            } else {
                form.classList.remove('entrando');
                form.classList.add('fechando');
                setTimeout(() => {
                    if (!formularioWsAberto) {
                        form.hidden = true;
                        form.classList.remove('fechando');
                    }
                }, 220);
            }
            adicionar.setAttribute('aria-expanded', String(abrir));
        };
        if (adicionar) adicionar.onclick = () => abrirFecharWorkspace(!formularioWsAberto, true);
        const cancelarNovo = q('#ws-novo-cancelar');
        if (cancelarNovo) cancelarNovo.onclick = () => {
            q('#ws-novo-nome').value = '';
            msg('');
            abrirFecharWorkspace(false, false);
        };
        q('#ws-sair').onclick = () => sairDaConta();
        const criar = async () => {
            const btn = q('#ws-novo-ok'), inp = q('#ws-novo-nome');
            const nome = nomeWsValido(inp.value);
            if (!nome) return msg('Digite um nome para o workspace.');
            btn.disabled = true; msg('');
            try {
                /* primeiro workspace de quem ainda tinha dados só neste navegador: leva esses dados junto */
                const locais = vazio ? dadosLocaisAntigos() : null;
                const ws = await criarWorkspace(nome, locais);
                ws.__importouLocal = !!locais;
                concluir(ws);
            } catch (e) {
                console.error(e);
                btn.disabled = false;
                msg(e && e.code === '42501' ? 'Sem permissão para criar workspaces. Verifique as políticas RLS no Supabase.' : (e.message || 'Não foi possível criar o workspace.'));
            }
        };
        q('#ws-novo-ok').onclick = criar;
        q('#ws-novo-nome').addEventListener('keydown', e => { if (e.key === 'Enter') criar(); });
        if (vazio) q('#ws-novo-nome').focus();
    });
}

