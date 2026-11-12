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
window.addEventListener('beforeunload', e => {
    if (nuvemAtiva() && localStorage.getItem(chavePend()) === '1') { e.preventDefault(); e.returnValue = ''; }
});

async function enviar() {
    if (!nuvemAtiva()) return false;
    const dados = montarDadosPersistidos();
    const minhaSeq = seq;
    const wid = workspaceAtual.id;
    try {
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
        setStatus('Erro ao salvar na nuvem');
        return false;
    }
}

