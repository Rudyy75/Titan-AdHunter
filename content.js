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

  // ⭐⭐⭐ FIXED: IMPROVED ADVERTISER EXTRACTION ⭐⭐⭐
  allLinks.forEach(link => {
    if (!link || !link.href) return;

    let targetUrl = processLink(link.href);
    if (!targetUrl && isAdUrl(link.href)) targetUrl = link.href;
    if (!targetUrl) return;

    let name = "Unknown";
    let fbLink = "";

    // Strategy 1: Look for advertiser info in parent containers
    let advertiserContainer = null;
    
    // Try multiple selectors for advertiser container
    const containerSelectors = [
      // Common Facebook Ads Library structures
      '[data-testid*="advertiser"]',
      '[aria-label*="Advertiser"]',
      '[class*="advertiser"]',
      'div[role="article"]', // Ad card container
      'div[class*="x1yztbdb"]', // Common Facebook class pattern
      'div[class*="x1iorvi4"]', // Another common class
      link.closest('div[role="article"]'), // Closest ad article
      link.closest('div[class*="x1yztbdb"]'), // Closest common container
    ];

    for (const selector of containerSelectors) {
      if (typeof selector === 'string') {
        advertiserContainer = link.closest(selector);
      } else if (selector) {
        advertiserContainer = selector;
      }
      if (advertiserContainer) break;
    }

    if (advertiserContainer) {
      // Strategy A: Look for advertiser name
      const nameSelectors = [
        'a[href*="/page"] span',
        'a[href*="/profile"] span',
        'a[role="link"] span',
        'span[dir="auto"]',
        'div[dir="auto"]',
        'a div[dir="auto"]',
        'a span[dir="auto"]'
      ];

      for (const nameSelector of nameSelectors) {
        const nameElement = advertiserContainer.querySelector(nameSelector);
        if (nameElement && nameElement.textContent && nameElement.textContent.trim()) {
          name = nameElement.textContent.trim();
          break;
        }
      }

      // Strategy B: Look for Facebook profile link
      const linkSelectors = [
        'a[href*="/page/"]',
        'a[href*="/profile.php"]',
        'a[href^="/"]', // Relative links
        'a[href*="facebook.com"]'
      ];

      for (const linkSelector of linkSelectors) {
        const profileLinkElement = advertiserContainer.querySelector(linkSelector);
        if (profileLinkElement && profileLinkElement.href) {
          let rawHref = profileLinkElement.href || profileLinkElement.getAttribute('href');
          
          if (rawHref) {
            // Handle relative URLs
            if (rawHref.startsWith('/')) {
              fbLink = `https://www.facebook.com${rawHref}`;
            } else if (rawHref.startsWith('http')) {
              fbLink = rawHref;
            }
            
            // Clean the URL
            if (fbLink.includes('?')) fbLink = fbLink.split('?')[0];
            if (fbLink.endsWith('/')) fbLink = fbLink.slice(0, -1);
            break;
          }
        }
      }
    }

    // Strategy 2: Fallback - traverse up the DOM tree looking for advertiser info
    if (name === "Unknown" || !fbLink) {
      let currentNode = link.parentElement;
      let depth = 0;
      
      while (currentNode && depth < 10) {
        // Look for text that might be the advertiser name
        const textNodes = currentNode.querySelectorAll('span, div, a');
        for (const node of textNodes) {
          const text = node.textContent?.trim();
          if (text && text.length > 2 && text.length < 100 && !text.includes('http')) {
            // Check if this looks like a name (not a button, not a URL)
            if (!text.includes('.') && !text.includes('/') && !text.includes('@')) {
              name = text;
              break;
            }
          }
        }
        
        // Look for Facebook links
        if (!fbLink) {
          const links = currentNode.querySelectorAll('a[href*="facebook.com"]');
          for (const foundLink of links) {
            const href = foundLink.href || foundLink.getAttribute('href');
            if (href && href.includes('facebook.com') && (href.includes('/page/') || href.includes('/profile.php'))) {
              fbLink = href;
              if (fbLink.includes('?')) fbLink = fbLink.split('?')[0];
              break;
            }
          }
        }
        
        if (name !== "Unknown" && fbLink) break;
        
        currentNode = currentNode.parentElement;
        depth++;
      }
    }

    // Final cleanup
    if (!name || name.trim().length < 2 || name === "Unknown") {
      name = "Unknown Advertiser";
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