---
confidence: 0.95
sources: [catfish/Features/PhoneOS/, catfish/Features/Journal/ClueJournalView.swift, catfish/Core/GameState.swift, catfish/DesignSystem/PhoneTheme.swift, catfish/Features/PhoneOS/PhoneShell.swift]
last-confirmed: 2026-05-09
status: active
---

# PhoneOS Meta-UI

Catfish presents itself as a fictional phone OS — the game world is a phone
inside your phone.

## Components

| File | Role |
|------|------|
| `Features/PhoneOS/PhoneShell.swift` | Phone frame container |
| `Features/PhoneOS/PhoneOSState.swift` | Phone-level state management |
| `Features/PhoneOS/HomeScreen.swift` | App grid / home screen |
| `Features/PhoneOS/StatusBar.swift` | Top status bar |
| `Features/PhoneOS/AppIcon.swift` | App icon component |
| `Features/PhoneOS/AppStubView.swift` | Placeholder for unimplemented apps |
| `DesignSystem/PhoneTheme.swift` | PhoneOS-specific theming |

## Apps

The PhoneShell wraps the entire game experience. Apps within the phone include:

- **LotsOFish** — The dating app (contains Swipe, Matches, Social, Board, Profile tabs)
- **Photos** — Evidence gallery showing discovered fact images (`PhotosGalleryView`)
- **Journal** — Captured + authored fact browser with accusation entry point
- **Word-Low**, **Ego Trip**, **Sugar Coat**, **Safe Spot** — Mini-games launched directly from the home screen
- **Settings** — Audio/Display/Accessibility toggles. Persisted to separate AsyncStorage keys (not on CaseRun). Uses RN `Switch` components with `cfPalette` styling. Added Phase 11.
- Other app stubs for future features (phone, FaceTime, mail, browser)

### Journal Badge

`HomeScreen.badge(for:)` returns a live badge count for the Journal icon.
The badge is `GameState.newJournalClueCount`, calculated as discovered clues
minus `CaseRun.journalLastSeenClueCount`. Opening the Journal marks clues as
seen via `GameState.markJournalViewed()`.

### Lots 'o Fish Tabs (P2 Passes)

The dating app exposes five sub-surfaces via a bottom tab bar inside the phone shell:

| Tab | Screen | Description |
|-----|--------|-------------|
| Swipe | `SwipeScreen` | Card deck; right-swipe to match |
| Matches | `MatchesScreen` | List of active matches + last message preview |
| Social | `SocialFeedScreen` | Instagram-style grid of authored IG posts (`FactSource.instagram`), filterable by matched character; captions use killer-variant overrides from `buildAuthoredFacts` |
| Board | `SuspectBoardScreen` | 2-column grid of all deck candidates showing portrait, name, risk meter (based on committed fact count from that candidate), and killer badge on `isKillerCandidate` rows |
| Profile | `ProfileScreen` | Player's own profile settings |

The "Board" tab is the primary suspect board surface. The Journal app remains the primary fact-capturing surface. Both surfaces share the same `CaseRun.facts` data.

### Photos App

Implemented in `Features/Apps/Photos/PhotosGalleryView.swift`. Shows a grid of
discovered facts that have `imageAssetID` set. Tap to expand with detail overlay
showing image, fact text, and source label. Empty state when no evidence photos.

## Related Pages

- [[features/swipe]] — LotsOFish dating app (Swipe/Matches/Social/Board/Profile tabs)
- [[features/arcade]] — Mini-games
- [[architecture/overview]] — Full architecture