/*
  Kiosco de orientación · UMAA 90 (IMSS, Torreón)
  Autor y responsable del contenido: Ing. Luis Ángel Díaz Bernal

  Configuración por dirección (cada tótem abre la suya):
    index.html?kiosco=pb   → tótem de planta baja
    index.html?kiosco=pa   → tótem del 1er piso
    &demo=1                → muestra botones de piso y el panel de estado (solo para pruebas)
*/
(function(){
"use strict";

/* ---------- Configuración ---------- */
var params = new URLSearchParams(location.search);
var hashPiso = location.hash.replace('#','');
var kiosco = (params.get('kiosco') || hashPiso) === 'pa' ? 'pa' : 'pb';
var DEMO = params.get('demo') === '1';
var INACTIVO_INICIO = 60 * 1000;      // regresa al inicio tras 1 min sin uso
var INACTIVO_REPOSO = 3 * 60 * 1000;  // pantalla de reposo tras 3 min sin uso
var REVISAR_VERSION = 15 * 60 * 1000; // busca versión nueva cada 15 min

/* ---------- Monitor de errores silenciosos y vigilante ---------- */
var errores = [];
var erroresRecientes = [];
function registrarError(msg){
  errores.push(new Date().toLocaleTimeString('es-MX') + ' · ' + msg);
  var ahora = Date.now();
  erroresRecientes = erroresRecientes.filter(function(t){ return ahora - t < 5 * 60 * 1000; });
  erroresRecientes.push(ahora);
  try { console.error('[Kiosco] ' + msg); } catch(_) {}
  if (erroresRecientes.length >= 5) recargar('demasiados errores');
  pintarDemo();
}
window.addEventListener('error', function(e){ registrarError('Error: ' + (e.message || 'desconocido')); });
window.addEventListener('unhandledrejection', function(e){ registrarError('Promesa rechazada: ' + String(e.reason)); });

var recargando = false;
function recargar(motivo){
  if (recargando) return;
  recargando = true;
  try { console.warn('[Kiosco] Recargando: ' + motivo); } catch(_) {}
  setTimeout(function(){ location.reload(); }, 3000);
}

/* ---------- Datos ---------- */
var COL = {trat:'var(--c-trat)', cons:'var(--c-cons)', apoyo:'var(--c-apoyo)', admin:'var(--c-admin)', serv:'var(--c-serv)', farm:'var(--c-farm)'};
var D = [], byId = {}, QUICK = [], ROOMS = [];
var KIOSCO = {x:405, y:196}, PASILLO_Y = 362;
var VERSION = '?';

/* ---------- Utilidades ---------- */
var $main = document.getElementById('main');
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function norm(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
function pisoTxt(p){ return p === 'pa' ? '1er piso' : 'Planta baja'; }
function corto(d){ return d.corto || d.nombre.replace(' (1er piso)','').replace(' (planta baja)',''); }

/* ---------- Validación de datos ---------- */
function validar(){
  var av = [], ids = {};
  D.forEach(function(d){
    if (ids[d.id]) av.push('ID duplicado: ' + d.id);
    ids[d.id] = true;
    if (!COL[d.cat]) av.push(d.nombre + ': categoría desconocida "' + d.cat + '"');
    if (d.estado === 'plano') av.push(d.nombre + ': solo en el plano del PIPC, falta confirmar en sitio');
    if (d.estado === 'pendiente') av.push(d.nombre + ': sin ubicación, no se puede trazar ruta');
    if (d.piso === 'pa' && d.orden && !ROOMS.some(function(r){ return r.id === d.id; })) av.push(d.nombre + ': tiene número de puerta pero no está dibujado');
  });
  ROOMS.forEach(function(r){ if (r.id && !byId[r.id]) av.push('Plano: cuarto "' + r.id + '" no existe en las áreas'); });
  QUICK.forEach(function(id){ if (!byId[id]) av.push('Más buscados: "' + id + '" no existe'); });
  return av;
}

/* ---------- Estado de la pantalla ---------- */
var vista = {t:'inicio', q:''};
var verPanel = false;

function render(){
  document.getElementById('floorPill').textContent = 'Usted está en: ' + pisoTxt(kiosco);
  if (vista.t === 'ruta') renderRuta(byId[vista.id]);
  else renderInicio();
  pintarDemo();
}

function filaHTML(d){
  var t = d.estado === 'ok' ? '' : '<span class="tag">' + (d.estado === 'plano' ? 'por verificar' : 'sin ubicar') + '</span>';
  return '<button class="row" type="button" data-go="' + d.id + '"><span class="dot" style="background:' + COL[d.cat] + '"></span><span>' + esc(d.nombre) + t + '</span><span class="where">' + pisoTxt(d.piso) + '</span></button>';
}

function renderInicio(){
  var q = vista.q.trim(), lista;
  if (q) { var nq = norm(q); lista = D.filter(function(d){ return norm(d.nombre + ' ' + (d.sinonimos || '')).indexOf(nq) >= 0; }); }
  else lista = D.slice().sort(function(a,b){ return a.nombre.localeCompare(b.nombre, 'es'); });
  var quick = q ? '' : '<p class="label">Lo más buscado</p><div class="quick">' + QUICK.map(function(id){
      var d = byId[id]; if (!d) return '';
      return '<button class="qbtn" type="button" data-go="' + id + '" style="background:' + COL[d.cat] + '">' + esc(corto(d)) + '<span>' + pisoTxt(d.piso) + '</span></button>';
    }).join('') + '</div>';
  $main.innerHTML =
    '<label class="search" for="q"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7" fill="none" stroke="var(--muted)" stroke-width="2.4"/><path d="M16 16l5 5" stroke="var(--muted)" stroke-width="2.4" stroke-linecap="round"/></svg>' +
    '<input id="q" type="search" autocomplete="off" placeholder="Escriba un servicio: farmacia, riñón, ojos…" value="' + esc(vista.q) + '"></label>' +
    quick +
    '<p class="label">' + (q ? 'Resultados' : 'Todos los servicios') + '</p>' +
    '<div class="list">' + (lista.length ? lista.map(filaHTML).join('') : '<p class="empty">No encontramos "' + esc(q) + '". Pruebe con otra palabra o pregunte en la ventanilla.</p>') + '</div>' +
    (verPanel ? panelEstado() : '');
  var inp = document.getElementById('q');
  inp.addEventListener('input', function(e){
    vista.q = e.target.value; renderInicio();
    var i = document.getElementById('q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
  });
}

function pasos(d){
  var s = [];
  if (d.piso === 'pb') { s.push({t:'Este servicio está en esta planta baja.'}); return s; }
  if (kiosco === 'pb') {
    s.push({t:'Suba al <b>1er piso</b> en el elevador que está a su derecha.', f:'elevador-pb'});
    s.push({t:'Al salir del elevador, busque el kiosco del 1er piso y la Farmacia junto a él.', f:'vestibulo-pa'});
  }
  if (d.id === 'farmacia') { s.push({t:'<b>Farmacia</b> está junto al kiosco del 1er piso, a pocos pasos del elevador.', f:d.foto}); return s; }
  if (d.id === 'archivo') {
    s.push({t:'Entre a <b>Farmacia</b>, junto al kiosco del 1er piso.', f:'farmacia'});
    s.push({t:'Siga la flecha <b>«Archivo»</b>: está al fondo, a la izquierda.', f:'archivo'});
    return s;
  }
  s.push({t:'Pase frente a Farmacia y el letrero <b>«Bienvenidos»</b>, y entre al pasillo que sigue.', f:'bienvenidos'});
  s.push({t:'Siga recto por el pasillo de celosías y macetas.', f:'celosias'});
  s.push({t:'Al fondo, en el letrero verde <b>«Consultorios»</b>, gire a la <b>izquierda</b> y cruce las puertas de vidrio.', f:'consultorios'});
  if (d.indicacion) { s.push({t:d.indicacion, f:d.foto}); return s; }
  var prev = D.filter(function(x){ return x.orden && x.orden < d.orden; }).sort(function(a,b){ return b.orden - a.orden; })[0];
  if (d.orden <= 2) s.push({t:'<b>' + esc(corto(d)) + '</b> está al inicio del pasillo, al cruzar las puertas.', f:d.foto});
  else s.push({t:'Busque el letrero <b>«' + esc(d.nombre) + '»</b>' + (prev ? ', después de ' + (prev.cat === 'serv' ? 'los sanitarios' : esc(corto(prev))) : '') + '.', f:d.foto});
  return s;
}

function renderRuta(d){
  if (!d) { vista = {t:'inicio', q:''}; return renderInicio(); }
  var cruza = d.piso !== kiosco, aviso = '';
  if (d.estado === 'pendiente') aviso = '<div class="warnbox"><b>Ubicación por confirmar.</b> Aún no tenemos la ruta exacta a ' + esc(d.nombre) + '. Está en el ' + pisoTxt(d.piso) + '; pregunte en la ventanilla más cercana.</div>';
  else if (d.estado === 'plano') aviso = '<div class="warnbox"><b>Ruta por verificar.</b> Si no encuentra el lugar, pregunte en Recepción.</div>';
  var mapa = d.piso === 'pa' ? mapaPA(d) + leyenda(d) : mapaPB(d);
  var lista = d.estado === 'pendiente' ? '' : '<ol class="steps">' + pasos(d).map(function(p){
      return '<li><span>' + p.t + (p.f ? '<img class="foto" src="fotos/' + p.f + '.jpg" alt="Foto de referencia" loading="lazy">' : '') + '</span></li>';
    }).join('') + '</ol>';
  $main.innerHTML =
    '<div class="dest"><span class="dot" style="background:' + COL[d.cat] + ';width:1.2rem;height:1.2rem"></span><h2>' + esc(d.nombre) + '</h2></div>' +
    '<div class="dest"><span class="badge">' + pisoTxt(d.piso) + '</span>' + (cruza ? '<span class="badge acc">♿ Ruta por elevador</span>' : '') + '</div>' +
    aviso + '<div class="mapbox">' + mapa + '</div>' + lista +
    '<div class="actions"><button class="big" type="button" data-home>Volver al inicio</button></div>' +
    (verPanel ? panelEstado() : '');
}

function leyenda(sel){
  var items = D.filter(function(x){ return x.piso === 'pa' && x.orden; }).sort(function(a,b){ return a.orden - b.orden; });
  return '<div class="legend">' + items.map(function(x){
    return '<span class="lg' + (sel && sel.id === x.id ? ' on' : '') + '"><b style="background:' + COL[x.cat] + '">' + x.orden + '</b>' + esc(corto(x).replace('Consultorio de ','')) + '</span>';
  }).join('') + '</div>';
}

/* ---------- Mapas SVG (coordenadas del dibujo, no píxeles) ---------- */
function nucleo(){
  return '<circle cx="450" cy="165" r="92" fill="#eef2f0" stroke="#a9b7b0" stroke-width="3"/>' +
    '<rect x="438" y="120" width="44" height="58" rx="4" fill="#5b6b66"/><line x1="460" y1="122" x2="460" y2="176" stroke="#eef2f0" stroke-width="2"/>' +
    '<text x="460" y="222" font-size="15" font-weight="700" fill="#10231c" text-anchor="middle">Elevador</text>' +
    '<rect x="402" y="128" width="20" height="42" rx="3" fill="#10231c"/>';
}
function aqui(on){
  return on ? '<circle class="here-dot" cx="' + KIOSCO.x + '" cy="' + KIOSCO.y + '" r="13" fill="var(--here)" stroke="#fff" stroke-width="4"/>' +
    '<text x="' + (KIOSCO.x - 18) + '" y="' + (KIOSCO.y + 38) + '" font-size="16" font-weight="700" fill="var(--here)" text-anchor="middle">Usted está aquí</text>' : '';
}
function escalera(x, y){
  var h = '<rect x="' + x + '" y="' + y + '" width="42" height="58" rx="4" fill="#fff" stroke="var(--c-serv)" stroke-width="3"/>';
  [14,28,42].forEach(function(dy){ h += '<line x1="' + (x+6) + '" y1="' + (y+dy) + '" x2="' + (x+36) + '" y2="' + (y+dy) + '" stroke="var(--c-serv)" stroke-width="3"/>'; });
  return h;
}

function mapaPA(dest){
  var enPA = kiosco === 'pa';
  var h = '<svg viewBox="0 60 920 650" role="img" aria-label="Mapa del 1er piso">';
  h += '<polyline points="360,200 40,250 40,' + PASILLO_Y + ' 70,' + PASILLO_Y + '" fill="none" stroke="var(--hall)" stroke-width="40" stroke-linejoin="round"/>';
  h += '<rect x="62" y="328" width="804" height="312" rx="8" fill="#f3f6f4" stroke="#a9b7b0" stroke-width="2"/>';
  h += '<rect x="62" y="335" width="804" height="56" fill="var(--hall)"/>';
  h += '<text x="470" y="386" font-size="14" font-weight="700" fill="var(--hall-ink)" text-anchor="middle">Pasillo de consultorios</text>';
  ROOMS.forEach(function(r){
    var d = r.id && byId[r.id], sel = dest && r.id === dest.id;
    var fill = d ? COL[d.cat] : 'var(--c-staff)', op = dest && !sel && d ? 0.35 : 1;
    var cx = r.x + r.w / 2, name = d ? corto(d) : 'Solo personal', fs = name.length > 16 ? 12 : 13;
    h += '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" fill="' + fill + '" opacity="' + op + '" stroke="' + (sel ? 'var(--route)' : '#fff') + '" stroke-width="' + (sel ? 6 : 3) + '"/>';
    h += '<text transform="translate(' + (cx + 4) + ',' + (r.y + r.h / 2 - 14) + ') rotate(-90)" font-size="' + fs + '" font-weight="700" fill="' + (d ? '#fff' : '#55625d') + '" text-anchor="middle" opacity="' + (op < 1 ? 0.85 : 1) + '">' + esc(name) + '</text>';
    if (d && d.orden) h += '<text x="' + cx + '" y="' + (r.y + r.h - 14) + '" font-size="' + (r.w < 45 ? 15 : 18) + '" font-weight="700" fill="#fff" text-anchor="middle" opacity="' + (op < 1 ? 0.85 : 1) + '">' + d.orden + '</text>';
  });
  var fs = dest && (dest.id === 'farmacia' || dest.id === 'archivo');
  h += '<rect x="250" y="112" width="120" height="62" rx="10" fill="var(--c-farm)" opacity="' + (dest && !fs ? 0.45 : 1) + '" stroke="' + (fs ? 'var(--route)' : '#fff') + '" stroke-width="' + (fs ? 6 : 3) + '"/>';
  h += '<text x="310" y="138" font-size="19" font-weight="700" fill="#fff" text-anchor="middle">Farmacia</text><text x="310" y="160" font-size="13" fill="#fff" text-anchor="middle">y Archivo</text>';
  h += '<line x1="40" y1="380" x2="40" y2="612" stroke="var(--hall)" stroke-width="22"/>' + escalera(20, 612) +
       '<text x="41" y="692" font-size="15" font-weight="700" fill="var(--c-serv)" text-anchor="middle">Escaleras</text>';
  h += escalera(868, 335) + '<text x="889" y="414" font-size="14" font-weight="700" fill="var(--c-serv)" text-anchor="middle">Escaleras</text>';
  h += nucleo();
  [150, 385, 600].forEach(function(x){ h += '<rect x="' + x + '" y="268" width="150" height="52" rx="6" fill="#8d7768"/><text x="' + (x + 75) + '" y="299" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">Sala de espera</text>'; });
  if (dest && dest.estado !== 'pendiente') {
    var start = enPA ? KIOSCO.x + ',' + KIOSCO.y : '460,185', pts = null;
    if (fs) pts = start + ' 310,176';
    else {
      var r = ROOMS.filter(function(x){ return x.id === dest.id; })[0];
      if (r) { var cx = r.x + r.w / 2; pts = start + ' 360,205 40,250 40,' + PASILLO_Y + ' ' + cx + ',' + PASILLO_Y + ' ' + cx + ',' + (r.y + 6); }
    }
    if (pts) h += '<polyline class="route-line" points="' + pts + '" fill="none" stroke="var(--route)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="20 20"/>';
  }
  if (!enPA) h += '<text x="560" y="120" font-size="16" font-weight="700" fill="var(--route)">← llega por el elevador</text>';
  h += aqui(enPA) + '</svg>';
  return h;
}

function mapaPB(dest){
  var enPB = kiosco === 'pb';
  var h = '<svg viewBox="20 60 860 620" role="img" aria-label="Mapa de planta baja">';
  h += '<rect x="430" y="255" width="40" height="300" fill="var(--hall)"/>';
  h += '<text x="490" y="410" font-size="15" fill="var(--hall-ink)">pasillo de entrada</text>';
  h += '<rect x="360" y="555" width="180" height="70" rx="10" fill="var(--accent)"/><text x="450" y="586" font-size="20" font-weight="700" fill="#fff" text-anchor="middle">ENTRADA</text><text x="450" y="608" font-size="13" fill="#fff" text-anchor="middle">con rampa</text>';
  [['urologia',70,300],['endoscopias',70,380],['wc-pb',70,460]].forEach(function(c){
    var d = byId[c[0]]; if (!d) return;
    var sel = dest && dest.id === c[0], x = c[1], y = c[2];
    h += '<rect x="' + x + '" y="' + y + '" width="230" height="64" rx="8" fill="' + (sel ? COL[d.cat] : '#fff') + '" stroke="' + (sel ? 'var(--route)' : '#a9b7b0') + '" stroke-width="' + (sel ? 5 : 2) + '" stroke-dasharray="7 5"/>';
    h += '<text x="' + (x + 115) + '" y="' + (y + 30) + '" font-size="17" font-weight="700" fill="' + (sel ? '#fff' : '#10231c') + '" text-anchor="middle">' + esc(corto(d)) + '</text><text x="' + (x + 115) + '" y="' + (y + 50) + '" font-size="12" fill="' + (sel ? '#fff' : '#53655d') + '" text-anchor="middle">posición por verificar</text>';
  });
  h += '<rect x="600" y="300" width="230" height="244" rx="8" fill="var(--c-staff)"/><text x="715" y="425" font-size="16" font-weight="700" fill="#55625d" text-anchor="middle">Solo personal</text>';
  h += nucleo() + aqui(enPB) + '</svg>';
  return h;
}

/* ---------- Modo demo (solo con &demo=1) ---------- */
function panelEstado(){
  var av = validar();
  return '<div class="panel"><b>Estado de datos</b> · ' + av.length + ' avisos, ' + errores.length + ' errores de programa · versión ' + esc(VERSION) +
    '<ul>' + av.concat(errores).map(function(a){ return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
}
function pintarDemo(){
  var bar = document.getElementById('demoBar');
  if (!DEMO) return;
  bar.hidden = false;
  var n = validar().length + errores.length;
  bar.className = 'demo';
  bar.innerHTML = '<button type="button" data-piso="pb" aria-pressed="' + (kiosco === 'pb') + '">Planta baja</button>' +
    '<button type="button" data-piso="pa" aria-pressed="' + (kiosco === 'pa') + '">1er piso</button>' +
    '<button type="button" data-panel>Estado' + (n ? ' · <b>' + n + '</b>' : ' · OK') + '</button>';
}

/* ---------- Eventos ---------- */
document.body.addEventListener('click', function(e){
  var go = e.target.closest('[data-go]');
  if (go) { vista = {t:'ruta', id:go.getAttribute('data-go')}; render(); window.scrollTo(0, 0); return; }
  if (e.target.closest('[data-home]')) { vista = {t:'inicio', q:''}; render(); window.scrollTo(0, 0); return; }
  var p = e.target.closest('[data-piso]');
  if (p) { kiosco = p.getAttribute('data-piso'); render(); return; }
  if (e.target.closest('[data-panel]')) { verPanel = !verPanel; render(); }
});
document.addEventListener('contextmenu', function(e){ e.preventDefault(); });

/* ---------- Inactividad: regreso al inicio y pantalla de reposo ---------- */
var tInicio, tReposo, tMover;
var reposo = document.getElementById('reposo'), card = document.getElementById('reposoCard'), destTxt = document.getElementById('reposoDest');
function moverReposo(){
  card.style.left = (5 + Math.random() * 40) + '%';
  card.style.top = (8 + Math.random() * 55) + '%';
  var d = byId[QUICK[Math.floor(Math.random() * QUICK.length)]];
  if (d) destTxt.textContent = corto(d) + ' · ' + pisoTxt(d.piso);
}
function mostrarReposo(){ reposo.hidden = false; moverReposo(); tMover = setInterval(moverReposo, 8000); }
function actividad(){
  clearTimeout(tInicio); clearTimeout(tReposo);
  tInicio = setTimeout(function(){ vista = {t:'inicio', q:''}; verPanel = false; render(); window.scrollTo(0, 0); }, INACTIVO_INICIO);
  tReposo = setTimeout(mostrarReposo, INACTIVO_REPOSO);
}
['click','input','touchstart','keydown'].forEach(function(ev){ document.addEventListener(ev, actividad, {passive:true}); });
// El toque que quita el reposo no debe abrir nada que esté debajo
reposo.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault(); reposo.hidden = true; clearInterval(tMover); actividad(); });
function inactivo(){ return !reposo.hidden; }

/* ---------- Vigilante: pantalla vacía, versión nueva y recarga diaria ---------- */
var inicioApp = Date.now();
setInterval(function(){
  if (!$main.children.length) recargar('pantalla vacía');
  var h = new Date();
  if (h.getHours() === 3 && h.getMinutes() < 5 && Date.now() - inicioApp > 60 * 60 * 1000) recargar('recarga diaria');
}, 60 * 1000);

var esperandoRecarga = false;
function revisarVersion(){
  if (esperandoRecarga) return;
  fetch('version.json?t=' + Date.now(), {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(v){
    if (VERSION !== '?' && v.version !== VERSION) {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(function(reg){ if (reg) reg.update(); });
      }
      esperandoRecarga = true;
      var esperar = setInterval(function(){ if (inactivo() || vista.t === 'inicio') { clearInterval(esperar); recargar('versión nueva ' + v.version); } }, 30000);
    }
  }).catch(function(){ /* sin red: sigue con la copia guardada */ });
}

/* ---------- PWA: copia local para funcionar sin red ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).catch(function(e){ registrarError('No se registró el modo sin internet: ' + e.message); });
}

/* ---------- Arranque ---------- */
Promise.all([
  fetch('data/areas.json').then(function(r){ if (!r.ok) throw new Error('areas.json ' + r.status); return r.json(); }),
  fetch('version.json').then(function(r){ return r.json(); }).catch(function(){ return {version:'?'}; })
]).then(function(res){
  var data = res[0];
  VERSION = res[1].version || '?';
  document.getElementById('ver').textContent = 'v' + VERSION;
  D = data.areas;
  D.forEach(function(d){ byId[d.id] = d; });
  QUICK = data.masBuscados || [];
  ROOMS = data.planoPA.cuartos.map(function(r){ return {id:r.id, x:r.x, w:r.w, y:395, h:215}; });
  render();
  actividad();
  setInterval(revisarVersion, REVISAR_VERSION);
}).catch(function(e){
  registrarError('No se cargaron los datos: ' + e.message);
  $main.innerHTML = '<div class="warnbox"><b>Estamos actualizando la información.</b> Por favor pregunte en Recepción, en el 1er piso.</div>';
  setTimeout(function(){ recargar('datos no cargados'); }, 60 * 1000);
});

})();
