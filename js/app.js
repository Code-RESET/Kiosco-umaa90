/*
  IMSS Maps · kiosco de orientación UMAA 90 (Torreón)
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
var mapaCompleto = false;
var CATEGORIAS = [
  {id:'consultas',  nombre:'Consultas',          cats:['cons'],                 color:'var(--c-cons)'},
  {id:'trat',       nombre:'Tratamientos',       cats:['trat'],                 color:'var(--c-trat)'},
  {id:'tramites',   nombre:'Trámites y apoyo',   cats:['apoyo','admin','farm'], color:'var(--c-apoyo)'},
  {id:'sanitarios', nombre:'Sanitarios',         cats:['serv'],                 color:'var(--c-serv)'}
];
var verPanel = false;

function render(){
  document.getElementById('floorPill').textContent = 'Usted está en: ' + pisoTxt(kiosco);
  if (vista.t === 'ruta') renderRuta(byId[vista.id]);
  else renderInicio();
  pintarDemo();
}

function filaHTML(d){
  var t = d.estado === 'ok' ? '' : '<span class="tag">' + (d.estado === 'plano' ? 'por verificar' : 'sin ubicar') + '</span>';
  return '<button class="row" type="button" data-go="' + d.id + '"><span class="dot" style="background:' + COL[d.cat] + '"></span><span>' + esc(d.nombre) + t + (d.horario ? '<small class="hr">' + esc(d.horario.split(' (')[0].split(',')[0]) + '</small>' : '') + '</span><span class="where">' + pisoTxt(d.piso) + '</span></button>';
}

function renderInicio(){
  var q = vista.q.trim(), lista, titulo;
  var cat = vista.cat && CATEGORIAS.filter(function(c){ return c.id === vista.cat; })[0];
  if (q) { var nq = norm(q); lista = D.filter(function(d){ return norm(d.nombre + ' ' + (d.sinonimos || '')).indexOf(nq) >= 0; }); titulo = 'Resultados'; }
  else if (cat) { lista = D.filter(function(d){ return cat.cats.indexOf(d.cat) >= 0; }); titulo = cat.nombre; }
  else { lista = D.slice(); titulo = 'Todos los servicios'; }
  lista.sort(function(a,b){ return a.nombre.localeCompare(b.nombre, 'es'); });
  var cats = q ? '' : '<p class="label">Buscar por tipo</p><div class="cats">' + CATEGORIAS.map(function(c){
      return '<button class="cbtn' + (cat && cat.id === c.id ? ' on' : '') + '" type="button" data-cat="' + c.id + '" style="--cc:' + c.color + '">' + c.nombre + '</button>';
    }).join('') + '</div>';
  var quick = (q || cat) ? '' : '<p class="label">Lo más buscado</p><div class="quick">' + QUICK.map(function(id){
      var d = byId[id]; if (!d) return '';
      return '<button class="qbtn" type="button" data-go="' + id + '" style="background:' + COL[d.cat] + '">' + esc(corto(d)) + '<span>' + pisoTxt(d.piso) + '</span></button>';
    }).join('') + '</div>';
  $main.innerHTML =
    '<label class="search" for="q"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7" fill="none" stroke="var(--muted)" stroke-width="2.4"/><path d="M16 16l5 5" stroke="var(--muted)" stroke-width="2.4" stroke-linecap="round"/></svg>' +
    '<input id="q" type="search" autocomplete="off" placeholder="Escriba un servicio: farmacia, riñón, ojos…" value="' + esc(vista.q) + '"></label>' +
    cats + quick +
    '<p class="label">' + titulo + (cat ? ' · <button class="link" type="button" data-cat="">ver todos</button>' : '') + '</p>' +
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
  if (d.piso === 'pb') {
    if (kiosco === 'pa') s.push({t:'Baje a <b>planta baja</b> en el elevador.', f:'vestibulo-pa'});
    s.push({t:'Siga el pasillo del elevador hasta el vestíbulo y gire a la <b>derecha</b>.'});
    s.push({t:'Al llegar a la rampa, baje al <b>pasillo de consultorios</b> y siga hacia la entrada principal.'});
    if (d.id === 'urologia' || d.id === 'endoscopias' || d.mismoLugar === 'endoscopias') s.push({t:'Busque la <b>puerta doble</b> con los letreros «Consultorio de Urología» y «Consultorio de Endoscopias».', f:d.foto});
    else s.push({t:'<b>' + esc(corto(d)) + '</b>: ' + esc(d.referencia || '') + '.', f:d.foto});
    if (d.extra) s.push(d.extra);
    return s;
  }
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
  s.push({t:'Al fondo, en el letrero verde <b>«Consultorios»</b>, gire a la <b>izquierda</b>.', f:'consultorios'});
  s.push({t:'Cruce las <b>puertas de vidrio</b> con el logo IMSS: ahí empieza el pasillo de consultorios.', f:'puertas-imss'});
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
  // Dos vistas: el piso completo (para ubicarse) y un acercamiento (para ver la puerta)
  var mapa;
  if (d.piso === 'pa') {
    mapa = '<p class="maptit">' + (kiosco === 'pa' ? '📍 Usted está aquí → su destino' : '🛗 Al salir del elevador → su destino') + '</p>' + mapaPA(d, false);
    if (d.estado !== 'pendiente') mapa += '<p class="maptit">🔍 Acercamiento a su destino</p><div class="zoombox">' + mapaPA(d, true) + '</div>';
    mapa += leyenda(d);
  } else mapa = mapaPB(d);
  var zoomBtn = '';
  var ayudaId = d.piso === 'pb' ? 'admision' : 'recepcion';
  var ayuda = d.id === ayudaId ? '' : '<button class="ayuda" type="button" data-go="' + ayudaId + '"><b>¿No lo encuentra?</b> ' +
    (d.piso === 'pb' ? 'Pregunte en el Módulo de Admisión · Planta baja' : 'Pregunte en Recepción · Puerta 9 · 1er piso') + '</button>';
  var lista = d.estado === 'pendiente' ? '' : '<ol class="steps">' + pasos(d).map(function(p){
      return '<li><span>' + p.t + (p.f ? '<img class="foto" src="fotos/' + p.f + '.jpg" alt="Foto de referencia" loading="lazy">' : '') + '</span></li>';
    }).join('') + '</ol>';
  $main.innerHTML =
    '<div class="dest"><span class="dot" style="background:' + COL[d.cat] + ';width:1.2rem;height:1.2rem"></span><h2>' + esc(d.nombre) + '</h2></div>' +
    '<p class="resumen">' + resumen(d) + '</p>' +
    (d.horario ? '<p class="horario">🕒 ' + esc(d.horario) + '</p>' : '') +
    (cruza ? '<div class="dest"><span class="badge acc">♿ Ruta por elevador</span></div>' : '') +
    aviso + '<div class="mapbox">' + mapa + zoomBtn + '</div>' + lista + ayuda +
    '<div class="actions"><button class="big" type="button" data-home>Volver al inicio</button></div>' +
    (verPanel ? panelEstado() : '');
}

function resumen(d){
  var partes = [pisoTxt(d.piso)];
  if (d.orden) partes.push('Puerta ' + d.orden);
  partes.push(d.referencia || (d.orden ? 'Pasillo de consultorios' : (d.piso === 'pb' ? 'Ubicación por verificar' : 'Junto al elevador')));
  return partes.map(esc).join(' · ');
}
function leyenda(sel){
  // Solo se muestra el destino elegido; la lista completa ya no se despliega
  if (!sel || !sel.orden) return '';
  return '<div class="legend-sel"><b style="background:' + COL[sel.cat] + '">' + sel.orden + '</b><span>' + esc(corto(sel)) + '</span></div>';
}

/* ---------- Mapas SVG (coordenadas del dibujo, no píxeles) ---------- */
function nucleo(){
  return '<circle cx="450" cy="165" r="92" fill="#eef2f0" stroke="#a9b7b0" stroke-width="3"/>' +
    '<rect x="438" y="120" width="44" height="58" rx="4" fill="#5b6b66"/><line x1="460" y1="122" x2="460" y2="176" stroke="#eef2f0" stroke-width="2"/>' +
    '<text x="460" y="112" font-size="15" font-weight="700" fill="#10231c" text-anchor="middle">Elevador</text>' +
    '<rect x="402" y="128" width="20" height="42" rx="3" fill="#10231c"/>';
}
/* Huellas que "caminan" a lo largo de la ruta */
function huellas(pts){
  var P = pts.trim().split(/\s+/).map(function(q){ var a = q.split(','); return [+a[0], +a[1]]; });
  var paso = 32, lista = [];
  for (var i = 0; i < P.length - 1; i++) {
    var x1 = P[i][0], y1 = P[i][1], x2 = P[i+1][0], y2 = P[i+1][1];
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx*dx + dy*dy); if (!L) continue;
    var ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;   // la huella apunta hacia donde se camina
    var nx = -dy / L, ny = dx / L;                        // perpendicular: pie izquierdo / derecho
    for (var t = (i ? paso / 2 : 14); t < L; t += paso) {
      var lado = lista.length % 2 ? 1 : -1;
      lista.push({x: x1 + dx * t / L + nx * 9 * lado, y: y1 + dy * t / L + ny * 9 * lado, a: ang, lado: lado});
    }
  }
  var n = lista.length, ciclo = Math.max(2.4, n * 0.11 + 1.2);
  var pie = '<defs><g id="pie" transform="scale(1.35)">' +
    '<path d="M-4 9 C-6 4 -6 -2 -4.5 -6 C-3 -10 3 -10 4.5 -6 C6 -1 5 5 3 9 C1.5 12.5 -2.5 12.5 -4 9 Z" fill="var(--route)"/>' +
    '<circle cx="-3.6" cy="-12.2" r="1.9" fill="var(--route)"/><circle cx="-0.8" cy="-13.6" r="1.6" fill="var(--route)"/>' +
    '<circle cx="1.8" cy="-13.3" r="1.4" fill="var(--route)"/><circle cx="4" cy="-12" r="1.2" fill="var(--route)"/></g></defs>';
  return pie + lista.map(function(f, k){
    return '<g transform="translate(' + f.x.toFixed(1) + ',' + f.y.toFixed(1) + ') rotate(' + f.a.toFixed(0) + ')">' +
      '<g class="huella" style="animation-duration:' + ciclo.toFixed(2) + 's;animation-delay:' + (k * 0.11).toFixed(2) + 's">' +
      '<use href="#pie" transform="scale(' + (f.lado > 0 ? -1 : 1) + ',1)"/></g></g>';
  }).join('');
}
/* Flecha grande que apunta al destino (dir: grados; 0 = hacia abajo) */
function flecha(x, y, dir){
  return '<g transform="translate(' + x + ',' + y + ') rotate(' + (dir || 0) + ')"><g class="flecha">' +
    '<path d="M0 0 L-26 -30 L-11 -30 L-11 -66 L11 -66 L11 -30 L26 -30 Z" fill="var(--here)" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></g></g>';
}
function aqui(on){
  // Punto "Usted se encuentra aquí": anillo que late + etiqueta con fondo para que se lea sobre cualquier color
  if (!on) return '';
  return '<circle class="here-ring" cx="' + KIOSCO.x + '" cy="' + KIOSCO.y + '" r="16" fill="none" stroke="var(--here)" stroke-width="4"/>' +
    '<circle class="here-dot" cx="' + KIOSCO.x + '" cy="' + KIOSCO.y + '" r="15" fill="var(--here)" stroke="#fff" stroke-width="4"/>' +
    '<rect x="' + (KIOSCO.x - 112) + '" y="' + (KIOSCO.y + 22) + '" width="200" height="30" rx="15" fill="var(--here)"/>' +
    '<text x="' + (KIOSCO.x - 12) + '" y="' + (KIOSCO.y + 43) + '" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">Usted se encuentra aquí</text>';
}
function escalera(x, y){
  var h = '<rect x="' + x + '" y="' + y + '" width="42" height="58" rx="4" fill="#fff" stroke="var(--c-serv)" stroke-width="3"/>';
  [14,28,42].forEach(function(dy){ h += '<line x1="' + (x+6) + '" y1="' + (y+dy) + '" x2="' + (x+36) + '" y2="' + (y+dy) + '" stroke="var(--c-serv)" stroke-width="3"/>'; });
  return h;
}

function mapaPA(dest, zoom){
  var enPA = kiosco === 'pa';
  var vb = '0 60 920 650';
  if (dest && zoom) {
    if (dest.id === 'farmacia' || dest.id === 'archivo') vb = '200 70 420 290';
    else {
      var rz = ROOMS.filter(function(x){ return x.id === dest.id; })[0];
      if (rz) { var x0 = Math.max(0, Math.min(920 - 440, rz.x + rz.w / 2 - 220)); vb = x0 + ' 245 440 380'; }
    }
  }
  var h = '<svg viewBox="' + vb + '" role="img" aria-label="Mapa del 1er piso">';
  h += '<polyline points="360,200 40,250 40,' + PASILLO_Y + ' 70,' + PASILLO_Y + '" fill="none" stroke="var(--hall)" stroke-width="40" stroke-linejoin="round"/>';
  h += '<rect x="62" y="328" width="804" height="312" rx="8" fill="#f3f6f4" stroke="#a9b7b0" stroke-width="2"/>';
  h += '<rect x="62" y="335" width="804" height="56" fill="var(--hall)"/>';
  h += '<text x="80" y="354" font-size="14" font-weight="700" fill="var(--hall-ink)">Pasillo de consultorios</text>';
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
    var start = enPA ? KIOSCO.x + ',' + KIOSCO.y : '460,185', pts = null, r = null;
    if (fs) pts = start + ' 310,176';
    else {
      r = ROOMS.filter(function(x){ return x.id === dest.id; })[0];
      if (r) { var cx = r.x + r.w / 2; pts = start + ' 360,205 40,250 40,' + PASILLO_Y + ' ' + cx + ',' + PASILLO_Y + ' ' + cx + ',' + (r.y + 6); }
    }
    if (pts) h += huellas(pts);
    if (fs) h += flecha(310, 108, 0);
    else if (r) h += flecha(r.x + r.w / 2, r.y + 2, 0);
  }
  if (!enPA && !zoom) h += '<circle cx="460" cy="185" r="13" fill="var(--accent)" stroke="#fff" stroke-width="4"/>' +
    '<rect x="370" y="207" width="180" height="28" rx="14" fill="var(--accent)"/><text x="460" y="226" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">Aquí sale del elevador</text>';
  h += aqui(enPA) + '</svg>';
  return h;
}

/* Planta baja: calco del croquis a mano de Angel (13-nov-2026). Norte arriba, calle al oriente (derecha). */
var PB_DX = -280;  // el núcleo del elevador se dibuja a la izquierda
var PB_CUARTOS = [
  {id:'admision',    x:420, w:110, t:'Admisión'},
  {id:'endoscopias', x:590, w:115, t:'Endo / Anest.'},
  {id:'urologia',    x:710, w:85,  t:'Urología'},
  {id:'wc-pb',       x:800, w:55,  t:'WC H'},
  {id:'wc-pb-m',     x:855, w:55,  t:'WC M'}
];
function mapaPB(dest){
  var enPB = kiosco === 'pb', WY = 510;
  var h = '<svg viewBox="0 60 1080 590" role="img" aria-label="Mapa de planta baja">';
  // pasillos (mismo trazo que el croquis)
  h += '<rect x="150" y="255" width="40" height="150" fill="var(--hall)"/>';                       // baja del elevador
  h += '<rect x="135" y="385" width="100" height="75" rx="6" fill="var(--hall)" stroke="#d6c37a" stroke-width="2"/>'; // vestíbulo
  h += '<rect x="235" y="395" width="285" height="40" fill="var(--hall)"/>';                       // hacia el oriente
  h += '<rect x="480" y="395" width="40" height="135" fill="var(--hall)"/>';                       // baja a la rampa
  h += '<rect x="420" y="490" width="505" height="40" fill="var(--hall)"/>';                       // andador de consultorios
  h += '<text x="560" y="485" font-size="13" font-weight="700" fill="var(--hall-ink)">Pasillo de consultorios</text>';
  // entrada lateral: al inicio del pasillo que sale del vestíbulo hacia el oriente (llega desde el norte)
  // flecha de entrada (en lugar de un pasillo): indica que por aquí se entra al pasillo
  h += '<path d="M262 344 h16 v26 h12 l-20 24 l-20 -24 h12 z" fill="var(--accent)" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>';
  h += '<rect x="215" y="286" width="110" height="54" rx="10" fill="var(--accent)"/><text x="270" y="310" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">ENTRADA</text><text x="270" y="328" font-size="11" fill="#fff" text-anchor="middle">lateral</text>';
  // rampa a Admisión
  h += '<text x="470" y="470" font-size="13" font-weight="700" fill="var(--c-cons)" text-anchor="end">♿ Rampa</text>';
  // rampa de discapacidad (zona norte del andador)
  h += '<rect x="640" y="380" width="240" height="85" rx="8" fill="#e3edf7" stroke="var(--c-cons)" stroke-width="2" stroke-dasharray="6 4"/>' +
       '<text x="760" y="428" font-size="15" font-weight="700" fill="var(--c-cons)" text-anchor="middle">♿ Rampa discapacidad</text>';
  // consultorios al sur del andador
  PB_CUARTOS.forEach(function(c){
    var d = byId[c.id]; if (!d) return;
    var sel = dest && (dest.id === c.id || dest.mismoLugar === c.id), op = dest && !sel ? 0.45 : 1;
    h += '<rect x="' + c.x + '" y="532" width="' + (c.w - 5) + '" height="80" rx="6" fill="' + COL[d.cat] + '" opacity="' + op + '" stroke="' + (sel ? 'var(--route)' : '#fff') + '" stroke-width="' + (sel ? 6 : 3) + '"/>';
    h += '<text x="' + (c.x + (c.w - 5) / 2) + '" y="577" font-size="' + (c.w < 70 ? 13 : 14) + '" font-weight="700" fill="#fff" text-anchor="middle" opacity="' + (op < 1 ? 0.85 : 1) + '">' + esc(c.t || corto(d)) + '</text>';
    if (sel) h += flecha(c.x + (c.w - 5) / 2, 528, 0);
  });
  // entrada principal desde la calle
  h += '<rect x="925" y="440" width="95" height="180" rx="10" fill="var(--accent)"/>' +
       '<text x="972" y="500" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">ENTRADA</text>' +
       '<text x="972" y="518" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">UMAA</text>' +
       '<text x="972" y="545" font-size="10" fill="#fff" text-anchor="middle">Mando de</text><text x="972" y="558" font-size="10" fill="#fff" text-anchor="middle">Vigilancia</text>';
  h += '<line x1="1035" y1="300" x2="1035" y2="640" stroke="#a9b7b0" stroke-width="3"/><line x1="1065" y1="300" x2="1065" y2="640" stroke="#a9b7b0" stroke-width="3"/>' +
       '<text transform="translate(1056,470) rotate(-90)" font-size="13" fill="#53655d" text-anchor="middle">Calle</text>';
  h += '<text x="1050" y="250" font-size="14" font-weight="700" fill="#53655d" text-anchor="middle">N</text><path d="M1050 256 l-7 16 h14 z" fill="#53655d"/>';
  // ruta
  if (dest && dest.estado !== 'pendiente') {
    var c = PB_CUARTOS.filter(function(x){ return x.id === dest.id || x.id === dest.mismoLugar; })[0];
    if (c) {
      var cx = c.x + (c.w - 5) / 2;
      var start = enPB ? (KIOSCO.x + PB_DX) + ',' + KIOSCO.y : (460 + PB_DX) + ',185';
      h += huellas(start + ' 170,250 170,415 500,415 500,' + WY + ' ' + cx + ',' + WY);
    }
  }
  h += '<g transform="translate(' + PB_DX + ',0)">' + nucleo() + aqui(enPB) + '</g>';
  h += '<text x="20" y="640" font-size="12" fill="#53655d">Borrador según croquis de campo · por verificar en sitio.</text>';
  h += '</svg>';
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
  if (go) { vista = {t:'ruta', id:go.getAttribute('data-go')}; mapaCompleto = false; render(); window.scrollTo(0, 0); return; }
  var cb = e.target.closest('[data-cat]');
  if (cb) { var c = cb.getAttribute('data-cat'); vista = {t:'inicio', q:'', cat:(vista.cat === c ? '' : c)}; render(); return; }
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
  fetch('data/areas.json', {cache:'no-cache'}).then(function(r){ if (!r.ok) throw new Error('areas.json ' + r.status); return r.json(); }),
  fetch('version.json', {cache:'no-cache'}).then(function(r){ return r.json(); }).catch(function(){ return {version:'?'}; })
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
