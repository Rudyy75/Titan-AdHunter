// popup.js
let results = [];
let isScanning = false;
let scanSessionId = Date.now(); // Unique ID for this scan session

document.addEventListener('DOMContentLoaded', function() {
    const scanBtn = document.getElementById('scan-btn');
    const exportBtn = document.getElementById('export-btn');
    const status = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const safetyFill = document.getElementById('safety-fill');
    const safetyText = document.getElementById('safety-text');
    const totalAdsSpan = document.getElementById('total-ads');
    const uniqueBrandsSpan = document.getElementById('unique-brands');

    // Load any existing results from storage
    chrome.storage.local.get(['state'], (result) => {
        if (result.state && result.state.qualifiedLeads) {
            results = result.state.qualifiedLeads;
            results.forEach(lead => addResultToUI(lead));
            if (results.length > 0) {
                exportBtn.disabled = false;
            }
        }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "update_dual_progress") {
            updateProgressBars(request.processingProgress, request.safetyProgress);
            updateStats(request.totalAds, request.uniqueBrands);
        }
        
        if (request.action === "update_status") {
            status.textContent = request.message;
        }
        
        if (request.action === "add_result") {
            addResult(request.result);
        }
        
        if (request.action === "scan_complete") {
            scanComplete(request.qualifiedCount, request.totalScanned, request.reason);
        }
        
        if (request.action === "scan_error") {
            scanError(request.message);
        }
    });

    scanBtn.addEventListener('click', function() {
        if (isScanning) {
            stopScan();
        } else {
            startScan();
        }
    });

    exportBtn.addEventListener('click', function() {
        exportToCSV();
    });

    function startScan() {
        isScanning = true;
        scanSessionId = Date.now(); // New session ID
        scanBtn.textContent = 'Stop Scan';
        scanBtn.style.background = '#ff6b6b'; // Visual feedback
        status.textContent = 'Starting scan...';
        results = [];
        resultsDiv.innerHTML = '';
        exportBtn.disabled = true;
        
        // Reset progress bars
        updateProgressBars(0, 0);
        updateStats(0, 0);
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "scan_ads"}, function(response) {
                    if (chrome.runtime.lastError) {
                        // Check if this is a valid target page
                        const url = tabs[0].url;
                        if (!url.includes('facebook.com/ads/library') && 
                            !(url.startsWith('file://') && url.includes('test_ad_library.html'))) {
                            status.textContent = 'Error: Please navigate to Meta Ad Library or test file first';
                        } else {
                            status.textContent = 'Error: Content script not responding. Try refreshing the page.';
                        }
                        isScanning = false;
                        scanBtn.textContent = 'Start Scan';
                        scanBtn.style.background = '#dc143c';
                    } else if (response && response.status === "already_scanning") {
                        status.textContent = 'Scan already in progress';
                        isScanning = false;
                        scanBtn.textContent = 'Start Scan';
                        scanBtn.style.background = '#dc143c';
                    }
                });
            } else {
                status.textContent = 'Error: No active tab found';
                isScanning = false;
                scanBtn.textContent = 'Start Scan';
                scanBtn.style.background = '#dc143c';
            }
        });
    }

    function stopScan() {
        isScanning = false;
        scanBtn.textContent = 'Start Scan';
        scanBtn.style.background = '#dc143c';
        status.textContent = 'Scan stopped';
        chrome.runtime.sendMessage({action: "stop_scan"});
    }

    function scanComplete(qualifiedCount, totalScanned, reason) {
        isScanning = false;
        scanBtn.textContent = 'Start Scan';
        scanBtn.style.background = '#dc143c';
        status.textContent = `Scan complete! Found ${qualifiedCount} qualifying websites (${reason})`;
        exportBtn.disabled = false;
    }

    function scanError(message) {
        isScanning = false;
        scanBtn.textContent = 'Start Scan';
        scanBtn.style.background = '#dc143c';
        status.textContent = `Error: ${message}`;
    }

    function updateProgressBars(processingProgress, safetyProgress) {
        const processingPercent = Math.min((processingProgress / 10) * 100, 100);
        const safetyPercent = Math.min((safetyProgress / 75) * 100, 100);
        
        progressFill.style.width = `${processingPercent}%`;
        progressText.textContent = `${processingProgress}/10`;
        
        safetyFill.style.width = `${safetyPercent}%`;
        safetyText.textContent = `${safetyProgress}/75`;
    }

    function updateStats(totalAds, uniqueBrands) {
        totalAdsSpan.textContent = `Total Ads: ${totalAds}`;
        uniqueBrandsSpan.textContent = `Unique Brands: ${uniqueBrands}`;
    }

    function addResult(result) {
        // Only add results from the current scan session
        results.push(result);
        addResultToUI(result);
    }

    function addResultToUI(result) {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        const fbDisplay = result.fbProfile 
        ? `<a href="${result.fbProfile}" target="_blank" style="color:#1877f2;">Facebook Profile</a>`
        : 'No Facebook Profile';
        
        resultItem.innerHTML = `
            <strong>${result.name}</strong><br>
            <a href="${result.website}" target="_blank" style="color: #dc143c;">${result.website}</a>
        `;
        
        resultsDiv.appendChild(resultItem);
    }

    function exportToCSV() {
        if (results.length === 0) {
            alert('No results to export');
            return;
        }

        const csvContent = "data:text/csv;charset=utf-8," +
            "Brand Name,Website URL,Facebook Profile,Email,Instagram,Detection Methods\n" +
            results.map(result => {
                let fbProfile = result.fbProfile || 'No Facebook Profile';
                let email = result.email || 'No Email';
                let instagram = result.instagram || 'No Instagram';
                let detectionMethods = result.detectionMethods ? result.detectionMethods.join('; ') : 'Unknown';
                
                return `"${result.name.replace(/"/g, '""')}","${result.website}","${fbProfile}","${email}","${instagram}","${detectionMethods}"`;
            }).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ad_hunter_results_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Initialize UI
    updateProgressBars(0, 0);
    updateStats(0, 0);
    
    // Check if a scan is already in progress
    chrome.storage.local.get(['state'], (result) => {
        if (result.state && result.state.isProcessing) {
            isScanning = true;
            scanBtn.textContent = 'Stop Scan';
            scanBtn.style.background = '#ff6b6b';
            status.textContent = 'Scan in progress...';
        }
    });
});