/**
 * Asset registry for Catfish.
 *
 * Mirrors the SwiftUI `Assets.xcassets` naming convention from the source
 * doc — every entry is keyed by its asset_id (`Axxx_<name>`). The
 * `<AssetImage />` component shows a labeled placeholder when an id isn't
 * registered yet, so we can grow the catalog across passes without
 * crashing.
 *
 * Asset-id ranges (loose convention):
 *   A0xx — title / brand marks (app icons, wordmark) / character
 *          portraits / fullbody renders
 *   A1xx — visual FX overlays
 *   A2xx — match / swipe-feedback / celebration overlays
 *   A3xx — journal UI elements (book, sparkles, ornate frames)
 *   A4xx — buttons
 *   A5xx — avatar placeholders / charms / speech bubbles
 *          (A503 = outgoing/sender pink, A504 = incoming/received gray)
 *   A6xx — background scene art (rooms, locations, exteriors)
 *   A9xx — spritesheet / reference art
 *
 * Background scenes (A6xx) are bundled now and earmarked for use as
 * chat-thread backdrops in Pass 2 (each candidate-thread can pin a
 * scene that matches their bio) and for journal location markers in
 * Pass 3. They are intentionally not wired into any screen yet.
 *
 * Brand foundation (A001-A005, A201, A303, A503-A504) bundled in this
 * pass. A001 (title card) and A200 (MATCH! stamp) are upgraded art that
 * auto-appear on the title screen and match overlay. The remaining
 * pieces — app icons (A002-A004), wordmark (A005), NOPE stamp (A201),
 * ornate portrait frame (A303), and the two-sided chat bubbles
 * (A503/A504) — await screen-level wiring in later passes.
 */

import { ImageSourcePropType } from "react-native";

export type AssetId =
  | "A001_title_logo"
  | "A002_app_icon_primary"
  | "A003_app_icon_alt_anchor"
  | "A004_app_icon_alt_hook"
  | "A005_wordmark_catfish"
  | "A021_accuse_modal_bg"
  | "A034_miles_portrait_neutral"
  | "A035_miles_portrait_smile"
  | "A036_miles_portrait_flirty"
  | "A037_miles_portrait_curious"
  | "A038_miles_portrait_uneasy"
  | "A039_miles_portrait_sinister"
  | "A040_kai_portrait_flirty"
  | "A041_kai_portrait_sinister"
  | "A042_kai_portrait_uneasy"
  | "A043_kai_portrait_smile"
  | "A044_kai_portrait_curious"
  | "A045_kai_portrait_neutral"
  | "A046_jules_portrait_neutral"
  | "A047_jules_portrait_smile"
  | "A048_jules_portrait_flirty"
  | "A049_jules_portrait_curious"
  | "A050_jules_portrait_uneasy"
  | "A051_jules_portrait_sinister"
  | "A052_river_portrait_flirty"
  | "A053_river_portrait_sinister"
  | "A054_river_portrait_uneasy"
  | "A055_river_portrait_smile"
  | "A056_river_portrait_curious"
  | "A057_river_portrait_neutral"
  | "A058_sam_portrait_curious"
  | "A059_sam_portrait_smile"
  | "A060_sam_portrait_uneasy"
  | "A061_sam_portrait_neutral"
  | "A062_sam_portrait_sinister"
  | "A063_sam_portrait_flirty"
  | "A064_kai_fullbody_casual"
  | "A065_kai_fullbody_formal"
  | "A066_miles_fullbody_casual"
  | "A067_miles_fullbody_dressed_up"
  | "A068_river_fullbody_formal"
  | "A069_river_fullbody_casual"
  | "A070_jules_fullbody_casual"
  | "A071_jules_fullbody_dressed_up"
  | "A072_player_fullbody_default"
  | "A073_sam_fullbody_casual"
  | "A074_sam_fullbody_formal"
  | "A100_fx_heart_particle"
  | "A101_fx_glitch_overlay"
  | "A102_fx_message_pop"
  | "A103_fx_unmatch_shatter"
  | "A200_match_overlay"
  | "A201_nope_stamp"
  | "A300_journal_book"
  | "A301_search_sparkle"
  | "A302_heart_ring"
  | "A303_portrait_frame"
  | "A400_button_red"
  | "A500_avatar_placeholder"
  | "A501_charm_fire"
  | "A502_speech_bubble"
  | "A503_speech_bubble_outgoing"
  | "A504_speech_bubble_incoming"
  | "A600_bg_parking_garage_b2"
  | "A601_bg_bedroom_night"
  | "A602_bg_lounge_skyline"
  | "A603_bg_dive_bar"
  | "A604_bg_park_sunset"
  | "A605_bg_cafe_day"
  | "A606_bg_cafe_night"
  | "A999_spritesheet_reference";

const REGISTRY: Partial<Record<AssetId, ImageSourcePropType>> = {
  A001_title_logo: require("./images/A001_title_logo.png"),
  A002_app_icon_primary: require("./images/A002_app_icon_primary.png"),
  A003_app_icon_alt_anchor: require("./images/A003_app_icon_alt_anchor.png"),
  A004_app_icon_alt_hook: require("./images/A004_app_icon_alt_hook.png"),
  A005_wordmark_catfish: require("./images/A005_wordmark_catfish.png"),
  A034_miles_portrait_neutral: require("./images/A034_miles_portrait_neutral.png"),
  A035_miles_portrait_smile: require("./images/A035_miles_portrait_smile.png"),
  A036_miles_portrait_flirty: require("./images/A036_miles_portrait_flirty.png"),
  A037_miles_portrait_curious: require("./images/A037_miles_portrait_curious.png"),
  A038_miles_portrait_uneasy: require("./images/A038_miles_portrait_uneasy.png"),
  A039_miles_portrait_sinister: require("./images/A039_miles_portrait_sinister.png"),
  A040_kai_portrait_flirty: require("./images/A040_kai_portrait_flirty.png"),
  A041_kai_portrait_sinister: require("./images/A041_kai_portrait_sinister.png"),
  A042_kai_portrait_uneasy: require("./images/A042_kai_portrait_uneasy.png"),
  A043_kai_portrait_smile: require("./images/A043_kai_portrait_smile.png"),
  A044_kai_portrait_curious: require("./images/A044_kai_portrait_curious.png"),
  A045_kai_portrait_neutral: require("./images/A045_kai_portrait_neutral.png"),
  A046_jules_portrait_neutral: require("./images/A046_jules_portrait_neutral.png"),
  A047_jules_portrait_smile: require("./images/A047_jules_portrait_smile.png"),
  A048_jules_portrait_flirty: require("./images/A048_jules_portrait_flirty.png"),
  A049_jules_portrait_curious: require("./images/A049_jules_portrait_curious.png"),
  A050_jules_portrait_uneasy: require("./images/A050_jules_portrait_uneasy.png"),
  A051_jules_portrait_sinister: require("./images/A051_jules_portrait_sinister.png"),
  A052_river_portrait_flirty: require("./images/A052_river_portrait_flirty.png"),
  A053_river_portrait_sinister: require("./images/A053_river_portrait_sinister.png"),
  A054_river_portrait_uneasy: require("./images/A054_river_portrait_uneasy.png"),
  A055_river_portrait_smile: require("./images/A055_river_portrait_smile.png"),
  A056_river_portrait_curious: require("./images/A056_river_portrait_curious.png"),
  A057_river_portrait_neutral: require("./images/A057_river_portrait_neutral.png"),
  A058_sam_portrait_curious: require("./images/A058_sam_portrait_curious.png"),
  A059_sam_portrait_smile: require("./images/A059_sam_portrait_smile.png"),
  A060_sam_portrait_uneasy: require("./images/A060_sam_portrait_uneasy.png"),
  A061_sam_portrait_neutral: require("./images/A061_sam_portrait_neutral.png"),
  A062_sam_portrait_sinister: require("./images/A062_sam_portrait_sinister.png"),
  A063_sam_portrait_flirty: require("./images/A063_sam_portrait_flirty.png"),
  A064_kai_fullbody_casual: require("./images/A064_kai_fullbody_casual.png"),
  A065_kai_fullbody_formal: require("./images/A065_kai_fullbody_formal.png"),
  A066_miles_fullbody_casual: require("./images/A066_miles_fullbody_casual.png"),
  A067_miles_fullbody_dressed_up: require("./images/A067_miles_fullbody_dressed_up.png"),
  A068_river_fullbody_formal: require("./images/A068_river_fullbody_formal.png"),
  A069_river_fullbody_casual: require("./images/A069_river_fullbody_casual.png"),
  A070_jules_fullbody_casual: require("./images/A070_jules_fullbody_casual.png"),
  A071_jules_fullbody_dressed_up: require("./images/A071_jules_fullbody_dressed_up.png"),
  A073_sam_fullbody_casual: require("./images/A073_sam_fullbody_casual.png"),
  A074_sam_fullbody_formal: require("./images/A074_sam_fullbody_formal.png"),
  A200_match_overlay: require("./images/A200_match_overlay.png"),
  A201_nope_stamp: require("./images/A201_nope_stamp.png"),
  A300_journal_book: require("./images/A300_journal_book.png"),
  A301_search_sparkle: require("./images/A301_search_sparkle.png"),
  A302_heart_ring: require("./images/A302_heart_ring.png"),
  A303_portrait_frame: require("./images/A303_portrait_frame.png"),
  A400_button_red: require("./images/A400_button_red.png"),
  A500_avatar_placeholder: require("./images/A500_avatar_placeholder.png"),
  A501_charm_fire: require("./images/A501_charm_fire.png"),
  A502_speech_bubble: require("./images/A502_speech_bubble.png"),
  A503_speech_bubble_outgoing: require("./images/A503_speech_bubble_outgoing.png"),
  A504_speech_bubble_incoming: require("./images/A504_speech_bubble_incoming.png"),
  A600_bg_parking_garage_b2: require("./images/A600_bg_parking_garage_b2.png"),
  A601_bg_bedroom_night: require("./images/A601_bg_bedroom_night.png"),
  A602_bg_lounge_skyline: require("./images/A602_bg_lounge_skyline.png"),
  A603_bg_dive_bar: require("./images/A603_bg_dive_bar.png"),
  A604_bg_park_sunset: require("./images/A604_bg_park_sunset.png"),
  A605_bg_cafe_day: require("./images/A605_bg_cafe_day.png"),
  A606_bg_cafe_night: require("./images/A606_bg_cafe_night.png"),
  A999_spritesheet_reference: require("./images/A999_spritesheet_reference.png"),
};

export function getAssetSource(id: AssetId): ImageSourcePropType | undefined {
  return REGISTRY[id];
}

export function isAssetRegistered(id: AssetId): boolean {
  return REGISTRY[id] !== undefined;
}
