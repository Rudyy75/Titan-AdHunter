// content.js
let isScanning = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scan_ads") {
    if (isScanning) return;
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
  const previousHeight = document.body.scrollHeight;
  
  // Scroll to bottom
  window.scrollTo(0, document.body.scrollHeight);
  
  // Wait for load (Wait for height change or timeout)
  let retries = 0;
  while (retries < 10) { // Max 5 seconds
    await new Promise(r => setTimeout(r, 500));
    if (document.body.scrollHeight > previousHeight) {
      break; 
    }
    retries++;
  }
  
  // Wait a bit more for images/content to render
  await new Promise(r => setTimeout(r, 1000));
  
  scrapeAndSendBatch();
}

function scrapeAndSendBatch() {
    // 1. Find all potential ad links
    const linkSelectors = [
      'a[href*="l.facebook.com"]', 
      'a[href*="www.facebook.com/tr"]'
    ];

    const allLinks = document.querySelectorAll(linkSelectors.join(','));
    const ads = [];
    
    allLinks.forEach(link => {
      const targetUrl = processLink(link.href);
      if (!targetUrl) return;

      // Metadata Extraction
      let name = "Unknown";
      let fbLink = "";

      // Improved Card Detection
      let card = link.closest('div[role="article"]');

      if (!card) {
         card = link.closest('.x1yztbdb') || link.closest('div._7jvw');
      }

      if (card) {
        // Strategy 1: Look for the specific profile link pattern
        const profileLink = card.querySelector('a[href*="/ads/library/?active_status="]');
        // Strategy 2: Look for a link to a Facebook page
        const fbPageLink = card.querySelector('a[href*="facebook.com/"]:not([href*="l.facebook.com"]):not([href*="/tr/"])');

        const nameSource = profileLink || fbPageLink;

        if (nameSource) {
           name = nameSource.innerText || nameSource.textContent;
           fbLink = nameSource.href;
        } else {
           // Strategy 3: Text-based fallback
           const header = card.querySelector('h4');
           if (header) name = header.innerText;
        }
      }

      name = name.trim().replace(/\n/g, ' ');

      ads.push({
        url: targetUrl,
        name: name,
        fbLink: fbLink
      });
    });

    // Send batch to background (Background handles deduplication)
    console.log(`Sending batch of ${ads.length} ads to background.`);
    chrome.runtime.sendMessage({
      action: "process_batch",
      ads: ads
    });
}

function processLink(url) {
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
  } else if (url && !url.includes('facebook.com') && !url.includes('instagram.com')) {
    return url;
  }
  return null;
}

function getDomain(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return domain;
  } catch {
    return url;
  }
}