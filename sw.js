/* Monitoramento — sw.js (mesmo desenho do EFCwork): guarda a TELA do app e os QUADROS DO MAPA no aparelho.
   Os DADOS não passam por aqui: o Firestore guarda o cache dele e sincroniza quando a conexão volta.
   O nome do cache sobe a cada versão (tools/montar.py troca monitoramento-0.6.8). Os quadros do mapa ficam num cache à parte,
   para não se perderem a cada versão nova; o limite evita encher o celular. */
const VERSAO = 'monitoramento-0.6.8';
const TILES = 'monitoramento-quadros-v1', MAX_QUADROS = 3000;
const TELA = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const ESPERA_REDE_MS = 3500;
self.addEventListener('install', ev => { ev.waitUntil(caches.open(VERSAO).then(c => c.addAll(['./index.html']).then(() => Promise.all(TELA.map(u => c.add(u).catch(() => null)))))); });
self.addEventListener('activate', ev => { ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('monitoramento-') === 0 && k !== VERSAO && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', ev => { if (ev.data === 'pular') self.skipWaiting(); });
const guardada = () => caches.match('./index.html').then(x => x || caches.match('./'));
function navegar(r) {
  const rede = fetch(r).then(resp => { if (resp && resp.ok && resp.type === 'basic') { const cp = resp.clone(); caches.open(VERSAO).then(c => c.put('./index.html', cp)); } return resp; });
  return new Promise(res => { let feito = false; const fim = x => { if (!feito && x) { feito = true; res(x); } };
    const t = setTimeout(() => guardada().then(fim), ESPERA_REDE_MS);
    rede.then(resp => { clearTimeout(t); if (resp && resp.ok) fim(resp); else guardada().then(x => fim(x || resp)); }).catch(() => { clearTimeout(t); guardada().then(x => fim(x || Response.error())); }); });
}
let n = 0;
async function quadro(r) {
  const c = await caches.open(TILES), hit = await c.match(r); if (hit) return hit;
  try { const resp = await fetch(r); if (resp && (resp.ok || resp.type === 'opaque')) { c.put(r, resp.clone()); if (++n % 60 === 0) c.keys().then(k => { if (k.length > MAX_QUADROS) k.slice(0, k.length - MAX_QUADROS).forEach(x => c.delete(x)); }); } return resp; } catch (e) { return Response.error(); }
}
self.addEventListener('fetch', ev => {
  const r = ev.request; if (r.method !== 'GET') return; const u = new URL(r.url);
  const fonte = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.hostname === 'server.arcgisonline.com' || /^tile\./.test(u.hostname)) { ev.respondWith(quadro(r)); return; }
  if (!fonte && (/googleapis\.com$|firebaseio\.com$|identitytoolkit|securetoken/.test(u.hostname) || u.pathname.indexOf('/google.firestore') >= 0)) return;
  if (r.mode === 'navigate') { ev.respondWith(navegar(r)); return; }
  if (u.hostname === 'www.gstatic.com' || fonte || u.origin === self.location.origin) {
    ev.respondWith(caches.match(r).then(x => x || fetch(r).then(resp => { if (resp && resp.status === 200) { const cp = resp.clone(); caches.open(VERSAO).then(c => c.put(r, cp)); } return resp; })));
  }
});
