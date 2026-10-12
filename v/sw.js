// ============================================================================
// O SERVICE WORKER DA PÁGINA DO CONVIDADO (Lote 3a.4, 09/10/2026).
// ============================================================================
// Uma coisa só: guardar a última versão da PÁGINA (o index.html desta pasta),
// para ela abrir na entrada do evento sem sinal. O que ela abriu fica na
// carteira, no armazenamento do navegador, e é a própria página que cuida
// disso.
//
// - A cópia nasce na INSTALAÇÃO: a primeira visita só registra este arquivo, e
//   sem a cópia já feita a segunda visita, sem sinal, não teria o que abrir.
// - Rede primeiro: com sinal, a página vem do GitHub Pages e a cópia é
//   trocada. Sem sinal, ou com uma rede que não responde em 4 segundos, vale
//   a cópia; a rede, se chegar depois, ainda atualiza a cópia.
// - Só a navegação para esta pasta (a página e o index.html dela). Os pedidos
//   ao servidor do Synova e ao Drive são de outra origem, e este arquivo não
//   os toca.
// - Só as caches com o prefixo daqui saem numa atualização: a origem é a
//   mesma das outras páginas do site.
// ============================================================================
'use strict';

const PREFIXO = 'synova-v-';
const CACHE = PREFIXO + 'pagina-1';
const PACIENCIA_MS = 4000;
const ESCOPO = new URL('./', self.location).href;
const INDEX = new URL('./index.html', self.location).href;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.add(ESCOPO); })
      // Sem rede na instalação, a cópia nasce na próxima visita com sinal.
      .catch(function () {})
      .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (nomes) {
        return Promise.all(nomes
          .filter(function (n) { return n.startsWith(PREFIXO) && n !== CACHE; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); }));
});

function ehAPagina(pedido) {
  if (pedido.method !== 'GET' || pedido.mode !== 'navigate') return false;
  const u = new URL(pedido.url);
  u.hash = '';
  u.search = '';
  return u.href === ESCOPO || u.href === INDEX;
}

self.addEventListener('fetch', function (e) {
  if (!ehAPagina(e.request)) return;
  const rede = fetch(e.request);
  // A cópia é tirada logo que a resposta chega, antes de o navegador ler o
  // corpo dela: depois, o corpo já foi consumido.
  e.waitUntil(rede.then(function (r) {
    if (!(r.ok && r.type === 'basic')) return undefined;
    const copia = r.clone();
    return caches.open(CACHE).then(function (c) { return c.put(ESCOPO, copia); });
  }).catch(function () {}));
  e.respondWith(caches.open(CACHE)
    .then(function (c) { return c.match(ESCOPO); })
    .then(function (guardada) {
      if (!guardada) return rede;
      return new Promise(function (pronto) {
        const prazo = setTimeout(function () { pronto(guardada); }, PACIENCIA_MS);
        rede.then(function (r) {
          clearTimeout(prazo);
          // Uma página de erro da rede não vence a página que funciona.
          pronto(r.ok ? r : guardada);
        }, function () {
          clearTimeout(prazo);
          pronto(guardada);
        });
      });
    }));
});
