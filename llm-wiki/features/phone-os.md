---
confidence: 0.95
sources: [catfish/Features/PhoneOS/, catfish/Features/Journal/ClueJournalView.swift, catfish/Core/GameState.swift, catfish/DesignSystem/PhoneTheme.swift, catfish/Features/PhoneOS/PhoneShell.swift]
last-confirmed: 2026-04-30
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

- **LotsOFish** — The dating app (contains the Swipe feature)
- **Photos** — Evidence gallery showing discovered fact images (`PhotosGalleryView`)
- **Word-Low**, **Ego Trip**, **Sugar Coat**, **Safe Spot** — Mini-games launched directly from the home screen
- Other app stubs for future features (phone, FaceTime, mail, browser)

### Journal Badge

`HomeScreen.badge(for:)` now returns a live badge count for the Journal icon.
The badge is `GameState.newJournalClueCount`, calculated as discovered clues
minus `CaseRun.journalLastSeenClueCount`. Opening the Journal marks clues as
seen via `GameState.markJournalViewed()`.

### Photos App

Implemented in `Features/Apps/Photos/PhotosGalleryView.swift`. Shows a grid of
discovered facts that have `imageAssetID` set. Tap to expand with detail overlay
showing image, fact text, and source label. Empty state when no evidence photos.

## Related Pages

- [[features/swipe]] — LotsOFish dating app
- [[features/arcade]] — Mini-games
- [[architecture/overview]] — Full architecture
