(() => {
    const root = document.documentElement;
    const barra = document.createElement('div');
    barra.className = 'planora-scrollbar';
    barra.setAttribute('role', 'scrollbar');
    barra.setAttribute('aria-label', 'Rolagem da página');
    barra.setAttribute('aria-orientation', 'vertical');
    barra.setAttribute('aria-controls', 'planora-page');
    barra.tabIndex = 0;
    const polegar = document.createElement('div');
    polegar.className = 'planora-scrollbar-thumb';
    barra.appendChild(polegar);
    root.id = root.id || 'planora-page';
    root.appendChild(barra);

    let maximoRolagem = 0;
    let alturaPolegar = 0;
    let quadroPendente = false;
    let arrasto = null;

    function atualizar() {
        quadroPendente = false;
        const alturaViewport = window.innerHeight;
        const alturaPagina = Math.max(root.scrollHeight, document.body.scrollHeight);
        maximoRolagem = Math.max(0, alturaPagina - alturaViewport);
        barra.hidden = maximoRolagem <= 1;
        if (barra.hidden) return;

        const alturaTrilho = barra.clientHeight;
        alturaPolegar = Math.min(alturaTrilho, Math.max(32, alturaTrilho * alturaViewport / alturaPagina));
        const deslocamentoMaximo = alturaTrilho - alturaPolegar;
        const topo = maximoRolagem ? window.scrollY / maximoRolagem * deslocamentoMaximo : 0;
        polegar.style.height = `${alturaPolegar}px`;
        polegar.style.transform = `translateY(${topo}px)`;
        barra.setAttribute('aria-valuemin', '0');
        barra.setAttribute('aria-valuemax', String(Math.round(maximoRolagem)));
        barra.setAttribute('aria-valuenow', String(Math.round(window.scrollY)));
    }

    function agendarAtualizacao() {
        if (quadroPendente) return;
        quadroPendente = true;
        window.requestAnimationFrame(atualizar);
    }

    function rolarPara(posicao) {
        window.scrollTo(0, Math.max(0, Math.min(maximoRolagem, posicao)));
    }

    barra.addEventListener('pointerdown', event => {
        const retangulo = barra.getBoundingClientRect();
        if (event.target !== polegar) {
            rolarPara((event.clientY - retangulo.top) / retangulo.height * maximoRolagem);
            return;
        }
        event.preventDefault();
        arrasto = { id: event.pointerId, deslocamento: event.clientY - polegar.getBoundingClientRect().top };
        barra.classList.add('arrastando');
        polegar.setPointerCapture(event.pointerId);
    });

    polegar.addEventListener('pointermove', event => {
        if (!arrasto || event.pointerId !== arrasto.id) return;
        const retangulo = barra.getBoundingClientRect();
        const deslocamentoMaximo = retangulo.height - alturaPolegar;
        const topo = event.clientY - retangulo.top - arrasto.deslocamento;
        rolarPara(deslocamentoMaximo > 0 ? topo / deslocamentoMaximo * maximoRolagem : 0);
    });

    function encerrarArrasto(event) {
        if (!arrasto || event.pointerId !== arrasto.id) return;
        arrasto = null;
        barra.classList.remove('arrastando');
    }
    polegar.addEventListener('pointerup', encerrarArrasto);
    polegar.addEventListener('pointercancel', encerrarArrasto);

    barra.addEventListener('keydown', event => {
        const passos = {
            ArrowDown: 40,
            ArrowUp: -40,
            PageDown: window.innerHeight * 0.9,
            PageUp: -window.innerHeight * 0.9,
            End: maximoRolagem,
            Home: -maximoRolagem
        };
        if (!(event.key in passos)) return;
        event.preventDefault();
        rolarPara(event.key === 'Home' ? 0 : event.key === 'End' ? maximoRolagem : window.scrollY + passos[event.key]);
    });

    window.addEventListener('scroll', agendarAtualizacao, { passive: true });
    window.addEventListener('resize', agendarAtualizacao, { passive: true });
    window.addEventListener('load', agendarAtualizacao);
    if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(agendarAtualizacao);
        observer.observe(document.body);
        observer.observe(root);
    }
    agendarAtualizacao();
})();
