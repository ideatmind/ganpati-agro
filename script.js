(function () {
  'use strict';
  var reduceMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;

  // Navbar scroll
  var navbar = document.getElementById('navbar');
  var lastY = 0;
  function onScroll() {
    var y = pageYOffset;
    if ((y > 40) !== (lastY > 40)) navbar.classList.toggle('scrolled', y > 40);
    lastY = y;
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  var hamburger = document.getElementById('hamburger');
  var navLinks = document.getElementById('navLinks');
  hamburger.addEventListener('click', function () {
    var open = navLinks.classList.toggle('open');
    hamburger.classList.toggle('active', open);
    hamburger.setAttribute('aria-expanded', open);
    hamburger.setAttribute('aria-label', open ? 'मेनू बंद करा' : 'मेनू उघडा');
  });
  navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });

  // Scroll reveal
  if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('visible');
          ro.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    var els = document.querySelectorAll('.reveal');
    for (var i = 0; i < els.length; i++) ro.observe(els[i]);
  } else {
    var els2 = document.querySelectorAll('.reveal');
    for (var i = 0; i < els2.length; i++) els2[i].classList.add('visible');
  }

  // Cluster tabs
  var tabs = document.querySelectorAll('.cluster-tab');
  var panels = document.querySelectorAll('.cluster-panel');
  function activateTab(tab) {
    var target = tab.getAttribute('data-tab');
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i] === tab;
      tabs[i].classList.toggle('active', active);
      tabs[i].setAttribute('aria-selected', active);
    }
    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.toggle('active', panels[i].id === 'panel-' + target);
    }
  }
  for (var j = 0; j < tabs.length; j++) {
    (function (tab) {
      tab.addEventListener('click', function () { activateTab(tab); });
      tab.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var idx = Array.prototype.indexOf.call(tabs, tab);
        var next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
        tabs[next].focus();
        activateTab(tabs[next]);
      });
    })(tabs[j]);
  }

  // Animated counters
  var counters = document.querySelectorAll('.stat-number[data-target]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var counted = {};
    var co = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var el = entries[i].target;
        if (entries[i].isIntersecting && !counted[el.getAttribute('data-target') + el.parentNode.querySelector('.stat-label').textContent]) {
          counted[el.getAttribute('data-target') + el.parentNode.querySelector('.stat-label').textContent] = 1;
          animateCounter(el);
        }
      }
    }, { threshold: 0.5 });
    for (var i = 0; i < counters.length; i++) co.observe(counters[i]);
  } else {
    for (var i = 0; i < counters.length; i++) {
      counters[i].textContent = parseInt(counters[i].getAttribute('data-target'), 10).toLocaleString('mr-IN');
    }
  }

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    var start = null;
    function step(now) {
      if (!start) start = now;
      var p = Math.min((now - start) / 1400, 1);
      el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target).toLocaleString('mr-IN');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Registration form
  var form = document.getElementById('registrationForm');
  var success = document.getElementById('formSuccess');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    form.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });

  // Back to top
  var btt = document.getElementById('backToTop');
  addEventListener('scroll', function () { btt.classList.toggle('visible', pageYOffset > 500); }, { passive: true });
  btt.addEventListener('click', function () { scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
})();
