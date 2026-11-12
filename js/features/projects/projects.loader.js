(function () {
    'use strict';
    const scripts = [
        "js/features/projects/project-state-and-table.js",
        "js/features/projects/project-tags.js",
        "js/features/projects/project-kanban-and-drag.js",
        "js/features/projects/project-folders-and-init.js"
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
