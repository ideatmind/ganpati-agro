(function () {
  'use strict';
  var reduceMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;

  // --- Registration API config ---
  var REGISTRATION_ENDPOINT = '/api/registration';
  var MAX_PLOTS = 10;
  var REQUEST_TIMEOUT_MS = 15000;

  function submitRegistration(payload) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    return fetch(REGISTRATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          var err = new Error(body && body.error ? body.error : 'Request failed');
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    }).catch(function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  // --- Navbar scroll ---
  var navbar = document.getElementById('navbar');
  var lastY = 0;
  function onScroll() {
    var y = pageYOffset;
    if ((y > 40) !== (lastY > 40)) navbar.classList.toggle('scrolled', y > 40);
    lastY = y;
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Mobile menu ---
  var hamburger = document.getElementById('hamburger');
  var navLinks = document.getElementById('navLinks');
  var mobileQuery = matchMedia('(max-width: 767px)');

  function syncNavState() {
    var open = navLinks.classList.contains('open');
    hamburger.classList.toggle('active', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'मेनू बंद करा' : 'मेनू उघडा');
    if ('inert' in navLinks) {
      navLinks.toggleAttribute('inert', mobileQuery.matches && !open);
    }
  }

  hamburger.addEventListener('click', function () {
    navLinks.classList.toggle('open');
    syncNavState();
  });
  navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('open');
      syncNavState();
    }
  });
  if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', syncNavState);
  syncNavState();

  // --- Scroll reveal ---
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

  // --- Cluster tabs ---
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
      var isActive = panels[i].id === 'panel-' + target;
      panels[i].classList.toggle('active', isActive);
      panels[i].toggleAttribute('hidden', !isActive);
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

  // --- Animated counters ---
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

  // --- Dynamic Farm Plots ---
  var farmEntries = document.getElementById('farmEntries');
  var addPlotBtn = document.getElementById('addPlotBtn');
  var plotWarning = document.getElementById('plotWarning');
  var plotCount = 1;

  function createFarmEntry(index) {
    var div = document.createElement('div');
    div.className = 'farm-entry';
    div.setAttribute('data-index', index);
    function toMarathiNum(n) {
      return String(n).replace(/[0-9]/g, function(d) { return String.fromCharCode(0x0966 + parseInt(d)); });
    }
    div.innerHTML =
      '<div class="farm-entry-header">' +
        '<span class="farm-entry-label">\u092A\u094D\u0932\u0949\u091F ' + toMarathiNum(index + 1) + ' / Plot ' + (index + 1) + '</span>' +
        '<button type="button" class="btn-remove-plot" title="Remove">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          'Remove' +
        '</button>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field">' +
          '<label for="plotNo_' + index + '">\u0917\u091F / \u0938\u0930\u094D\u0935\u0947 \u0928\u0902\u092C\u0930 <span class="label-en">Plot / Survey No.</span> <span class="required">*</span></label>' +
          '<input type="text" id="plotNo_' + index + '" name="plotNo_' + index + '" required placeholder="e.g. 123/A">' +
        '</div>' +
        '<div class="field">' +
          '<label for="area_' + index + '">\u0915\u094D\u0937\u0947\u0924\u094D\u0930\u092B\u0933 (\u090F\u0915\u0930) <span class="label-en">Area (Acres)</span> <span class="required">*</span></label>' +
          '<input type="number" id="area_' + index + '" name="area_' + index + '" required placeholder="e.g. 2.5" step="0.01" min="0.01">' +
        '</div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field">' +
          '<label for="cropName_' + index + '">\u092A\u093F\u0915\u093E\u091A\u0947 \u0928\u093E\u0935 <span class="label-en">Crop Name</span> <span class="required">*</span></label>' +
          '<input type="text" id="cropName_' + index + '" name="cropName_' + index + '" required placeholder="e.g. Soybean">' +
        '</div>' +
        '<div class="field">' +
          '<label for="irrigationSource_' + index + '">\u0938\u093F\u0902\u091A\u0928 \u0938\u094D\u0930\u094B\u0924 <span class="label-en">Irrigation Source</span> <span class="required">*</span></label>' +
          '<select id="irrigationSource_' + index + '" name="irrigationSource_' + index + '" required>' +
            '<option value="">Select Source</option>' +
            '<option value="well">Well</option>' +
            '<option value="borewell">Borewell</option>' +
            '<option value="canal">Canal</option>' +
            '<option value="drip">Drip Irrigation</option>' +
            '<option value="sprinkler">Sprinkler</option>' +
            '<option value="rainfed">Rainfed</option>' +
            '<option value="river">River / Stream</option>' +
            '<option value="other">Other</option>' +
          '</select>' +
        '</div>' +
      '</div>';
    return div;
  }

  function renumberPlots() {
    var entries = farmEntries.querySelectorAll('.farm-entry');
    for (var i = 0; i < entries.length; i++) {
      var mr = String(i + 1).replace(/[0-9]/g, function(d) { return String.fromCharCode(0x0966 + parseInt(d)); });
      entries[i].querySelector('.farm-entry-label').textContent = '\u092A\u094D\u0932\u0949\u091F ' + mr + ' / Plot ' + (i + 1);
    }
  }

  addPlotBtn.addEventListener('click', function () {
    var current = farmEntries.querySelectorAll('.farm-entry').length;
    if (current >= MAX_PLOTS) {
      plotWarning.textContent = 'कमाल ' + MAX_PLOTS + ' प्लॉट जोडता येतील. / Maximum ' + MAX_PLOTS + ' plots allowed.';
      plotWarning.hidden = false;
      return;
    }
    plotWarning.hidden = true;
    var entry = createFarmEntry(plotCount);
    farmEntries.appendChild(entry);
    plotCount++;
    entry.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });

  farmEntries.addEventListener('click', function (e) {
    var removeBtn = e.target.closest('.btn-remove-plot');
    if (!removeBtn) return;
    var entry = removeBtn.closest('.farm-entry');
    if (farmEntries.querySelectorAll('.farm-entry').length <= 1) {
      plotWarning.textContent = 'किमान एक प्लॉट आवश्यक आहे. / At least one plot is required.';
      plotWarning.hidden = false;
      return;
    }
    plotWarning.hidden = true;
    entry.remove();
    renumberPlots();
  });

  // --- Registration form submission ---
  var form = document.getElementById('registrationForm');
  var success = document.getElementById('formSuccess');
  var submitBtn = document.getElementById('submitBtn');
  var formError = document.getElementById('formError');

  function setFormError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  function makeRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setFormError('');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    // Collect farm plots
    var farmEntriesEls = farmEntries.querySelectorAll('.farm-entry');
    var plots = [];
    for (var i = 0; i < farmEntriesEls.length; i++) {
      var idx = farmEntriesEls[i].getAttribute('data-index');
      plots.push({
        plot_no: form.querySelector('#plotNo_' + idx).value.trim(),
        area_acres: parseFloat(form.querySelector('#area_' + idx).value),
        crop_name: form.querySelector('#cropName_' + idx).value.trim(),
        irrigation_source: form.querySelector('#irrigationSource_' + idx).value
      });
    }

    var incomeRadio = form.querySelector('input[name="income"]:checked');
    var payload = {
      request_id: makeRequestId(),
      name: form.farmerName.value.trim(),
      mobile: form.mobile.value.trim(),
      date_of_birth: form.dob.value,
      aadhar_no: form.aadhar.value.trim(),
      village: form.village.value.trim(),
      taluka: form.taluka.value,
      district: form.district.value.trim(),
      income_source: incomeRadio ? incomeRadio.value : '',
      cluster_type: form.clusterType.value,
      consent: form.consent.checked,
      website: form.website.value,
      plots: plots
    };

    // Show loading state
    var btnText = submitBtn.querySelector('.btn-text');
    var btnLoading = submitBtn.querySelector('.btn-loading');
    btnText.hidden = true;
    btnLoading.hidden = false;
    submitBtn.disabled = true;

    submitRegistration(payload)
      .then(function () {
        form.hidden = true;
        success.hidden = false;
        success.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      })
      .catch(function (err) {
        setFormError(err.name === 'AbortError'
          ? 'वेळ संपली. कृपया पुन्हा प्रयत्न करा. / Request timed out. Please try again.'
          : 'नोंदणी अयशस्वी. कृपया पुन्हा प्रयत्न करा. / Registration failed. Please try again.');
        console.error('Registration error:', err);
        btnText.hidden = false;
        btnLoading.hidden = true;
        submitBtn.disabled = false;
      });
  });

  // --- Image fallback (replace broken editorial image with a self-hosted placeholder) ---
  var aboutImg = document.querySelector('.about-media img');
  if (aboutImg) {
    aboutImg.addEventListener('error', function () {
      if (aboutImg.getAttribute('data-fallback')) return;
      aboutImg.setAttribute('data-fallback', '1');
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420">' +
        '<rect width="1200" height="420" fill="#1b5e20"/>' +
        '<circle cx="600" cy="210" r="130" fill="none" stroke="#4caf50" stroke-width="8"/>' +
        '<path d="M470 210h260M600 80v260" stroke="#4caf50" stroke-width="8"/>' +
        '<path d="M600 80c-30 40-30 90 0 130s30 90 0 130" fill="none" stroke="#f9a825" stroke-width="6"/>' +
        '</svg>';
      aboutImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  // --- Back to top ---
  var btt = document.getElementById('backToTop');
  addEventListener('scroll', function () { btt.classList.toggle('visible', pageYOffset > 500); }, { passive: true });
  btt.addEventListener('click', function () { scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
})();
