// background.js
let activeTabs = new Set();

// Global State
let scannedBrandsSet = new Set(); // Tracks unique brand domains to enforce Safety Cap
let qualifiedLeads = [];
let processingQueue = [];
let isProcessing = false;
let contentTabId = null;

const SUCCESS_TARGET = 10;
const SAFETY_CAP = 75;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_scan_session") {
    // Reset State
    scannedBrandsSet.clear();
    qualifiedLeads = [];
    processingQueue = [];
    isProcessing = false;
    contentTabId = sender.tab ? sender.tab.id : null;
    console.log("Starting new scan session. Tab ID:", contentTabId);
    return;
  }

  if (request.action === "process_batch") {
    const newAds = request.ads;
    contentTabId = sender.tab ? sender.tab.id : contentTabId;

    // Filter for globally unique brands
    const uniqueBatch = newAds.filter(ad => {
      const domain = getDomain(ad.url);
      if (scannedBrandsSet.has(domain)) return false;
      return true;
    });

    // Add unique ones to set and queue
    uniqueBatch.forEach(ad => {
      if (scannedBrandsSet.size < SAFETY_CAP) {
        scannedBrandsSet.add(getDomain(ad.url));
        processingQueue.push(ad);
      }
    });

    console.log(`Received batch: ${newAds.length}, Unique New: ${uniqueBatch.length}, Queue Size: ${processingQueue.length}`);
    updateUI();

    // Start processing if not already running
    if (!isProcessing) {
      processNextAd();
    }
  }
});

async function processNextAd() {
  // Check Termination Conditions
  if (qualifiedLeads.length >= SUCCESS_TARGET) {
    finishScan("Target Reached");
    return;
  }

  if (processingQueue.length === 0) {
    isProcessing = false;
    // Queue empty. Check if we reached safety cap.
    if (scannedBrandsSet.size >= SAFETY_CAP) {
      finishScan("Safety Cap Reached");
    } else {
      // Need more ads! Trigger scroll in content script.
      console.log("Queue empty. Requesting more ads...");
      if (contentTabId) {
        chrome.tabs.sendMessage(contentTabId, { action: "trigger_scroll" });
      }
    }
    return;
  }

  isProcessing = true;
  const currentAd = processingQueue.shift();
  console.log(`Processing Ad (${scannedBrandsSet.size}/${SAFETY_CAP}):`, currentAd.url);
  updateUI();

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
      qualifiedLeads.push({
        name: currentAd.name,
        website: landingAnalysis.finalUrl || currentAd.url,
        email: landingAnalysis.email || fbAnalysis.email || "", 
        instagram: landingAnalysis.instagram || fbAnalysis.instagram || currentAd.fbLink,
        fbProfile: currentAd.fbLink,
        profileEmail: fbAnalysis.email || "",
        profileInstagram: fbAnalysis.instagram || "",
        detectionMethods: landingAnalysis.detectionMethods
      });
      
    } else {
      console.log('❌ No sign-up detected:', currentAd.url);
    }
    
  } catch (error) {
    console.log('Error processing Ad:', currentAd.url, error);
  }
  
  // Strict Serial Processing Delay
  setTimeout(processNextAd, 2000);
}

function finishScan(reason) {
  isProcessing = false;
  console.log(`Scan Finished: ${reason}`);
  
  chrome.storage.local.set({ 
    leads: qualifiedLeads,
    processingComplete: true 
  });
  
  chrome.runtime.sendMessage({
    action: "scan_complete",
    qualifiedCount: qualifiedLeads.length,
    totalScanned: scannedBrandsSet.size,
    reason: reason
  });
}

function updateUI() {
  chrome.runtime.sendMessage({
    action: "update_dual_progress",
    processingProgress: qualifiedLeads.length,
    safetyProgress: scannedBrandsSet.size,
    totalAds: scannedBrandsSet.size,
    uniqueBrands: qualifiedLeads.length
  }).catch(() => {}); // Catch error if popup is closed
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

  // Look for email in the "Intro" or "About" sections
  // Facebook structure is complex, so we look for mailto links and text patterns generally
  const mailtoLink = document.querySelector('a[href^="mailto:"]');
  if (mailtoLink) {
    email = mailtoLink.href.replace('mailto:', '').split('?')[0];
  } else {
     // Text search in visible body content
     const bodyText = document.body.innerText;
     const emailMatch = bodyText.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/);
     if (emailMatch) email = emailMatch[0];
  }

  // Look for Instagram link
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
      chrome.tabs.remove(tabId).catch(() => {});
      activeTabs.delete(tabId);
    }
    return null;
  }
}

// Function to be injected into landing pages
function analyzePageForSignUp() {
  const detectionMethods = [];
  let hasSignUp = false;
  let finalUrl = window.location.href;
  let foundEmail = "";
  let foundInstagram = "";

  // --- Data Extraction ---
  
  // 1. Extract Email (Mailto links or text patterns)
  const mailtoLink = document.querySelector('a[href^="mailto:"]');
  if (mailtoLink) {
    foundEmail = mailtoLink.href.replace('mailto:', '').split('?')[0];
  } else {
    // Regex for email in body text (simple version)
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/;
    const footer = document.querySelector('footer') || document.body;
    const match = footer.innerText.match(emailRegex);
    if (match) foundEmail = match[0];
  }

  // 2. Extract Instagram Link
  const igLink = document.querySelector('a[href*="instagram.com"]');
  if (igLink) foundInstagram = igLink.href;


  // --- Sign-up Detection ---

  // 1. Check for email input fields
  const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"], input[placeholder*="email" i]');
  if (emailInputs.length > 0) {
    detectionMethods.push('email_input_fields');
    hasSignUp = true;
  }
  
  // 2. Check for password fields
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  if (passwordInputs.length > 0) {
    detectionMethods.push('password_fields');
    hasSignUp = true;
  }
  
  // 3. Check for sign-up related text in buttons and links
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
  
  // 4. Check for form elements with sign-up related attributes
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    const formHtml = form.outerHTML.toLowerCase();
    if (formHtml.includes('signup') || formHtml.includes('register') || 
        formHtml.includes('create-account') || formHtml.includes('newsletter')) {
      detectionMethods.push('form_attributes');
      hasSignUp = true;
    }
  });
  
  // 5. Check for common sign-up class names and IDs
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
    chrome.tabs.remove(tabId).catch(() => {});
  });
});