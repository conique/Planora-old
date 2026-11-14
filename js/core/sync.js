/* ---------- envio com controle de conflito ---------- */
/* Envia já (use antes de trocar de página, para não perder o que acabou de salvar). */
function descarregarNuvem() {
    clearTimeout(timer);
    fila = fila.then(enviar);
    return fila;
}
function agendarEnvio() {
    if (!nuvemAtiva()) return;
    setStatus('Salvando...');
    clearTimeout(timer);
    timer = setTimeout(() => { fila = fila.then(enviar); }, 200);
}
/* Envio imediato (usado depois de arrastar linhas, para não depender do tempo de espera). */
function enviarAgora() {
    if (!nuvemAtiva()) return;
    clearTimeout(timer);
    setStatus('Salvando...');
    fila = fila.then(enviar);
}

/* Avisa antes de fechar/recarregar se ainda há alteração não enviada à nuvem. */
let saidaComPendenciasConfirmada = false;
function permitirNavegacaoComPendencias() {
    saidaComPendenciasConfirmada = true;
}
window.addEventListener('beforeunload', e => {
    if (!saidaComPendenciasConfirmada && nuvemAtiva() && localStorage.getItem(chavePend()) === '1') {
        e.preventDefault();
        e.returnValue = '';
    }
});

function serializarJsonEstavel(valor) {
    if (Array.isArray(valor)) return valor.map(serializarJsonEstavel);
    if (!valor || typeof valor !== 'object') return valor;
    return Object.keys(valor).sort().reduce((obj, chave) => {
        obj[chave] = serializarJsonEstavel(valor[chave]);
        return obj;
    }, {});
}
function assinaturaRegistro(registro) {
    return JSON.stringify(serializarJsonEstavel([
        registro.parent_record_id || null,
        registro.kind,
        Number(registro.position),
        registro.payload || {}
    ]));
}
function profundidadeRegistro(registro, porId, visitados = new Set()) {
    if (!registro.parent_record_id || visitados.has(registro.record_id)) return 0;
    visitados.add(registro.record_id);
    const pai = porId.get(registro.parent_record_id);
    return pai ? 1 + profundidadeRegistro(pai, porId, visitados) : 0;
}
async function sincronizarRegistrosNuvem(workspaceId) {
    const base = lerBaseRegistros();
    if (base === null) throw new Error('Não há uma base de sincronização dos registros. Recarregue o workspace.');
    const atuais = JSON.parse(JSON.stringify(registrosParaPersistir(lerBancoDeDados())));
    const basePorId = new Map(base.map(registro => [registro.record_id, registro]));
    const atuaisPorId = new Map(atuais.map(registro => [registro.record_id, registro]));
    const upserts = atuais.filter(registro => {
        const salvo = basePorId.get(registro.record_id);
        return !salvo || assinaturaRegistro(registro) !== assinaturaRegistro(salvo);
    }).sort((a, b) => profundidadeRegistro(a, atuaisPorId) - profundidadeRegistro(b, atuaisPorId))
        .map(registro => ({
            ...registro,
            expected_revision: basePorId.has(registro.record_id)
                ? Number(basePorId.get(registro.record_id).revision)
                : null
        }));
    const removidos = base.filter(registro => !atuaisPorId.has(registro.record_id))
        .sort((a, b) => profundidadeRegistro(b, basePorId) - profundidadeRegistro(a, basePorId))
        .map(registro => ({ record_id: registro.record_id, expected_revision: Number(registro.revision) }));

    if (!upserts.length && !removidos.length) return;
    const { data, error } = await sb.rpc('planora_apply_workspace_record_changes', {
        p_workspace_id: workspaceId,
        p_upserts: upserts,
        p_deletes: removidos
    });
    if (error) {
        if (error.code === '40001') {
            setStatus('Conflito: um registro foi alterado em outro dispositivo');
            alert('Outro usuário alterou um dos mesmos registros. Recarregue o workspace antes de continuar.\n\nSuas alterações locais continuam neste navegador.');
        } else if (error.code === 'PGRST202' || error.code === '42883') {
            setStatus('Migração SQL incompleta');
            alert('A função de sincronização colaborativa não foi encontrada no Supabase. Aplique supabase_workspace_collaboration.sql e tente novamente.');
        }
        throw error;
    }
    if (data && data.length) aplicarMetadadosRegistrosLocal(data);
    const revisoes = new Map((data || []).map(registro => [registro.record_id, Number(registro.revision)]));
    salvarBaseRegistros(atuais.map(registro => ({
        ...registro,
        revision: revisoes.get(registro.record_id) ||
            Number(basePorId.get(registro.record_id)?.revision) ||
            1
    })));
}
async function sincronizarPreferenciasNuvem(workspaceId) {
    const preferencias = JSON.parse(JSON.stringify(lerPreferenciasBanco()));
    const atuais = JSON.stringify(serializarJsonEstavel(preferencias));
    const sincronizadas = preferenciasSincronizadas === null
        ? null
        : JSON.stringify(serializarJsonEstavel(preferenciasSincronizadas));
    if (atuais === sincronizadas && dadosWorkspacePersistidos?.registros_individuais === true) return;

    const legado = Array.isArray(dadosWorkspacePersistidos)
        ? { itens: dadosWorkspacePersistidos, preferencias: {} }
        : dadosWorkspacePersistidos && typeof dadosWorkspacePersistidos === 'object'
            ? { ...dadosWorkspacePersistidos }
            : { itens: [] };
    const dados = { ...legado, preferencias, registros_individuais: true };
    const agora = new Date().toISOString();
    let resposta;
    if (versao === null) {
        resposta = await sb.from(TABELA_DADOS)
            .upsert({ workspace_id: workspaceId, dados, atualizado_em: agora }, { onConflict: 'workspace_id' })
            .select('atualizado_em').single();
    } else {
        resposta = await sb.from(TABELA_DADOS).update({ dados, atualizado_em: agora })
            .eq('workspace_id', workspaceId).eq('atualizado_em', versao)
            .select('atualizado_em').maybeSingle();
    }
    if (resposta.error) throw resposta.error;
    if (!resposta.data) {
        setStatus('Conflito: preferências alteradas em outro dispositivo');
        alert('As preferências do workspace foram alteradas em outro dispositivo. Recarregue a página para sincronizá-las.');
        const conflito = new Error('Conflito ao salvar as preferências do workspace.');
        conflito.code = '40001';
        throw conflito;
    }
    versao = resposta.data.atualizado_em;
    dadosWorkspacePersistidos = dados;
    preferenciasSincronizadas = JSON.parse(JSON.stringify(preferencias));
}

async function enviar() {
    if (!nuvemAtiva()) return false;
    if (workspaceAtual.role === 'viewer') {
        setStatus('Modo visualizador: alterações desativadas');
        return false;
    }
    const minhaSeq = seq;
    const wid = workspaceAtual.id;
    try {
        if (usarRegistrosIndividuais) {
            await sincronizarRegistrosNuvem(wid);
            await sincronizarPreferenciasNuvem(wid);
            if (minhaSeq === seq) localStorage.removeItem(chavePend());
            const api = window.Planora_Workspaces;
            if (api && typeof api.processarAtualizacaoRemotaPendente === 'function') {
                await api.processarAtualizacaoRemotaPendente();
            }
            setStatus('Salvo na nuvem');
            return true;
        }
        const dados = montarDadosPersistidos();
        let r;
        /* atualizado_em é o "número da versão" do controle de conflito: gravamos um valor novo a cada envio,
           sem depender de gatilho no banco. */
        const agora = new Date().toISOString();
        if (versao === null) {
            r = await sb.from(TABELA_DADOS).upsert({ workspace_id: wid, dados, atualizado_em: agora }, { onConflict: 'workspace_id' })
                .select('atualizado_em').single();
            if (r.error) throw r.error;
            versao = r.data.atualizado_em;
        } else {
            r = await sb.from(TABELA_DADOS).update({ dados, atualizado_em: agora })
                .eq('workspace_id', wid).eq('atualizado_em', versao).select('atualizado_em');
            if (r.error) throw r.error;
            if (!r.data.length) {
                setStatus('Conflito: recarregue a página');
                alert('Outro computador alterou os dados. Recarregue a página para ver a versão mais recente.\n\nSuas últimas alterações NÃO foram enviadas.');
                return false;
            }
            versao = r.data[0].atualizado_em;
        }
        if (minhaSeq === seq) localStorage.removeItem(chavePend());
        setStatus('Salvo na nuvem');
        return true;
    } catch (e) {
        console.error(e);
        setStatus(e.code === '40001' ? 'Conflito: recarregue o workspace'
            : e.code === 'PGRST202' || e.code === '42883' ? 'Migração SQL incompleta'
                : 'Erro ao salvar na nuvem');
        return false;
    }
}

