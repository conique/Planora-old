/* ---------- workspaces ---------- */
const nomeWsValido = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60);
const dataCurta = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR'); };
let canalRegistrosWorkspace = null;
let timerRealtimeWorkspace = null;
let reconciliacaoRegistrosEmAndamento = false;
let atualizacaoRemotaAguardando = false;

async function carregarWorkspaces() {
    const { data: proprios, error } = await sb.from(TABELA_WS).select('id,nome,created_at,legacy_user_id')
        .eq('owner_id', usuario.id).order('created_at', { ascending: true });
    if (error) throw error;
    const lista = (proprios || []).map(workspace => ({ ...workspace, role: 'owner' }));
    const propriosIds = new Set(lista.map(workspace => workspace.id));
    const { data: associacoes, error: erroAssociacoes } = await sb.from(TABELA_MEMBROS)
        .select('workspace_id,role').eq('user_id', usuario.id).eq('status', 'accepted');
    if (erroAssociacoes) throw erroAssociacoes;
    const papeisCompartilhados = new Map((associacoes || [])
        .filter(membro => !propriosIds.has(membro.workspace_id))
        .map(membro => [membro.workspace_id, membro.role]));
    const idsCompartilhados = [...papeisCompartilhados.keys()];
    if (idsCompartilhados.length) {
        const { data: compartilhados, error: erroCompartilhados } = await sb.from(TABELA_WS)
            .select('id,nome,created_at,legacy_user_id').in('id', idsCompartilhados);
        if (erroCompartilhados) throw erroCompartilhados;
        (compartilhados || []).forEach(workspace => lista.push({
            ...workspace,
            role: papeisCompartilhados.get(workspace.id)
        }));
    }
    lista.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (lista.length) {   // só para mostrar "atualizado em" na tela inicial; não traz o conteúdo (dados)
        const r = await sb.from(TABELA_DADOS).select('workspace_id,atualizado_em').in('workspace_id', lista.map(w => w.id));
        if (!r.error) (r.data || []).forEach(x => { const w = lista.find(y => y.id === x.workspace_id); if (w) w.atualizado_em = x.atualizado_em; });
    }
    return lista;
}
async function criarWorkspace(nome, dadosIniciais) {
    nome = nomeWsValido(nome);
    if (!nome) throw new Error('Digite um nome para o workspace.');
    if (listaWorkspaces.some(w => w.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Você já tem um workspace com esse nome.');
    const ws = { id: crypto.randomUUID(), owner_id: usuario.id, nome, created_at: new Date().toISOString() };
    const r = await sb.from(TABELA_WS).insert(ws).select('id,nome,created_at,legacy_user_id').single();
    if (r.error) throw r.error;
    const novo = { ...r.data, role: 'owner' };
    const dados = dadosIniciais || { itens: [], preferencias: { areas: AREAS_PADRAO.map(a => ({ ...a })) } };
    const atualizado_em = new Date().toISOString();
    const d = await sb.from(TABELA_DADOS).insert({ workspace_id: novo.id, dados, atualizado_em });
    /* se esta segunda gravação falhar, o workspace existe sem dados; ao abrir, o primeiro envio cria a linha. */
    if (d.error) console.error('Workspace criado, mas os dados iniciais não foram gravados:', d.error);
    else novo.atualizado_em = atualizado_em;
    listaWorkspaces.push(novo);
    return novo;
}
/* A tabela legada Planora_dados foi aposentada. Novos dados existem apenas por workspace. */
function workspaceDaSessao(lista) {
    try {
        const s = JSON.parse(sessionStorage.getItem(SESSAO_WS) || 'null');
        if (s && s.u === usuario.id) return lista.find(w => w.id === s.w) || null;
    } catch (e) { /* sem escolha anterior */ }
    return null;
}
function ehTelaWorkspaces() {
    return location.pathname.split('/').pop() === 'workspaces.html';
}
function retornoSeguroWorkspaces(valor) {
    try {
        const destino = new URL(valor || 'index.html', location.href);
        const pagina = destino.pathname.split('/').pop();
        if (destino.origin !== location.origin || !['index.html', 'cards.html'].includes(pagina)) return 'index.html';
        return destino.pathname + destino.search + destino.hash;
    } catch (e) {
        return 'index.html';
    }
}
function urlTelaWorkspaces(retorno) {
    return 'workspaces.html?return=' + encodeURIComponent(retornoSeguroWorkspaces(retorno));
}
function urlRetornoWorkspaces() {
    return retornoSeguroWorkspaces(new URLSearchParams(location.search).get('return'));
}
/* Caminho do primeiro acesso: dados que só existiam neste navegador (modo local, antes da nuvem). */
function dadosLocaisAntigos() {
    try {
        const itens = JSON.parse(localStorage.getItem(CHAVE_DB));
        if (!Array.isArray(itens) || !itens.length) return null;
        let preferencias = {};
        try { const p = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS)); if (p && typeof p === 'object' && !Array.isArray(p)) preferencias = p; } catch (e) { /* padrão */ }
        return { itens, preferencias };
    } catch (e) { return null; }
}
/* Alterações que ficaram pendentes no cache da versão anterior (chaves sem id) vão para o workspace inicial. */
function adotarCachePendenteAntigo() {
    if (workspaceAtual.legacy_user_id !== usuario.id) return;
    if (localStorage.getItem(PEND_FLAG) !== '1' || localStorage.getItem(chaveDb()) !== null) return;
    const antigo = localStorage.getItem(CHAVE_DB);
    if (antigo === null) return;
    localStorage.setItem(chaveDb(), antigo);
    const pref = localStorage.getItem(CHAVE_PREFERENCIAS);
    if (pref !== null) localStorage.setItem(chavePreferencias(), pref);
    localStorage.setItem(chavePend(), '1');
    localStorage.removeItem(PEND_FLAG);
}
async function carregarRegistrosWorkspace(workspaceId) {
    const registros = [];
    const tamanhoPagina = 1000;
    for (let inicio = 0; ; inicio += tamanhoPagina) {
        const { data, error } = await sb.from(TABELA_REGISTROS)
            .select('record_id,workspace_id,parent_record_id,kind,position,payload,revision,created_by,created_at,updated_by,updated_at,legacy_key')
            .eq('workspace_id', workspaceId)
            .order('position', { ascending: true })
            .order('record_id', { ascending: true })
            .range(inicio, inicio + tamanhoPagina - 1);
        if (error) throw error;
        registros.push(...(data || []));
        if (!data || data.length < tamanhoPagina) return registros;
    }
}
async function carregarPessoasWorkspace(workspaceId) {
    const { data, error } = await sb.rpc('planora_list_workspace_people', {
        p_workspace_id: workspaceId
    });
    if (error) {
        console.error('Não foi possível carregar os nomes das pessoas do workspace:', error);
        definirPessoasWorkspace([]);
        return false;
    }
    definirPessoasWorkspace(data || []);
    return true;
}
function registrosRemotosDiferem(registros, base) {
    if (base === null || registros.length !== base.length) return true;
    const basePorId = new Map(base.map(registro => [registro.record_id, registro]));
    return registros.some(registro => {
        const anterior = basePorId.get(registro.record_id);
        return !anterior ||
            Number(registro.revision) !== Number(anterior.revision) ||
            assinaturaRegistro(registro) !== assinaturaRegistro(anterior);
    });
}
async function reconciliarRegistrosRemotos() {
    if (!nuvemAtiva() || !usarRegistrosIndividuais) return false;
    if (reconciliacaoRegistrosEmAndamento) {
        atualizacaoRemotaAguardando = true;
        return false;
    }
    if (localStorage.getItem(chavePend()) === '1') {
        atualizacaoRemotaAguardando = true;
        setStatus('Atualização remota aguardando envio local');
        return false;
    }

    reconciliacaoRegistrosEmAndamento = true;
    const workspaceId = workspaceAtual.id;
    try {
        const registros = await carregarRegistrosWorkspace(workspaceId);
        if (!workspaceAtual || workspaceAtual.id !== workspaceId) return false;
        if (localStorage.getItem(chavePend()) === '1') {
            atualizacaoRemotaAguardando = true;
            setStatus('Atualização remota aguardando envio local');
            return false;
        }
        if (!registrosRemotosDiferem(registros, lerBaseRegistros())) return false;
        await carregarPessoasWorkspace(workspaceId);
        if (!workspaceAtual || workspaceAtual.id !== workspaceId ||
            localStorage.getItem(chavePend()) === '1') {
            atualizacaoRemotaAguardando = true;
            return false;
        }
        instalarRegistrosWorkspace(registros);
        setStatus('Workspace atualizado em tempo real');
        return true;
    } catch (erro) {
        console.error('Não foi possível atualizar o workspace em tempo real:', erro);
        setStatus('Falha ao atualizar o workspace em tempo real');
        return false;
    } finally {
        reconciliacaoRegistrosEmAndamento = false;
        if (atualizacaoRemotaAguardando && localStorage.getItem(chavePend()) !== '1') {
            atualizacaoRemotaAguardando = false;
            setTimeout(reconciliarRegistrosRemotos, 0);
        }
    }
}
function iniciarRealtimeWorkspace(ws) {
    if (canalRegistrosWorkspace) sb.removeChannel(canalRegistrosWorkspace);
    clearTimeout(timerRealtimeWorkspace);
    atualizacaoRemotaAguardando = false;
    canalRegistrosWorkspace = sb.channel('workspace-records-' + ws.id)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: TABELA_REGISTROS,
            filter: 'workspace_id=eq.' + ws.id
        }, () => {
            clearTimeout(timerRealtimeWorkspace);
            timerRealtimeWorkspace = setTimeout(reconciliarRegistrosRemotos, 160);
        })
        .subscribe(status => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('A assinatura Realtime do workspace não pôde ser iniciada:', status);
                setStatus('Atualização em tempo real indisponível');
            }
        });
}
async function processarAtualizacaoRemotaPendente() {
    if (!atualizacaoRemotaAguardando || localStorage.getItem(chavePend()) === '1') return false;
    atualizacaoRemotaAguardando = false;
    return reconciliarRegistrosRemotos();
}
function tabelaRegistrosAusente(error) {
    return error && (error.code === 'PGRST205' || error.code === '42P01');
}
function preferenciasDoPayload(dados) {
    return dados && !Array.isArray(dados) && dados.preferencias &&
        typeof dados.preferencias === 'object' && !Array.isArray(dados.preferencias)
        ? dados.preferencias
        : {};
}
function itensLegadosDoPayload(dados) {
    if (Array.isArray(dados)) return dados;
    return dados && Array.isArray(dados.itens) ? dados.itens : [];
}
function associarIdsLegados(itens, registros) {
    const porChaveLegada = new Map(registros
        .filter(registro => registro.legacy_key)
        .map(registro => [registro.legacy_key, registro.record_id]));
    itens.forEach((item, itemIndex) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        const idItem = porChaveLegada.get(`legacy:item:${itemIndex}`);
        if (idItem) item._recordId = idItem;
        if (Array.isArray(item.cards)) {
            item.cards.forEach((card, cardIndex) => {
                if (!card || typeof card !== 'object' || Array.isArray(card)) return;
                const idCard = porChaveLegada.get(`legacy:card:${itemIndex}:${cardIndex}`);
                if (idCard) card._recordId = idCard;
            });
        }
    });
}
function confirmarMigracaoCacheAntigo(registrosRemotos, dadosRemotos) {
    return new Promise(resolve => {
        let itensLocais, preferenciasLocais;
        try {
            itensLocais = JSON.parse(JSON.stringify(lerBancoDeDados()));
            preferenciasLocais = JSON.parse(JSON.stringify(lerPreferenciasBanco()));
        } catch (erro) {
            console.error('Não foi possível preparar o backup do cache local:', erro);
            alert('Não foi possível preparar um backup dos dados locais. O cache foi mantido e nada foi sincronizado.');
            resolve(null);
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'lg-overlay';
        overlay.innerHTML = `<div class="lg-card" role="dialog" aria-modal="true" aria-labelledby="ws-cache-conflito-tit">
            <div class="lg-logo">!</div>
            <h2 id="ws-cache-conflito-tit">Alterações locais pendentes</h2>
            <p class="lg-sub">Para preservar esta versão, primeiro baixe um arquivo com o cache local e os registros atuais da nuvem. Depois, confirme para usar a versão local como principal. O arquivo contém dados do workspace; mantenha-o em local seguro.</p>
            <button class="lg-principal" id="ws-cache-backup" type="button">Baixar backup das duas versões</button>
            <button class="lg-principal" id="ws-cache-continuar" type="button" disabled>Sincronizar versão local</button>
            <p class="lg-msg" role="status" aria-live="polite"></p>
            <div class="lg-links"><button id="ws-cache-cancelar" type="button">Cancelar</button></div>
        </div>`;
        document.body.appendChild(overlay);

        const botaoBackup = overlay.querySelector('#ws-cache-backup');
        const botaoContinuar = overlay.querySelector('#ws-cache-continuar');
        const mensagem = overlay.querySelector('.lg-msg');
        const nomeSeguro = String(workspaceAtual.nome || 'workspace').replace(/[<>:"\/\\|?*\u0000-\u001f]/g, '-');
        const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
        let backupCriado = false;
        let concluido = false;
        const finalizar = valor => {
            if (concluido) return;
            concluido = true;
            document.removeEventListener('keydown', tecla);
            overlay.remove();
            resolve(valor);
        };
        const tecla = evento => {
            if (evento.key === 'Escape') finalizar(null);
        };

        botaoBackup.addEventListener('click', () => {
            try {
                const backup = {
                    formato: 'Planora-workspace-backup-v1',
                    criado_em: new Date().toISOString(),
                    workspace: { id: workspaceAtual.id, nome: workspaceAtual.nome },
                    local: {
                        itens: itensLocais,
                        preferencias: preferenciasLocais,
                        pendente: localStorage.getItem(chavePend()) === '1'
                    },
                    supabase: {
                        atualizado_em: versao,
                        dados_legados: dadosRemotos,
                        registros: registrosRemotos
                    }
                };
                const arquivo = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(arquivo);
                const link = document.createElement('a');
                link.href = url;
                link.download = `planora-backup-${nomeSeguro}-${carimbo}.json`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
                backupCriado = true;
                botaoBackup.disabled = true;
                botaoContinuar.disabled = false;
                mensagem.className = 'lg-msg ok';
                mensagem.textContent = 'Backup baixado. Confira o arquivo antes de continuar.';
            } catch (erro) {
                console.error('Não foi possível baixar o backup do workspace:', erro);
                mensagem.textContent = 'Falha ao criar o backup. Nada foi sincronizado; tente novamente.';
            }
        });
        botaoContinuar.addEventListener('click', () => {
            if (backupCriado) finalizar({ itens: itensLocais, preferencias: preferenciasLocais });
        });
        overlay.querySelector('#ws-cache-cancelar').addEventListener('click', () => finalizar(null));
        document.addEventListener('keydown', tecla);
        botaoBackup.focus();
    });
}
async function ativarWorkspace(ws, importouLocal) {
    workspaceAtual = ws;
    avisoVisualizadorExibido = false;
    definirPessoasWorkspace([]);
    document.documentElement.dataset.workspaceRole = ws.role || 'owner';
    versao = null;
    try {
        sessionStorage.setItem(SESSAO_WS, JSON.stringify({ u: usuario.id, w: ws.id }));
        localStorage.setItem(ULTIMO_WS + ':' + usuario.id, ws.id);
    } catch (e) { /* sem armazenamento */ }
    adotarCachePendenteAntigo();
    inicializarHistorico();
    const { data, error } = await sb.from(TABELA_DADOS).select('dados,atualizado_em').eq('workspace_id', ws.id).maybeSingle();
    if (error) {
        console.error(error);
        sb = null; usuario = null; // não envia nada, para não sobrescrever a nuvem
        setStatus('Erro ao carregar da nuvem (somente leitura local)');
        return false;
    }
    await carregarPessoasWorkspace(ws.id);
    versao = data ? data.atualizado_em : null;
    dadosWorkspacePersistidos = data ? data.dados : null;

    let registros;
    try {
        registros = await carregarRegistrosWorkspace(ws.id);
        usarRegistrosIndividuais = true;
    } catch (erro) {
        if (!tabelaRegistrosAusente(erro)) {
            console.error(erro);
            sb = null; usuario = null;
            setStatus('Erro ao carregar os registros do workspace');
            alert('Não foi possível carregar os registros individuais. Confirme se a migração SQL foi aplicada no Supabase.\n\nErro: ' + (erro.message || erro));
            return false;
        }
        usarRegistrosIndividuais = false;
        console.warn('A tabela de registros individuais ainda não existe; usando o armazenamento legado.');
    }

    if (ws.role === 'viewer' && localStorage.getItem(chavePend()) === '1') {
        setStatus('Alterações locais pendentes: modo visualizador');
        alert('Este workspace agora está em modo de visualização, mas há alterações locais pendentes de quando você tinha acesso de edição. Elas foram preservadas neste navegador e não serão enviadas. Faça um backup antes de continuar.');
        return false;
    }

    if (!usarRegistrosIndividuais) {
        if (data) {
            if (localStorage.getItem(chavePend()) === '1') {
                await enviar();
            } else {
                const migrarFormato = carregarDadosPersistidos(data.dados);
                preferenciasSincronizadas = preferenciasDoPayload(data.dados);
                if (migrarFormato) {
                    localStorage.setItem(chavePend(), '1');
                    seq++;
                    if (!await enviar()) return false;
                }
            }
        } else if (!await enviar()) {
            return false;
        }
    } else {
        let pendente = localStorage.getItem(chavePend()) === '1';
        if (pendente && localStorage.getItem(chaveDb()) === null) {
            localStorage.removeItem(chavePend());
            pendente = false;
        }
        const baseLocal = lerBaseRegistros();
        const dadosRemotos = data ? data.dados : null;
        const jaMigrado = !!(dadosRemotos && !Array.isArray(dadosRemotos) && dadosRemotos.registros_individuais);
        preferenciasSincronizadas = JSON.parse(JSON.stringify(preferenciasDoPayload(dadosRemotos)));

        if (pendente && baseLocal === null && registros.length) {
            const cacheConfirmado = await confirmarMigracaoCacheAntigo(registros, dadosRemotos);
            if (!cacheConfirmado) {
                setStatus('Cache local preservado; aguardando confirmação');
                return false;
            }
            try {
                salvarBaseRegistros(registros);
                associarIdsLegados(cacheConfirmado.itens, registros);
                prepararRegistrosLocais(cacheConfirmado.itens);
                localStorage.setItem(chaveDb(), JSON.stringify(cacheConfirmado.itens));
                localStorage.setItem(chavePreferencias(), JSON.stringify(cacheConfirmado.preferencias));
                sincronizarHistoricoComBanco();
                dadosWorkspacePersistidos = dadosRemotos;
                localStorage.setItem(chavePend(), '1');
                seq++;
            } catch (erro) {
                localStorage.removeItem(chaveBaseRegistros());
                console.error('Não foi possível preparar o cache local para sincronização:', erro);
                setStatus('Falha ao preparar a recuperação local');
                alert('O backup foi preservado, mas não foi possível preparar a sincronização. Os dados locais continuam neste navegador.\n\nErro: ' + (erro.message || erro));
                return false;
            }
            if (!await enviar()) return false;
        }

        if (pendente && !(baseLocal === null && registros.length)) {
            dadosWorkspacePersistidos = dadosRemotos;
            if (baseLocal === null) {
                salvarBaseRegistros([]);
                if (localStorage.getItem(chaveDb()) === null) {
                    instalarPreferenciasWorkspace(dadosRemotos);
                    instalarItensLegadosWorkspace(dadosRemotos || { itens: [] });
                }
            }
            if (!await enviar()) return false;
        } else if (!pendente) {
            instalarPreferenciasWorkspace(dadosRemotos);
            if (registros.length || jaMigrado) {
                instalarRegistrosWorkspace(registros);
                dadosWorkspacePersistidos = dadosRemotos;
                if (!jaMigrado) {
                    localStorage.setItem(chavePend(), '1');
                    seq++;
                    if (!await enviar()) return false;
                }
            } else {
                const itensLegados = itensLegadosDoPayload(dadosRemotos);
                const itensIniciais = itensLegados.length ? itensLegados : data ? [] : lerBancoDeDados();
                instalarItensLegadosWorkspace(itensIniciais);
                dadosWorkspacePersistidos = dadosRemotos;
                localStorage.setItem(chavePend(), '1');
                seq++;
                if (!await enviar()) return false;
            }
        }
    }
    if (!await garantirAreasPadrao()) return false;
    if (importouLocal) await sincronizarMidiasLocais();
    try { await migrarMidiasLegadasWorkspace(); }
    catch (erro) { console.error('Não foi possível migrar as mídias antigas do workspace:', erro); }
    iniciarRealtimeWorkspace(ws);
    setStatus(ws.role === 'viewer' ? 'Modo visualizador' : 'Salvo na nuvem');
    reenviarPendentes();
    window.dispatchEvent(new Event('Planora-areas-atualizadas'));
    window.dispatchEvent(new Event('Planora-workspace-atualizado'));
    return true;
}
/* Troca de workspace: envia o que estiver pendente e recarrega na raiz do novo workspace.
   id = null volta para a tela de boas-vindas. */
async function trocarWorkspace(id) {
    if (!await garantirEnvioPendente()) {
        if (id) {
            alert('Não foi possível confirmar o envio dos dados para a nuvem. Você continua neste workspace para não perder nada.');
            return false;
        }
        const continuar = confirm('Não foi possível enviar as alterações agora. Elas permanecem salvas neste navegador, mas não estão na nuvem. Deseja abrir o menu de workspaces para responder ao convite? Não limpe os dados do navegador antes de fazer backup.');
        if (!continuar) return false;
        permitirNavegacaoComPendencias();
    }
    try {
        if (id) sessionStorage.setItem(SESSAO_WS, JSON.stringify({ u: usuario.id, w: id }));
        else sessionStorage.removeItem(SESSAO_WS);
    } catch (e) { /* sem armazenamento */ }
    location.href = id ? 'index.html' : urlTelaWorkspaces(location.pathname + location.search + location.hash);
    return true;
}
async function novoWorkspaceInterativo() {
    const nome = await pedirNomeWorkspace();
    if (!nome) return;
    try {
        const ws = await criarWorkspace(nome);
        await trocarWorkspace(ws.id);
    } catch (e) {
        console.error(e);
        alert('Não foi possível criar o workspace: ' + (e.message || e));
    }
}
/* Grava o novo nome de um workspace (só o dono consegue; exige a política de UPDATE em Planora_workspaces). */
async function salvarNomeWorkspace(id, nomeBruto) {
    const nome = nomeWsValido(nomeBruto);
    if (!nome) throw new Error('Digite um nome para o workspace.');
    const ws = listaWorkspaces.find(w => w.id === id);
    if (!ws) throw new Error('Workspace não encontrado.');
    if (ws.role !== 'owner') {
        const erro = new Error('Somente o dono do workspace pode renomeá-lo.');
        erro.code = '42501';
        throw erro;
    }
    if (nome === ws.nome) return false;
    if (listaWorkspaces.some(w => w.id !== id && w.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Você já tem um workspace com esse nome.');
    const { data, error } = await sb.from(TABELA_WS).update({ nome })
        .eq('id', id).eq('owner_id', usuario.id).select('id,nome').maybeSingle();
    if (error) throw error;
    if (!data) {
        const e = new Error('O Supabase não permitiu renomear. Confira a política de UPDATE em Planora_workspaces (supabase/02_politicas_workspaces.sql).');
        e.code = '42501';
        throw e;
    }
    ws.nome = data.nome;
    if (workspaceAtual && workspaceAtual.id === id) workspaceAtual.nome = data.nome;
    window.dispatchEvent(new Event('Planora-workspace-atualizado'));
    return true;
}
async function renomearWorkspaceInterativo(id) {
    const ws = listaWorkspaces.find(w => w.id === id);
    if (!ws) throw new Error('Workspace não encontrado.');
    const nome = await pedirNovoNomeWorkspace(ws);
    if (!nome || nome === ws.nome) return false;
    return salvarNomeWorkspace(id, nome);
}
function gerenciarCompartilhamento(id) {
    const ws = listaWorkspaces.find(workspace => workspace.id === id);
    if (!ws) return Promise.reject(new Error('Workspace não encontrado.'));
    if (ws.role !== 'owner') return Promise.reject(new Error('Somente o dono pode gerenciar o compartilhamento.'));

    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'lg-overlay';
        overlay.innerHTML = `<div class="lg-card ws-share-card" role="dialog" aria-modal="true" aria-labelledby="ws-share-tit">
            <div class="lg-logo" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"></path></svg></div>
            <h2 id="ws-share-tit">Compartilhar workspace</h2>
            <p class="lg-sub">Adicione pessoas que já têm uma conta Planora e escolha se podem editar ou apenas visualizar.</p>
            <form class="ws-share-form" id="ws-share-form">
                <label>E-mail da conta<input id="ws-share-email" type="email" autocomplete="off" placeholder="pessoa@empresa.com" required></label>
                <label>Acesso<select id="ws-share-role"><option value="editor">Editor</option><option value="viewer">Visualizador</option></select></label>
                <button class="lg-principal" id="ws-share-add" type="submit">Adicionar pessoa</button>
            </form>
            <p class="lg-msg" role="status" aria-live="polite"></p>
            <h3 class="ws-share-subtitulo">Pessoas com acesso</h3>
            <div class="ws-share-members" id="ws-share-members"><p class="ws-share-vazio">Carregando...</p></div>
            <div class="lg-links"><button id="ws-share-close" type="button">Fechar</button></div>
        </div>`;
        document.body.appendChild(overlay);

        const q = seletor => overlay.querySelector(seletor);
        q('#ws-share-tit').textContent = 'Compartilhar: ' + ws.nome;
        const lista = q('#ws-share-members');
        const mensagem = q('.lg-msg');
        let fechada = false;
        const fechar = () => {
            if (fechada) return;
            fechada = true;
            document.removeEventListener('keydown', tecla);
            overlay.remove();
            resolve();
        };
        const tecla = evento => { if (evento.key === 'Escape') fechar(); };
        const mostrarMensagem = (texto, ok) => {
            mensagem.textContent = texto;
            mensagem.className = 'lg-msg' + (ok ? ' ok' : '');
        };
        const erroAmigavel = (erro, acao) => {
            if (erro && erro.code === 'P0002' && acao === 'adicionar') {
                return 'Não encontramos uma conta Planora com esse e-mail.';
            }
            if (erro && erro.code === '42501') return 'Somente o dono pode gerenciar os membros deste workspace.';
            if (erro && /column reference "user_id" is ambiguous/i.test(erro.message || '')) {
                return 'A função de compartilhamento do Supabase está desatualizada. Execute novamente a versão atualizada de supabase_workspace_collaboration.sql.';
            }
            return erro && erro.message ? erro.message : 'Não foi possível concluir a operação.';
        };
        const carregarMembros = async () => {
            lista.replaceChildren();
            const carregando = document.createElement('p');
            carregando.className = 'ws-share-vazio';
            carregando.textContent = 'Carregando...';
            lista.appendChild(carregando);
            const { data, error } = await sb.rpc('planora_list_workspace_members', {
                p_workspace_id: ws.id
            });
            if (error) throw error;
            lista.replaceChildren();
            (data || []).forEach(membro => {
                const linha = document.createElement('div');
                linha.className = 'ws-share-membro';
                const identificacao = document.createElement('div');
                identificacao.className = 'ws-share-identificacao';
                const nome = document.createElement('strong');
                nome.textContent = membro.display_name || membro.email || 'Membro';
                const email = document.createElement('span');
                email.textContent = membro.email || '';
                identificacao.append(nome, email);
                if (membro.status === 'pending') {
                    const pendente = document.createElement('span');
                    pendente.className = 'ws-share-status-pendente';
                    pendente.textContent = 'Convite pendente';
                    identificacao.appendChild(pendente);
                }
                linha.appendChild(identificacao);

                if (membro.role === 'owner') {
                    const papel = document.createElement('span');
                    papel.className = 'ws-share-papel';
                    papel.textContent = 'Dono';
                    linha.appendChild(papel);
                } else {
                    const acoes = document.createElement('div');
                    acoes.className = 'ws-share-acoes';
                    const papel = document.createElement('select');
                    papel.setAttribute('aria-label', 'Permissão de ' + (membro.display_name || membro.email));
                    papel.innerHTML = '<option value="editor">Editor</option><option value="viewer">Visualizador</option>';
                    papel.value = membro.role;
                    papel.addEventListener('change', async () => {
                        papel.disabled = true;
                        try {
                            const { error: erroPapel } = await sb.rpc('planora_update_workspace_member_role', {
                                p_workspace_id: ws.id,
                                p_user_id: membro.user_id,
                                p_role: papel.value
                            });
                            if (erroPapel) throw erroPapel;
                            mostrarMensagem('Permissão atualizada.', true);
                        } catch (erro) {
                            console.error('Não foi possível alterar a permissão do membro:', erro);
                            mostrarMensagem(erroAmigavel(erro, 'alterar'));
                            try { await carregarMembros(); } catch (erroLista) { console.error(erroLista); }
                        } finally {
                            papel.disabled = false;
                        }
                    });
                    const remover = document.createElement('button');
                    remover.className = 'ws-share-remover';
                    remover.type = 'button';
                    remover.textContent = 'Remover';
                    remover.setAttribute('aria-label', 'Remover ' + (membro.display_name || membro.email));
                    remover.addEventListener('click', async () => {
                        if (!confirm('Remover o acesso de ' + (membro.display_name || membro.email) + '?')) return;
                        remover.disabled = true;
                        try {
                            const { error: erroRemover } = await sb.rpc('planora_remove_workspace_member', {
                                p_workspace_id: ws.id,
                                p_user_id: membro.user_id
                            });
                            if (erroRemover) throw erroRemover;
                            mostrarMensagem('Acesso removido.', true);
                            await carregarMembros();
                        } catch (erro) {
                            console.error('Não foi possível remover o membro:', erro);
                            mostrarMensagem(erroAmigavel(erro, 'remover'));
                            remover.disabled = false;
                        }
                    });
                    acoes.append(papel, remover);
                    linha.appendChild(acoes);
                }
                lista.appendChild(linha);
            });
            if (!lista.children.length) {
                const vazio = document.createElement('p');
                vazio.className = 'ws-share-vazio';
                vazio.textContent = 'Ainda não há pessoas compartilhadas.';
                lista.appendChild(vazio);
            }
        };

        q('#ws-share-form').addEventListener('submit', async evento => {
            evento.preventDefault();
            const botao = q('#ws-share-add');
            const email = q('#ws-share-email').value.trim();
            botao.disabled = true;
            mostrarMensagem('', false);
            try {
                const { data, error } = await sb.rpc('planora_add_workspace_member', {
                    p_workspace_id: ws.id,
                    p_email: email,
                    p_role: q('#ws-share-role').value
                });
                if (error) throw error;
                q('#ws-share-email').value = '';
                const membro = Array.isArray(data) ? data[0] : null;
                mostrarMensagem(membro && membro.status === 'accepted'
                    ? 'A pessoa já tinha acesso; a permissão foi atualizada.'
                    : 'Convite criado. A pessoa poderá aceitá-lo ou recusá-lo ao abrir a tela de workspaces.', true);
                await carregarMembros();
            } catch (erro) {
                console.error('Não foi possível adicionar o membro:', erro);
                mostrarMensagem(erroAmigavel(erro, 'adicionar'));
            } finally {
                botao.disabled = false;
            }
        });
        q('#ws-share-close').addEventListener('click', fechar);
        overlay.addEventListener('click', evento => { if (evento.target === overlay) fechar(); });
        document.addEventListener('keydown', tecla);
        carregarMembros().catch(erro => {
            console.error('Não foi possível carregar os membros do workspace:', erro);
            mostrarMensagem(erroAmigavel(erro, 'listar'));
            lista.replaceChildren();
        });
        q('#ws-share-email').focus();
    });
}
window.Planora_Workspaces = {
    get lista() { return listaWorkspaces.slice(); },
    get atual() { return workspaceAtual; },
    selecionar: trocarWorkspace,
    telaInicial: () => trocarWorkspace(null),
    criarNovo: novoWorkspaceInterativo,
    renomear: renomearWorkspaceInterativo,
    salvarNome: salvarNomeWorkspace,
    gerenciarCompartilhamento: gerenciarCompartilhamento,
    processarAtualizacaoRemotaPendente
};

/* Janela simples para dar nome a um novo workspace (usada pelo painel lateral). */
function pedirNomeWorkspace() {
    return new Promise(res => {
        const o = document.createElement('div');
        o.className = 'lg-overlay';
        o.innerHTML = `<div class="lg-card" role="dialog" aria-modal="true" aria-labelledby="ws-nome-tit">
            <div class="lg-logo">+</div><h2 id="ws-nome-tit">Novo workspace</h2>
            <p class="lg-sub">Dê um nome para o novo espaço. Ele começa vazio e não mexe nos seus outros workspaces.</p>
            <label>Nome<input id="ws-nome-in" type="text" maxlength="60" placeholder="Ex.: Projetos 2026" autocomplete="off"></label>
            <p class="lg-msg" role="alert"></p>
            <button class="lg-principal" id="ws-nome-ok" type="button">Criar e entrar</button>
            <div class="lg-links"><button id="ws-nome-cancelar" type="button">Cancelar</button></div></div>`;
        document.body.appendChild(o);
        const inp = o.querySelector('#ws-nome-in'), msg = o.querySelector('.lg-msg');
        const fechar = v => { document.removeEventListener('keydown', tecla); o.remove(); res(v); };
        const confirmar = () => {
            const n = nomeWsValido(inp.value);
            if (!n) { msg.textContent = 'Digite um nome para o workspace.'; return; }
            if (listaWorkspaces.some(w => w.nome.toLowerCase() === n.toLowerCase())) { msg.textContent = 'Você já tem um workspace com esse nome.'; return; }
            fechar(n);
        };
        const tecla = e => { if (e.key === 'Escape') fechar(null); };
        document.addEventListener('keydown', tecla);
        o.querySelector('#ws-nome-ok').onclick = confirmar;
        o.querySelector('#ws-nome-cancelar').onclick = () => fechar(null);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirmar(); });
        inp.focus();
    });
}
function pedirNovoNomeWorkspace(ws) {
    return new Promise(res => {
        const o = document.createElement('div');
        o.className = 'lg-overlay';
        o.innerHTML = `<div class="lg-card" role="dialog" aria-modal="true" aria-labelledby="ws-renomear-tit">
            <div class="lg-logo">✎</div><h2 id="ws-renomear-tit">Renomear workspace</h2>
            <p class="lg-sub">O nome novo aparecerá no seletor e no painel lateral.</p>
            <label>Nome<input id="ws-renomear-in" type="text" maxlength="60" autocomplete="off"></label>
            <p class="lg-msg" role="alert"></p>
            <button class="lg-principal" id="ws-renomear-ok" type="button">Salvar nome</button>
            <div class="lg-links"><button id="ws-renomear-cancelar" type="button">Cancelar</button></div></div>`;
        document.body.appendChild(o);
        const inp = o.querySelector('#ws-renomear-in'), msg = o.querySelector('.lg-msg');
        inp.value = ws.nome;
        const fechar = v => { document.removeEventListener('keydown', tecla); o.remove(); res(v); };
        const confirmar = () => {
            const nome = nomeWsValido(inp.value);
            if (!nome) { msg.textContent = 'Digite um nome para o workspace.'; return; }
            fechar(nome);
        };
        const tecla = e => { if (e.key === 'Escape') fechar(null); };
        document.addEventListener('keydown', tecla);
        o.querySelector('#ws-renomear-ok').onclick = confirmar;
        o.querySelector('#ws-renomear-cancelar').onclick = () => fechar(null);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirmar(); });
        inp.focus();
        inp.select();
    });
}

