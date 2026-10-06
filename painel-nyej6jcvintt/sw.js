// Guarda os arquivos da agenda para abrir sem internet.
// Ao mudar qualquer arquivo, aumente a versão abaixo para o celular baixar a nova.
const CACHE = "agenda-eletrix-v2";
const FILES = ["./", "index.html", "agenda.css", "agenda.js", "manifest.webmanifest",
  "fonts/poppins-Regular.woff2", "fonts/poppins-Medium.woff2", "fonts/poppins-Bold.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Tenta a internet primeiro (pega atualizações); sem sinal, usa a cópia guardada.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
