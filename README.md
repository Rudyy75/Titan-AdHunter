# Titan AdHunter — Chrome Extension

A Chrome extension that automates the analysis of ads from the Meta Ad Library to identify websites with user registration/sign-up forms, extract contact info, and score personal brands.

## Features

- **Smart Ad Detection**: Automatically identifies and processes ads from Meta Ad Library search results
- **Landing Page Analysis**: Navigates to advertiser landing pages and scans for sign-up forms
- **Personal Brand Scoring**: Scores leads (0-100) to distinguish personal brands from corporate accounts
- **Email Extraction & Pattern Generation**: Extracts emails from landing pages and FB profiles, generates likely email patterns when none found
- **Instagram Discovery**: Finds Instagram handles from landing pages and Facebook About pages
- **Dual Progress Tracking**: Shows both processing progress (qualified personal brands, max 30) and safety cap progress (total ads scanned, max 50)
- **Brand Deduplication**: Filters out duplicate domains to focus on unique opportunities
- **Concurrent Processing**: Processes up to 3 ads simultaneously for speed
- **CSV Export**: Exports qualified leads with scores, emails, patterns, and social links
- **Resource Management**: Efficiently manages browser tabs and resources

## Installation

1. **Load the Extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the extension directory

2. **Verify Installation:**
   - The AdHunter icon should appear in your Chrome toolbar
   - Click the icon to open the popup interface

## Usage

### Basic Operation

1. **Navigate to Meta Ad Library:**
   - Go to [Meta Ad Library](https://www.facebook.com/ads/library/)
   - Perform a search (e.g., for "funnel", "coaching", etc.)

2. **Start the Scan:**
   - Click the AdHunter extension icon
   - Click "Start Scan" in the popup
   - The extension will automatically:
     - Detect ads on the current page
     - Scroll to load more ads as needed
     - Open landing pages in background tabs (up to 3 concurrent)
     - Scan for sign-up forms
     - Analyze Facebook About pages for contact info
     - Score personal brand likelihood
     - Compile a list of qualifying leads

3. **Monitor Progress:**
   - **Processing Progress**: Shows how many qualified personal brands found (max 30)
   - **Safety Progress**: Shows total unique ads scanned (safety cap: 50)

4. **Stop the Scan:**
   - Click "Stop Scan" to immediately halt all processing, close background tabs, and clear the queue

5. **Export Results:**
   - Click "Export CSV" to download results
   - CSV columns: Personal Brand Label, Score, Brand Name, Website URL, Email, Email Patterns, Instagram, Facebook Profile, Signals

6. **Reset:**
   - Click "Reset Scan" to clear all data and start fresh

### Testing

For testing purposes, use the included `test_ad_library.html` file:

1. **Important**: Go to `chrome://extensions`, find AdHunter, click "Details", and enable "Allow access to file URLs".
2. Open `test_ad_library.html` in Chrome.
3. Click the AdHunter extension icon.
4. Start the scan to test the basic functionality.

## Technical Architecture

### File Structure

- **`manifest.json`**: Extension configuration and permissions (MV3)
- **`content.js`**: Ad detection, scrolling logic, and DOM scraping
- **`background.js`**: Orchestration, processing queue, concurrent workers, and state management
- **`popup.html`**: User interface with dual progress bars
- **`popup.js`**: Popup functionality, progress display, and messaging handlers
- **`test_ad_library.html`**: Test page for development

### Key Components

#### Content Script (`content.js`)
- Detects ad links using Facebook tracking URL patterns
- Implements on-demand scrolling triggered by background script
- Extracts advertiser metadata (name, Facebook profile)
- Sends batches of ads to background script for processing
- Respects stop/reset commands immediately

#### Background Script (`background.js`)
- Manages global state via `chrome.storage.local`
- Coordinates scrolling and batch processing
- Runs up to 3 concurrent worker tabs for parallel analysis
- Handles landing page sign-up detection
- Analyzes Facebook About pages for emails/Instagram
- Calculates personal brand scores
- Generates email patterns from names and domains
- Uses `scanAborted` flag for immediate stop propagation
- Uses atomic state updates to prevent race conditions

#### Popup Interface
- Dual progress bars (processing at /30, safety at /50)
- Start/Stop scan controls with visual state feedback
- Reset button to clear all data
- Results display with brand names and URLs
- CSV export functionality

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `SAFETY_CAP` | 50 | Maximum unique domains to process per scan |
| `MAX_CONCURRENT_TABS` | 3 | Maximum simultaneous analysis tabs |
| `SUCCESS_TARGET` | 10 | Original target (not actively enforced) |

## Safety Features

- **Safety Cap**: Maximum 50 unique ads processed per scan (prevents infinite loops)
- **Immediate Stop**: `scanAborted` flag provides synchronous kill switch for all workers
- **Tab Management**: Automatic cleanup of background tabs on stop/suspend
- **Concurrent Limit**: Maximum 3 simultaneous background tabs
- **Error Handling**: Comprehensive error handling for network issues and tab failures

## Development

### Testing the Extension

1. **Load the extension** in Chrome developer mode
2. **Open `test_ad_library.html`** to test basic functionality
3. **Use Chrome DevTools** to monitor console logs and debug

### Key Message Flow

1. **Popup → Content**: `scan_ads` — Initiates scanning
2. **Content → Background**: `start_scan_session` — Resets state for new scan
3. **Content → Background**: `process_batch` — Sends detected ads
4. **Background → Content**: `trigger_scroll` — Requests more content
5. **Background → Popup**: `update_dual_progress` — Updates UI progress bars
6. **Background → Popup**: `add_result` — Adds qualifying leads in real-time
7. **Background → Popup**: `scan_complete` — Signals scan finished
8. **Popup → Background**: `stop_scan` — Halts all processing immediately
9. **Popup → Content**: `reset_scan` — Resets content script state

### Modifying the Extension

- **To change safety limits**: Modify `SAFETY_CAP` in `background.js` and `SAFETY_MAX` in `popup.js`
- **To change processing display limit**: Modify `PROCESSING_MAX` in `popup.js`
- **To adjust scrolling behavior**: Modify timing and `maxScrolls` in `content.js`
- **To update UI**: Modify `popup.html` and `popup.js`

## Troubleshooting

### Common Issues

1. **"Please navigate to Meta Ad Library first"**
   - Ensure you're on a Meta Ad Library page
   - The extension only activates on Ad Library pages

2. **Scan stops prematurely**
   - Check console logs for errors
   - Verify the page has ad content loaded

3. **No results found**
   - Ensure the search has ads with external landing pages
   - Check that landing pages have visible sign-up forms

### Debugging

- Open Chrome DevTools (F12) and check the Console tab
- Look for messages from the AdHunter extension (prefixed with worker IDs)
- Monitor network activity for landing page requests
- Check the background service worker console at `chrome://extensions` → Inspect views

## License

This extension is provided for educational and development purposes. Use responsibly and in compliance with Meta's terms of service.