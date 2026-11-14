/* =========================================================
           ENVIAR NOVO CARD
        ========================================================= */

        async function adicionarCard() {

            const titulo =
                document.getElementById(
                    'inputTituloCard'
                ).value.trim();

            const legenda =
                document.getElementById(
                    'inputLegendaCard'
                ).value;

            const botao =
                document.getElementById(
                    'btnEnviarCard'
                );

            if (!titulo) {

                alert(
                    'O card precisa de um título.'
                );

                document.getElementById(
                    'inputTituloCard'
                ).focus();

                return;
            }

            botao.disabled = true;
            botao.textContent = '...';

            try {

                let midiaId = null;

                /*
                 * AQUI ESTÁ A CORREÇÃO:
                 * a imagem/vídeo vai para IndexedDB,
                 * e não para localStorage.
                 */
                if (
                    midiaTemporariaNovo &&
                    midiaTemporariaNovo.blob
                ) {

                    midiaId =
                        await salvarMidiaBlob(
                            midiaTemporariaNovo.blob,
                            midiaTemporariaNovo.tipo
                        );
                }

                const agora =
                    new Date();

                const dataString =
                    `${agora.toLocaleDateString('pt-BR')} às ${
                        agora.toLocaleTimeString(
                            'pt-BR',
                            {
                                hour: '2-digit',
                                minute: '2-digit'
                            }
                        )
                    }`;

                const novoCard = {

                    titulo: titulo,

                    legenda:
                        legenda.replace(
                            /\n/g,
                            '<br>'
                        ),

                    data: dataString,

                    /*
                     * Mantido como null para os cards novos.
                     * A mídia fica em IndexedDB.
                     */
                    midia: null,

                    tipoMidia:
                        midiaTemporariaNovo.tipo ||
                        null,

                    midiaId: midiaId
                };

                projetoAtual.cards.push(
                    novoCard
                );

                db[projetoId] =
                    projetoAtual;

                salvarBancoDeDados(db);

                limparFormularioNovoCard();

                abrirFecharFormulario(false);

                await renderizarTimeline();

            } catch (erro) {

                console.error(
                    'Erro ao criar card:',
                    erro
                );

                alert(
                    'Não foi possível criar o card.\n\n' +
                    'Erro: ' +
                    (erro.message || erro)
                );

            } finally {

                botao.disabled = false;
                botao.textContent = 'Publicar card ↵';
            }
        }


        /* =========================================================
           LIMPAR FORMULÁRIO
        ========================================================= */

        function limparFormularioNovoCard(focar = true) {

            const titulo = document.getElementById('inputTituloCard');
            titulo.value = '';

            document.getElementById(
                'inputLegendaCard'
            ).value = '';

            removerMidiaNovo();

            if (focar) titulo.focus();
        }

        document.getElementById('btnCancelarCard').addEventListener('click', () => {
            limparFormularioNovoCard(false);
            abrirFecharFormulario(false);
        });


        /* =========================================================
           ENTER PARA ENVIAR
           SHIFT + ENTER = NOVA LINHA
        ========================================================= */

        document.addEventListener(
            'keydown',
            function(event) {

                const campo =
                    event.target;

                if (
                    event.key === 'Enter' &&
                    (
                        (campo.id === 'inputTituloCard' && !event.shiftKey) ||
                        (campo.id === 'inputLegendaCard' && (event.ctrlKey || event.metaKey))
                    )
                ) {

                    event.preventDefault();

                    adicionarCard();

                    return;
                }

                if (
                    event.key === 'Enter' &&
                    (
                        (campo.id.startsWith('edit-titulo-') && !event.shiftKey) ||
                        (campo.id.startsWith('edit-legenda-') && (event.ctrlKey || event.metaKey))
                    )
                ) {

                    event.preventDefault();

                    const index =
                        parseInt(
                            campo.id.split('-').pop(),
                            10
                        );

                    salvarEdicaoCard(index);
                }
            }
        );


        /* =========================================================
           MENU DO CARD
        ========================================================= */

        function alternarMenuCard(event, index) {

            event.stopPropagation();

            document
                .querySelectorAll(
                    '.menu-card-flutuante'
                )
                .forEach((menu, idx) => {

                    if (idx !== index) {
                        menu.style.display = 'none';
                    }
                });

            const menu =
                document.getElementById(
                    `menu-card-${index}`
                );

            menu.style.display =
                menu.style.display === 'block'
                    ? 'none'
                    : 'block';
        }


        window.onclick = function() {

            document
                .querySelectorAll(
                    '.menu-card-flutuante'
                )
                .forEach(menu => {

                    menu.style.display = 'none';

                });
        };


        /* =========================================================
           DELETAR CARD
        ========================================================= */

        async function deletarCard(index) {
            if (workspaceAtual && workspaceAtual.role === 'viewer') return;

            if (
                !confirm(
                    'Tem certeza que deseja apagar este card?'
                )
            ) {
                return;
            }

            const card =
                projetoAtual.cards[index];

            /*
             * Apaga a mídia correspondente
             * do IndexedDB antes de remover o card.
             */
            if (card && card.midiaId) {

                try {
                    await deletarMidiaBlob(
                        card.midiaId
                    );
                } catch (erro) {
                    console.error(
                        'Erro ao apagar mídia:',
                        erro
                    );
                }
            }

            projetoAtual.cards.splice(
                index,
                1
            );

            db[projetoId] =
                projetoAtual;

            salvarBancoDeDados(db);

            await renderizarTimeline();
        }
