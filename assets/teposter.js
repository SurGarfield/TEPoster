(function () {
  var cfg = (window.TEPosterConfig || {});

  function syncPageConfig() {
    if (window.TEPosterConfig && window.TEPosterConfig !== cfg) {
      cfg = window.TEPosterConfig;
    }
    var button = document.getElementById('teposter-generate');
    if (!button) return;
    cfg.postCustomCover = button.getAttribute('data-teposter-post-cover') || '';
    cfg.postDateISO = button.getAttribute('data-teposter-post-date') || '';
    cfg.postAuthor = button.getAttribute('data-teposter-post-author') || '';
    cfg.postAuthorAvatar = button.getAttribute('data-teposter-post-author-avatar') || '';
  }

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
    showToast._t = setTimeout(function () { toast.style.display = 'none'; }, ms || 1600);
  }
  function ensureLoadingScaffold() {
    var wrap = $('.teposter-loading-backdrop');
    if (wrap) return wrap;
    wrap = createEl('div', 'teposter-loading-backdrop');
    var spinner = createEl('div', 'teposter-loading-spinner');
    var text = createEl('div', 'teposter-loading-text');
    text.textContent = '海报生成中...';
    wrap.appendChild(spinner);
    wrap.appendChild(text);
    document.body.appendChild(wrap);
    return wrap;
  }
  function setLoading(active, text) {
    var wrap = ensureLoadingScaffold();
    var textEl = wrap.querySelector('.teposter-loading-text');
    if (textEl && text) textEl.textContent = text;
    wrap.style.display = active ? 'flex' : 'none';
  }
  function getTextFromSelectors(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = $(selectors[i]);
      if (el && el.textContent) return el.textContent.trim();
    }
    return '';
  }
  function getMeta(nameOrProp, isProp) {
    var sel = isProp ? 'meta[property="' + nameOrProp + '"]' : 'meta[name="' + nameOrProp + '"]';
    var m = $(sel);
    return m && m.getAttribute('content') || '';
  }
  function sanitizeSummaryText(text) {
    if (!text) return '';
    var s = String(text);
    s = s.replace(/```[\s\S]*?```/g, ' ');
    s = s.replace(/~~~[\s\S]*?~~~/g, ' ');
    s = s.replace(/`{1,3}[^`]*`{1,3}/g, ' ');
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
    s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
    s = s.replace(/^\s{0,3}\[[^\]]+\]:\s+\S+.*$/gm, ' ');
    s = s.replace(/^\s{0,3}(?:#{1,6}\s*)/gm, '');
    s = s.replace(/^\s{0,3}>\s?/gm, '');
    s = s.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, '');
    s = s.replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, ' ');
    s = s.replace(/(\*\*|__|\*|_|~~)/g, '');
    s = s.replace(/\[(?:\/)?[a-zA-Z][\w:-]*(?:\s+[^\]]*)?\]/g, ' ');
    s = s.replace(/\{\{[\s\S]*?\}\}/g, ' ');
    s = s.replace(/\{%[\s\S]*?%\}/g, ' ');
    s = s.replace(/<%[\s\S]*?%>/g, ' ');
    s = s.replace(/:::[\s\S]*?:::/g, ' ');
    s = s.replace(/&nbsp;/gi, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }
  function extractTextFromContainer(container) {
    if (!container) return '';
    var clone;
    try {
      clone = container.cloneNode(true);
    } catch (_) {
      clone = container;
    }
    var removeSelectors = [
      'script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'form',
      'button', 'input', 'textarea', 'select', 'nav', 'aside', 'footer', 'header',
      '.comment', '.comments', '#comments', '.respond', '.toc', '.table-of-contents',
      '.post-copyright', '.copyright', '.reward', '.ad', '.ads', '.advert',
      '.share', '.social', '.qr', '.qrcode', 'pre', 'code'
    ];
    try {
      var rm = clone.querySelectorAll(removeSelectors.join(', '));
      for (var i = 0; i < rm.length; i++) {
        if (rm[i] && rm[i].parentNode) rm[i].parentNode.removeChild(rm[i]);
      }
    } catch (_) { }

    var best = '';
    try {
      var blocks = clone.querySelectorAll('p, li');
      for (var j = 0; j < blocks.length; j++) {
        var t = sanitizeSummaryText(blocks[j] && blocks[j].textContent || '');
        if (t.length >= 20) return t;
        if (t.length > best.length) best = t;
      }
    } catch (_) { }

    var full = sanitizeSummaryText(clone.textContent || '');
    if (full.length > best.length) return full;
    return best;
  }
  function isLikelyNavOrMenu(node, text) {
    if (!node) return true;
    var t = String(text || '').trim();
    if (!t) return true;
    try {
      if (node.closest && node.closest('nav,header,footer,aside,[role="navigation"],.menu,.menus,.nav,.navbar,.breadcrumb,.site-header,.topbar,.sidebar,.widget,.pagination')) {
        return true;
      }
    } catch (_) { }

    var marker = '';
    try {
      marker = ((node.id || '') + ' ' + (node.className || '')).toLowerCase();
    } catch (_) { }
    if (/(^|\s)(menu|menus|nav|navbar|header|topbar|footer|sidebar|widget|breadcrumb|pager|pagination)(\s|$)/.test(marker) && t.length < 260) {
      return true;
    }

    var linksTextLen = 0;
    var linkCount = 0;
    var pCount = 0;
    try {
      var links = node.querySelectorAll('a');
      linkCount = links.length;
      for (var i = 0; i < links.length; i++) {
        linksTextLen += sanitizeSummaryText(links[i] && links[i].textContent || '').length;
      }
      pCount = node.querySelectorAll('p').length;
    } catch (_) { }
    var linkDensity = t.length > 0 ? (linksTextLen / t.length) : 1;
    if (linkCount >= 4 && pCount === 0 && linkDensity > 0.5) {
      return true;
    }
    return false;
  }
  function detectArticleText() {
    var candidates = [
      '#post_content', '.post_content', '.post-content', '.entry-content', '.article-content',
      '.post__content', '.post-body', '.markdown-body', '.single-content', '.post-entry',
      '.post_container', '.rich-content', '.rich-media', '.typo', '.blog-post',
      '.post-main', '#post-main', '.main-content', '#main-content', '.article',
      '.post', '.content', '.container', '.entry'
    ];
    var fallback = '';
    for (var i = 0; i < candidates.length; i++) {
      var nodes = document.querySelectorAll(candidates[i]);
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];
        var text = extractTextFromContainer(node);
        if (!text || isLikelyNavOrMenu(node, text)) {
          continue;
        }
        if (text.length >= 20) {
          return text;
        }
        if (text.length > fallback.length) fallback = text;
      }
    }
    return fallback;
  }

  function previewStyleName(style) {
    if (style === 'ninetheme') return 'ninetheme';
    if (style === 'netease') return '网易云';
    if (style === 'minimal') return '深色卡片';
    return '默认样式';
  }

  function fitPosterPreview(backdrop, img, style) {
    var modal = backdrop.querySelector('.teposter-modal');
    var body = backdrop.querySelector('.teposter-modal-body');
    var meta = backdrop.querySelector('.teposter-preview-meta');
    if (!modal || !body || !img) return;

    var naturalWidth = img.naturalWidth || 800;
    var naturalHeight = img.naturalHeight || 1200;
    var ratio = naturalWidth / Math.max(1, naturalHeight);
    var viewportWidth = document.documentElement.clientWidth || window.innerWidth || 400;
    var viewportHeight = document.documentElement.clientHeight || window.innerHeight || 720;
    var preferredWidth = style === 'minimal' ? 430 : (style === 'netease' ? 410 : (style === 'ninetheme' ? 390 : 400));
    var maxImageWidth = Math.max(120, viewportWidth - 64);
    var maxImageHeight = Math.max(120, viewportHeight - 184);
    var previewWidth = Math.max(96, Math.min(preferredWidth, maxImageWidth, maxImageHeight * ratio));

    modal.style.width = Math.ceil(previewWidth + 34) + 'px';
    body.style.setProperty('--teposter-preview-width', Math.floor(previewWidth) + 'px');
    body.style.setProperty('--teposter-preview-height', Math.floor(maxImageHeight) + 'px');
    backdrop.setAttribute('data-poster-style', style || 'default');
    if (meta) {
      meta.textContent = previewStyleName(style) + ' · ' + naturalWidth + ' × ' + naturalHeight;
    }
  }

  function ensureModalScaffold() {
    var backdrop = $('.teposter-modal-backdrop');
    if (backdrop) return backdrop;
    backdrop = createEl('div', 'teposter-modal-backdrop');
    var modal = createEl('div', 'teposter-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'teposter-preview-title');
    modal.tabIndex = -1;
    var header = createEl('div', 'teposter-modal-header');
    var title = createEl('div', 'teposter-modal-title');
    title.id = 'teposter-preview-title';
    title.textContent = '海报预览';
    var closeBtn = createEl('button', 'teposter-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', '关闭预览');
    closeBtn.title = '关闭预览';
    closeBtn.innerHTML = '✕';

    function closePreview() {
      backdrop.style.display = 'none';
      var trigger = document.getElementById('teposter-generate');
      if (trigger && trigger.focus) trigger.focus();
    }

    closeBtn.addEventListener('click', closePreview);
    header.appendChild(title);
    header.appendChild(closeBtn);
    var body = createEl('div', 'teposter-modal-body');
    var footer = createEl('div', 'teposter-modal-footer');
    var previewMeta = createEl('div', 'teposter-preview-meta');
    previewMeta.textContent = '海报生成完成';
    var downloadBtn = createEl('button', 'teposter-download');
    downloadBtn.type = 'button';
    downloadBtn.textContent = '下载海报';
    downloadBtn.addEventListener('click', function () {
      var img = body.querySelector('img');
      if (!img) return;
      var a = document.createElement('a');
      a.href = img.src;
      a.download = 'poster.png';
      a.click();
    });
    footer.appendChild(previewMeta);
    footer.appendChild(downloadBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) closePreview();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && backdrop.style.display === 'flex') closePreview();
    });
    window.addEventListener('resize', function () {
      if (backdrop.style.display === 'flex' && typeof backdrop._teposterFit === 'function') {
        backdrop._teposterFit();
      }
    });
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
    } catch (_) { }
    return null;
  }

  // Dynamically load scripts with CDN/local fallback and deduplication
  function loadScriptOnce(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!url) return reject(new Error('empty url'));
      var cache = loadScriptOnce._cache || (loadScriptOnce._cache = {});
      if (cache[url]) return cache[url].then(resolve, reject);
      var key = 'data-teposter-src';
      var p = new Promise(function (res, rej) {
        var existing = null;
        for (var i = 0; i < document.scripts.length; i++) {
          var si = document.scripts[i];
          if (si.getAttribute(key) === url || si.src === url) {
            existing = si;
            break;
          }
        }

        var done = false;
        var timer = null;
        function finish(fn, arg) {
          if (done) return;
          done = true;
          if (timer) clearTimeout(timer);
          fn(arg);
        }
        if (timeoutMs && timeoutMs > 0) {
          timer = setTimeout(function () {
            finish(rej, new Error('load timeout: ' + url));
          }, timeoutMs);
        }

        function onLoad() { finish(res); }
        function onError() { finish(rej, new Error('load fail: ' + url)); }

        if (existing) {
          if (existing.getAttribute('data-teposter-loaded') === '1') {
            return finish(res);
          }
          existing.addEventListener('load', onLoad, { once: true });
          existing.addEventListener('error', onError, { once: true });
          return;
        }

        var s = document.createElement('script');
        s.async = true;
        s.defer = true;
        s.setAttribute(key, url);
        s.src = url;
        s.onload = function () {
          try { s.setAttribute('data-teposter-loaded', '1'); } catch (_) { }
          onLoad();
        };
        s.onerror = onError;
        (document.head || document.documentElement).appendChild(s);
      });
      cache[url] = p;
      p.then(function () {
        if (loadScriptOnce._cache) delete loadScriptOnce._cache[url];
      }, function () {
        if (loadScriptOnce._cache) delete loadScriptOnce._cache[url];
      });
      p.then(resolve, reject);
    });
  }

  function ensureDepsReady(silent) {
    if (ensureDepsReady._p) return ensureDepsReady._p;
    var needsQR = (typeof window.QRCode === 'undefined');
    var needsH2C = (typeof window.html2canvas === 'undefined');
    if (!needsQR && !needsH2C) return Promise.resolve();
    if (!silent) showToast('加载组件中…');
    var tasks = [];
    var preferLocal = (cfg.assetSource === 'local');
    var scriptTimeout = 2800;

    function loadDependency(primary, secondary, isReady) {
      function loadAndVerify(url) {
        return loadScriptOnce(url, scriptTimeout).then(function () {
          if (!isReady()) throw new Error('dependency unavailable: ' + url);
        });
      }
      return loadAndVerify(primary).catch(function () {
        return loadAndVerify(secondary);
      });
    }

    if (needsQR) {
      var qrCdn = cfg.cdnQrcodeUrl;
      var qrLocal = cfg.localQrcodeUrl || (cfg.assetsBase + '/vendor/qrcode.min.js');
      var qrPrimary = preferLocal ? qrLocal : qrCdn;
      var qrSecondary = preferLocal ? qrCdn : qrLocal;
      tasks.push(loadDependency(qrPrimary, qrSecondary, function () {
        return typeof window.QRCode !== 'undefined';
      }));
    }
    if (needsH2C) {
      var h2cCdn = cfg.cdnHtml2canvasUrl;
      var h2cLocal = cfg.localHtml2canvasUrl || (cfg.assetsBase + '/vendor/html2canvas.min.js');
      var h2cPrimary = preferLocal ? h2cLocal : h2cCdn;
      var h2cSecondary = preferLocal ? h2cCdn : h2cLocal;
      tasks.push(loadDependency(h2cPrimary, h2cSecondary, function () {
        return typeof window.html2canvas !== 'undefined';
      }));
    }
    ensureDepsReady._p = Promise.all(tasks).then(function () {
      if (typeof window.QRCode === 'undefined' || typeof window.html2canvas === 'undefined') {
        throw new Error('deps not ready');
      }
    }).catch(function (error) {
      ensureDepsReady._p = null;
      throw error;
    });
    return ensureDepsReady._p;
  }

  function waitForImage(img, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (!done) { done = true; resolve(); } }
      if (!img) return resolve();
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
      if (timeoutMs) setTimeout(finish, timeoutMs);
    });
  }

  // Utilities shared by layouts
  var MIN_COVER_SHORT_EDGE = 180;
  var MIN_COVER_LONG_EDGE = 320;
  var MIN_COVER_AREA = 120000;

  function isDecorationUrl(url) {
    if (!url) return true;
    var u = String(url).toLowerCase();
    if (/^(?:data|blob):/i.test(u)) return true;
    if (/\.(?:svg)(?:[?#]|$)/i.test(u)) return true;
    if (/(?:^|[\/_.?&=-])(?:avatar|gravatar|emoji|emoticon|sticker|icon|logo|badge|sprite|placeholder|qrcode|qr-code|reward)(?:[\/_.?&=-]|$)/i.test(u)) return true;
    return /(?:loading|lazy|spacer|blank|transparent)[-_.]?(?:image|pixel)?\.(?:gif|png|webp)(?:[?#]|$)/i.test(u);
  }

  function isDecorationImage(img) {
    if (!img) return true;
    try {
      if (img.closest('nav, aside, footer, .author, .post-author, .entry-author, .profile, .avatar, .comments, .comment, .reward, .share, .social, .qrcode, .qr-code')) {
        return true;
      }
    } catch (_) { }

    var semanticText = [
      img.id,
      img.className,
      img.getAttribute('alt'),
      img.getAttribute('title'),
      img.getAttribute('role')
    ].join(' ').toLowerCase();
    return /(?:^|[\s_-])(?:avatar|gravatar|emoji|emoticon|sticker|icon|logo|badge|qrcode|qr-code|reward|author|profile)(?:[\s_-]|$)/i.test(semanticText);
  }

  function pickLargestSrcset(srcset) {
    if (!srcset || !String(srcset).trim()) return '';
    var bestUrl = '';
    var bestScore = -1;
    String(srcset).split(',').forEach(function (item) {
      var parts = item.trim().split(/\s+/);
      if (!parts[0]) return;
      var descriptor = parts[1] || '1x';
      var score = parseFloat(descriptor) || 1;
      if (/w$/i.test(descriptor)) score *= 1000;
      if (score > bestScore) {
        bestScore = score;
        bestUrl = parts[0];
      }
    });
    return bestUrl;
  }

  function isUsableCoverDimensions(img, allowSmall) {
    if (allowSmall) return true;
    var width = Number(img && img.naturalWidth) || 0;
    var height = Number(img && img.naturalHeight) || 0;
    if (!width || !height) return false;
    var shortEdge = Math.min(width, height);
    var longEdge = Math.max(width, height);
    return shortEdge >= MIN_COVER_SHORT_EDGE
      && longEdge >= MIN_COVER_LONG_EDGE
      && width * height >= MIN_COVER_AREA;
  }

  function normalizeUrlMaybe(url) {
    if (!url) return '';
    var str = String(url).trim();
    if (!str) return '';
    try { return new URL(str, location.href).href; } catch (_) { }
    return str;
  }
  function getSameSiteUploadCandidates(url) {
    var normalized = normalizeUrlMaybe(url);
    if (!normalized) return [];
    var candidates = [];
    try {
      var parsed = new URL(normalized, location.href);
      if (parsed.origin !== location.origin && /^\/usr\/uploads(?:\/|$)/i.test(parsed.pathname)) {
        candidates.push(location.origin + parsed.pathname + parsed.search + parsed.hash);
      }
    } catch (_) { }
    if (candidates.indexOf(normalized) === -1) candidates.push(normalized);
    return candidates;
  }
  function setImageCorsMode(img, url) {
    try {
      var parsed = new URL(url, location.href);
      if (parsed.origin === location.origin) {
        img.removeAttribute('crossorigin');
      } else {
        img.crossOrigin = 'anonymous';
      }
    } catch (_) {
      img.removeAttribute('crossorigin');
    }
  }
  function optimizeRemoteImageUrl(url) {
    if (!url) return '';
    var s = String(url);
    if (!/^https?:\/\//i.test(s)) return s;
    try {
      var u = new URL(s, location.href);
      var host = (u.hostname || '').toLowerCase();
      var maxW = Math.max(900, Math.min(1400, Math.round((parseInt(cfg.posterWidth, 10) || 400) * 2.2)));
      if (host.indexOf('unsplash.com') !== -1) {
        if (!u.searchParams.has('auto')) u.searchParams.set('auto', 'format');
        if (!u.searchParams.has('fit')) u.searchParams.set('fit', 'max');
        u.searchParams.set('w', String(maxW));
        u.searchParams.set('q', '70');
        u.searchParams.set('fm', 'jpg');
      }
      return u.toString();
    } catch (_) {
      return s;
    }
  }
  function pickUnsplashPhoto(json) {
    var list = Array.isArray(json) ? json : (json ? [json] : []);
    if (!list.length) return null;

    var recentIds = [];
    try {
      var raw = sessionStorage.getItem('teposter_unsplash_recent_ids');
      recentIds = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(recentIds)) recentIds = [];
    } catch (_) { recentIds = []; }

    function bestUrl(item) {
      return item && item.urls && (item.urls.regular || item.urls.full || item.urls.small || item.urls.thumb) || '';
    }

    var filtered = [];
    for (var i = 0; i < list.length; i++) {
      var id = list[i] && list[i].id;
      var url = bestUrl(list[i]);
      if (!url) continue;
      if (id && recentIds.indexOf(id) !== -1) continue;
      filtered.push(list[i]);
    }

    var pool = filtered.length ? filtered : list;
    var picked = pool[Math.floor(Math.random() * pool.length)] || null;
    var pickedUrl = bestUrl(picked);
    if (!pickedUrl) return null;

    try {
      var pickedId = picked && picked.id;
      if (pickedId) {
        recentIds.push(pickedId);
        if (recentIds.length > 24) {
          recentIds = recentIds.slice(recentIds.length - 24);
        }
        sessionStorage.setItem('teposter_unsplash_recent_ids', JSON.stringify(recentIds));
      }
    } catch (_) { }

    return { id: picked && picked.id || '', url: pickedUrl };
  }

  function resolveImgCandidate(img) {
    if (!img) return '';
    var attrOrder = [
      'data-original',
      'data-original-src',
      'data-src',
      'data-lazy',
      'data-lazy-src',
      'data-full',
      'data-preview',
      'data-zoom',
      'data-zoom-img',
      'data-large',
      'data-origin'
    ];
    for (var i = 0; i < attrOrder.length; i++) {
      var val = img.getAttribute(attrOrder[i]);
      if (val && val.trim()) return val;
    }
    if (img.currentSrc) return img.currentSrc;
    var srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset');
    if (!srcset && img.dataset) {
      srcset = img.dataset.srcset || img.dataset.srcSet;
    }
    var srcsetUrl = pickLargestSrcset(srcset);
    if (srcsetUrl) return srcsetUrl;
    return img.getAttribute('src') || '';
  }

  function findContentImageCandidates() {
    var containerSelectors = [
      '.post-content',
      '.entry-content',
      '.post_content',
      '.article-content',
      '#post-content',
      '#content .post .post-content',
      'article .post-content',
      '.markdown-body',
      '.typo',
      '.rich-media',
      '.rich-content',
      '.blog-post',
      '.post-body',
      '.single-content',
      '.post-entry',
      'article'
    ];
    var seenNodes = [];
    var seenUrls = Object.create(null);
    var candidates = [];

    for (var i = 0; i < containerSelectors.length; i++) {
      var container = null;
      try { container = document.querySelector(containerSelectors[i]); } catch (_) { }
      if (!container) continue;
      var images = container.querySelectorAll('img');
      for (var j = 0; j < images.length; j++) {
        var img = images[j];
        if (seenNodes.indexOf(img) !== -1 || isDecorationImage(img)) continue;
        seenNodes.push(img);
        var normalized = normalizeUrlMaybe(resolveImgCandidate(img));
        if (!normalized || isDecorationUrl(normalized) || seenUrls[normalized]) continue;
        seenUrls[normalized] = true;
        candidates.push(normalized);
      }
      if (candidates.length) break;
    }
    return candidates;
  }

  // Resolve and load main image then call applyUrl(url).
  // Returns a promise that resolves when the image is ready (or timed out).
  function chooseImageAndLoad(targetImg, applyUrl, onErrorFallback) {
    var imgSource = (cfg.imageSource || 'default');
    var defaultUrl = (cfg.defaultImage || (cfg.assetsBase + '/poster.webp'));
    var candidateTimeout = 3200;

    function loadCandidate(candidate) {
      return new Promise(function (resolve) {
        var finalUrl = optimizeRemoteImageUrl(candidate.url);
        var settled = false;
        var timer = null;

        function cleanup() {
          if (timer) clearTimeout(timer);
          targetImg.onload = null;
          targetImg.onerror = null;
        }
        function finish(ok) {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(ok);
        }
        targetImg.onload = function () {
          if (settled) return;
          if (!isUsableCoverDimensions(targetImg, candidate.allowSmall)) return finish(false);
          try { applyUrl(finalUrl); } catch (_) { }
          finish(true);
        };
        targetImg.onerror = function () { finish(false); };
        timer = setTimeout(function () { finish(false); }, candidateTimeout);

        try {
          setImageCorsMode(targetImg, finalUrl);
          targetImg.referrerPolicy = 'no-referrer';
          targetImg.style.width = '100%';
          targetImg.style.height = '100%';
          targetImg.style.objectFit = 'cover';
          targetImg.src = finalUrl;
          if (targetImg.complete) setTimeout(targetImg.onload, 0);
        } catch (_) {
          finish(false);
        }
      });
    }

    function loadCandidates(candidates, index) {
      if (index >= candidates.length) {
        try { if (onErrorFallback) onErrorFallback(); } catch (_) { }
        return waitForImage(targetImg, 1000);
      }
      return loadCandidate(candidates[index]).then(function (loaded) {
        if (loaded) return;
        return loadCandidates(candidates, index + 1);
      });
    }

    if (imgSource === 'thumb') {
      var candidates = [];
      var seen = Object.create(null);
      function enqueue(url, allowDecoration, allowSmall) {
        getSameSiteUploadCandidates(url).forEach(function (resolved) {
          if (!allowDecoration && isDecorationUrl(resolved)) return;
          if (seen[resolved]) return;
          seen[resolved] = true;
          candidates.push({ url: resolved, allowSmall: !!allowSmall });
        });
      }

      enqueue(cfg.postCustomCover);
      findContentImageCandidates().forEach(function (url) { enqueue(url); });
      enqueue(getMeta('og:image', true) || getMeta('twitter:image', true));
      enqueue(defaultUrl, true, true);
      return loadCandidates(candidates, 0);
    } else if (imgSource === 'unsplash') {
      candidateTimeout = 5000;
      var hasUnsplashKey = (cfg.unsplashAccessKey && cfg.unsplashAccessKey.length > 0);
      if (hasUnsplashKey) {
        try {
          var params = new URLSearchParams();
          if (cfg.unsplashKeywords) params.set('query', String(cfg.unsplashKeywords));
          params.set('orientation', 'landscape');
          params.set('content_filter', 'high');
          params.set('count', '10');
          params.set('nonce', String(Date.now()) + '-' + Math.floor(Math.random() * 1000000));
          var api = 'https://api.unsplash.com/photos/random?' + params.toString();
          var headers = { 'Accept-Version': 'v1', 'Authorization': 'Client-ID ' + cfg.unsplashAccessKey };
          return fetch(api, { headers: headers, cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error('unsplash api status ' + r.status);
            return r.json();
          }).then(function (json) {
            var picked = pickUnsplashPhoto(json);
            var url = picked && picked.url || '';
            if (url) {
              var norm = url + (url.indexOf('?') > -1 ? '&' : '?') + 'rand=' + Date.now();
              return loadCandidates([{ url: norm, allowSmall: false }, { url: defaultUrl, allowSmall: true }], 0);
            }
            return loadCandidates([{ url: defaultUrl, allowSmall: true }], 0);
          }).catch(function () {
            return loadCandidates([{ url: defaultUrl, allowSmall: true }], 0);
          });
        } catch (_) {
          return loadCandidates([{ url: defaultUrl, allowSmall: true }], 0);
        }
      }
      return loadCandidates([{ url: defaultUrl, allowSmall: true }], 0);
    }
    return loadCandidates([{ url: defaultUrl, allowSmall: true }], 0);
  }

  function buildPosterDomDefault(data) {
    var width = Math.max(240, parseInt(cfg.posterWidth || 400, 10));
    var staging = createEl('div', 'teposter-staging');

    var root = createEl('div', 'teposter-root teposter-default');
    root.style.width = width + 'px';

    if (cfg.logoUrl) {
      var header = createEl('div', 'teposter-header');
      var logoImg = createEl('img', 'teposter-logo');
      logoImg.src = cfg.logoUrl;
      logoImg.alt = 'logo';
      logoImg.crossOrigin = 'anonymous';
      header.appendChild(logoImg);
      root.appendChild(header);
    }

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
        var months0 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
    } catch (_) { }
    var randomImg = createEl('img');
    randomImg.loading = 'eager';
    randomImg.decoding = 'async';
    function setSvgPlaceholder() {
      var svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f8fbff" offset="0"/><stop stop-color="#e8f0fe" offset="1"/></linearGradient></defs><rect fill="url(#g)" width="800" height="600"/></svg>');
      randomImg.src = 'data:image/svg+xml;charset=utf-8,' + svg;
      randomWrap.appendChild(randomImg);
    }
    var imageReadyPromise = chooseImageAndLoad(randomImg, function (url) {
      randomWrap.appendChild(randomImg);
    }, setSvgPlaceholder);

    var summary = createEl('div', 'teposter-summary');
    summary.textContent = data.summary;

    // QR code (bottom centered)
    var qrWrap = createEl('div', 'teposter-qrcode');
    var sizeDefault = (typeof cfg.qrSizeDefault !== 'undefined') ? parseInt(cfg.qrSizeDefault, 10) : 130;
    var qrSizeInline = Math.max(40, sizeDefault || 130);
    try { qrWrap.style.width = qrSizeInline + 'px'; qrWrap.style.height = qrSizeInline + 'px'; } catch (_) { }

    content.appendChild(title);
    content.appendChild(randomWrap);
    if (data.summary) content.appendChild(summary);
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
    var heroInfoBottom = createEl('div', 'nt-hero-info nt-hero-info-bottom');
    var titleEl = createEl('div', 'nt-title');
    titleEl.textContent = data.title;
    var summaryEl = createEl('div', 'nt-summary');
    summaryEl.textContent = data.summary;
    heroInfoBottom.appendChild(titleEl);
    if (data.summary) heroInfoBottom.appendChild(summaryEl);
    hero.appendChild(heroInfoBottom);

    // Top-left date
    try {
      var d = getPostDate();
      if (d) {
        var day = String(d.getDate());
        var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
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
    } catch (_) { }

    // Choose image and set as background
    var randomImg = new Image();
    randomImg.loading = 'eager';
    randomImg.decoding = 'async';
    function setSvgPlaceholder() {
      var svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d9dde3" offset="0"/><stop stop-color="#aeb6c2" offset="1"/></linearGradient></defs><rect fill="url(#g)" width="1600" height="900"/></svg>');
      hero.style.backgroundImage = 'url("data:image/svg+xml;charset=utf-8,' + svg + '")';
    }
    var imageReadyPromise = chooseImageAndLoad(randomImg, function (url) {
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
      try { footer.classList.add('no-desc'); } catch (_) { }
    }
    var qrWrap = createEl('div', 'nt-qrcode');
    var sizeNine = (typeof cfg.qrSizeNinetheme !== 'undefined') ? parseInt(cfg.qrSizeNinetheme, 10) : 75;
    var qrSizeInline = Math.max(30, sizeNine || 75);
    try { qrWrap.style.width = qrSizeInline + 'px'; qrWrap.style.height = qrSizeInline + 'px'; } catch (_) { }
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

  // Build Netease poster layout
  function buildPosterDomNetease(data) {
    var width = Math.max(240, parseInt(cfg.posterWidth || 400, 10));
    var staging = createEl('div', 'teposter-staging');

    var root = createEl('div', 'teposter-root teposter-netease');
    root.style.width = width + 'px';

    // 1. Cover
    var imageWrap = createEl('div', 'netease-image-wrap');

    var randomImg = new Image();
    randomImg.loading = 'eager';
    randomImg.decoding = 'async';

    function setSvgPlaceholder() {
      var svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#dde2e6" width="800" height="600"/></svg>');
      randomImg.src = 'data:image/svg+xml;charset=utf-8,' + svg;
    }

    var imageReadyPromise = chooseImageAndLoad(randomImg, function (url) {
      // Image loaded
    }, setSvgPlaceholder);

    imageWrap.appendChild(randomImg);
    root.appendChild(imageWrap);

    // 2. Article identity
    var articleHead = createEl('div', 'netease-article-head');
    var titleEl = createEl('div', 'netease-title');
    titleEl.textContent = data.title;
    articleHead.appendChild(titleEl);
    if (cfg.postAuthor) {
      var authorEl = createEl('div', 'netease-author');
      authorEl.textContent = cfg.postAuthor;
      articleHead.appendChild(authorEl);
    }
    root.appendChild(articleHead);

    // 3. Date and excerpt
    var middleArea = createEl('div', 'netease-middle');

    // Date follows the default layout: day above, month and year below.
    var dateWrap = createEl('div', 'netease-date-wrap');
    var d = getPostDate() || new Date();
    var day = String(d.getDate());
    if (day.length < 2) day = '0' + day;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var monthYear = months[d.getMonth()] + '.' + d.getFullYear();
    var dateDay = createEl('div', 'netease-date-day');
    var dateMonthYear = createEl('div', 'netease-date-monthyear');
    dateDay.textContent = day;
    dateMonthYear.textContent = monthYear;
    dateWrap.appendChild(dateDay);
    dateWrap.appendChild(dateMonthYear);

    // Article excerpt
    var descWrap = createEl('div', 'netease-desc-wrap');
    var descEl = createEl('div', 'netease-desc');
    descEl.textContent = data.summary || '';
    descWrap.appendChild(descEl);

    middleArea.appendChild(dateWrap);
    if (data.summary) {
      middleArea.appendChild(descWrap);
    } else {
      middleArea.classList.add('no-summary');
    }
    root.appendChild(middleArea);

    // 4. Site identity and QR code
    var footer = createEl('div', 'netease-footer');

    // Left
    var footerLeft = createEl('div', 'netease-footer-left');
    var brandRow = createEl('div', 'netease-brand-row');

    // Keep the configured logo treatment, with a clean site title as fallback.
    if (cfg.logoUrl) {
      var logo = createEl('img', 'netease-logo');
      logo.src = cfg.logoUrl;
      logo.alt = cleanSiteTitle(cfg.siteTitle);
      logo.crossOrigin = 'anonymous';
      brandRow.appendChild(logo);
    } else {
      var siteName = createEl('span', 'netease-site-name');
      siteName.textContent = cleanSiteTitle(cfg.siteTitle);
      brandRow.appendChild(siteName);
    }

    footerLeft.appendChild(brandRow);

    var scanText = createEl('div', 'netease-scan-text');
    scanText.textContent = '长按识别二维码，阅读全文';
    footerLeft.appendChild(scanText);

    // Right (QR Code)
    var footerRight = createEl('div', 'netease-footer-right');
    var qrWrap = createEl('div', 'netease-qrcode');

    var sizeNetease = 72;
    qrWrap.style.width = '80px';
    qrWrap.style.height = '80px';

    footerRight.appendChild(qrWrap);
    footer.appendChild(footerLeft);
    footer.appendChild(footerRight);
    root.appendChild(footer);

    staging.appendChild(root);
    document.body.appendChild(staging);

    // Generate QR
    try {
      new QRCode(qrWrap, {
        text: data.url,
        width: sizeNetease,
        height: sizeNetease,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.error('QRCode error', e);
    }

    return { staging: staging, root: root, ready: Promise.resolve(imageReadyPromise) };
  }

  function getSiteFaviconUrl() {
    var links = document.querySelectorAll('link[rel][href]');
    var bestUrl = '';
    var bestScore = -1;
    for (var i = 0; i < links.length; i++) {
      var rel = String(links[i].getAttribute('rel') || '').toLowerCase();
      var relTokens = rel.split(/\s+/);
      if (relTokens.indexOf('icon') === -1) continue;
      var href = normalizeUrlMaybe(links[i].getAttribute('href'));
      if (!href) continue;
      var score = relTokens.indexOf('shortcut') !== -1 ? 1000 : 900;
      var sizes = String(links[i].getAttribute('sizes') || '');
      var match = sizes.match(/(\d+)x(\d+)/i);
      if (match) score += Math.max(parseInt(match[1], 10), parseInt(match[2], 10));
      if (sizes.toLowerCase() === 'any') score += 512;
      if (score > bestScore) {
        bestScore = score;
        bestUrl = href;
      }
    }
    return bestUrl;
  }

  function cleanSiteTitle(title) {
    var value = String(title || '').trim();
    var first = value.split(/[-丨]/)[0].trim();
    return first || value || location.hostname || 'Website';
  }

  function cleanPageTitle(title, siteTitle) {
    var value = String(title || '').trim();
    var site = String(siteTitle || '').trim();
    if (!value || !site) return value;

    var siteNames = [site, cleanSiteTitle(site)];
    for (var i = 0; i < siteNames.length; i++) {
      var name = String(siteNames[i] || '').trim();
      if (!name || siteNames.indexOf(name) !== i) continue;
      var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var suffix = new RegExp('\\s*[-–—|丨]\\s*' + escaped + '\\s*$', 'i');
      if (suffix.test(value)) return value.replace(suffix, '').trim();
    }
    return value;
  }

  function buildPosterDomMinimal(data) {
    var width = Math.max(240, parseInt(cfg.posterWidth || 400, 10));
    var staging = createEl('div', 'teposter-staging');
    var root = createEl('div', 'teposter-root teposter-minimal');
    root.style.width = width + 'px';

    var coverWrap = createEl('div', 'minimal-cover');
    var cover = new Image();
    cover.loading = 'eager';
    cover.decoding = 'async';
    function setCoverPlaceholder() {
      var svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect fill="#2a2d2c" width="800" height="800"/></svg>');
      cover.src = 'data:image/svg+xml;charset=utf-8,' + svg;
    }
    var coverReadyPromise = chooseImageAndLoad(cover, function () { }, setCoverPlaceholder);
    coverWrap.appendChild(cover);
    root.appendChild(coverWrap);

    var copy = createEl('div', 'minimal-copy');
    var title = createEl('div', 'minimal-title');
    title.textContent = data.title;
    copy.appendChild(title);
    if (data.summary) {
      var summary = createEl('div', 'minimal-summary');
      summary.textContent = data.summary;
      copy.appendChild(summary);
    }
    root.appendChild(copy);

    var footer = createEl('div', 'minimal-footer');
    var brand = createEl('div', 'minimal-brand');
    var favicon = createEl('img', 'minimal-favicon');
    favicon.alt = '';
    favicon.style.display = 'none';
    var siteName = createEl('div', 'minimal-site-name');
    var useAuthorIdentity = cfg.minimalIdentity === 'author' && String(cfg.postAuthor || '').trim().length > 0;
    var identityType = useAuthorIdentity ? 'avatar' : 'favicon';
    siteName.textContent = useAuthorIdentity ? cfg.postAuthor : cleanSiteTitle(cfg.siteTitle);
    brand.appendChild(favicon);
    brand.appendChild(siteName);
    footer.appendChild(brand);

    var qrWrap = createEl('div', 'minimal-qrcode');
    footer.appendChild(qrWrap);
    root.appendChild(footer);

    staging.appendChild(root);
    document.body.appendChild(staging);

    try {
      new QRCode(qrWrap, {
        text: data.url,
        width: 44,
        height: 44,
        colorDark: '#1c1f1e',
        colorLight: '#f5f5f2',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      qrWrap.style.display = 'none';
      console.error('QRCode error', e);
    }

    var identityCandidates = [];
    var seenIdentityUrls = {};

    function appendIdentityCandidates(url, type) {
      getSameSiteUploadCandidates(url).forEach(function (candidateUrl) {
        if (!candidateUrl || seenIdentityUrls[candidateUrl]) return;
        seenIdentityUrls[candidateUrl] = true;
        identityCandidates.push({ url: candidateUrl, type: type });
      });
    }

    if (useAuthorIdentity) {
      appendIdentityCandidates(cfg.postAuthorAvatar, 'avatar');
    } else {
      appendIdentityCandidates(getSiteFaviconUrl(), 'favicon');
    }

    var faviconReadyPromise = new Promise(function (resolve) {
      function loadNext(index) {
        if (index >= identityCandidates.length) return resolve();
        var candidate = identityCandidates[index];
        var url = candidate.url;
        var settled = false;
        var timer = null;
        function finish(loaded) {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          favicon.onload = null;
          favicon.onerror = null;
          if (loaded) {
            favicon.className = 'minimal-favicon' + (identityType === 'avatar' ? ' is-avatar' : ' is-favicon');
            favicon.alt = identityType === 'avatar' ? (cfg.postAuthor || '文章作者') : cleanSiteTitle(cfg.siteTitle);
            favicon.style.display = 'block';
            return resolve();
          }
          loadNext(index + 1);
        }
        favicon.onload = function () { finish(favicon.naturalWidth > 0); };
        favicon.onerror = function () { finish(false); };
        timer = setTimeout(function () { finish(false); }, 2200);
        setImageCorsMode(favicon, url);
        favicon.referrerPolicy = 'no-referrer';
        favicon.src = url;
        if (favicon.complete) setTimeout(favicon.onload, 0);
      }
      loadNext(0);
    });

    return {
      staging: staging,
      root: root,
      ready: Promise.all([coverReadyPromise, faviconReadyPromise])
    };
  }

  function generatePoster() {
    if (generatePoster._p) return generatePoster._p;
    syncPageConfig();
    setLoading(true, '加载组件中...');
    // Ensure dependencies exist (handles SPA first click)
    var depsReady = ensureDepsReady(true);
    var task = Promise.resolve(depsReady).then(function () {
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas not ready');
      }
      setLoading(true, '海报生成中...');
      // Prefer on-page article title, avoid site <title>
      var pageTitle = getTextFromSelectors([
        '.entry-title', '.wp-block-post-title', '.post__title', '.post-detail__title',
        '.post_text_title', '.article-info-title', '.article-title', '.post-title',
        '.post_header h1', '.post-header h1', '.post_nothumb h1', '.post_info h1',
        '#article-info h1', '[itemprop="headline"]', 'article h1'
      ]) || getMeta('og:title', true) || getMeta('twitter:title', true) || document.title || '';
      pageTitle = cleanPageTitle(pageTitle, cfg.siteTitle);
      var fullText = detectArticleText();
      if (!fullText) {
        fullText = sanitizeSummaryText(getMeta('description', false) || getMeta('og:description', true) || getMeta('twitter:description', true) || '');
      }
      var summary = fullText;
      var data = { title: pageTitle, summary: summary, url: location.href };

      var dom;
      if (cfg.posterStyle === 'ninetheme') {
        dom = buildPosterDomNinetheme(data);
      } else if (cfg.posterStyle === 'netease') {
        dom = buildPosterDomNetease(data);
      } else if (cfg.posterStyle === 'minimal') {
        dom = buildPosterDomMinimal(data);
      } else {
        dom = buildPosterDomDefault(data);
      }

      // Improve sharpness by rendering at higher scale with pixel budget to avoid freezes
      var dpr = (window.devicePixelRatio || 1);
      var baseScale = dpr > 1.5 ? 2 : 1.5;
      var maxPixels = 2.5e6; // 2.5MP budget
      var rect = dom.root.getBoundingClientRect();
      var estPixels = rect.width * rect.height * baseScale * baseScale;
      var scale = baseScale;
      if (estPixels > maxPixels) {
        scale = Math.max(1, Math.sqrt(maxPixels / (rect.width * rect.height)));
      }
      return Promise.resolve(dom.ready).then(function () {
        return html2canvas(dom.root, {
          useCORS: true,
          backgroundColor: cfg.posterStyle === 'minimal' ? '#1c1f1e' : '#ffffff',
          scale: scale,
          willReadFrequently: true
        });
      }).then(function (canvas) {
        return new Promise(function (resolve) {
          try {
            if (canvas.toBlob) {
              canvas.toBlob(function (blob) {
                if (blob) {
                  return resolve({ url: URL.createObjectURL(blob), objectUrl: true });
                }
                resolve({ url: canvas.toDataURL('image/png'), objectUrl: false });
              }, 'image/png');
              return;
            }
          } catch (_) { }
          resolve({ url: canvas.toDataURL('image/png'), objectUrl: false });
        });
      }).then(function (imgData) {
        var backdrop = ensureModalScaffold();
        var body = backdrop.querySelector('.teposter-modal-body');
        var oldImg = body.querySelector('img');
        if (oldImg && oldImg.getAttribute('data-teposter-object-url') === '1') {
          try { URL.revokeObjectURL(oldImg.src); } catch (_) { }
        }
        body.innerHTML = '';
        var img = createEl('img');
        img.alt = '生成的文章海报';
        if (imgData.objectUrl) {
          img.setAttribute('data-teposter-object-url', '1');
        }
        backdrop._teposterFit = function () {
          fitPosterPreview(backdrop, img, cfg.posterStyle || 'default');
        };
        img.addEventListener('load', backdrop._teposterFit);
        img.src = imgData.url;
        body.appendChild(img);
        backdrop._teposterFit();
        backdrop.style.display = 'flex';
        var modal = backdrop.querySelector('.teposter-modal');
        if (modal && modal.focus) modal.focus();
      }).catch(function (err) {
        console.error(err);
        showToast('生成失败');
      }).finally(function () {
        try { dom.staging.remove(); } catch (_) { }
        setLoading(false);
      });
    }).catch(function (err) {
      console.error(err);
      showToast('组件加载失败');
      setLoading(false);
    });
    generatePoster._p = task.then(function (result) {
      generatePoster._p = null;
      return result;
    }, function (error) {
      generatePoster._p = null;
      throw error;
    });
    return generatePoster._p;
  }

  // auto insert removed

  function prewarmDeps() {
    if (prewarmDeps._started) return prewarmDeps._p || Promise.resolve();
    prewarmDeps._started = true;
    prewarmDeps._p = Promise.resolve().then(function () {
      return ensureDepsReady(true);
    }).catch(function () {
      prewarmDeps._started = false;
      prewarmDeps._p = null;
    });
    return prewarmDeps._p;
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // removed persistent progress bar to avoid theme conflicts

  function bindPrewarmOnce() {
    if (window.__TEPosterPrewarmBoundV1) return;
    window.__TEPosterPrewarmBoundV1 = true;

    function warmOnButtonIntent(e) {
      var target = e.target;
      var button = target && (target.id === 'teposter-generate' ? target : (target.closest && target.closest('#teposter-generate')));
      if (button) prewarmDeps();
    }

    document.addEventListener('pointerover', warmOnButtonIntent, true);
    document.addEventListener('focusin', warmOnButtonIntent, true);
  }

  function bindDelegatesOnce() {
    if (window.__TEPosterBoundV1) return;
    window.__TEPosterBoundV1 = true;

    function delegate(e) {
      var t = e.target;
      if (!t) return;
      var hit = (t.id === 'teposter-generate') || (t.closest && t.closest('#teposter-generate'));
      if (hit) {
        try { e.preventDefault(); } catch (_) { }
        return generatePoster();
      }
    }
    document.addEventListener('click', delegate, false);
  }

  ready(function () {
    bindPrewarmOnce();
    bindDelegatesOnce();
    // Expose for manual triggering if needed
    window.TEPoster = window.TEPoster || {};
    window.TEPoster.generate = generatePoster;
    window.TEPoster.prewarm = prewarmDeps;
    window.TEPoster.rebind = syncPageConfig;
  });
})();
