// background.js
// MV3 Compliant State Management via chrome.storage.local

const SUCCESS_TARGET = 10;
const SAFETY_CAP = 100;

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

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
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
    console.log("Starting new scan session. Tab ID:", newState.contentTabId);
    return;
  }

  if (request.action === "process_batch") {
    const newAds = request.ads;
    const contentTabId = sender.tab ? sender.tab.id : state.contentTabId;
    
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

    // Start processing if not already running
    if (!state.isProcessing) {
      state.isProcessing = true;
      await saveState(state);
      processNextAd();
    }
  }
});

async function processNextAd() {
  const state = await loadState();
  
  // Check Termination Conditions
  // Limit check removed to allow continuous scanning until safety cap
  // if (state.qualifiedLeads.length >= SUCCESS_TARGET) {
  //   await finishScan("Target Reached", state);
  //   return;
  // }

  if (state.processingQueue.length === 0) {
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
    return;
  }

  const currentAd = state.processingQueue.shift();
  console.log(`Processing Ad (${state.scannedBrandsSet.length}/${SAFETY_CAP}):`, currentAd.url);
  await saveState(state);
  updateUI(state);

  try {
    // Step 1: Analyze Landing Page
    const landingAnalysis = await analyzeUrl(currentAd.url, analyzePageForSignUp);

    if (landingAnalysis && landingAnalysis.hasSignUp) {
      console.log('✅ Sign-up detected on:', currentAd.url);

      // Step 2: Analyze Facebook Profile (if link exists)
      let fbAnalysis = { email: "", instagram: "" };
      if (currentAd.fbLink && currentAd.fbLink.includes('facebook.com')) {
        // Add delay before opening next tab
        await new Promise(r => setTimeout(r, 1000));
        const fbRes = await analyzeUrl(currentAd.fbLink, analyzeFacebookProfile);
        if (fbRes) fbAnalysis = fbRes;
      }

      // Merge Data
      const leadData = {
        name: currentAd.name,
        website: landingAnalysis.finalUrl || currentAd.url,
        email: landingAnalysis.email || fbAnalysis.email || "",
        instagram: landingAnalysis.instagram || fbAnalysis.instagram || "",
        fbProfile: currentAd.fbLink,
        profileEmail: fbAnalysis.email || "",
        profileInstagram: fbAnalysis.instagram || "",
        detectionMethods: landingAnalysis.detectionMethods
      };

      state.qualifiedLeads.push(leadData);
      await saveState(state);

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

  // Continue processing with delay
  setTimeout(processNextAd, 2000);
}

async function finishScan(reason, state) {
  state.isProcessing = false;
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

function analyzeFacebookProfile() {
  let email = "";
  let instagram = "";

  const mailtoLink = document.querySelector('a[href^="mailto:"]');
  if (mailtoLink) {
    email = mailtoLink.href.replace('mailto:', '').split('?')[0];
  } else {
    const bodyText = document.body.innerText;
    const emailMatch = bodyText.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/);
    if (emailMatch) email = emailMatch[0];
  }

  const igLink = document.querySelector('a[href*="instagram.com"]');
  if (igLink) instagram = igLink.href;

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