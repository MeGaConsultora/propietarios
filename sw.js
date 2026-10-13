// Service Worker del portal de propietarios — MeGa Consultora
// Su único fin es que el navegador ofrezca "Instalar app" y que la página
// cargue si no hay conexión. Estrategia "network-first": siempre se intenta
// traer la versión más nueva y la caché es solo un respaldo.
// IMPORTANTE: solo se guardan en caché los archivos de ESTE sitio (la página,
// íconos). Las consultas a Supabase (datos y sesión del propietario) son de
// otro origen y no pasan por acá, para no dejar datos personales guardados.
const CACHE_NAME = 'mega-propietarios-v1';
const ARCHIVOS_BASICOS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_BASICOS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
        return respuesta;
      })
      .catch(() => caches.match(req))
  );
});
