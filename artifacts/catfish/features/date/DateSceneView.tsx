/**
 * DateSceneView — visual surface for date mode.
 *
 * Renders a character sprite over an environment background with
 * a dialogue/choice overlay. Implements the Focus Shift transition
 * (standard ↔ firstPerson camera) triggered by the director.
 *
 * Visual spec: "16-bit JRPG cutscene crossed with FaceTime intimacy."
 * Static character sprite over scene background with first-person
 * framing mode for high-tension moments (focusShift beats).
 *
 * Mounting: rendered by the PhoneOS shell when a date is active.
 * Unmounts and returns to App mode when the director fires onEnd.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { useAudioPlayer } from "expo-audio";
import { AssetImage } from "@/components/AssetImage";
import { PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import {
  DateDirector,
  DateSceneError,
} from "@/core/dateDirector";
import {
  CameraMode,
  DateMusicMode,
  DateScene,
  EnvironmentId,
  ExpressionState,
  ResolvedBeat,
} from "@/core/dateScene";
import { useGameState } from "@/core/gameStore";
import { getAudioAsset, audioKey } from "@/assets/audioManifest";
import { getVoiceForCharacterKey } from "@/core/voiceProfiles";
import { getCachedVoiceClip } from "@/core/voicePreload";
import { emitSfx } from "@/features/audio/audioEvents";
import type { AssetId } from "@/assets/manifest";

/* ─────────────── Environment backgrounds ─────────────── */

const ENVIRONMENTS: Record<EnvironmentId, string> = {
  env_coffee_shop_day: "env_coffee_shop_day",
  env_coffee_shop_night: "env_coffee_shop_night",
  env_restaurant: "env_restaurant",
  env_park: "env_park",
  env_bar: "env_bar",
  env_apartment: "env_apartment",
  env_lantern: "env_lantern",
};

/* ─────────────── Portrait assets ─────────────── */

const PORTRAIT_BASE: Record<string, string> = {
  kai: "A043_kai_portrait_smile",
  miles: "A035_miles_portrait_smile",
  jules: "A047_jules_portrait_smile",
  river: "A055_river_portrait_smile",
  sam: "A059_sam_portrait_smile",
  tessa: "A500_avatar_placeholder",
  ren: "A500_avatar_placeholder",
  delphine: "A500_avatar_placeholder",
};

const EXPRESSION_OVERLAY: Record<ExpressionState, string> = {
  neutral: "neutral",
  neutral_saintmask: "neutral_saintmask",
  smile: "smile",
  flirty: "flirty",
  curious: "curious",
  uneasy: "uneasy",
  sinister: "sinister",
};

function portraitAssetId(
  character: string,
  expression: ExpressionState,
): string {
  const base = PORTRAIT_BASE[character] ?? "A500_avatar_placeholder";
  if (expression === "neutral") return base;
  const suffix = expression.replace("neutral_saintmask", "neutral_smt");
  return base.replace("_portrait_smile", `_portrait_${suffix}`);
}

/* ─────────────── Camera transition ─────────────── */

const FOCUS_SHIFT_DURATION_MS = 400;

function useCameraAnimation(
  mode: CameraMode,
  onTick: (scale: number, opacity: number) => void,
) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: mode === "firstPerson" ? 1 : 0,
      duration: FOCUS_SHIFT_DURATION_MS,
      useNativeDriver: true,
    }).start();
    const id = anim.addListener(({ value }) => {
      const scale = 1 + value * 0.15;
      const opacity = 1 - value * 0.1;
      onTick(scale, opacity);
    });
    return () => anim.removeListener(id);
  }, [mode, anim, onTick]);

  return anim;
}

/* ─────────────── Voice playback ─────────────── */

/**
 * Resolve the voice line key components from a voiceLineID.
 * voiceLineIDs in scene JSON look like: "kai_coffee_greeting_warm"
 * audioManifest keys look like: "kai_kai_drink_0"
 * We parse the character key and use the rest as the beat key prefix.
 */
function parseVoiceLineId(id: string): { characterKey: string; beatKey: string } {
  const parts = id.split("_");
  const characterKey = parts[0] ?? "kai";
  const beatKey = parts.slice(1).join("_");
  return { characterKey, beatKey };
}

function useVoicePlayer(partner: string) {
  const playerRef = useRef<ReturnType<typeof useAudioPlayer> | null>(null);
  const [voiceState, setVoiceState] = useState<{ playing: boolean; lineId: string | null }>({ playing: false, lineId: null });
  const voiceMuted = useGameState((s) => s.voiceMuted);
  const abortRef = useRef<AbortController | null>(null);

  const getPlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = useAudioPlayer();
    }
    return playerRef.current;
  }, []);

  const stop = useCallback(() => {
    try {
      abortRef.current?.signal.throwIfAborted();
    } catch {
      // already aborted — ignore
    }
    abortRef.current = null;
    try {
      getPlayer().pause();
    } catch {
      /* idle player */
    }
    setVoiceState({ playing: false, lineId: null });
  }, [getPlayer]);

  const play = useCallback(
    async (lineId: string) => {
      if (voiceMuted || !lineId) return;

      // Cancel any in-flight playback for this line.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      const { characterKey } = parseVoiceLineId(lineId);
      const profile = getVoiceForCharacterKey(characterKey);
      if (!profile) return;

      setVoiceState({ playing: true, lineId });

      try {
        // 1. Hot path — pre-generated bundled clip from audioManifest.
        const baked = getAudioAsset(audioKey(characterKey, lineId, 0));
        if (baked !== undefined) {
          const player = getPlayer();
          player.replace(baked as Parameters<typeof player.replace>[0]);
          player.play();
          setVoiceState({ playing: false, lineId: null });
          return;
        }

        // 2. Cache + live TTS via voicePreload.
        const uri = await getCachedVoiceClip(
          lineId,
          lineId, // text is the lineId as a stable key for pre-gen fallbacks
          profile,
          signal,
        );
        if (!uri || signal.aborted) return;

        const player = getPlayer();
        player.replace({ uri } as Parameters<typeof player.replace>[0]);
        player.play();
        setVoiceState({ playing: false, lineId: null });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (__DEV__) console.warn("[voice] playback failed for", lineId, err);
        setVoiceState({ playing: false, lineId: null });
      }
    },
    [voiceMuted, getPlayer],
  );

  return { state: voiceState, play, stop };
}

/* ─────────────── Dialogue box ─────────────── */

interface DialogueBoxProps {
  text: string;
  voiceLineID?: string | null;
  onAdvance: () => void;
}

function DialogueBox({ text, voiceLineID, onAdvance }: DialogueBoxProps) {
  const [spoken, setSpoken] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setSpoken("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setSpoken(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <Pressable onPress={onAdvance} style={styles.dialogueWrap}>
      <View style={styles.dialogueBubble}>
        <PixelText size={9} color={cfPalette.bone} style={styles.dialogueText}>
          {spoken}
          {!done && <PixelText size={9} color={cfPalette.bone}>▌</PixelText>}
        </PixelText>
        {done && (
          <PixelText
            size={6}
            color={cfPalette.ash}
            style={styles.dialogueHint}
          >
            tap to continue
          </PixelText>
        )}
      </View>
    </Pressable>
  );
}

/* ─────────────── Choice grid ─────────────── */

interface ChoiceGridProps {
  choices: Array<{ id: string; label: string }>;
  onSelect: (choiceId: string) => void;
}

function ChoiceGrid({ choices, onSelect }: ChoiceGridProps) {
  return (
    <View style={styles.choiceWrap}>
      {choices.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onSelect(c.id)}
          style={({ pressed }) => [
            styles.choiceBtn,
            pressed && styles.choiceBtnPressed,
          ]}
        >
          <PixelText size={8} color={cfPalette.bone} align="center">
            {c.label}
          </PixelText>
        </Pressable>
      ))}
    </View>
  );
}

/* ─────────────── Main view ─────────────── */

interface DateSceneViewProps {
  scene: DateScene;
  onDateEnd: (outcome: unknown) => void;
}

/**
 * DateSceneView — mounts when a date is active, unmounts on date end.
 *
 * Hosts the visual layer (character sprite + environment), dialogue UI,
 * and choice buttons. Drives the DateDirector for beat sequencing.
 *
 * Layout contract:
 *   - Top 65%: character sprite over environment background
 *   - Bottom 35%: dialogue bubble + choice grid
 *
 * Focus Shift: when `cameraMode` flips to `firstPerson`, the character
 * region scales up 15% with a subtle overlay effect (0.4s CRT-style
 * flash reuse from the swipe deck's fx_glitch_overlay).
 */
export function DateSceneView({ scene, onDateEnd }: DateSceneViewProps) {
  const run = useGameState((s) => s.run);
  const directorRef = useRef<DateDirector | null>(null);
  const [currentBeat, setCurrentBeat] = useState<ResolvedBeat | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("standard");
  const [musicMode, setMusicMode] = useState<DateMusicMode>("warm");
  const [sceneScale, setSceneScale] = useState(1);
  const [sceneOpacity, setSceneOpacity] = useState(1);
  const [showTyping, setShowTyping] = useState(false);
  const { state: voiceState, play: playVoice } = useVoicePlayer(scene.partner);

  const onTick = useCallback((scale: number, opacity: number) => {
    setSceneScale(scale);
    setSceneOpacity(opacity);
  }, []);

  useCameraAnimation(cameraMode, onTick);

  useEffect(() => {
    if (!run) return;
    const director = new DateDirector({
      scene,
      runId: run.id,
      killerId: run.killer,
      onBeatResolved: (beat) => {
        setCurrentBeat(beat);
        if (beat.voiceLineID) {
          void playVoice(beat.voiceLineID);
        }
      },
      onCameraChange: (mode) => setCameraMode(mode),
      onMusicModeChange: (mode) => setMusicMode(mode),
      onDiscover: (factId) => {
        useGameState.getState().commitFact({
          candidateId: scene.partner,
          quote: `[Date clue] ${factId}`,
        });
      },
      onEnd: (outcome) => {
        onDateEnd(outcome);
      },
    });
    directorRef.current = director;

    const initial = director.start();
    setCurrentBeat(initial);
    if (initial.voiceLineID) {
      void playVoice(initial.voiceLineID);
    }

    return () => {
      directorRef.current = null;
    };
  }, [run, scene, playVoice, onDateEnd]);

  const handleChoiceSelect = useCallback(
    (choiceId: string) => {
      const director = directorRef.current;
      if (!director || !currentBeat?.choices) return;
      const choice = currentBeat.choices.find((c) => c.id === choiceId);
      if (!choice) return;
      emitSfx("choiceSelect");
      try {
        const next = director.selectChoice(choice);
        setCurrentBeat(next);
        if (next.voiceLineID) void playVoice(next.voiceLineID);
      } catch (e) {
        if (e instanceof DateSceneError && e.message.includes("complete")) {
          return;
        }
        throw e;
      }
    },
    [currentBeat, playVoice],
  );

  const handleAdvance = useCallback(() => {
    const director = directorRef.current;
    if (!director) return;
    if (voiceState.playing) return;
    try {
      const next = director.advance();
      setCurrentBeat(next);
      if (next.voiceLineID) void playVoice(next.voiceLineID);
    } catch (e) {
      if (e instanceof DateSceneError && e.message.includes("no more beats")) {
        return;
      }
      throw e;
    }
  }, [voiceState.playing, playVoice]);

  const handleCutShort = useCallback(() => {
    const director = directorRef.current;
    if (!director) return;
    emitSfx("dateEnd");
    director.cutShort();
  }, []);

  const partner = scene.partner;
  const expression = currentBeat?.expression ?? "neutral";
  const portraitId = portraitAssetId(partner, expression);
  const envId = ENVIRONMENTS[scene.environment] ?? "env_coffee_shop_day";

  return (
    <View style={styles.root}>
      {/* Environment + character layer */}
      <Animated.View
        style={[
          styles.sceneRegion,
          {
            transform: [{ scale: sceneScale }],
            opacity: sceneOpacity,
          },
        ]}
      >
        <AssetImage
          id={envId as AssetId}
          style={styles.envBackground}
          resizeMode="cover"
        />
        <View style={styles.characterLayer}>
          <AssetImage
            id={portraitId as AssetId}
            style={styles.characterSprite}
            resizeMode="contain"
          />
          {expression === "uneasy" && (
            <View style={styles.uneaseOverlay} />
          )}
        </View>
        {cameraMode === "firstPerson" && (
          <View style={styles.focusShiftOverlay} />
        )}
      </Animated.View>

      {/* Dialogue / choice UI */}
      <View style={styles.uiLayer}>
        {currentBeat?.type === "choice" && currentBeat.choices ? (
          <ChoiceGrid
            choices={currentBeat.choices}
            onSelect={handleChoiceSelect}
          />
        ) : (
          currentBeat && (
            <DialogueBox
              text={currentBeat.text ?? "..."}
              voiceLineID={currentBeat.voiceLineID}
              onAdvance={handleAdvance}
            />
          )
        )}

        <Pressable onPress={handleCutShort} style={styles.leaveBtn}>
          <PixelText size={6} color={cfPalette.ash}>
            leave the date
          </PixelText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.void,
  },
  sceneRegion: {
    flex: 0.65,
    position: "relative",
  },
  envBackground: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  characterLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  characterSprite: {
    width: "60%",
    height: "80%",
  },
  uneaseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  focusShiftOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: cfPalette.pinkHot,
    opacity: 0.3,
  },
  uiLayer: {
    flex: 0.35,
    justifyContent: "flex-end",
    padding: 12,
    gap: 12,
  },
  dialogueWrap: {
    flex: 1,
    justifyContent: "center",
  },
  dialogueBubble: {
    backgroundColor: cfPalette.panel,
    borderWidth: 2,
    borderColor: cfPalette.purple,
    padding: 12,
    minHeight: 80,
  },
  dialogueText: {
    lineHeight: 15,
  },
  dialogueHint: {
    marginTop: 8,
    textAlign: "right",
  },
  choiceWrap: {
    gap: 8,
  },
  choiceBtn: {
    backgroundColor: cfPalette.panel,
    borderWidth: 2,
    borderColor: cfPalette.purple,
    padding: 12,
    alignItems: "center",
  },
  choiceBtnPressed: {
    backgroundColor: cfPalette.panelHi,
    borderColor: cfPalette.pinkHot,
  },
  leaveBtn: {
    alignSelf: "center",
    padding: 8,
  },
});