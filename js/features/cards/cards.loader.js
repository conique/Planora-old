(function () {
    'use strict';
    const scripts = [
        "js/features/cards/cards-timeline.js?v=20261116-nc1",
        "js/features/cards/project-edit-and-tags.js",
        "js/features/cards/card-notes-and-status.js",
        "js/features/cards/card-create-and-media.js?v=20261114-nc2",
        "js/features/cards/card-edit-and-media.js?v=20261114-nc2",
        "js/features/cards/card-save.js?v=20261114-nc2",
        "js/features/cards/cards-init.js?v=20261116-nc1"
    ];
    function carregarSequencialmente(indice = 0) {
        if (indice >= scripts.length) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scripts[indice];
            script.onload = () => resolve(carregarSequencialmente(indice + 1));
            script.onerror = () => reject(new Error('Falha ao carregar ' + scripts[indice]));
            document.body.appendChild(script);
        });
    }
    Planora_PRONTO.then(() => {
        if (window.Planora_REDIRECIONANDO_WORKSPACES) return;
        return carregarSequencialmente();
    }).catch(console.error);
})();
