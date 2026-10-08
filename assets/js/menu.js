/* Eletrix Consertos — menu do cabeçalho (sem bibliotecas).
   Aprimora o menu: submenu Serviços, painel mobile, trava de rolagem,
   Esc, foco e fechamento ao tocar em link ou ao voltar para desktop.
   Sem JS, os links continuam visíveis (ver CSS: fallback sem .js). */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var DESKTOP = 960;
  var header = document.querySelector('.site-header');
  if (!header) return;
  var burger = header.querySelector('.burger');
  var nav = header.querySelector('.main-nav');
  var toggles = Array.prototype.slice.call(header.querySelectorAll('.nav-toggle'));

  function isDesktop() { return window.innerWidth >= DESKTOP; }
  function setToggle(btn, open) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  function closeToggles() { toggles.forEach(function (b) { setToggle(b, false); }); }

  /* Submenu Serviços: clique alterna (acordeão no mobile, dropdown no desktop) */
  toggles.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      setToggle(btn, btn.getAttribute('aria-expanded') !== 'true');
    });
  });

  /* Painel mobile */
  function openMenu() {
    header.classList.add('is-open');
    document.body.classList.add('menu-aberto');
    if (burger) { burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Fechar menu'); }
    var first = nav && nav.querySelector('a, button');
    if (first) first.focus();
  }
  function closeMenu(returnFocus) {
    header.classList.remove('is-open');
    document.body.classList.remove('menu-aberto');
    if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menu'); }
    closeToggles();
    if (returnFocus && burger) burger.focus();
  }

  if (burger) {
    burger.addEventListener('click', function () {
      if (header.classList.contains('is-open')) closeMenu(true); else openMenu();
    });
  }

  /* Fecha o painel ao tocar em um link (importante para âncoras como /#contato) */
  if (nav) {
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && !isDesktop()) closeMenu(false);
    });
  }

  /* Esc: fecha o painel mobile ou o submenu aberto */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (header.classList.contains('is-open')) { closeMenu(true); return; }
    var openT = header.querySelector('.nav-toggle[aria-expanded="true"]');
    if (openT) { setToggle(openT, false); openT.focus(); }
  });

  /* Clique fora fecha o submenu (desktop) */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.has-submenu')) closeToggles();
  });

  /* Voltar para largura de desktop fecha o painel mobile */
  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      if (isDesktop() && header.classList.contains('is-open')) closeMenu(false);
    }, 150);
  });
})();
