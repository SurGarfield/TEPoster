(function () {
  var cfg = (window.TEPosterConfig || {});

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function createEl(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }
  function showToast(message, ms) {
    var toast = $('.teposter-toast');
    if (!toast) {
      toast = createEl('div', 'teposter-toast');
      document.body.appendChild(toast);
    }
    toast.textContent = message || '';
    toast.style.display = 'block';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function(){ toast.style.display = 'none'; }, ms || 1600);
  }
  function getTextFromSelectors(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = $(selectors[i]);
      if (el && el.textContent) return el.textContent.trim();
    }
    return '';
  }
  function getMeta(nameOrProp, isProp) {
    var sel = isProp ? 'meta[property="'+nameOrProp+'"]' : 'meta[name="'+nameOrProp+'"]';
    var m = $(sel);
    return m && m.getAttribute('content') || '';
  }
  function detectArticleText() {
    var candidates = [
      'article', '.post .post-content', '.post-content', '.entry-content', '.article-content', '.typo', '.content',
      '#post_content', '.post_content'
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = $(candidates[i]);
      if (el && el.textContent && el.textContent.trim().length > 0) {
        return el.textContent.trim();
      }
    }
    return document.body.textContent.trim();
  }
  function ensureModalScaffold() {
    var backdrop = $('.teposter-modal-backdrop');
    if (backdrop) return backdrop;
    backdrop = createEl('div', 'teposter-modal-backdrop');
    var modal = createEl('div', 'teposter-modal');
    var header = createEl('div', 'teposter-modal-header');
    var title = createEl('div');
    title.textContent = '海报预览';
    var closeBtn = createEl('button', 'teposter-close');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', function(){ backdrop.style.display = 'none'; });
    header.appendChild(title);
    header.appendChild(closeBtn);
    var body = createEl('div', 'teposter-modal-body');
    var footer = createEl('div', 'teposter-modal-footer');
    var btnClass = (cfg.buttonClass && cfg.buttonClass.length) ? cfg.buttonClass : 'teposter-btn';
    var downloadBtn = createEl('button', btnClass);
    downloadBtn.textContent = '下载图片';
    downloadBtn.addEventListener('click', function(){
      var img = body.querySelector('img');
      if (!img) return;
      var a = document.createElement('a');
      a.href = img.src;
      a.download = 'poster.png';
      a.click();
    });
    footer.appendChild(downloadBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function detectPageDateISO() {
    // Try common meta tags
    var metaProps = [
      'article:published_time', 'og:article:published_time'
    ];
    for (var i = 0; i < metaProps.length; i++) {
      var m = document.querySelector('meta[property="' + metaProps[i] + '"]');
      if (m && m.getAttribute('content')) return m.getAttribute('content');
    }
    var metaNames = ['publishdate', 'pubdate', 'date', 'DC.date.issued'];
    for (var j = 0; j < metaNames.length; j++) {
      var n = document.querySelector('meta[name="' + metaNames[j] + '"]');
      if (n && n.getAttribute('content')) return n.getAttribute('content');
    }
    // Try time elements in the theme
    var t = document.querySelector('#article-info time[datetime]')
      || document.querySelector('.info-time[datetime]')
      || document.querySelector('article time[datetime]')
      || document.querySelector('time[datetime]');
    if (t && t.getAttribute('datetime')) return t.getAttribute('datetime');
    return '';
  }

  function getPostDate() {
    var iso = (cfg.postDateISO && String(cfg.postDateISO)) || detectPageDateISO();
    if (!iso) return null;
    try {
      var d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    } catch (_) {}
    return null;
  }

  // Dynamically load scripts with CDN/local fallback and deduplication
  function loadScriptOnce(url) {
    return new Promise(function(resolve, reject){
      if (!url) return reject(new Error('empty url'));
      var key = 'data-teposter-src';
      var exists = Array.prototype.some.call(document.scripts, function(s){
        return s.getAttribute(key) === url || s.src === url;
      });
      if (exists) {
        // If script tag exists, wait a tick in case it's still loading
        return setTimeout(resolve, 50);
      }
      var s = document.createElement('script');
      s.async = true;
      s.defer = true;
      s.setAttribute(key, url);
      s.src = url;
      s.onload = function(){ resolve(); };
      s.onerror = function(){ reject(new Error('load fail: '+url)); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function ensureDepsReady() {
    if (ensureDepsReady._p) return ensureDepsReady._p;
    var needsQR = (typeof window.QRCode === 'undefined');
    var needsH2C = (typeof window.html2canvas === 'undefined');
    if (!needsQR && !needsH2C) return Promise.resolve();
    showToast('加载组件中…');
    var tasks = [];
    if (needsQR) {
      var qrCdn = cfg.cdnQrcodeUrl;
      var qrLocal = cfg.localQrcodeUrl || (cfg.assetsBase + '/vendor/qrcode.min.js');
      tasks.push(loadScriptOnce(qrCdn).catch(function(){ return loadScriptOnce(qrLocal); }));
    }
    if (needsH2C) {
      var h2cCdn = cfg.cdnHtml2canvasUrl;
      var h2cLocal = cfg.localHtml2canvasUrl || (cfg.assetsBase + '/vendor/html2canvas.min.js');
      tasks.push(loadScriptOnce(h2cCdn).catch(function(){ return loadScriptOnce(h2cLocal); }));
    }
    ensureDepsReady._p = Promise.all(tasks).then(function(){
      if (typeof window.QRCode === 'undefined' || typeof window.html2canvas === 'undefined') {
        throw new Error('deps not ready');
      }
    });
    return ensureDepsReady._p;
  }

  function waitForImage(img, timeoutMs) {
    return new Promise(function(resolve){
      var done = false;
      function finish(){ if (!done) { done = true; resolve(); } }
      if (!img) return resolve();
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
      if (timeoutMs) setTimeout(finish, timeoutMs);
    });
  }

  // Utilities shared by layouts
  function isDecorationUrl(url) {
    if (!url) return true;
    var u = String(url);
    return /(logo|icon|avatar|emoji|sprite|placeholder)\/|\.(svg)$/i.test(u);
  }

  function findFirstContentImage() {
    var list = document.querySelectorAll('#content .post .post-content img, article .post-content img, .entry-content img, .article-content img');
    for (var i = 0; i < list.length; i++) {
      var src = list[i].getAttribute('src');
      if (src && !isDecorationUrl(src)) {
        try { return new URL(src, location.href).href; } catch(_) { return src; }
      }
    }
    return '';
  }

  // Resolve and load main image then call applyUrl(url).
  // Returns a promise that resolves when the image is ready (or timed out).
  function chooseImageAndLoad(targetImg, applyUrl, onErrorFallback) {
    var imgSource = (cfg.imageSource || 'default');
    var defaultUrl = (cfg.defaultImage || (cfg.assetsBase + '/poster.webp'));
    var timeout = 8000;
    function load(url) {
      try {
        if (onErrorFallback) targetImg.onerror = function(){ onErrorFallback(); };
        targetImg.crossOrigin = 'anonymous';
        targetImg.referrerPolicy = 'no-referrer';
      } catch(_) {}
      try { targetImg.src = url; } catch(_) {}
      try { applyUrl(url); } catch(_) {}
    }
    if (imgSource === 'thumb') {
      var first = findFirstContentImage();
      if (first) {
        load(first);
      } else {
        var cover = getMeta('og:image', true) || getMeta('twitter:image', true);
        if (cover && !isDecorationUrl(cover)) {
          load(cover);
        } else {
          load(defaultUrl);
        }
      }
    } else if (imgSource === 'unsplash') {
      timeout = 9000;
      var hasUnsplashKey = (cfg.unsplashAccessKey && cfg.unsplashAccessKey.length > 0);
      if (hasUnsplashKey) {
        try {
          var params = new URLSearchParams();
          if (cfg.unsplashKeywords) params.set('query', String(cfg.unsplashKeywords));
          params.set('orientation', 'landscape');
          var api = 'https://api.unsplash.com/photos/random?' + params.toString();
          var headers = { 'Accept-Version': 'v1', 'Authorization': 'Client-ID ' + cfg.unsplashAccessKey };
          fetch(api, { headers: headers }).then(function(r){ return r.json(); }).then(function(json){
            var url = (json && json.urls && (json.urls.regular || json.urls.full || json.urls.small || json.urls.thumb)) || '';
            if (url) {
              var norm = url + (url.indexOf('?')>-1 ? '&' : '?') + 'fm=jpg&q=85';
              load(norm);
            } else {
              load(defaultUrl);
            }
          }).catch(function(){ load(defaultUrl); });
        } catch (_) {
          load(defaultUrl);
        }
      } else {
        load(defaultUrl);
      }
    } else {
      load(defaultUrl);
    }
    return waitForImage(targetImg, timeout);
  }

  function buildPosterDomDefault(data) {
    var width = Math.max(240, parseInt(cfg.posterWidth || 400, 10));
    var staging = createEl('div', 'teposter-staging');

    var root = createEl('div', 'teposter-root');
    root.style.width = width + 'px';
    
    // Header with logo (top-left)
    var header = createEl('div', 'teposter-header');
    if (cfg.logoUrl) {
      var logoImg = createEl('img', 'teposter-logo');
      logoImg.src = cfg.logoUrl;
      logoImg.alt = 'logo';
      logoImg.crossOrigin = 'anonymous';
      header.appendChild(logoImg);
    }
    root.appendChild(header);

    var content = createEl('div', 'teposter-content');
    var title = createEl('div', 'teposter-title');
    title.textContent = data.title;
    
    // Random image (centered)
    var randomWrap = createEl('div', 'teposter-random');
    // Date badge first to ensure it always exists before image
    try {
      var d0 = getPostDate();
      if (d0) {
        var day0 = String(d0.getDate());
        var months0 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var monthYear0 = months0[d0.getMonth()] + '.' + d0.getFullYear();
        var badge0 = createEl('div', 'teposter-date-badge');
        var dayEl0 = createEl('div', 'teposter-date-day');
        dayEl0.textContent = day0;
        var myEl0 = createEl('div', 'teposter-date-monthyear');
        myEl0.textContent = monthYear0;
        badge0.appendChild(dayEl0);
        badge0.appendChild(myEl0);
        randomWrap.appendChild(badge0);
      }
    } catch (_) {}
    var randomImg = createEl('img');
    randomImg.loading = 'eager';
    randomImg.decoding = 'sync';
    function setSvgPlaceholder() {
      var svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f8fbff" offset="0"/><stop stop-color="#e8f0fe" offset="1"/></linearGradient></defs><rect fill="url(#g)" width="800" height="600"/></svg>');
      randomImg.src = 'data:image/svg+xml;charset=utf-8,' + svg;
      randomWrap.appendChild(randomImg);
    }
    var imageReadyPromise = chooseImageAndLoad(randomImg, function(url){
      randomWrap.appendChild(randomImg);
    }, setSvgPlaceholder);

    var summary = createEl('div', 'teposter-summary');
    summary.textContent = data.summary;

    // QR code (bottom centered)
    var qrWrap = createEl('div', 'teposter-qrcode');
    var sizeDefault = (typeof cfg.qrSizeDefault !== 'undefined') ? parseInt(cfg.qrSizeDefault, 10) : 130;
    var qrSizeInline = Math.max(40, sizeDefault || 130);
    try { qrWrap.style.width = qrSizeInline + 'px'; qrWrap.style.height = qrSizeInline + 'px'; } catch(_) {}

    content.appendChild(title);
    content.appendChild(randomWrap);
    content.appendChild(summary);
    content.appendChild(qrWrap);
    root.appendChild(content);

    staging.appendChild(root);
    document.body.appendChild(staging);

    // Generate QR
    try {
      // eslint-disable-next-line no-undef
      var size = Math.max(40, sizeDefault || 130);
      new QRCode(qrWrap, {
        text: data.url,
        width: size,
        height: size,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.error('QRCode error', e);
    }

    return { staging: staging, root: root, ready: Promise.resolve(imageReadyPromise) };
  }

  // Build ninetheme poster layout (hero background on upper half)
  function buildPosterDomNinetheme(data) {
    var width = Math.max(240, parseInt(cfg.posterWidth || 400, 10));
    var staging = createEl('div', 'teposter-staging');

    var root = createEl('div', 'teposter-root teposter-nt');
    root.style.width = width + 'px';

    // Hero section with background image
    var hero = createEl('div', 'nt-hero');
    var heroInfoTop = createEl('div', 'nt-hero-info nt-hero-info-top');
    var heroInfoBottom = createEl('div', 'nt-hero-info nt-hero-info-bottom');
    var titleEl = createEl('div', 'nt-title');
    titleEl.textContent = data.title;
    var summaryEl = createEl('div', 'nt-summary');
    summaryEl.textContent = data.summary;
    heroInfoBottom.appendChild(titleEl);
    heroInfoBottom.appendChild(summaryEl);
    hero.appendChild(heroInfoTop);
    hero.appendChild(heroInfoBottom);

    // Top-left date
    try {
      var d = getPostDate();
      if (d) {
        var day = String(d.getDate());
        var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        var monthYear = months[d.getMonth()] + '.' + d.getFullYear();
        var dateBadge = createEl('div', 'nt-date');
        var dayEl = createEl('div', 'nt-day');
        dayEl.textContent = day;
        var myEl = createEl('div', 'nt-monthyear');
        myEl.textContent = monthYear;
        dateBadge.appendChild(dayEl);
        dateBadge.appendChild(myEl);
        hero.appendChild(dateBadge);
      }
    } catch (_) {}

    // Choose image and set as background
    var randomImg = new Image();
    randomImg.loading = 'eager';
    randomImg.decoding = 'sync';
    function setSvgPlaceholder() {
      var svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#7b90ff" offset="0"/><stop stop-color="#b35fff" offset="1"/></linearGradient></defs><rect fill="url(#g)" width="1600" height="900"/></svg>');
      hero.style.backgroundImage = 'url("data:image/svg+xml;charset=utf-8,' + svg + '")';
    }
    var imageReadyPromise = chooseImageAndLoad(randomImg, function(url){
      hero.style.backgroundImage = 'url("' + url + '")';
    }, setSvgPlaceholder);

    root.appendChild(hero);

    // Bottom white section with brand + qrcode
    var footer = createEl('div', 'nt-footer-white');
    var brand = createEl('div', 'nt-brand');
    var brandRow = createEl('div', 'nt-brand-row');
    var logoOrTitle;
    if (cfg.logoUrl && String(cfg.logoUrl).length > 0) {
      logoOrTitle = createEl('img', 'nt-brand-logo');
      logoOrTitle.src = cfg.logoUrl;
      logoOrTitle.alt = cfg.siteTitle || 'logo';
      logoOrTitle.crossOrigin = 'anonymous';
    } else {
      logoOrTitle = createEl('div', 'nt-brand-title');
      logoOrTitle.textContent = cfg.siteTitle || '';
    }
    var brandDesc = createEl('div', 'nt-brand-desc');
    var descText = String(cfg.ntBrandDesc || '').trim();
    if (descText.length > 0) {
      brandDesc.textContent = descText;
    }
    brandRow.appendChild(logoOrTitle);
    brand.appendChild(brandRow);
    if (descText.length > 0) {
      brand.appendChild(brandDesc);
    } else {
      try { footer.classList.add('no-desc'); } catch(_) {}
    }
    var qrWrap = createEl('div', 'nt-qrcode');
    var sizeNine = (typeof cfg.qrSizeNinetheme !== 'undefined') ? parseInt(cfg.qrSizeNinetheme, 10) : 75;
    var qrSizeInline = Math.max(30, sizeNine || 75);
    try { qrWrap.style.width = qrSizeInline + 'px'; qrWrap.style.height = qrSizeInline + 'px'; } catch(_) {}
    footer.appendChild(brand);
    footer.appendChild(qrWrap);
    root.appendChild(footer);

    staging.appendChild(root);
    document.body.appendChild(staging);

    // QR code
    try {
      var size = Math.max(30, sizeNine || 75);
      new QRCode(qrWrap, { text: data.url, width: size, height: size, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.M });
    } catch (e) { console.error('QRCode error', e); }

    return { staging: staging, root: root, ready: Promise.resolve(imageReadyPromise) };
  }

  function generatePoster() {
    // Ensure dependencies exist (handles SPA first click)
    var depsReady = ensureDepsReady();
    return Promise.resolve(depsReady).then(function(){
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas not ready');
      }
    // Prefer on-page article title, avoid site <title>
    var pageTitle = getTextFromSelectors(['.article-info-title', '.post_info h1','.post-title', 'article h1', '#article-info h1']) || getMeta('og:title', true) || getMeta('twitter:title', true) || document.title || '';
    // Strictly use article content, not site description
    var bodyFirstP = (function(){
      var containers = [
        '#content .post .post-content',
        '#post_content',
        '.post_content',
        '.post-content',
        '.entry-content',
        '.article-content'
      ];
      for (var i = 0; i < containers.length; i++) {
        var c = document.querySelector(containers[i]);
        if (c) {
          var p = c.querySelector('p');
          if (p && p.textContent) return p.textContent.trim();
          if (c.textContent) return c.textContent.trim();
        }
      }
      return '';
    })();
    var fullText = bodyFirstP || detectArticleText();
    // Do not hard-limit by chars; keep fullText for line clamp (CSS limits to 4 lines)
    var summary = fullText;
    var data = { title: pageTitle, summary: summary, url: location.href };

    var dom = (cfg.posterStyle === 'ninetheme') ? buildPosterDomNinetheme(data) : buildPosterDomDefault(data);

    showToast('生成中…');
    // Improve sharpness by rendering at higher scale with pixel budget to avoid freezes
    var dpr = (window.devicePixelRatio || 1);
    var baseScale = Math.max(1.5, Math.min(3, dpr * 2));
    var maxPixels = 4e6; // 4MP budget
    var rect = dom.root.getBoundingClientRect();
    var estPixels = rect.width * rect.height * baseScale * baseScale;
    var scale = baseScale;
    if (estPixels > maxPixels) {
      scale = Math.max(1, Math.sqrt(maxPixels / (rect.width * rect.height)));
    }
    Promise.resolve(dom.ready).then(function(){
      return html2canvas(dom.root, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: scale,
        willReadFrequently: true
      });
    }).then(function(canvas){
      var imgUrl = canvas.toDataURL('image/png');
      var backdrop = ensureModalScaffold();
      var body = backdrop.querySelector('.teposter-modal-body');
      body.innerHTML = '';
      var img = createEl('img');
      img.src = imgUrl;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.objectFit = 'contain';
      // Fit within viewport: scale down via container flex centering (CSS)
      body.appendChild(img);
      backdrop.style.display = 'flex';
      showToast('已生成');
    }).catch(function(err){
      console.error(err);
      showToast('生成失败');
    }).finally(function(){
      try { dom.staging.remove(); } catch(_) {}
    });
    }).catch(function(err){
      console.error(err);
      showToast('组件加载失败');
    });
  }

  // auto insert removed

  function wireManualButton() {
    var btn = document.getElementById('teposter-generate');
    if (btn && !btn._teposterBound) {
      btn.addEventListener('click', generatePoster);
      btn._teposterBound = true;
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // removed persistent progress bar to avoid theme conflicts

  function bindDelegatesOnce() {
    if (window.__TEPosterBoundV1) return;
    window.__TEPosterBoundV1 = true;

    function delegate(e){
      var t = e.target;
      if (!t) return;
      var hit = (t.id === 'teposter-generate') || (t.closest && t.closest('#teposter-generate'));
      if (hit) {
        try { e.preventDefault(); } catch(_) {}
        try { e.stopPropagation(); } catch(_) {}
        return generatePoster();
      }
    }
    document.addEventListener('click', delegate, true);
    document.addEventListener('click', delegate, false);
    document.addEventListener('pointerup', delegate, true);
    document.addEventListener('pointerup', delegate, false);

    // Re-bind on common SPA/PJAX events
    var spaEvents = [
      'pjax:end','pjax:complete','pjax:success',
      'turbolinks:load','turbo:load',
      'instantclick:newpage','InstantClickChange',
      'swup:contentReplaced','barba:after','htmx:afterSettle',
      'pageshow','popstate','hashchange',
      // Turbofley-style custom events (user-provided)
      'turbofley:load','turbofley:ready','turbofley:navigate','turbofley:after'
    ];
    spaEvents.forEach(function(evt){
      window.addEventListener(evt, function(){
        wireManualButton();
      });
      document.addEventListener(evt, function(){
        wireManualButton();
      });
    });

    // MutationObserver to bind once the button appears
    try {
      var mo = new MutationObserver(function(){ wireManualButton(); });
      mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
      // Stop observing after bind success
      var checkBound = setInterval(function(){
        var btn = document.getElementById('teposter-generate');
        if (btn && btn._teposterBound) { try { mo.disconnect(); } catch(_){} clearInterval(checkBound); }
      }, 1000);
      setTimeout(function(){ try { mo.disconnect(); } catch(_){} clearInterval(checkBound); }, 15000);
    } catch(_) {}
  }

  ready(function(){
    wireManualButton();
    bindDelegatesOnce();
    // Expose for manual triggering if needed
    window.TEPoster = window.TEPoster || {};
    window.TEPoster.generate = generatePoster;
    window.TEPoster.rebind = function(){
      try { wireManualButton(); } catch(_) {}
      try { bindDelegatesOnce(); } catch(_) {}
    };
  });
})();


