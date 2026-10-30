// ============================================================================
//  ADS — paste your ad codes here. A spot left as '' shows nothing.
//
//  Each spot accepts either:
//    • a Google AdSense ad-unit ID (just the number, e.g. '1234567890'), or
//    • the full HTML/JavaScript snippet from any other ad network.
// ============================================================================
export const ADS = {
  // Your AdSense publisher ID, e.g. 'ca-pub-1234567890123456'. Leave '' if you don't use AdSense.
  adsenseClient: '',

  spots: {
    sidebarTop: '',    // right-hand column, under the daily goal (desktop)
    sidebarBottom: '', // right-hand column, bottom (desktop)
    pathTop: '',       // above the lesson path
    betweenUnits: '',  // between units on the lesson path (repeats after every unit)
    pageTop: '',       // top of Practice, Stories, Quests, Shop, Leaderboard, Friends, Profile, Settings
    pageBottom: '',    // bottom of those same pages
    results: '',       // under the Continue button on the end-of-lesson screen
  },
};

// ---------------------------------------------------------------------------
// Rendering — no need to edit below this line
// ---------------------------------------------------------------------------
export const adSlot = (name) => (ADS.spots[name] ? `<div class="ad-slot" data-ad="${name}"><span class="ad-label">Advertisement</span><div class="ad-body"></div></div>` : '');

function loadAdsense() {
  if (!ADS.adsenseClient || document.querySelector('script[src*="adsbygoogle.js"]')) return;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADS.adsenseClient)}`;
  document.head.append(s);
}

// Scripts inserted with innerHTML don't run, so re-create them
function runScripts(el) {
  el.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script');
    [...old.attributes].forEach((a) => s.setAttribute(a.name, a.value));
    s.text = old.text;
    old.replaceWith(s);
  });
}

export function fillAds(root = document) {
  root.querySelectorAll('.ad-slot:not([data-filled])').forEach((slot) => {
    slot.dataset.filled = '1';
    const code = ADS.spots[slot.dataset.ad] || '';
    const body = slot.querySelector('.ad-body');
    if (/^\d+$/.test(code.trim()) && ADS.adsenseClient) {
      loadAdsense();
      body.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${ADS.adsenseClient}" data-ad-slot="${code.trim()}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by an ad blocker */ }
    } else {
      body.innerHTML = code;
      runScripts(body);
    }
  });
}

// Fill ad spots whenever a page renders
export function watchAds() {
  loadAdsense();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fillAds(); });
  }).observe(document.body, { childList: true, subtree: true });
  fillAds();
}
