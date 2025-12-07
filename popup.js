// popup.js
let results = [];
let isScanning = false;

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
            scanComplete();
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
        scanBtn.textContent = 'Stop Scan';
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
                        status.textContent = 'Error: Please navigate to Meta Ad Library first';
                        isScanning = false;
                        scanBtn.textContent = 'Start Scan';
                    }
                });
            }
        });
    }

    function stopScan() {
        isScanning = false;
        scanBtn.textContent = 'Start Scan';
        status.textContent = 'Scan stopped';
        chrome.runtime.sendMessage({action: "stop_scan"});
    }

    function scanComplete() {
        isScanning = false;
        scanBtn.textContent = 'Start Scan';
        status.textContent = `Scan complete! Found ${results.length} qualifying websites`;
        exportBtn.disabled = false;
    }

    function scanError(message) {
        isScanning = false;
        scanBtn.textContent = 'Start Scan';
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
        results.push(result);
        
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
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

        const csvContent = "data:text/csv;charset=utf-8,"
            + "Brand Name,Website URL,Facebook Profile\n"
            + results.map(result => {
                let fbProfile = result.fbProfile || 'No Facebook Profile';
                let email = result.email || 'No Email';
                
                return `"${result.name.replace(/"/g, '""')}","${result.website}","${fbProfile}"`;
            }).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "ad_hunter_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Initialize UI
    updateProgressBars(0, 0);
    updateStats(0, 0);
});