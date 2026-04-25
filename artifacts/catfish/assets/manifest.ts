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
 *   A0xx — title / character portraits / fullbody renders
 *   A1xx — visual FX overlays
 *   A2xx — match / celebration overlays
 *   A3xx — journal UI elements
 *   A4xx — buttons
 *   A5xx — avatar placeholders / charms / speech bubbles
 *   A6xx — background scene art (rooms, locations, exteriors)
 *   A9xx — spritesheet / reference art
 *
 * Background scenes (A6xx) are bundled now and earmarked for use as
 * chat-thread backdrops in Pass 2 (each candidate-thread can pin a
 * scene that matches their bio) and for journal location markers in
 * Pass 3. They are intentionally not wired into any screen yet.
 */

import { ImageSourcePropType } from "react-native";

export type AssetId =
  | "A001_title_logo"
  | "A021_accuse_modal_bg"
  | "A047_jules_portrait_smile"
  | "A048_jules_portrait_flirty"
  | "A049_jules_portrait_curious"
  | "A050_jules_portrait_uneasy"
  | "A051_jules_portrait_sinister"
  | "A070_jules_fullbody_casual"
  | "A071_jules_fullbody_dressed_up"
  | "A072_player_fullbody_default"
  | "A100_fx_heart_particle"
  | "A101_fx_glitch_overlay"
  | "A102_fx_message_pop"
  | "A103_fx_unmatch_shatter"
  | "A200_match_overlay"
  | "A300_journal_book"
  | "A301_search_sparkle"
  | "A302_heart_ring"
  | "A400_button_red"
  | "A500_avatar_placeholder"
  | "A501_charm_fire"
  | "A502_speech_bubble"
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
  A047_jules_portrait_smile: require("./images/A047_jules_portrait_smile.png"),
  A048_jules_portrait_flirty: require("./images/A048_jules_portrait_flirty.png"),
  A049_jules_portrait_curious: require("./images/A049_jules_portrait_curious.png"),
  A050_jules_portrait_uneasy: require("./images/A050_jules_portrait_uneasy.png"),
  A051_jules_portrait_sinister: require("./images/A051_jules_portrait_sinister.png"),
  A070_jules_fullbody_casual: require("./images/A070_jules_fullbody_casual.png"),
  A071_jules_fullbody_dressed_up: require("./images/A071_jules_fullbody_dressed_up.png"),
  A200_match_overlay: require("./images/A200_match_overlay.png"),
  A300_journal_book: require("./images/A300_journal_book.png"),
  A301_search_sparkle: require("./images/A301_search_sparkle.png"),
  A302_heart_ring: require("./images/A302_heart_ring.png"),
  A400_button_red: require("./images/A400_button_red.png"),
  A500_avatar_placeholder: require("./images/A500_avatar_placeholder.png"),
  A501_charm_fire: require("./images/A501_charm_fire.png"),
  A502_speech_bubble: require("./images/A502_speech_bubble.png"),
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
