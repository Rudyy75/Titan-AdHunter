# AdHunter Chrome Extension

A Chrome extension that automates the analysis of ads from the Meta Ad Library to identify websites with user registration/sign-up forms.

## Features

- **Smart Ad Detection**: Automatically identifies and processes ads from Meta Ad Library search results
- **Landing Page Analysis**: Navigates to advertiser landing pages and scans for sign-up forms
- **Dual Progress Tracking**: Shows both processing progress and safety cap progress
- **Brand Deduplication**: Filters out duplicate brands to focus on unique opportunities
- **CSV Export**: Exports qualified leads to CSV format for further analysis
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
   - Perform a search (e.g., for "funnel")

2. **Start the Scan:**
   - Click the AdHunter extension icon
   - Click "Start Scan" in the popup
   - The extension will automatically:
     - Detect ads on the current page
     - Scroll to load more ads as needed
     - Open landing pages in background tabs
     - Scan for sign-up forms
     - Compile a list of qualifying websites

3. **Monitor Progress:**
   - **Processing Progress**: Shows how many unique brands have been processed (target: 75)
   - **Safety Progress**: Shows total ads processed for safety cap (limit: 75)

4. **Export Results:**
   - Once the scan completes, click "Export CSV"
   - The CSV file will contain: Brand Name, Website URL, Facebook Profile

### Testing

For testing purposes, use the included `test_ad_library.html` file:

1. Open `test_ad_library.html` in Chrome
2. Click the AdHunter extension icon
3. Start the scan to test the basic functionality

## Technical Architecture

### File Structure

- **`manifest.json`**: Extension configuration and permissions
- **`content.js`**: Ad detection, scrolling logic, and DOM scraping
- **`background.js`**: Orchestration, processing queue, and state management
- **`popup.html`**: User interface with dual progress bars
- **`popup.js`**: Popup functionality and messaging handlers
- **`test_ad_library.html`**: Test page for development

### Key Components

#### Content Script (`content.js`)
- Detects ad links using Facebook tracking URL patterns
- Implements on-demand scrolling triggered by background script
- Extracts advertiser metadata (name, Facebook profile)
- Sends batches of ads to background script for processing

#### Background Script (`background.js`)
- Manages global state and processing queue
- Coordinates scrolling and batch processing
- Handles tab management and landing page analysis
- Implements sign-up form detection logic
- Manages safety limits and progress tracking

#### Popup Interface
- Dual progress bars for real-time monitoring
- Start/Stop scan controls
- Results display with brand names and URLs
- CSV export functionality

## Sign-Up Form Detection

The extension detects sign-up forms using multiple strategies:

1. **HTML Elements**: `input` fields with types like `email`, `password`, `text` within `<form>` tags
2. **Text Content**: Button/link text containing phrases like "Sign Up", "Register", "Get Started", etc.
3. **CSS Selectors**: Common selectors associated with registration forms
4. **Semantic Analysis**: Contextual analysis of page content

## Safety Features

- **Processing Limit**: Maximum 75 unique brands processed per scan
- **Safety Cap**: Maximum 75 total ads processed (prevents infinite loops)
- **Tab Management**: Automatic cleanup of background tabs
- **Error Handling**: Comprehensive error handling for network issues

## Development

### Testing the Extension

1. **Load the extension** in Chrome developer mode
2. **Open `test_ad_library.html`** to test basic functionality
3. **Use Chrome DevTools** to monitor console logs and debug

### Key Message Flow

1. **Popup → Content**: `scan_ads` - Initiates scanning
2. **Content → Background**: `process_batch` - Sends detected ads
3. **Background → Content**: `trigger_scroll` - Requests more content
4. **Background → Popup**: `update_dual_progress` - Updates UI progress
5. **Background → Popup**: `add_result` - Adds qualifying websites

### Modifying the Extension

- **To change safety limits**: Modify the constants in `background.js`
- **To adjust scrolling behavior**: Modify timing in `content.js`
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
- Look for messages from the AdHunter extension
- Monitor network activity for landing page requests

## License

This extension is provided for educational and development purposes. Use responsibly and in compliance with Meta's terms of service.