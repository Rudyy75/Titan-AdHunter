// content.js
let isScanning = false;

// Scope Containment: Guard clause to ensure we only run on valid targets
function isValidTarget() {
  const url = window.location.href;
  // Allow Meta Ad Library
  if (url.includes('facebook.com/ads/library')) return true;
  // Allow local test file (file protocol or localhost)
  if ((url.startsWith('file://') || url.includes('localhost') || url.includes('127.0.0.1')) && url.includes('test_ad_library.html')) return true;
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Guard check
  if (!isValidTarget()) {
    // If we are on a random page, ignore messages or send error
    // But since we use <all_urls>, we should just ignore to avoid noise
    return; 
  }

  if (request.action === "scan_ads") {
    if (isScanning) {
      sendResponse({ status: "already_scanning" });
      return;
    }
    isScanning = true;

    // Initial Scan
    scrapeAndSendBatch();

    // Notify background that we started
    chrome.runtime.sendMessage({ action: "start_scan_session" });

    sendResponse({ status: "started" });
  }

  if (request.action === "trigger_scroll") {
    console.log("Received scroll trigger from background.");
    performScrollAndScrape();
  }
});

async function performScrollAndScrape() {
  if (!document.body) return; // Safety check

  const previousHeight = document.body.scrollHeight;
  
  // More aggressive scroll strategy:
  window.scrollTo(0, document.body.scrollHeight);

  // Also try scrolling a bit up and back down to trigger lazy loaders
  await new Promise(r => setTimeout(r, 500));
  window.scrollBy(0, -500);
  await new Promise(r => setTimeout(r, 300));
  window.scrollTo(0, document.body.scrollHeight);

  // Wait for load (Wait for height change or timeout)
  let retries = 0;
  while (retries < 15) { // Max ~7.5 seconds
    await new Promise(r => setTimeout(r, 500));
    // Check if new content arrived (height changed)
    if (document.body && document.body.scrollHeight > previousHeight) {
      break;
    }
    retries++;
  }

  // Stability wait
  await new Promise(r => setTimeout(r, 1500));

  scrapeAndSendBatch();
}

function scrapeAndSendBatch() {
  // 1. Find all potential ad links
  const linkSelectors = [
    'a[href*="l.facebook.com"]',
    'a[href*="www.facebook.com/tr"]',
    'a[href*="/ad_link/"]',
    'a[role="link"][target="_blank"]'
  ];

  const allLinks = document.querySelectorAll(linkSelectors.join(','));
  const ads = [];

  // Helper to check if a URL is likely an external ad landing page
  const isAdUrl = (url) => {
    if (!url) return false;
    if (url.includes('facebook.com') || url.includes('instagram.com') || url.includes('whatsapp.com')) return false;
    if (url.startsWith('javascript:')) return false;
    return true;
  };

  allLinks.forEach(link => {
    if (!link || !link.href) return; // Null check

    let targetUrl = processLink(link.href);

    // If processLink failed, check if the raw href is valid
    if (!targetUrl && isAdUrl(link.href)) {
      targetUrl = link.href;
    }

    if (!targetUrl) return;

    // Metadata Extraction
    let name = "Unknown";
    let fbLink = "";

    // Improved Card Detection - traverse up to find the container
    // Added null checks and fallback
    let card = link.closest('div[role="article"]') ||
      link.closest('.x1yztbdb') ||
      link.closest('div._7jvw') ||
      link.closest('div[class*="content"]'); 

    if (card) {
      // Strategy 1: "Sponsored" Label Proximity (Primary)
      const allElements = Array.from(card.querySelectorAll('*'));
      const sponsoredEl = allElements.find(el => 
        el.textContent === 'Sponsored' && 
        el.children.length === 0 
      );

      let foundViaSponsored = false;

      if (sponsoredEl && sponsoredEl.parentElement) {
        let current = sponsoredEl.parentElement;
        let attempts = 0;
        while (current && attempts < 5) {
            const linksInHeader = Array.from(current.querySelectorAll('a'));
            
            const validProfileLinks = linksInHeader.filter(l => {
                const href = l.getAttribute('href');
                return href && 
                       (href.includes('facebook.com') || href.startsWith('/')) &&
                       !href.includes('l.facebook.com') && 
                       !href.includes('/ads/library/');
            });

            if (validProfileLinks.length > 0) {
                const candidate = validProfileLinks[0];
                name = candidate.innerText || candidate.textContent || "";
                
                if (!name || name.trim().length === 0) {
                    const img = candidate.querySelector('img');
                    if (img && img.alt) name = img.alt;
                }

                let rawHref = candidate.getAttribute('href');
                if (rawHref && rawHref.startsWith('/')) {
                    fbLink = `https://www.facebook.com${rawHref}`;
                } else {
                    fbLink = candidate.href;
                }
                foundViaSponsored = true;
                break; 
            }
            current = current.parentElement;
            attempts++;
        }
      }

      // Strategy 2: Exclusion (Fallback)
      if ((name === "Unknown" || !fbLink) && !foundViaSponsored) {
          const allCardLinks = Array.from(card.querySelectorAll('a'));
          const profileLink = allCardLinks.find(link => {
            if (!link) return false;
            const href = link.href;
            const rawHref = link.getAttribute('href'); 

            if (href === targetUrl) return false;
            if (href.includes('l.facebook.com')) return false;
            if (href.includes('/ad_link/')) return false;
            if (href.includes('/tr/')) return false;
            if (href.includes('/ads/library/')) return false;
            if (href.includes('view_all_page_id')) return false;

            const isInternal = href.includes('facebook.com') || href.includes('instagram.com') || (rawHref && rawHref.startsWith('/'));
            return isInternal;
          });

          if (profileLink) {
            name = profileLink.innerText || profileLink.textContent || "";
            if (!name || name.trim().length === 0) {
              const img = profileLink.querySelector('img');
              if (img && img.alt) name = img.alt;
            }

            let rawHref = profileLink.getAttribute('href');
            if (rawHref && rawHref.startsWith('/')) {
              fbLink = `https://www.facebook.com${rawHref}`;
            } else {
              fbLink = profileLink.href;
            }
          }
      }
    }

    // Clean up FB Link
    if (fbLink) {
      if (fbLink.includes('?')) fbLink = fbLink.split('?')[0];
      if (fbLink.endsWith('/')) fbLink = fbLink.slice(0, -1);
    }

    if ((name === "Unknown" || name.length < 2) && card) {
      const possibleName = card.innerText.split('\n')[0];
      if (possibleName) name = possibleName;
    }

    name = (name || "Unknown").trim().replace(/\n/g, ' ');

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
  }).catch(err => {
      console.log("Error sending batch to background:", err);
      // Could retry or stop scanning
  });
}

function processLink(url) {
  if (!url) return null;

  if (url.includes('l.facebook.com') || url.includes('www.facebook.com/tr')) {
    try {
      const urlParams = new URL(url).searchParams;
      const targetUrl = urlParams.get('u') || urlParams.get('url');
      if (targetUrl && !targetUrl.includes('facebook.com') && !targetUrl.includes('instagram.com')) {
        return targetUrl;
      }
    } catch (e) {
      return null;
    }
  } else if (!url.includes('facebook.com') && !url.includes('instagram.com') && !url.startsWith('javascript:')) {
    return url;
  }
  return null;
}