# Phase 9 — Phone App + Browser App + FaceTime Stub → Real

## Summary

Build out the remaining PhoneOS apps: Phone (call log / voicemail system for friend tips), Browser (investigation web search), and FaceTime (video call dates). Each app surfaces facts through its own interaction metaphor.

## Motivation

Three PhoneOS apps are still stub placeholders. The phone metaphor is central to Catfish's identity — every app on the home screen should do something meaningful. These apps provide alternative fact-discovery channels beyond chat and dates, giving players multiple investigation paths.

## Deliverables

### 9.1 Phone App — Call Log & Voicemail

**Call Log:**
- List of incoming calls from Dev and Nia (friends)
- Missed call indicators with voicemail badges
- Call detail: caller name, time (game day), duration

**Voicemail System:**
- Voicemails are pre-recorded tips from friends (text displayed, optional voice playback)
- New voicemails appear on day advance, keyed to current investigation state
- Example: "Hey, I looked into that thing about Miles's alibi. Call me back." → unlocks a new fact
- Voicemail content authored per day (days 2-7), per killer variant where relevant
- ~15-20 voicemails total

**Outgoing Calls:**
- Player can "call" Dev or Nia to ask about specific suspects
- Call triggers a dialogue tree: "What do you think about [Kai/River/Miles/Sam/Jules]?"
- Friend response varies based on discovered facts and killer identity
- Each call costs 1 "phone credit" (limited to 3 per day to prevent grinding)

### 9.2 Browser App — Investigation Search

**Search Interface:**
- URL bar + search input
- "Search history" showing previous queries
- Pre-authored search results for investigation keywords

**Content:**
- ~20 searchable keywords tied to facts: "loading dock fire", "trail camera", "medical cart", "IG reflection", etc.
- Search results: headline + excerpt + "evidence saved" notification
- Searching a keyword commits the associated fact (if not yet discovered)
- Red herring searches: plausible keywords that return nothing useful
- Day-gated: some results only available after certain days

**Browser History:**
- Auto-populated with "bookmarks" based on discovered facts
- Player can re-read previously found evidence

### 9.3 FaceTime App — Video Call Dates

**Video Call UI:**
- Full-screen "video call" with character portrait + animated overlay
- Simulated call quality effects (slight glitch, compression artifacts)
- Character speaks scripted lines with voice playback
- Player responds via choice buttons (same as date mode, but simpler)

**Call Content:**
- Shorter than full date scenes (2-3 minute calls)
- 1 call per matched character, triggered by affinity threshold or day gate
- Each call reveals 1 fact
- Killer tells can surface as visual glitches or awkward pauses
- Call ends with character-specific sign-off

**Call Scheduling:**
- FaceTime calls appear as notifications: "River is calling..."
- Player can accept (enters call) or decline (character calls back next day)
- Call history shown in FaceTime app

### 9.4 Friend Tip System (Cross-App)
- Dev and Nia send tips through multiple channels (phone voicemail, DM, chat)
- Tips are day-gated and killer-aware
- Each tip points toward a specific fact or area of investigation
- Players can't get all tips in one run (encourages replay)

## Acceptance Criteria

1. Phone app shows call log with voicemails, playable voicemail content
2. Browser app has functional search with pre-authored results
3. FaceTime app presents video-call-style date interactions
4. Each app commits facts to the journal when appropriate
5. Content is day-gated and killer-aware where specified
6. Build succeeds, all tests pass

## Files to Modify

- New: `catfish/Features/Apps/Phone/PhoneAppView.swift`
- New: `catfish/Features/Apps/Phone/VoicemailPlayer.swift`
- New: `catfish/Features/Apps/Browser/BrowserAppView.swift`
- New: `catfish/Features/Apps/FaceTime/FaceTimeAppView.swift`
- `catfish/Features/PhoneOS/PhoneOSState.swift` — routing for all 3 apps
- `catfish/Resources/Content/content.json` — voicemail content, search results, FaceTime scripts
- `catfish/Core/Content/ContentSchema.swift` — new content types
- `catfish/Core/Content/ContentScheduler.swift` — voicemail/call scheduling

## Token Budget Estimate
~75K tokens (3 new apps + substantial content authoring)

## Dependencies
- Phase 3 (all facts authored — search results and voicemails reference them)
