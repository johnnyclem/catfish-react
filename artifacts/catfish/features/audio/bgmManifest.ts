export type BgmName =
  | "noir_loop"
  | "bgm_main_theme"
  | "bgm_phone_os"
  | "bgm_swipe"
  | "bgm_chat"
  | "bgm_date_coffee"
  | "bgm_date_restaurant"
  | "bgm_date_park"
  | "bgm_date_bar"
  | "bgm_date_apartment"
  | "bgm_arcade_wordlow"
  | "bgm_arcade_ego_trip"
  | "bgm_arcade_general";

const BGM_MANIFEST: Record<BgmName, number | object> = {
  noir_loop: require("@/assets/audio/music/noir_loop.wav"),
  bgm_main_theme: require("@/assets/audio/music/bgm_main_theme.wav"),
  bgm_phone_os: require("@/assets/audio/music/bgm_phone_os.wav"),
  bgm_swipe: require("@/assets/audio/music/bgm_swipe.wav"),
  bgm_chat: require("@/assets/audio/music/bgm_chat.wav"),
  bgm_date_coffee: require("@/assets/audio/music/bgm_date_coffee.wav"),
  bgm_date_restaurant: require("@/assets/audio/music/bgm_date_restaurant.wav"),
  bgm_date_park: require("@/assets/audio/music/bgm_date_park.wav"),
  bgm_date_bar: require("@/assets/audio/music/bgm_date_bar.wav"),
  bgm_date_apartment: require("@/assets/audio/music/bgm_date_apartment.wav"),
  bgm_arcade_wordlow: require("@/assets/audio/music/bgm_arcade_wordlow.wav"),
  bgm_arcade_ego_trip: require("@/assets/audio/music/bgm_arcade_ego_trip.wav"),
  bgm_arcade_general: require("@/assets/audio/music/bgm_arcade_general.wav"),
};

export function bgmAsset(name: BgmName): number | object {
  return BGM_MANIFEST[name];
}
