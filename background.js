// background.js
// MV3 Compliant State Management via chrome.storage.local

const SUCCESS_TARGET = 10;
const SAFETY_CAP = 50;
const MAX_CONCURRENT_TABS = 3;

// Processing state for concurrent workers
let taskCounter = 0; // For odd/even distribution
let activeProcessingSlots = 0; // Track concurrent processing slots
let scrollInProgress = false; // Prevent multiple scroll triggers
let stateLock = false; // Global lock for atomic state updates
let scanAborted = false; // Immediate kill switch for all workers

// Helper for atomic state updates
async function updateState(modifier) {
  // Wait for lock
  while (stateLock) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  stateLock = true;
  try {
    const result = await chrome.storage.local.get(['state']);
    const state = result.state || {
      scannedBrandsSet: [],
      qualifiedLeads: [],
      processingQueue: [],
      isProcessing: false,
      contentTabId: null
    };

    // Apply changes
    await modifier(state);

    // Save back
    await new Promise(resolve => chrome.storage.local.set({ state }, resolve));
    return state;
  } finally {
    stateLock = false;
  }
}

// Initialize storage with defaults if empty
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['state'], (result) => {
    if (!result.state) {
      chrome.storage.local.set({
        state: {
          scannedBrandsSet: [],
          qualifiedLeads: [],
          processingQueue: [],
          isProcessing: false,
          contentTabId: null
        }
      });
    }
  });
});

let activeTabs = new Set();

// Load state from storage
async function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['state'], (result) => {
      resolve(result.state || {
        scannedBrandsSet: [],
        qualifiedLeads: [],
        processingQueue: [],
        isProcessing: false,
        contentTabId: null
      });
    });
  });
}

// Save state to storage
async function saveState(state) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ state }, () => resolve());
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Use async IIFE pattern so we can return true to keep the channel open
  (async () => {
  const state = await loadState();

  if (request.action === "start_scan_session") {
    // Reset State
    const newState = {
      scannedBrandsSet: [],
      qualifiedLeads: [],
      processingQueue: [],
      isProcessing: false,
      contentTabId: sender.tab ? sender.tab.id : null
    };
    await saveState(newState);

    // Reset concurrent processing state
    activeProcessingSlots = 0;
    taskCounter = 0;
    scrollInProgress = false;
    scanAborted = false; // Clear abort flag for new session

    console.log("Starting new scan session. Tab ID:", newState.contentTabId);
    return;
  }

  if (request.action === "scroll_completed") {
    console.log("Scroll operation completed by content script");
    scrollInProgress = false;
    return;
  }

  if (request.action === "get_remaining_capacity") {
    const remaining = Math.max(0, SAFETY_CAP - state.scannedBrandsSet.length);
    sendResponse({ remaining: remaining });
    return true; // Keep message channel open for async response
  }

  if (request.action === "process_batch") {
    const newAds = request.ads;
    const contentTabId = sender.tab ? sender.tab.id : state.contentTabId;

    // Reset scroll flag when receiving new batch
    console.log(`Received batch of ${newAds.length} ads. Resetting scroll flag.`);
    scrollInProgress = false;

    // Update state with new tab ID if provided
    if (contentTabId !== state.contentTabId) {
      state.contentTabId = contentTabId;
    }

    // 1. Deduplicate WITHIN the batch first
    const uniqueBatchDomains = new Set();
    const uniqueBatch = [];

    newAds.forEach(ad => {
      const domain = getDomain(ad.url);
      // Only keep if we haven't seen this domain IN THIS BATCH and not GLOBALLY
      if (!uniqueBatchDomains.has(domain) && !state.scannedBrandsSet.includes(domain)) {
        uniqueBatchDomains.add(domain);
        uniqueBatch.push(ad);
      }
    });

    // 2. Add to global set and queue
    uniqueBatch.forEach(ad => {
      if (state.scannedBrandsSet.length < SAFETY_CAP) {
        state.scannedBrandsSet.push(getDomain(ad.url));
        state.processingQueue.push(ad);
      }
    });

    console.log(`Received batch: ${newAds.length}, Unique Valid: ${uniqueBatch.length}, Queue Size: ${state.processingQueue.length}`);
    await saveState(state);
    updateUI(state);

    // Start processing if not already running, or trigger more concurrent processing if already running
    await updateState(async (s) => {
      if (!s.isProcessing) {
        s.isProcessing = true;
      }
    });

    // Always try to start processing after a batch update
    const finalState = await loadState();
    if (finalState.isProcessing) {
      if (activeProcessingSlots === 0) {
        processNextAd();
      } else {
        startConcurrentProcessing();
      }
    }
  }

  if (request.action === "stop_scan") {
    console.log("Stop scan requested by user");

    // IMMEDIATELY set abort flag - this is checked synchronously by all workers
    scanAborted = true;

    // Send stop message to content script to halt scrolling
    if (state.contentTabId) {
      chrome.tabs.sendMessage(state.contentTabId, { action: "stop_scan" })
        .then(() => console.log("Stop message sent to content script"))
        .catch(err => console.log("Error sending stop to content script:", err));
    }

    // Atomic state update to ensure no race with workers
    await updateState(async (s) => {
      s.isProcessing = false;
      s.processingQueue = []; // Clear queue
    });

    // Close any active analysis tabs
    const tabsToClose = [...activeTabs];
    activeTabs.clear();
    tabsToClose.forEach(tabId => {
      chrome.tabs.remove(tabId).catch(() => { });
    });

    // Reset concurrent processing state
    activeProcessingSlots = 0;
    taskCounter = 0;
    scrollInProgress = false;

    console.log("Scan stopped by user. Queue cleared, tabs closed, and processing state reset.");
  }
  })(); // End async IIFE
  return true; // Keep message channel open for async sendResponse
});

// Process a single ad (used by concurrent workers)
async function processSingleAd(currentAd, workerId) {
  // Check abort flag first (synchronous, no race)
  if (scanAborted) {
    console.log(`Worker ${workerId} stopping immediately - scan aborted`);
    activeProcessingSlots--;
    return;
  }

  // Just load state for logging/checking, don't need lock yet
  let state = await loadState();

  // Check if scan was stopped
  if (!state.isProcessing) {
    console.log(`Worker ${workerId} stopping - scan was cancelled`);
    activeProcessingSlots--;
    return;
  }

  console.log(`Worker ${workerId} Processing Ad (${state.scannedBrandsSet.length}/${SAFETY_CAP}):`, currentAd.url);

  try {
    // Step 1: Analyze Landing Page
    const landingAnalysis = await analyzeUrl(currentAd.url, analyzePageForSignUp);

    // Check again if scan was stopped after async operation
    if (scanAborted) {
      console.log(`Worker ${workerId} stopping after landing analysis - scan aborted`);
      activeProcessingSlots--;
      return;
    }
    state = await loadState();
    if (!state.isProcessing) {
      console.log(`Worker ${workerId} stopping after landing analysis - scan was cancelled`);
      activeProcessingSlots--;
      return;
    }

    if (landingAnalysis && landingAnalysis.hasSignUp) {
      console.log('✅ Sign-up detected on:', currentAd.url);

      // Step 2: Analyze Facebook Profile About page (if link exists)
      let fbAnalysis = { email: "", instagram: "" };
      if (currentAd.fbLink && currentAd.fbLink.includes('facebook.com')) {
        // Add delay before opening next tab
        await new Promise(r => setTimeout(r, 1000));

        // Check if stopped during delay
        if (scanAborted) {
          console.log(`Worker ${workerId} stopping before FB analysis - scan aborted`);
          activeProcessingSlots--;
          return;
        }

        // Navigate to About page for better contact info
        let aboutUrl = currentAd.fbLink;
        if (!aboutUrl.endsWith('/about')) {
          aboutUrl = aboutUrl.replace(/\/$/, '') + '/about';
        }

        console.log('Analyzing FB About page:', aboutUrl);
        const fbRes = await analyzeUrl(aboutUrl, analyzeFacebookProfile);
        if (fbRes) fbAnalysis = fbRes;
      }

      // Check if stopped after FB analysis
      if (scanAborted) {
        console.log(`Worker ${workerId} stopping after FB analysis - scan aborted`);
        activeProcessingSlots--;
        return;
      }

      // Merge Data
      const foundEmail = landingAnalysis.email || fbAnalysis.email || "";
      const websiteUrl = landingAnalysis.finalUrl || currentAd.url;

      // Generate email patterns if no email found
      let emailPatterns = [];
      if (!foundEmail) {
        emailPatterns = generateEmailPatterns(currentAd.name, websiteUrl);
      }

      // Calculate personal brand score
      const brandScore = calculatePersonalBrandScore(
        currentAd.name,
        websiteUrl,
        landingAnalysis.pageText || ''
      );

      const leadData = {
        name: currentAd.name,
        website: websiteUrl,
        email: foundEmail,
        emailPatterns: emailPatterns.join(' | '),  // Pipe-separated patterns
        personalBrandScore: brandScore.score,
        personalBrandLabel: brandScore.label,
        brandSignals: brandScore.signals,
        instagram: landingAnalysis.instagram || fbAnalysis.instagram || "",
        fbProfile: currentAd.fbLink,
        profileEmail: fbAnalysis.email || "",
        profileInstagram: fbAnalysis.instagram || "",
        detectionMethods: landingAnalysis.detectionMethods
      };

      // Atomic update for results
      state = await updateState(async (s) => {
        // Deduplicate check inside lock
        const exists = s.qualifiedLeads.some(l => l.website === leadData.website);
        if (!exists) {
          s.qualifiedLeads.push(leadData);
        }
      });

      // Send result to popup immediately
      chrome.runtime.sendMessage({
        action: "add_result",
        result: leadData
      }).catch(() => { });

      // Update UI immediately
      updateUI(state);

    } else {
      console.log('❌ No sign-up detected:', currentAd.url);
    }

  } catch (error) {
    console.log('Error processing Ad:', currentAd.url, error);
  }

  // Decrement active slots and try to start more processing
  activeProcessingSlots--;
  console.log(`Worker ${workerId} finished. Active slots: ${activeProcessingSlots}`);

  // Check if we need to trigger scrolling for more ads
  setTimeout(async () => {
    // Check abort flag first (immediate)
    if (scanAborted) {
      console.log("Scan aborted - skipping post-worker actions");
      return;
    }

    const currentState = await loadState();

    // Don't do anything if scan was stopped
    if (!currentState.isProcessing) {
      console.log("Scan stopped - skipping post-worker actions");
      return;
    }

    if (currentState.processingQueue.length === 0 && activeProcessingSlots === 0) {
      // Queue empty and no active processing - check if we need more ads
      if (currentState.scannedBrandsSet.length >= SAFETY_CAP) {
        await finishScan("Safety Cap Reached", currentState);
      } else if (!scrollInProgress) {
        // Need more ads! Trigger scroll in content script.
        scrollInProgress = true;
        console.log("Queue empty after worker completion. Requesting more ads...");
        console.log(`Sending scroll trigger to tab ${currentState.contentTabId}`);
        if (currentState.contentTabId) {
          chrome.tabs.sendMessage(currentState.contentTabId, { action: "trigger_scroll" })
            .then(() => console.log("Scroll trigger sent successfully"))
            .catch(err => {
              console.log("Error sending scroll trigger:", err);
              scrollInProgress = false; // Reset on error
            });
        } else {
          console.log("No content tab ID available for scrolling");
          scrollInProgress = false;
        }
      }
    } else if (currentState.processingQueue.length <= 1 && !scrollInProgress) {
      // Queue very low - aggressively trigger scroll for more ads
      console.log(`Queue very low (${currentState.processingQueue.length} remaining). Triggering aggressive scroll...`);
      if (currentState.contentTabId) {
        scrollInProgress = true;
        chrome.tabs.sendMessage(currentState.contentTabId, { action: "trigger_scroll" })
          .then(() => console.log("Aggressive scroll trigger sent successfully"))
          .catch(err => {
            console.log("Error sending aggressive scroll trigger:", err);
            scrollInProgress = false;
          });
      }
    } else {
      // Try to start more concurrent processing
      startConcurrentProcessing();
    }
  }, 1000); // Slower check to reduce resource pressure
}

// Main processing coordinator with concurrent workers
async function processNextAd() {
  if (scanAborted) return;
  const state = await loadState();

  // Stop if processing flag was cleared
  if (!state.isProcessing) return;

  // Check Termination Conditions
  // Limit check removed to allow continuous scanning until safety cap
  // if (state.qualifiedLeads.length >= SUCCESS_TARGET) {
  //   await finishScan("Target Reached", state);
  //   return;
  // }

  if (state.processingQueue.length === 0) {
    // If no active processing and queue is empty, check for completion
    if (activeProcessingSlots === 0) {
      state.isProcessing = false;
      await saveState(state);

      // Queue empty. Check if we reached safety cap.
      if (state.scannedBrandsSet.length >= SAFETY_CAP) {
        await finishScan("Safety Cap Reached", state);
      } else {
        // Need more ads! Trigger scroll in content script.
        console.log("Queue empty. Requesting more ads...");
        if (state.contentTabId) {
          chrome.tabs.sendMessage(state.contentTabId, { action: "trigger_scroll" }).catch(err => {
            console.log("Error sending scroll trigger:", err);
          });
        }
      }
    }
    return;
  }

  // Start concurrent processing if slots are available
  startConcurrentProcessing();
}

// Start processing with available slots (up to MAX_CONCURRENT_TABS)
async function startConcurrentProcessing() {
  // Use atomic update to dequeue items
  // We loop until we fill slots or run out of queue

  while (activeProcessingSlots < MAX_CONCURRENT_TABS && !scanAborted) {
    let currentAd = null;
    let shouldStart = false;
    let workerId = 0;
    let currentState = null;

    // Atomic check-and-dequeue
    await updateState(async (s) => {
      if (!s.isProcessing || s.processingQueue.length === 0) return;

      // Double check slots inside lock (though slots is global, logic is here)
      if (activeProcessingSlots >= MAX_CONCURRENT_TABS) return;

      // Extra safety: Check actual active tabs count if available
      if (activeTabs.size >= MAX_CONCURRENT_TABS) {
        console.log("Active tabs limit reached (safety check). Waiting...");
        return;
      }

      currentAd = s.processingQueue.shift();
      shouldStart = true;

      // Update UI state inside lock
      currentState = s;
    });

    if (!shouldStart || !currentAd) break;

    workerId = taskCounter % 2;
    taskCounter++;
    activeProcessingSlots++;

    console.log(`Starting worker ${workerId}. Active slots: ${activeProcessingSlots}`);
    updateUI(currentState);

    // Start processing this ad in background (don't await)
    processSingleAd(currentAd, workerId);

    // Small delay
    await new Promise(r => setTimeout(r, 200));
  }

  // Check for low queue after filling slots
  const finalState = await loadState();
  if (finalState.processingQueue.length <= 1 && !scrollInProgress && finalState.scannedBrandsSet.length < SAFETY_CAP && finalState.isProcessing) {
    console.log(`After starting workers, queue low (${finalState.processingQueue.length}). Triggering scroll immediately...`);
    if (finalState.contentTabId) {
      scrollInProgress = true;
      chrome.tabs.sendMessage(finalState.contentTabId, { action: "trigger_scroll" })
        .then(() => console.log("Immediate scroll trigger sent successfully"))
        .catch(err => {
          console.log("Error sending immediate scroll trigger:", err);
          scrollInProgress = false;
        });
    }
  }
}

async function finishScan(reason, state) {
  state.isProcessing = false;

  // Reset concurrent processing state
  activeProcessingSlots = 0;
  taskCounter = 0;

  console.log(`Scan Finished: ${reason}`);

  await saveState(state);

  chrome.runtime.sendMessage({
    action: "scan_complete",
    qualifiedCount: state.qualifiedLeads.length,
    totalScanned: state.scannedBrandsSet.length,
    reason: reason
  });
}

function updateUI(state) {
  chrome.runtime.sendMessage({
    action: "update_dual_progress",
    processingProgress: state.qualifiedLeads.length,
    safetyProgress: state.scannedBrandsSet.length,
    totalAds: state.scannedBrandsSet.length,
    uniqueBrands: state.scannedBrandsSet.length
  }).catch(() => { });
}

function getDomain(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    if (parts.length > 2) return parts.slice(-2).join('.');
    return domain;
  } catch { return url; }
}

// Generate email patterns from name and domain
function generateEmailPatterns(name, websiteUrl) {
  if (!name || !websiteUrl) return [];

  try {
    const domain = new URL(websiteUrl).hostname.replace('www.', '');

    // Clean and parse the name
    const cleanName = name.replace(/[^a-zA-Z\s]/g, '').trim().toLowerCase();
    const nameParts = cleanName.split(/\s+/).filter(p => p.length > 1);

    if (nameParts.length === 0) return [`hello@${domain}`, `contact@${domain}`];

    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const firstInitial = firstName.charAt(0);

    const patterns = [];

    // Most common patterns for personal brands (ordered by likelihood)
    patterns.push(`${firstName}@${domain}`);                    // john@domain.com

    if (lastName) {
      patterns.push(`${firstName}${lastName}@${domain}`);       // johnsmith@domain.com
      patterns.push(`${firstName}.${lastName}@${domain}`);      // john.smith@domain.com
      patterns.push(`${firstInitial}${lastName}@${domain}`);    // jsmith@domain.com
      patterns.push(`${firstName}${firstInitial}@${domain}`);   // johns@domain.com (if last name starts with s)
      patterns.push(`${lastName}@${domain}`);                   // smith@domain.com
    }

    // Fallback patterns
    patterns.push(`hello@${domain}`);
    patterns.push(`contact@${domain}`);

    // Remove duplicates and return
    return [...new Set(patterns)];
  } catch (e) {
    console.log('Error generating email patterns:', e);
    return [];
  }
}

// Calculate Personal Brand Score (0-100)
// Higher score = more likely to be a personal brand (coach, creator, solo founder)
function calculatePersonalBrandScore(name, websiteUrl, bio = '') {
  let score = 0;
  const signals = [];

  const nameLower = (name || '').toLowerCase();
  const bioLower = (bio || '').toLowerCase();
  const combinedText = `${nameLower} ${bioLower}`;

  // --- POSITIVE SIGNALS (Personal Brand Indicators) ---

  // 1. Name looks like a person (first + last name pattern)
  const nameParts = nameLower.split(/\s+/).filter(p => p.length > 1);
  if (nameParts.length >= 2 && nameParts.length <= 4) {
    // Likely a person's name (2-4 words)
    score += 15;
    signals.push('person_name');
  }

  // 2. High-value personal brand keywords in name/bio
  const personalKeywords = ['coach', 'mentor', 'author', 'speaker', 'founder', 'creator',
    'consultant', 'trainer', 'expert', 'strategist', 'helping', 'i help', 'i teach'];
  personalKeywords.forEach(kw => {
    if (combinedText.includes(kw)) {
      score += 10;
      signals.push(`keyword:${kw}`);
    }
  });

  // 3. First-person language ("I", "my", "me")
  if (/\bi\b|\bmy\b|\bme\b/.test(bioLower)) {
    score += 10;
    signals.push('first_person');
  }

  // 4. "Helping [audience] achieve [result]" formula
  if (/helping .+ (achieve|get|become|build|grow|scale)/.test(bioLower)) {
    score += 15;
    signals.push('helping_formula');
  }

  // 5. Humanizing elements (Dad, Mom, Runner, Coffee lover, etc.)
  const humanElements = ['dad', 'mom', 'father', 'mother', 'runner', 'coffee',
    'dog lover', 'cat lover', 'ex-', 'former', 'traveler', 'foodie'];
  humanElements.forEach(el => {
    if (combinedText.includes(el)) {
      score += 8;
      signals.push(`human:${el}`);
    }
  });

  // 6. Personal domain pattern (firstname.com, firstnamelastname.com)
  if (websiteUrl) {
    try {
      const domain = new URL(websiteUrl).hostname.replace('www.', '').split('.')[0];
      const firstName = nameParts[0] || '';
      const lastName = nameParts[nameParts.length - 1] || '';

      if (domain.includes(firstName) || domain.includes(lastName)) {
        score += 12;
        signals.push('personal_domain');
      }
    } catch (e) { }
  }

  // 7. Link-in-bio services (Linktree, Beacons, etc.)
  const linkServices = ['linktr.ee', 'beacons.ai', 'bio.link', 'carrd.co', 'stan.store'];
  linkServices.forEach(svc => {
    if ((websiteUrl || '').includes(svc)) {
      score += 10;
      signals.push(`link_service:${svc}`);
    }
  });

  // --- NEGATIVE SIGNALS (Corporate/Agency Indicators) ---

  // 8. Corporate jargon in name
  const corporateKeywords = ['agency', 'inc', 'llc', 'ltd', 'corp', 'group',
    'associates', 'solutions', 'partners', 'team', 'studio', 'media', 'digital'];
  corporateKeywords.forEach(kw => {
    if (nameLower.includes(kw)) {
      score -= 15;
      signals.push(`corporate:${kw}`);
    }
  });

  // 9. Third-person language ("we", "our", "us")
  if (/\bwe\b|\bour\b|\bus\b/.test(bioLower)) {
    score -= 10;
    signals.push('third_person');
  }

  // 10. Generic brand patterns
  if (/official|brand|®|™|©/.test(combinedText)) {
    score -= 10;
    signals.push('brand_markers');
  }

  // Normalize score to 0-100 range
  score = Math.max(0, Math.min(100, score));

  // Determine label
  let label = 'Unknown';
  if (score >= 50) label = '🔥 Personal Brand';
  else if (score >= 30) label = '⚡ Likely Personal';
  else if (score >= 15) label = '❓ Mixed Signals';
  else label = '🏢 Likely Corporate';

  return {
    score: score,
    label: label,
    signals: signals.slice(0, 5).join(', ') // Top 5 signals
  };
}

function analyzeFacebookProfile() {
  let email = "";
  let instagram = "";

  // Common generic email prefixes to ignore
  const genericPrefixes = [
    'info', 'support', 'contact', 'hello', 'help', 'admin', 'sales',
    'team', 'office', 'mail', 'enquiry', 'enquiries', 'service',
    'customerservice', 'customer', 'noreply', 'no-reply', 'feedback',
    'marketing', 'press', 'media', 'general', 'webmaster', 'postmaster'
  ];

  const isGenericEmail = (emailAddr) => {
    if (!emailAddr) return true;
    const prefix = emailAddr.split('@')[0].toLowerCase();
    return genericPrefixes.some(g => prefix === g || prefix.startsWith(g + '.'));
  };

  // Collect all emails found, then filter
  const foundEmails = [];

  // Method 1: Look for mailto links
  const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
  for (const link of mailtoLinks) {
    const addr = link.href.replace('mailto:', '').split('?')[0];
    if (addr && !isGenericEmail(addr)) {
      foundEmails.push(addr);
    }
  }

  // Method 2: Search visible text for email patterns
  const bodyText = document.body.innerText;
  const emailMatches = bodyText.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g) || [];
  for (const addr of emailMatches) {
    if (!isGenericEmail(addr) && !foundEmails.includes(addr)) {
      foundEmails.push(addr);
    }
  }

  // Method 3: Look for contact info in About section specifically
  const aboutSections = document.querySelectorAll('[role="main"] span, [role="main"] a');
  for (const el of aboutSections) {
    const text = el.textContent || '';
    if (text.includes('@') && text.includes('.')) {
      const match = text.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/);
      if (match && !isGenericEmail(match[0]) && !foundEmails.includes(match[0])) {
        foundEmails.push(match[0]);
      }
    }
  }

  // Take first non-generic email found
  if (foundEmails.length > 0) {
    email = foundEmails[0];
  }

  // Look for Instagram links
  const igLinks = document.querySelectorAll('a[href*="instagram.com"]');
  for (const link of igLinks) {
    const href = link.href;
    const match = href.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
    if (match && match[1] && !['p', 'explore', 'reels', 'stories'].includes(match[1])) {
      instagram = '@' + match[1];
      break;
    }
  }

  // Fallback: Search for Instagram handles in text
  if (!instagram) {
    const igTextMatch = bodyText.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_.]{3,30})(?![a-zA-Z0-9_.])/i);
    if (igTextMatch && igTextMatch[1]) {
      const handle = igTextMatch[1];
      if (!['com', 'www', 'http', 'https'].includes(handle.toLowerCase())) {
        instagram = '@' + handle;
      }
    }
  }

  console.log('FB Profile Analysis:', { email, instagram, allEmailsFound: foundEmails });
  return { email, instagram };
}

async function analyzeUrl(url, scriptFunc) {
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url: url, active: false });
    tabId = tab.id;
    activeTabs.add(tabId);

    // Wait for load
    await new Promise(resolve => {
      const onUpdated = (tid, changeInfo) => {
        if (tid === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }, 10000);
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: scriptFunc
    });

    await chrome.tabs.remove(tabId);
    activeTabs.delete(tabId);

    return results[0]?.result;
  } catch (e) {
    console.log("Error analyzing URL:", url, e);
    if (tabId) {
      chrome.tabs.remove(tabId).catch(() => { });
      activeTabs.delete(tabId);
    }
    return null;
  }
}

function analyzePageForSignUp() {
  const detectionMethods = [];
  let hasSignUp = false;
  let finalUrl = window.location.href;
  let foundEmail = "";
  let foundInstagram = "";

  // Extract Email
  const mailtoLink = document.querySelector('a[href^="mailto:"]');
  if (mailtoLink) {
    foundEmail = mailtoLink.href.replace('mailto:', '').split('?')[0];
  } else {
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/;
    const footer = document.querySelector('footer') || document.body;
    const match = footer.innerText.match(emailRegex);
    if (match) foundEmail = match[0];
  }

  // Extract Instagram Link
  const igLink = document.querySelector('a[href*="instagram.com"]');
  if (igLink) foundInstagram = igLink.href;

  // Sign-up Detection
  const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"], input[placeholder*="email" i]');
  if (emailInputs.length > 0) {
    detectionMethods.push('email_input_fields');
    hasSignUp = true;
  }

  const passwordInputs = document.querySelectorAll('input[type="password"]');
  if (passwordInputs.length > 0) {
    detectionMethods.push('password_fields');
    hasSignUp = true;
  }

  const signUpTextPatterns = [
    /sign\s*up/i,
    /register/i,
    /create\s*account/i,
    /get\s*started/i,
    /try\s*for\s*free/i,
    /join\s*now/i,
    /start\s*free\s*trial/i,
    /create\s*profile/i
  ];

  const allTextElements = document.querySelectorAll('button, a, span, div, p, h1, h2, h3, h4, h5, h6');
  allTextElements.forEach(element => {
    const text = element.textContent?.toLowerCase() || '';
    signUpTextPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        detectionMethods.push(`text_pattern_${pattern.source}`);
        hasSignUp = true;
      }
    });
  });

  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    const formHtml = form.outerHTML.toLowerCase();
    if (formHtml.includes('signup') || formHtml.includes('register') ||
      formHtml.includes('create-account') || formHtml.includes('newsletter')) {
      detectionMethods.push('form_attributes');
      hasSignUp = true;
    }
  });

  const signUpSelectors = [
    '[class*="signup"]',
    '[class*="register"]',
    '[class*="newsletter"]',
    '[id*="signup"]',
    '[id*="register"]',
    '[id*="newsletter"]',
    '.signup-form',
    '.registration-form',
    '.newsletter-form'
  ];

  signUpSelectors.forEach(selector => {
    if (document.querySelector(selector)) {
      detectionMethods.push(`css_selector_${selector}`);
      hasSignUp = true;
    }
  });

  return {
    hasSignUp: hasSignUp,
    finalUrl: finalUrl,
    email: foundEmail,
    instagram: foundInstagram,
    detectionMethods: [...new Set(detectionMethods)]
  };
}

// Cleanup function for any remaining tabs
chrome.runtime.onSuspend.addListener(() => {
  activeTabs.forEach(tabId => {
    chrome.tabs.remove(tabId).catch(() => { });
  });
});