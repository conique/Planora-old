/* =========================================================
           INICIALIZAÇÃO
        ========================================================= */

        const _renderizarTimelineBase = renderizarTimeline;
renderizarTimeline = async function () {
    await _renderizarTimelineBase();
    if (window.Planora_Topo) {
        const cadeia = [];
        let pid = projetoAtual.pai, guarda = 0;
        while (pid && guarda++ < 50) {
            const f = db.find(x => x.tipo === 'pasta' && x.id === pid);
            if (!f) break;
            cadeia.unshift(f);
            pid = f.pai;
        }
        Planora_Topo.definirCaminho([
            ...cadeia.map(f => ({ nome: f.nome, pasta: f.id, href: 'index.html?pasta=' + f.id })),
            { nome: projetoAtual.nome }
        ]);
        const voltar = document.querySelector('.btn-voltar');
        if (voltar && projetoAtual.pai) voltar.href = 'index.html?pasta=' + projetoAtual.pai;
    }
    sincronizarFormulario();
    sincronizarMinimizar();
    ajustarTodasLegendas();
};

window.addEventListener('Planora-dados-restaurados', e => {
    db = e.detail.dados;
    projetoAtual = db[projetoId];
    if (!projetoAtual) {
        window.location.href = 'index.html';
        return;
    }
    renderizarTimeline();
});

(async function() {

            try {
                await abrirBancoMidia();
            } catch (erro) {
                console.error(
                    'IndexedDB não pôde ser inicializado:',
                    erro
                );
            }

            renderizarTimeline();
        })();
