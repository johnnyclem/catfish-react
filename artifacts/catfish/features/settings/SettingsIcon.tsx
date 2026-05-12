import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

import { PixelIconFrame } from "@/features/parody/PixelIconFrame";

interface Props {
  size: number;
}

export function SettingsIcon({ size }: Props) {
  return (
    <PixelIconFrame size={size}>
      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        <Feather name="settings" size={Math.round(size * 0.45)} color="#a1a1aa" />
      </View>
    </PixelIconFrame>
  );
}
