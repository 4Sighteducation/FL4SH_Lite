/* FL4SH Lite Knack integration loader
 * - Loaded by Homepage loader.js as a classic script
 * - Dynamically discovers latest Vercel hashed assets
 * - Mounts Vue app in Knack rich text container (same window => window.Knack available)
 */
(function () {
  const DEFAULT_APP_URL = 'https://fl4sh-lite.vercel.app/';
  const DEBUG = false;

  function log(...args) {
    if (DEBUG) console.log('[FL4SH Lite Loader]', ...args);
  }

  function normalizeBaseUrl(url) {
    const raw = String(url || DEFAULT_APP_URL).trim();
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function getConfig() {
    const cfg = window.VESPA_CONFIG || {};
    return {
      appUrl: normalizeBaseUrl(cfg.appUrl),
      elementSelector: String(cfg.elementSelector || '.kn-rich-text').trim(),
    };
  }

  function resolveTarget(selector) {
    const exact = document.querySelector(selector);
    if (exact) return exact;

    const richText = document.querySelector('#view_3005 .kn-rich_text__content');
    if (richText) return richText;

    return document.querySelector('.kn-rich_text__content') || document.body;
  }

  function getTopOffsetPx() {
    const candidates = [
      '#knack-body .knHeader',
      '.knHeader',
      '#knack-body .kn-header',
      '.kn-header',
      '#knack-body header',
      'header',
    ];

    let maxBottom = 0;
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (!rect || !Number.isFinite(rect.bottom)) continue;
      const style = window.getComputedStyle(el);
      // Only treat fixed/sticky headers as an overlay offset.
      if (style.position !== 'fixed' && style.position !== 'sticky') continue;
      if (rect.bottom > maxBottom) maxBottom = rect.bottom;
    }

    // Clamp to something sensible.
    const px = Math.max(0, Math.min(220, Math.round(maxBottom)));
    return px;
  }

  async function fetchAssetUrls(appUrl) {
    const res = await fetch(appUrl, { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch app shell (${res.status})`);
    const html = await res.text();

    const jsMatch = html.match(/<script[^>]*type="module"[^>]*src="([^"]+\.js)"/i);
    if (!jsMatch) throw new Error('Could not locate module script in app shell');
    const cssMatch = html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+\.css)"/i);

    const jsUrl = new URL(jsMatch[1], appUrl).toString();
    const cssUrl = cssMatch ? new URL(cssMatch[1], appUrl).toString() : null;
    return { jsUrl, cssUrl };
  }

  function ensureMount(target) {
    target.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'fl4sh-lite-host';
    wrapper.style.width = '100%';
    wrapper.style.minHeight = '72vh';
    wrapper.style.boxSizing = 'border-box';

    const mount = document.createElement('div');
    mount.id = 'app';
    wrapper.appendChild(mount);
    target.appendChild(wrapper);

    return wrapper;
  }

  function injectCss(cssUrl) {
    if (!cssUrl) return;
    const prev = document.querySelector('link[data-fl4sh-lite-css="1"]');
    if (prev) prev.remove();

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${cssUrl}${cssUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
    link.dataset.fl4shLiteCss = '1';
    document.head.appendChild(link);
  }

  function injectModule(jsUrl) {
    const prev = document.querySelector('script[data-fl4sh-lite-module="1"]');
    if (prev) prev.remove();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = `${jsUrl}${jsUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
      script.dataset.fl4shLiteModule = '1';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load FL4SH Lite module bundle'));
      document.head.appendChild(script);
    });
  }

  window.initializeFlashcardApp = async function initializeFlashcardApp() {
    try {
      const { appUrl, elementSelector } = getConfig();
      const target = resolveTarget(elementSelector);
      if (!target) throw new Error(`Mount target not found for selector: ${elementSelector}`);

      const { jsUrl, cssUrl } = await fetchAssetUrls(appUrl);
      const wrapper = ensureMount(target);

      // When embedded inside Knack, the General Header often overlays the top of the viewport.
      // Apply an offset so the app starts below it.
      const applyOffset = () => {
        const topOffset = getTopOffsetPx();
        wrapper.style.paddingTop = topOffset ? `${topOffset}px` : '0px';
        wrapper.style.minHeight = topOffset ? `calc(100vh - ${topOffset}px)` : '72vh';
        try {
          document.documentElement.style.scrollPaddingTop = topOffset ? `${topOffset}px` : '0px';
          // Expose as CSS variable so fixed-position modals can also offset correctly.
          document.documentElement.style.setProperty('--knack-top-offset', topOffset ? `${topOffset}px` : '0px');
        } catch (_) {}
      };
      applyOffset();
      window.addEventListener('resize', applyOffset);
      // Knack sometimes animates header height; re-apply briefly after mount.
      setTimeout(applyOffset, 250);
      setTimeout(applyOffset, 800);
      setTimeout(applyOffset, 1500);

      injectCss(cssUrl);
      await injectModule(jsUrl);
      log('Initialized successfully', { appUrl, elementSelector, jsUrl, cssUrl });
    } catch (err) {
      console.error('[FL4SH Lite Loader] Initialization failed:', err);
    }
  };
})();
