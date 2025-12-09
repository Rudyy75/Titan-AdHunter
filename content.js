// content.js
let isScanning = false;

// Scope Containment: Guard clause to ensure we only run on valid targets
function isValidTarget() {
  const url = window.location.href;
  if (url.includes('facebook.com/ads/library')) return true;
  if ((url.startsWith('file://') || url.includes('localhost') || url.includes('127.0.0.1')) && url.includes('test_ad_library.html')) return true;
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!isValidTarget()) return;

  if (request.action === "scan_ads") {
    if (isScanning) {
      sendResponse({ status: "already_scanning" });
      return;
    }
    isScanning = true;

    scrapeAndSendBatch();
    chrome.runtime.sendMessage({ action: "start_scan_session" });
    sendResponse({ status: "started" });
  }

  if (request.action === "trigger_scroll") {
    console.log("Received scroll trigger from background.");
    performScrollAndScrape();
  }
});

async function performScrollAndScrape() {
  if (!document.body) return;

  const previousHeight = document.body.scrollHeight;

  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 500));
  window.scrollBy(0, -500);
  await new Promise(r => setTimeout(r, 300));
  window.scrollTo(0, document.body.scrollHeight);

  let retries = 0;
  while (retries < 15) {
    await new Promise(r => setTimeout(r, 500));
    if (document.body.scrollHeight > previousHeight) break;
    retries++;
  }

  await new Promise(r => setTimeout(r, 1500));
  scrapeAndSendBatch();
}

function scrapeAndSendBatch() {
  const linkSelectors = [
    'a[href*="l.facebook.com"]',
    'a[href*="www.facebook.com/tr"]',
    'a[href*="/ad_link/"]',
    'a[role="link"][target="_blank"]'
  ];

  const allLinks = document.querySelectorAll(linkSelectors.join(','));
  const ads = [];

  const isAdUrl = (url) => {
    if (!url) return false;
    if (url.includes('facebook.com') || url.includes('instagram.com') || url.includes('whatsapp.com')) return false;
    if (url.startsWith('javascript:')) return false;
    return true;
  };

  allLinks.forEach(link => {
    if (!link || !link.href) return;

    let targetUrl = processLink(link.href);
    if (!targetUrl && isAdUrl(link.href)) targetUrl = link.href;
    if (!targetUrl) return;

    let name = "Unknown";
    let fbLink = "";

    // ⭐⭐⭐ FIXED: REAL META ADS LIBRARY ADVERTISER BLOCK ⭐⭐⭐
    const advertiserBlock = link.closest('[data-testid="ad_library_advertiser_info"]');

    if (advertiserBlock) {
      // Extract advertiser name
      const nameElement = advertiserBlock.querySelector('a[role="link"] span');
      if (nameElement) {
        name = nameElement.innerText.trim();
      }

      // Extract advertiser Facebook profile link
      const profileAnchor = advertiserBlock.querySelector('a[role="link"]');
      if (profileAnchor) {
        let rawHref = profileAnchor.getAttribute('href');

        if (rawHref.startsWith('/')) {
          fbLink = `https://www.facebook.com${rawHref}`;
        } else {
          fbLink = rawHref;
        }

        // Clean
        if (fbLink.includes('?')) fbLink = fbLink.split('?')[0];
        if (fbLink.endsWith('/')) fbLink = fbLink.slice(0, -1);
      }
    }

    // Final cleanup + fallback name
    if (!name || name.trim().length < 2) {
      name = name.trim() || "Unknown";
    }

    ads.push({
      url: targetUrl,
      name: name,
      fbLink: fbLink || ""
    });
  });

  console.log(`Sending batch of ${ads.length} ads to background.`);
  chrome.runtime.sendMessage({
    action: "process_batch",
    ads: ads
  }).catch(err => console.log("Error sending batch:", err));
}

function processLink(url) {
  if (!url) return null;

  if (url.includes('l.facebook.com') || url.includes('www.facebook.com/tr')) {
    try {
      const params = new URL(url).searchParams;
      const target = params.get('u') || params.get('url');
      if (target && !target.includes('facebook.com') && !target.includes('instagram.com')) {
        return target;
      }
    } catch (e) {
      return null;
    }
  } else if (!url.includes('facebook.com') && !url.includes('instagram.com') && !url.startsWith('javascript:')) {
    return url;
  }

  return null;
}
