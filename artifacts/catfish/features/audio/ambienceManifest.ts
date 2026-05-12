export type AmbienceName =
  | "amb_coffee_shop"
  | "amb_restaurant"
  | "amb_park"
  | "amb_bar"
  | "amb_apartment"
  | "amb_alley"
  | "amb_hospital"
  | "amb_killer_reveal";

const AMBIENCE_MANIFEST: Record<AmbienceName, number | object> = {
  amb_coffee_shop: require("@/assets/audio/ambience/amb_coffee_shop.wav"),
  amb_restaurant: require("@/assets/audio/ambience/amb_restaurant.wav"),
  amb_park: require("@/assets/audio/ambience/amb_park.wav"),
  amb_bar: require("@/assets/audio/ambience/amb_bar.wav"),
  amb_apartment: require("@/assets/audio/ambience/amb_apartment.wav"),
  amb_alley: require("@/assets/audio/ambience/amb_alley.wav"),
  amb_hospital: require("@/assets/audio/ambience/amb_hospital.wav"),
  amb_killer_reveal: require("@/assets/audio/ambience/amb_killer_reveal.wav"),
};

export function ambienceAsset(name: AmbienceName): number | object {
  return AMBIENCE_MANIFEST[name];
}
