async function salvarEdicaoCard(index) {
    const novoTitulo = document.getElementById(`edit-titulo-${index}`).value.trim();
    if (!novoTitulo) {
        alert('O título não pode ficar vazio.');
        return;
    }

    const card = projetoAtual.cards[index];
    const editor = document.getElementById(`edit-legenda-${index}`);
    const botaoSalvar = document.querySelector(`#card-conteudo-${index} .btn-enviar-card`);
    const idsAntigos = new Set(Planora_RichText.ids(card.conteudoHtml || ''));
    if (card.midiaId) idsAntigos.add(card.midiaId);

    try {
        if (botaoSalvar) {
            botaoSalvar.disabled = true;
            botaoSalvar.textContent = 'Salvando...';
        }

        const conteudoHtml = await Planora_RichText.serializar(editor, `edicao-${index}`);
        const idsNovos = new Set(Planora_RichText.ids(conteudoHtml));
        for (const id of idsAntigos) {
            if (!idsNovos.has(id)) await deletarMidiaBlob(id);
        }

        card.titulo = novoTitulo;
        card.conteudoHtml = conteudoHtml;
        card.legenda = '';
        card.midia = null;
        card.midiaId = null;
        card.tipoMidia = null;
        db[projetoId] = projetoAtual;
        salvarBancoDeDados(db);

        Planora_RichText.liberar(`edicao-${index}`, document.getElementById(`card-conteudo-${index}`));
        await renderizarTimeline();
    } catch (erro) {
        console.error('Erro ao salvar edição:', erro);
        alert('Não foi possível salvar as alterações.\n\nErro: ' + (erro.message || erro));
        if (botaoSalvar) {
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = 'Salvar';
        }
    }
}
