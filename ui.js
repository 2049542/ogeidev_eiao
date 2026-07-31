/* ══════════════════════════════════════════════════════════════
   EIAO — mejoras visuales (glassmorphism / microanimaciones)
   Aditivo: no modifica lógica de negocio, ids, clases usadas por
   el JS principal, ni llamadas a la API. Solo estética.
══════════════════════════════════════════════════════════════ */

/* Convierte una fecha a texto relativo: "hace 5 min", "ayer", etc. */
function timeAgo(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 45) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} ${diffHr === 1 ? 'hora' : 'horas'}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'ayer';
  if (diffDay < 7) return `hace ${diffDay} días`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `hace ${diffWeek} ${diffWeek === 1 ? 'semana' : 'semanas'}`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `hace ${diffMonth} ${diffMonth === 1 ? 'mes' : 'meses'}`;
  const diffYear = Math.floor(diffDay / 365);
  return `hace ${diffYear} ${diffYear === 1 ? 'año' : 'años'}`;
}

function _hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Paleta de acentos dentro de tonos guinda/púrpura para mantener coherencia visual */
const AVATAR_PALETTE = ['#7B1D1D', '#9B2626', '#8a2f4a', '#6d2340', '#5c3a6e', '#4a3b7a', '#6b2d5c', '#823333', '#a13a3a', '#7a2e52'];

/* Genera un color consistente (hash simple) a partir del nombre/iniciales */
function getAvatarColor(nombre) {
  const str = (nombre || '').trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function _paintAvatar(el) {
  const label = (el.textContent || '').trim();
  if (!label || el.dataset.avPainted === label) return;
  const color = getAvatarColor(label);
  el.style.background = _hexToRgba(color, .3);
  el.style.borderColor = _hexToRgba(color, .55);
  el.style.color = color;
  el.dataset.avPainted = label;
}

function _colorizeAvatars(root) {
  (root || document).querySelectorAll('.top-avatar, .cav:not(.sys)').forEach(_paintAvatar);
}

/* Punto de entrada reutilizable para placeholders .skeleton (el shimmer lo hace el CSS) */
function initSkeletons() {
  document.querySelectorAll('.skeleton').forEach(el => el.classList.add('skeleton'));
}

/* Reproduce la transición de página + stagger sutil en las cards cada vez que .page recibe .on */
function animatePageTransition() {
  document.querySelectorAll('.page').forEach(page => {
    new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.attributeName === 'class' && page.classList.contains('on')) {
          page.querySelectorAll('.card, .kc').forEach((c, i) => {
            c.style.animation = 'none';
            void c.offsetWidth;
            c.style.animation = `fadeUp .22s ease-out ${Math.min(i * 30, 150)}ms both`;
          });
        }
      });
    }).observe(page, { attributes: true, attributeFilter: ['class'] });
  });
}

/* Observa el DOM para colorear avatares nuevos (topbar y comentarios) sin tocar el JS de negocio */
function initMicrointeractions() {
  const observer = new MutationObserver(() => _colorizeAvatars(document));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  _colorizeAvatars(document);
}

document.addEventListener('DOMContentLoaded', () => {
  initSkeletons();
  animatePageTransition();
  initMicrointeractions();
});

/* ══════════════════════════════════════════════════════════════
   RESPONSIVE — sidebar tipo drawer en móvil/tablet (≤1024px)
   Aditivo: no toca go(), buildSidebar() ni ningún otro handler
   existente. Solo controla la clase .open del sidebar y el overlay.
══════════════════════════════════════════════════════════════ */
function _setHamburgerIcon(open) {
  const icon = document.querySelector('#hamburger-btn i');
  if (icon) icon.className = open ? 'ti ti-x' : 'ti ti-menu-2';
}

function openSidebar() {
  const side = document.querySelector('.side');
  const overlay = document.getElementById('sidebar-overlay');
  if (side) side.classList.add('open');
  if (overlay) overlay.classList.add('on');
  _setHamburgerIcon(true);
}

function closeSidebar() {
  const side = document.querySelector('.side');
  const overlay = document.getElementById('sidebar-overlay');
  if (side) side.classList.remove('open');
  if (overlay) overlay.classList.remove('on');
  _setHamburgerIcon(false);
}

function toggleSidebar() {
  const side = document.querySelector('.side');
  if (side && side.classList.contains('open')) closeSidebar();
  else openSidebar();
}

/* Cierra el drawer automáticamente al elegir un nav item en móvil/tablet */
document.addEventListener('click', (e) => {
  if (window.innerWidth > 1024) return;
  if (e.target.closest('.nav')) closeSidebar();
});

/* Si la pantalla crece más allá del breakpoint, resetea el estado del drawer */
window.addEventListener('resize', () => {
  if (window.innerWidth > 1024) closeSidebar();
});
