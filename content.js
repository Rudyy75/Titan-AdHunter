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

  // Find all Facebook page links first to map them to ads
  const pageLinks = findFacebookPageLinks();
  
  allLinks.forEach(link => {
    if (!link || !link.href) return;

    let targetUrl = processLink(link.href);
    if (!targetUrl && isAdUrl(link.href)) targetUrl = link.href;
    if (!targetUrl) return;

    let name = "Unknown Advertiser";
    let fbLink = "";

    // Find the closest Facebook page link to this ad link
    const closestPageInfo = findClosestFacebookPageInfo(link, pageLinks);
    name = closestPageInfo.name;
    fbLink = closestPageInfo.fbLink;

    ads.push({
      url: targetUrl,
      name: name,
      fbLink: fbLink
    });
  });

  console.log(`Sending batch of ${ads.length} ads to background.`);
  chrome.runtime.sendMessage({
    action: "process_batch",
    ads: ads
  }).catch(err => console.log("Error sending batch:", err));
}

// Find all Facebook page links on the page
function findFacebookPageLinks() {
  const pageLinks = [];
  
  // Selector for Facebook page/profile links
  const facebookLinkSelectors = [
    // Direct page links
    'a[href*="facebook.com/"][href*="/"]:not([href*="facebook.com/ads/library"]):not([href*="facebook.com/help"]):not([href*="facebook.com/policies"]):not([href*="facebook.com/about"])',
    'a[href^="/"][target="_blank"]',
    'a[role="link"][href*="/"]',
    // Look for links that contain page names
    'a[href*="/pages/"]',
    'a[href*="/pg/"]',
    'a[href*="/page/"]'
  ];
  
  // First, find all potential Facebook page links
  facebookLinkSelectors.forEach(selector => {
    try {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        let href = link.href || link.getAttribute('href');
        let text = link.textContent?.trim() || "";
        
        if (!href) return;
        
        // Clean and normalize the URL
        if (href.startsWith('/')) {
          href = `https://www.facebook.com${href}`;
        }
        
        // Skip if it's not a facebook.com URL or is a known non-page URL
        if (!href.includes('facebook.com') || 
            href.includes('facebook.com/share') ||
            href.includes('facebook.com/dialog') ||
            href.includes('facebook.com/plugins') ||
            href.includes('facebook.com/tr/') ||
            href.includes('l.facebook.com')) {
          return;
        }
        
        // Remove query parameters and fragments
        if (href.includes('?')) href = href.split('?')[0];
        if (href.includes('#')) href = href.split('#')[0];
        if (href.endsWith('/')) href = href.slice(0, -1);
        
        // Skip if the URL is too short to be a page (just facebook.com)
        if (href === 'https://www.facebook.com' || href === 'https://facebook.com') {
          return;
        }
        
        // Extract page name from URL
        let pageName = "";
        const urlMatch = href.match(/facebook\.com\/([^\/\?]+)/);
        if (urlMatch && urlMatch[1]) {
          pageName = urlMatch[1];
          // Skip common non-page names
          if (['events', 'groups', 'marketplace', 'watch', 'gaming', 'settings', 'messages', 'notifications', 'bookmarks'].includes(pageName)) {
            return;
          }
        }
        
        // Get meaningful text for the name
        let displayName = text;
        if (!displayName || displayName.length < 2 || displayName.includes('http')) {
          displayName = pageName || "Facebook Page";
        }
        
        // Clean the display name
        displayName = displayName.replace(/[^\w\s\-&@.,!?]/g, ' ').trim();
        if (displayName.length > 100) {
          displayName = displayName.substring(0, 100) + '...';
        }
        
        pageLinks.push({
          element: link,
          href: href,
          name: displayName,
          text: text
        });
      });
    } catch (e) {
      console.log(`Error with selector ${selector}:`, e);
    }
  });
  
  // Remove duplicates based on href
  const uniqueLinks = [];
  const seenHrefs = new Set();
  
  pageLinks.forEach(link => {
    if (!seenHrefs.has(link.href)) {
      seenHrefs.add(link.href);
      uniqueLinks.push(link);
    }
  });
  
  console.log(`Found ${uniqueLinks.length} unique Facebook page links:`, uniqueLinks.map(l => ({name: l.name, href: l.href})));
  return uniqueLinks;
}

// Find the closest Facebook page info to a given ad link
function findClosestFacebookPageInfo(adLink, pageLinks) {
  let bestMatch = { name: "Unknown Advertiser", fbLink: "" };
  let closestDistance = Infinity;
  
  // Get the ad link's position in the DOM
  const adRect = adLink.getBoundingClientRect();
  
  pageLinks.forEach(pageLink => {
    const pageRect = pageLink.element.getBoundingClientRect();
    
    // Calculate distance between elements
    const distance = Math.sqrt(
      Math.pow(pageRect.left - adRect.left, 2) + 
      Math.pow(pageRect.top - adRect.top, 2)
    );
    
    // Check if they're in the same ad container
    const adContainer = findCommonAncestor(adLink, pageLink.element);
    if (adContainer) {
      // They're in the same container, this is likely the correct match
      const containerText = adContainer.textContent || "";
      if (containerText.includes('Advertiser') || containerText.includes('Page') || containerText.includes('Sponsored')) {
        if (distance < closestDistance) {
          closestDistance = distance;
          bestMatch = { name: pageLink.name, fbLink: pageLink.href };
        }
      }
    }
    
    // Also check if they're visually close (within 500px)
    if (distance < 500 && distance < closestDistance) {
      closestDistance = distance;
      bestMatch = { name: pageLink.name, fbLink: pageLink.href };
    }
  });
  
  // If we found a close match, use it
  if (bestMatch.fbLink && closestDistance < 1000) {
    return bestMatch;
  }
  
  // Fallback: Look for advertiser info in the parent hierarchy
  return findAdvertiserInfoInParentTree(adLink);
}

// Find common ancestor of two elements
function findCommonAncestor(el1, el2) {
  const ancestors1 = new Set();
  let current = el1;
  
  while (current) {
    ancestors1.add(current);
    current = current.parentElement;
  }
  
  current = el2;
  while (current) {
    if (ancestors1.has(current)) {
      return current;
    }
    current = current.parentElement;
  }
  
  return null;
}

// Fallback: Look for advertiser info in the parent tree of the ad link
function findAdvertiserInfoInParentTree(element) {
  let name = "Unknown Advertiser";
  let fbLink = "";
  
  let current = element;
  let depth = 0;
  
  while (current && depth < 10) {
    // Look for Facebook page links in this element
    const pageLinks = current.querySelectorAll('a[href*="facebook.com"]');
    for (const link of pageLinks) {
      let href = link.href || link.getAttribute('href');
      if (href && href.includes('facebook.com')) {
        // Skip non-page URLs
        if (href.includes('facebook.com/ads/library') || 
            href.includes('facebook.com/share') ||
            href.includes('facebook.com/dialog') ||
            href.includes('l.facebook.com')) {
          continue;
        }
        
        // Clean the URL
        if (href.startsWith('/')) {
          href = `https://www.facebook.com${href}`;
        }
        if (href.includes('?')) href = href.split('?')[0];
        if (href.endsWith('/')) href = href.slice(0, -1);
        
        // Extract page name from URL for display
        const urlMatch = href.match(/facebook\.com\/([^\/\?]+)/);
        if (urlMatch && urlMatch[1]) {
          const pageName = urlMatch[1];
          // Skip common non-page sections
          if (!['events', 'groups', 'marketplace', 'watch', 'gaming'].includes(pageName)) {
            fbLink = href;
            
            // Try to get name from link text
            const linkText = link.textContent?.trim();
            if (linkText && linkText.length > 1 && !linkText.includes('http')) {
              name = linkText;
            } else {
              name = pageName.charAt(0).toUpperCase() + pageName.slice(1).replace(/-/g, ' ');
            }
            
            return { name, fbLink };
          }
        }
      }
    }
    
    // Move up the tree
    current = current.parentElement;
    depth++;
  }
  
  return { name, fbLink };
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