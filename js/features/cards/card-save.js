/* =========================================================
           SALVAR EDIÇÃO
        ========================================================= */

        async function salvarEdicaoCard(index) {

            const novoTipo =
                document.getElementById(
                    `edit-tipo-${index}`
                ).value;

            const novoTitulo =
                document.getElementById(
                    `edit-titulo-${index}`
                ).value.trim();

            const novaLegenda =
                document.getElementById(
                    `edit-legenda-${index}`
                ).value;

            if (!novoTitulo) {

                alert(
                    'O título não pode ficar vazio.'
                );

                return;
            }

            const dadosMidia =
                window[
                    `midiaTemporariaEdicao_${index}`
                ] || {
                    blob: null,
                    tipo: null,
                    midiaId: null,
                    removida: false
                };

            const card =
                projetoAtual.cards[index];

            try {

                /*
                 * Se uma nova mídia foi selecionada,
                 * salva primeiro a nova no IndexedDB.
                 */
                if (
                    dadosMidia.blob
                ) {

                    const novaMidiaId =
                        await salvarMidiaBlob(
                            dadosMidia.blob,
                            dadosMidia.tipo
                        );

                    /*
                     * Apaga a mídia antiga.
                     */
                    if (
                        card.midiaId &&
                        card.midiaId !== novaMidiaId
                    ) {

                        await deletarMidiaBlob(
                            card.midiaId
                        );
                    }

                    card.midia =
                        null;

                    card.midiaId =
                        novaMidiaId;

                    card.tipoMidia =
                        dadosMidia.tipo;
                }

                /*
                 * Se o usuário removeu a mídia.
                 */
                else if (
                    dadosMidia.removida
                ) {

                    if (card.midiaId) {

                        await deletarMidiaBlob(
                            card.midiaId
                        );
                    }

                    card.midia =
                        null;

                    card.midiaId =
                        null;

                    card.tipoMidia =
                        null;
                }

                card.tipo =
                    novoTipo;

                card.titulo =
                    novoTitulo;

                card.legenda =
                    novaLegenda.replace(
                        /\n/g,
                        '<br>'
                    );

                db[projetoId] =
                    projetoAtual;

                salvarBancoDeDados(db);

                await renderizarTimeline();

            } catch (erro) {

                console.error(
                    'Erro ao salvar edição:',
                    erro
                );

                alert(
                    'Não foi possível salvar as alterações.\n\n' +
                    'Erro: ' +
                    (erro.message || erro)
                );
            }
        }
