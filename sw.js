/*
  Kiosco UMAA 90 · service worker (copia local para funcionar sin red)
  Autor: Ing. Luis Ángel Díaz Bernal
  IMPORTANTE: en cada entrega cambie VERSION aquí y en version.json (el mismo número).
*/
var VERSION = '1.3.3';
var CACHE = 'kiosco-umaa90-' + VERSION;
var ARCHIVOS = [
  './', 'index.html', 'css/estilos.css', 'js/app.js', 'data/areas.json', 'version.json', 'manifest.json', 'icons/icono.svg',
  'fonts/atkinson-hyperlegible-400.woff2', 'fonts/atkinson-hyperlegible-700.woff2',
  'fotos/admision.jpg', 'fotos/archivo.jpg', 'fotos/bienvenidos.jpg', 'fotos/celosias.jpg', 'fotos/cirugia.jpg', 'fotos/consultorios.jpg', 'fotos/elevador-pb.jpg', 'fotos/farmacia.jpg', 'fotos/hemo.jpg', 'fotos/inhalo.jpg', 'fotos/modulo.jpg', 'fotos/nefrologia.jpg', 'fotos/neumologia.jpg', 'fotos/oftalmologia.jpg', 'fotos/oncologia.jpg', 'fotos/ortopedia.jpg', 'fotos/otorrino.jpg', 'fotos/puertas-imss.jpg', 'fotos/tsocial-nutricion.jpg', 'fotos/urologia-endoscopias.jpg', 'fotos/vestibulo-pa.jpg', 'fotos/wc-hombres.jpg', 'fotos/wc-mujeres.jpg'
];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ARCHIVOS); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// Primero la red (para ver cambios), y si no hay red, la copia guardada.
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // no-cache: pregunta al servidor si hay cambios (evita que el navegador muestre archivos viejos)
    fetch(e.request, {cache:'no-cache'}).then(function(resp){
      if (resp && resp.ok && new URL(e.request.url).origin === location.origin && e.request.url.indexOf('version.json') < 0) {
        var copia = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copia); });
      }
      return resp;
    }).catch(function(){
      return caches.match(e.request, {ignoreSearch:true});
    })
  );
});
