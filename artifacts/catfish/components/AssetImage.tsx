/**
 * AssetImage — labeled placeholder for unregistered asset ids.
 *
 * Translated from the SwiftUI `AssetImage` view in the source doc:
 * "shows a labeled placeholder when the named asset isn't in the catalog
 * yet. Lets you develop the UI before all 107 PNGs land."
 */

import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { AssetId, getAssetSource, isAssetRegistered } from "@/assets/manifest";
import { cfPalette } from "@/constants/colors";

/** Accepts any string — used for dynamic asset ids from scene data. */
type FlexibleAssetId = string;

interface AssetImageProps {
  id: FlexibleAssetId;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  /** Force the placeholder even if the asset is registered. */
  showPlaceholder?: boolean;
}

export function AssetImage({
  id,
  style,
  containerStyle,
  resizeMode = "contain",
  showPlaceholder,
}: AssetImageProps) {
  const source = getAssetSource(id as AssetId);
  const useFallback = showPlaceholder || !isAssetRegistered(id as AssetId) || !source;

  if (useFallback) {
    return (
      <View style={[styles.placeholder, containerStyle, style as ViewStyle]}>
        <Text style={styles.placeholderLabel}>{id}</Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Image source={source} style={style} resizeMode={resizeMode} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: cfPalette.iron,
    borderWidth: 2,
    borderColor: cfPalette.purple,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  placeholderLabel: {
    color: cfPalette.ash,
    fontFamily: "PressStart2P_400Regular",
    fontSize: 8,
    textAlign: "center",
  },
});
