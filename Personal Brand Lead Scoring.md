# Chat Conversation

Note: _This is purely the output of the chat conversation and does not contain any raw data, codebase snippets, etc. used to generate the output._

### User Input

go through this entire repo and get to know what this product if for

### Planner Response

I'll explore the Titan-AdHunter repository to understand what this product is about. Let me start by examining the project structure and key files.

*Listed directory [Titan-AdHunter](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter) *

*Viewed [README.md](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/README.md) *

*Viewed [manifest.json](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/manifest.json) *

*Viewed [AGENTS.md](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/AGENTS.md) *

### Planner Response

Now let me look at the core code files to understand the implementation details:

*Analyzed [background.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js) *

*Analyzed [content.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/content.js) *

*Analyzed [popup.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/popup.js) *

*Viewed [popup.html](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/popup.html) *

### Planner Response

Let me also check the openspec folder for any additional documentation:

*Listed directory [openspec](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/openspec) *

*Viewed [project.md](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/openspec/project.md) *

### Planner Response

Now I have a comprehensive understanding of the **Titan-AdHunter** project. Here's a summary:

---

## 🎯 **Titan-AdHunter - Product Overview**

### **What is it?**
**Titan-AdHunter** (or "AdHunter") is a **Chrome Extension** designed for **lead generation** from the **Meta (Facebook) Ad Library**. It automates the process of finding advertisers whose landing pages contain **sign-up/registration forms** — commonly known as "funnels."

---

### **Who is it for?**
This tool is primarily for:
- **Marketers & Copywriters** looking for potential clients running ads with funnel-style landing pages
- **Agency owners** prospecting for brands that invest in paid advertising and use lead capture strategies
- **Business development professionals** seeking warm leads from advertisers in specific niches

---

### **Core Workflow**
1. **User navigates** to [Meta Ad Library](https://www.facebook.com/ads/library/) and performs a search (e.g., "funnel", "coaching", etc.)
2. **User clicks "Start Scan"** in the extension popup
3. **The extension automatically**:
   - Scrapes ads from the Ad Library page
   - Scrolls the page to load more ads
   - Opens advertiser landing pages in background tabs
   - Analyzes each landing page for **sign-up forms** (email inputs, "Register" buttons, etc.)
   - Deduplicates brands to focus on unique leads
4. **Results are displayed** with brand names, website URLs, and Facebook profile links
5. **User exports to CSV** for further outreach

---

### **Key Features**
| Feature | Description |
|---------|-------------|
| **Smart Ad Detection** | Detects Facebook ad tracking URLs and extracts advertiser metadata |
| **Landing Page Analysis** | Scans for form inputs, "Sign Up" buttons, and registration patterns |
| **Brand Deduplication** | Filters duplicate advertisers to focus on unique leads |
| **Facebook Profile Extraction** | Extracts advertiser Facebook page links for additional contact info |
| **Dual Progress Tracking** | Shows both processing progress and safety cap progress |
| **CSV Export** | Exports qualified leads (Brand Name, Website URL, Facebook Profile) |
| **Safety Limits** | Max 10 successful leads (configurable), 30 ads processed cap |

---

### **Tech Stack**
- **Chrome Extension Manifest V3**
- **Vanilla JavaScript (ES6+)**
- **HTML5 / CSS3**

### **Architecture**
| File | Role |
|------|------|
| [manifest.json](cci:7://file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/manifest.json:0:0-0:0) | Extension configuration & permissions |
| [background.js](cci:7://file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js:0:0-0:0) | Orchestration, state management, tab management, form detection logic |
| [content.js](cci:7://file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/content.js:0:0-0:0) | DOM scraping, ad detection, scrolling, data extraction from Ad Library |
| `popup.html/js` | User interface with progress bars, controls, and export functionality |

---

### **Business Context**
This is a **copywriting/marketing tool** designed to help you find **potential clients** who are already running ads with funnel landing pages — a strong signal that they may need copywriting or marketing services. It automates what would otherwise be hours of manual research.

### User Input

Now see, i want to set up a copywriting business in teh fastest time possible. within the next 30 days, i want to hit $6k/month and in the next 2 months i want that mark to hit $10k+.

Now for that to happen i have made this extension. rn if i go to facebook ad library(i dont know any other source) and search for something like online business coach - i get lot of results. I then use this extension and scrape potential clients who have a website wiht a email list. 
Now i sign up to that and see which emails go to spam. I then msg those ppl/brnads pitching to fix this issue for about $2k. Then i try to upsell into a monthly retainer managing their lists and providing other copywriting services.

Now you have this extension. but for me to dm them, i either need their email address or their instagram. also in instagram theres this cool feature that if i find one good account i can press the "show similar acc" button to get more accounts which might be potential clients.

Now also, instead of messaging brands - personal brands would be better no? LIke one guy who has his brand which might have email list or maybe a course seller etc. 

The problem rn is that even if i find 100 people, they might not be personal brands. Even if its a brand, i dont mind working but contacting them is hard. Keywords like online business coach etc might give good results idk.

I need you to be my partner in this and brainstorm the fuck out to give me the best plan possible - everything from what changes this extension needs, how to get 100 prospects within 15mins, how to get the right ppl etc

I want you to think about the fastest ways in which i can go and hit that $10k/month - preferable within the next 30-50 days.



### Planner Response

This is exactly the kind of strategic hustle I love. Let me brainstorm with you and create a comprehensive battle plan. This is a **C3 System-level** task that needs deep strategic thinking.

*Edited relevant file*

*Edited relevant file*

### User Input

1) Nope, i was lazy to find clients and dm them
2) Sure, do it
3) I think i could handle 20-30 dms a day
4) We can't go much lower imo, $1.5k minimum, but lets see that later
5) No proofs as of now

I was thinking that finding leads on insta is time taking. The facebook ad method is mad fast - 10mins gives you 100 leads ez. But in insta this might take hours. 
Brainstorm a crazy plan - could be another extension as well to find the best possible leads from insta the fastest

### Planner Response

You're absolutely right — Instagram manual prospecting is painfully slow. Let me brainstorm an **Instagram Lead Hunter extension** that can match the speed of your Meta Ad Library scraper.

*Edited relevant file*

*Edited relevant file*

### User Input

1) Not required imo, i can run it multiple times
2) Hmm no need, per session ig 20 should be fine, ill run the extension again,
3) Yes

Under no circumstance should instagrram ban my acc or flag it as a bot. this is most crucial

### Planner Response

Got it — anti-detection is the top priority. Let me build both extensions with human-like behavior patterns.

*Viewed [background.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js) *

*Viewed [popup.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/popup.js) *

### Planner Response

I see the AdHunter already has Instagram extraction in [analyzeFacebookProfile()](cci:1://file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js:498:0-578:1). Let me now create the Instagram Lead Hunter extension with anti-detection measures. I'll create it in the same parent directory.

*Edited relevant file*

*Edited relevant file*

*Edited relevant file*

*Edited relevant file*

*Edited relevant file*

*Edited relevant file*

*Edited relevant file*

*Listed directory [InstaLeadHunter](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/InstaLeadHunter) *

### Planner Response

All 6 files created. Now let me create the walkthrough documenting what was built:

*Edited relevant file*

### User Input

ok, what does the instahunter do rn

### Planner Response

Here's what **InstaLeadHunter** does right now:

## Current Functionality

### 1. **🔍 Start Hunt** (Main Feature)
When you're on any Instagram profile and click "Start Hunt":
- Tries to find and click the "Similar Accounts" dropdown
- Scrapes usernames from the similar accounts list
- Puts the extension into **passive capture mode**

### 2. **📊 Auto-Capture (Passive Mode)**
While hunting is active, as you **manually browse** to different profiles:
- Automatically extracts profile data (username, bio, followers, website, email)
- Scores the lead based on keywords (coach, mentor, course = high score)
- If score ≥ 25, automatically saves the lead
- Shows a running count in the popup

### 3. **📊 Analyze Profile** (Manual)
One-click to score and capture the current profile you're viewing — even if auto-capture didn't trigger.

### 4. **📁 Export CSV**
Exports all captured leads with:
- Username, Display Name, Bio
- Follower count, Website, Email
- Quality Score, Profile URL

### 5. **🛡️ Anti-Detection**
- Random delays (800-2500ms) between all actions
- No automated navigation — YOU control the browsing
- 20 leads per session limit

---

## What You Actually Do

1. Go to a coach/creator profile on Instagram
2. Click **Start Hunt**
3. **You manually click** on "Similar Accounts" dropdown
4. **You manually browse** through those profiles
5. Extension auto-captures qualified leads in the background
6. Export when you hit 20

**It's semi-automated** — you do the browsing (looks human), extension does the data extraction.

Want me to make it more automated (riskier) or adjust anything?

### User Input

ok for the Titan-AdHunter i want a mega feature addition

You see rn, we actually aren't getting the ceo/founders email right from the website - its tying to find if its in the about section but if it doesnt find, then it leave it blank.

I want a mega feature addition - auto email finder
Based on the name of the brand/person i want the extension to find the email address of the founder so that i can dm them coz i don't think if i reply to the spam emails anyone would reply back to me.

Under no circumstance should my ip get banned or affected

Brainstorm and find the best solution

### Planner Response

This is a **C3 System-level** feature that needs careful planning. Let me brainstorm the safest approaches:

## 🔍 Email Finder Options Analysis

| Method | IP Safety | Cost | Accuracy | Effort |
|--------|-----------|------|----------|--------|
| **Hunter.io API** | ✅ Safe (uses their servers) | Free: 25/mo, $49/mo for 500 | 90%+ | Low |
| **Apollo.io API** | ✅ Safe | Free: 50/mo | 85%+ | Low |
| **Email Pattern Guessing** | ✅ Safe (no external requests) | Free | 60-70% | Medium |
| **Scraping LinkedIn/Google** | ❌ RISKY | Free | Variable | High |
| **Snov.io API** | ✅ Safe | Free: 50/mo | 85%+ | Low |

---

## 🏆 Recommended Approach: Hybrid System

### Tier 1: Enhanced On-Page Extraction (FREE, already have)
- Facebook About page (current)
- Website footer, contact page, about page
- Look harder in more places

### Tier 2: Email Pattern Generation (FREE, no API)
Given the **domain** and **founder name**, generate likely emails:
```
john@domain.com
john.smith@domain.com
jsmith@domain.com
j.smith@domain.com
smith@domain.com
```
Output all patterns → you manually verify later OR use a free email verifier

### Tier 3: Hunter.io API (FREE tier = 25/month)
For high-priority leads only:
- Domain email search → finds all emails at that domain
- Returns founder/CEO emails with confidence scores
- **Your IP is 100% safe** (calls go through Hunter's servers)

---

## 🛡️ IP Safety Guarantee

The safest approach uses **external APIs only** — your IP never touches any scraping:

| Action | Your IP Exposed? |
|--------|------------------|
| Call Hunter.io API | ❌ No — uses API key, not your IP |
| Email pattern generation | ❌ No — runs locally |
| Scraping websites | ⚠️ Yes — risky |

---

## My Recommendation

**Build a 3-tier system:**

1. **Aggressive on-page extraction** — Scrape more pages (website /contact, /about, /team) before giving up
2. **Smart email pattern generator** — Generate 5-6 likely patterns from name + domain
3. **Optional Hunter.io integration** — For when you need verified emails (API key config in popup)

**Do you want me to:**
1. **Implement Tier 1+2** (enhanced extraction + pattern generator) — Completely free, no API needed
2. **Add Tier 3** (Hunter.io integration) — Requires you to sign up for free API key
3. **Both** — Full system with fallback chain

Which approach do you prefer? Also, do you already have a Hunter.io account or want me to design without requiring one?

### User Input

the problem with hunter is it only gives 25/month and i don't have jack cash with me to get the premium version. I need to accomplish this without a single peeny invested. I want you to analyse and tell me if you can replicate hunter.io without putting my ip or email deliverability at risk

### Planner Response

Great question. Let me break down exactly how Hunter.io works and what we can replicate safely:

## How Hunter.io Works

| Component | What It Does | Can We Replicate? |
|-----------|--------------|-------------------|
| **Web Crawling Database** | They've crawled billions of pages, stored emails | ❌ No — requires massive infrastructure |
| **Email Pattern Detection** | Given domain, guess patterns from known data | ✅ Yes — we can generate patterns |
| **SMTP Verification** | Connect to mail server, check if email exists | ⚠️ Risky from your IP |

---

## What We CAN Build (100% Free, 100% Safe)

### ✅ Smart Email Pattern Generator

Given: **Name + Domain** (e.g., "John Smith" + "coachingbyjohn.com")

Generate these patterns:
```
john@coachingbyjohn.com           (most common for personal brands)
johnsmith@coachingbyjohn.com
john.smith@coachingbyjohn.com
jsmith@coachingbyjohn.com
j.smith@coachingbyjohn.com
smith@coachingbyjohn.com
hello@coachingbyjohn.com          (fallback)
```

**Safety**: ✅ 100% local computation, no external requests, no IP exposure

---

### ✅ Enhanced Website Scraping

Go beyond Facebook `/about` — also check:
- Website `/contact` page
- Website `/about` or `/about-us` page
- Website `/team` page
- Footer across all pages
- Meta tags, structured data (schema.org)

**Safety**: ✅ Normal browsing — same as visiting their website manually

---

### ⚠️ SMTP Verification (NOT Recommended from Your IP)

This would directly connect to their mail server to check if email exists. 
- **Risk**: Your IP could get flagged as a scanner
- **Risk**: Your email domain reputation could suffer if on same network

**My Verdict**: ❌ Don't do this from your machine

---

## The Realistic Free Solution

**What I'll build:**

1. **Deep website scraper** — Check 3-4 extra pages per lead for emails
2. **Smart pattern generator** — Output 6-8 likely email patterns per lead
3. **CSV export with patterns** — You get a column with all possible emails

**Your workflow:**
1. Extension finds leads with websites
2. Generates email patterns (john@, johnsmith@, etc.)
3. You pick the most likely one (personal brands usually use firstname@)
4. Send cold email — some will bounce, that's normal (~20-30% bounce is fine)

**Reality check**: Most cold emailers start this way. A 30% bounce rate on cold outreach is totally acceptable when starting out.

---

## Want Me to Build This?

I'll add to AdHunter:
1. **Enhanced email extraction** (scrape /contact, /about, /team pages)
2. **Email pattern generator** (generate 6-8 patterns from name + domain)
3. **Export with email patterns column**

This is 100% free, no API keys, and completely safe for your IP.

**Yes or should I adjust the approach?**

### User Input

this is fine, also find out which free tool i can use to verify if a email id is correct or not - this way we could generate addresses and check if its correct

*Searched web for free email verification tool check if email exists 2024*

### Planner Response

I found several free verification tools. Now let me build the feature and provide you with the best free tools.

*Viewed [background.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js) *

*Viewed [background.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js) *

### Planner Response

Now I'll add the email pattern generator function and enhanced scraping. Let me add the function and modify the leadData creation:

*Edited relevant file*

### Planner Response

Now I need to update the CSV export in popup.js to include the email patterns column:

*Edited relevant file*

### Planner Response

Now let me update the task list and walkthrough, then notify you with the free verification tools:

*Edited relevant file*

### User Input

now, i need strategic help here. i need you to tell me which would be better, using our extension or a n8n type agentic workflow to do the lead finding part. im very good at coding, im pretty sure if you explain well ill understand

### User Input

Continue

*Edited relevant file*

*Edited relevant file*

### User Input

i want you to research the whole internet to give me the best tool for getting the email of the founder/ceo
also what happened about the part where we were discussing about getting only personal brands etcc

*Searched web for best free tool to find founder ceo email address 2024 higher limit than hunter.io*

*Searched web for how to identify personal brands vs corporate brands on social media at scale scraper logic*

*Searched web for best free email finder for founders 2024 2025 reddit reviews high limits*

*Edited relevant file*

### User Input

sure, do it

*Viewed [background.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js) *

*Viewed [background.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js) *

### Planner Response

Now I'll add the personal brand scoring function and integrate it into the lead data. Let me view the area around line 540 where [generateEmailPatterns](cci:1://file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js:508:0-548:1) is, so I can add the new function nearby:

*Viewed [background.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/background.js) *

### Planner Response

Now I'll add the personal brand scoring function and integrate it into the lead data:

*Edited relevant file*

### Planner Response

Now I need to update the CSV export in popup.js to include the personal brand score columns:

*Viewed [popup.js](file:///c:/Users/yellu/Documents/Stuff/Money%20Lab/Copywriting/Titan-AdHunter/popup.js) *

*Edited relevant file*

*Edited relevant file*

*Edited relevant file*