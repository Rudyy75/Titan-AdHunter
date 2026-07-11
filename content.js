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

  if (request.action === "stop_scan") {
    console.log("Stop scan received in content script");
    isScanning = false;
    sendResponse({ status: "stopped" });
  }

  if (request.action === "reset_scan") {
    console.log("Reset scan received in content script");
    isScanning = false;
    sendResponse({ status: "reset" });
  }

  if (request.action === "trigger_scroll") {
    // Don't scroll if scanning was stopped
    if (!isScanning) {
      console.log("Scroll trigger ignored - scanning stopped");
      return;
    }
    console.log("Received scroll trigger from background.");
    console.log("Current page URL:", window.location.href);
    console.log("Current scroll position:", window.scrollY, "of", document.body.scrollHeight);
    performScrollAndScrape();
  }
});

async function performScrollAndScrape() {
  if (!document.body) return;
  if (!isScanning) {
    console.log("Scroll aborted - not scanning");
    return;
  }

  console.log("Starting aggressive scroll operation to find at least 10 ads. Current height:", document.body.scrollHeight);

  const initialAdCount = getCurrentAdCount();
  console.log(`Current ads on page: ${initialAdCount}`);

  let totalScrolls = 0;
  const maxScrolls = 6; // Maximum scroll attempts (less aggressive)

  // Get remaining capacity from background script
  const remainingCapacity = await getRemainingCapacity();
  const minAdsTarget = Math.min(8, remainingCapacity); // Target fewer ads if close to limit

  console.log(`Remaining capacity: ${remainingCapacity}, targeting ${minAdsTarget} new ads`);

  if (remainingCapacity <= 0) {
    console.log("Safety cap reached, skipping scroll");
    scrapeAndSendBatch();
    return;
  }

  while (totalScrolls < maxScrolls && isScanning) {
    const beforeHeight = document.body.scrollHeight;
    const beforeAdCount = getCurrentAdCount();

    // Less aggressive scroll to prevent skipping
    // Scroll in smaller chunks to allow rendering
    const currentScrollY = window.scrollY;
    const targetScrollY = document.body.scrollHeight;
    const increment = 400; // Smaller increments

    for (let y = currentScrollY; y < targetScrollY && isScanning; y += increment) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 150)); // Short pause for render
    }

    if (!isScanning) {
      console.log("Scroll stopped mid-operation");
      return;
    }

    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1000)); // Longer pause at bottom

    if (!isScanning) {
      console.log("Scroll stopped after reaching bottom");
      return;
    }

    // Additional nudge to trigger infinite scroll
    window.scrollBy(0, 200);
    await new Promise(r => setTimeout(r, 500));

    // Wait for content to load with longer timeout
    let heightChanged = false;
    let retries = 0;
    while (retries < 20 && !heightChanged && isScanning) { // Increased retries
      await new Promise(r => setTimeout(r, 500)); // Increased check interval
      if (document.body.scrollHeight > beforeHeight) {
        heightChanged = true;
        console.log(`Height increased to ${document.body.scrollHeight} after ${retries + 1} checks`);
      }
      retries++;
    }

    if (!isScanning) {
      console.log("Scroll stopped during content load wait");
      return;
    }

    totalScrolls++;
    const currentAdCount = getCurrentAdCount();
    const scrollNewAds = currentAdCount - beforeAdCount;

    console.log(`Scroll ${totalScrolls}/${maxScrolls}: Found ${scrollNewAds} new ads this scroll (total: ${currentAdCount})`);

    // Check if we have enough new ads total (but don't exceed remaining capacity)
    const totalNewAds = currentAdCount - initialAdCount;
    if (totalNewAds >= minAdsTarget || totalNewAds >= remainingCapacity) {
      console.log(`Target reached: ${totalNewAds} new ads found total (${remainingCapacity} remaining capacity)`);
      break;
    }

    // If no height change and no new ads this scroll, we might be at the end
    if (!heightChanged && scrollNewAds === 0) {
      console.log("No new content loaded, might be at end of feed");
      break;
    }
  }

  if (!isScanning) {
    console.log("Scan stopped - not sending batch");
    return;
  }

  console.log("Finished scrolling. Starting final scrape...");
  await new Promise(r => setTimeout(r, 500)); // Reduced final wait
  scrapeAndSendBatch();
}

// Get remaining processing capacity from background script
async function getRemainingCapacity() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "get_remaining_capacity" }, (response) => {
      if (response && response.remaining !== undefined) {
        resolve(response.remaining);
      } else {
        resolve(30); // Default fallback
      }
    });
  });
}

// Helper function to count current ads on page
function getCurrentAdCount() {
  const linkSelectors = [
    'a[href*="l.facebook.com"]',
    'a[href*="www.facebook.com/tr"]',
    'a[href*="/ad_link/"]',
    'a[role="link"][target="_blank"]'
  ];

  const allLinks = document.querySelectorAll(linkSelectors.join(','));
  const isAdUrl = (url) => {
    if (!url) return false;
    if (url.includes('facebook.com') || url.includes('instagram.com') || url.includes('whatsapp.com')) return false;
    if (url.startsWith('javascript:')) return false;
    return true;
  };

  let adCount = 0;
  allLinks.forEach(link => {
    if (link && link.href) {
      let targetUrl = processLink(link.href);
      if (!targetUrl && isAdUrl(link.href)) targetUrl = link.href;
      if (targetUrl) adCount++;
    }
  });

  return adCount;
}

function scrapeAndSendBatch() {
  const linkSelectors = [
    'a[href*="l.facebook.com"]',
    'a[href*="www.facebook.com/tr"]',
    'a[href*="/ad_link/"]',
    'a[role="link"][target="_blank"]'
  ];

  const allLinks = document.querySelectorAll(linkSelectors.join(','));
  console.log(`Found ${allLinks.length} potential ad links with selectors:`, linkSelectors.join(', '));

  const ads = [];

  const isAdUrl = (url) => {
    if (!url) return false;
    if (url.includes('facebook.com') || url.includes('instagram.com') || url.includes('whatsapp.com')) return false;
    if (url.startsWith('javascript:')) return false;
    return true;
  };

  // Find all Facebook page links first to map them to ads
  const pageLinks = findFacebookPageLinks();
  console.log(`Found ${pageLinks.length} Facebook page links`);

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
  console.log("Ads found:", ads.map(ad => ({ name: ad.name, url: ad.url })));
  chrome.runtime.sendMessage({
    action: "process_batch",
    ads: ads
  }).then(() => {
    console.log("Batch sent successfully");
    // Notify background that scrolling operation completed
    chrome.runtime.sendMessage({ action: "scroll_completed" });
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

  console.log(`Found ${uniqueLinks.length} unique Facebook page links:`, uniqueLinks.map(l => ({ name: l.name, href: l.href })));
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