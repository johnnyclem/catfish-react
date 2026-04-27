/**
 * Safe Spot — Plants vs Zombies parody mini-game.
 *
 * Ports the user's `SafeSpot` draft mechanics:
 *
 *   - 5-column × 6-row tile grid. Tap a tile (with a tool selected
 *     and enough POM) to deploy a defender.
 *   - Currency: POM (starts at 150). Sanity meter (0..100); -10
 *     for each attacker that reaches the left edge.
 *   - Tools: Self Care (50 POM, 50 hp, generates POM), Mute Button
 *     (50 POM, 300 hp, blocker), Fact Check (100 POM, 80 hp, shoots
 *     logic projectiles), Seen Rect (175 POM, 80 hp, slows enemies).
 *   - Enemies: Energy Vampire (100 hp, fast, purple), Gaslighter
 *     (150 hp, slow, red). Spawn from the right at random rows.
 *   - Game loop is `requestAnimationFrame` driven; per-frame state
 *     lives in refs so React reconciliation is paid only at the
 *     ~30 Hz visual-tick rate.
 *   - "Wave" = 30s of survival. Best wave persists.
 *   - SFX: `swipe_pass` on tool place, `accuse` on game over,
 *     `match` on a new wave milestone.
 */
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useGameState } from "@/core/gameStore";
import { emitSfx } from "@/features/audio/audioEvents";

interface Props {
  onExit: () => void;
}

const ROWS = 6;
const COLS = 5;
const STARTING_POM = 150;
const STARTING_SANITY = 100;
const FRAME_MS = 100; // logical tick
const WAVE_TICKS = 300; // 30s @ 100ms ticks

type ToolId = "coffee" | "mute" | "fact" | "seen";
type EnemyId = "vampire" | "gaslighter";
type Phase = "READY" | "PLAYING" | "GAME_OVER";

interface Tool {
  id: ToolId;
  name: string;
  cost: number;
  hp: number;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
}

interface Enemy {
  uid: number;
  type: EnemyId;
  hp: number;
  maxHp: number;
  speed: number;
  color: string;
  row: number;
  x: number; // column-space, decreasing toward 0
  slowed: number; // ticks remaining
}

interface Defender {
  uid: number;
  type: ToolId;
  row: number;
  col: number;
  hp: number;
}

interface Projectile {
  uid: number;
  row: number;
  x: number; // column-space, increasing toward COLS
  type: ToolId;
}

const TOOLS: Tool[] = [
  { id: "coffee", name: "Self Care", cost: 50, hp: 50, icon: "coffee", color: "#f97316" },
  { id: "mute", name: "Mute Button", cost: 50, hp: 300, icon: "volume-x", color: "#a1a1aa" },
  { id: "fact", name: "Fact Check", cost: 100, hp: 80, icon: "shield", color: "#3b82f6" },
  { id: "seen", name: "Seen Rect", cost: 175, hp: 80, icon: "eye-off", color: "#a78bfa" },
];

const ENEMY_TYPES: Record<EnemyId, Pick<Enemy, "type" | "maxHp" | "hp" | "speed" | "color">> = {
  vampire: { type: "vampire", maxHp: 100, hp: 100, speed: 0.04, color: "#a78bfa" },
  gaslighter: { type: "gaslighter", maxHp: 150, hp: 150, speed: 0.025, color: "#f87171" },
};

let UID_COUNTER = 1;
function newUid(): number {
  UID_COUNTER += 1;
  return UID_COUNTER;
}

export function SafeSpot({ onExit }: Props) {
  const [phase, setPhase] = useState<Phase>("READY");
  const [pom, setPom] = useState(STARTING_POM);
  const [sanity, setSanity] = useState(STARTING_SANITY);
  const [wave, setWave] = useState(1);
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);

  const phaseRef = useRef<Phase>("READY");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const defendersRef = useRef<Defender[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const tickRef = useRef(0);
  const waveRef = useRef(1);
  const sanityRef = useRef(STARTING_SANITY);
  const pomRef = useRef(STARTING_POM);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const [, setRenderTick] = useState(0);
  const recordParodyScore = useGameState((s) => s.recordParodyScore);
  const bestWave = useGameState((s) => s.parody.safeSpotBestWave);

  const reset = useCallback(() => {
    defendersRef.current = [];
    enemiesRef.current = [];
    projectilesRef.current = [];
    tickRef.current = 0;
    waveRef.current = 1;
    sanityRef.current = STARTING_SANITY;
    pomRef.current = STARTING_POM;
    setPom(STARTING_POM);
    setSanity(STARTING_SANITY);
    setWave(1);
    setSelectedTool(null);
  }, []);

  const stepLogic = useCallback(() => {
    tickRef.current += 1;
    const t = tickRef.current;

    // Wave bookkeeping
    const newWave = Math.floor(t / WAVE_TICKS) + 1;
    if (newWave !== waveRef.current) {
      waveRef.current = newWave;
      setWave(newWave);
      emitSfx("match");
    }

    // Spawn — frequency rises slightly per wave.
    const spawnChance = 0.02 + Math.min(0.04, newWave * 0.005);
    if (Math.random() < spawnChance) {
      const ids: EnemyId[] = ["vampire", "gaslighter"];
      const id = ids[Math.floor(Math.random() * ids.length)] ?? "vampire";
      const proto = ENEMY_TYPES[id];
      enemiesRef.current = [
        ...enemiesRef.current,
        {
          uid: newUid(),
          type: proto.type,
          hp: proto.hp,
          maxHp: proto.maxHp,
          speed: proto.speed,
          color: proto.color,
          row: Math.floor(Math.random() * ROWS),
          x: COLS - 0.5,
          slowed: 0,
        },
      ];
    }

    // Self Care defenders generate POM occasionally
    for (const d of defendersRef.current) {
      if (d.type === "coffee" && Math.random() < 0.012) {
        pomRef.current = Math.min(999, pomRef.current + 25);
      }
    }
    setPom(pomRef.current);

    // Move enemies — enemies blocked by an in-row defender deal damage to it
    let breached = 0;
    enemiesRef.current = enemiesRef.current
      .map((e) => {
        const blocker = defendersRef.current.find(
          (d) => d.row === e.row && Math.abs(d.col - e.x) < 0.45,
        );
        if (blocker) {
          blocker.hp -= 1;
          return e;
        }
        const speed = e.slowed > 0 ? e.speed * 0.4 : e.speed;
        const slowed = e.slowed > 0 ? e.slowed - 1 : 0;
        const nextX = e.x - speed;
        if (nextX <= 0) {
          breached += 1;
          return null;
        }
        return { ...e, x: nextX, slowed };
      })
      .filter((e): e is Enemy => e !== null);
    defendersRef.current = defendersRef.current.filter((d) => d.hp > 0);

    if (breached > 0) {
      sanityRef.current = Math.max(0, sanityRef.current - 10 * breached);
      setSanity(sanityRef.current);
    }

    // Defenders fire projectiles
    for (const d of defendersRef.current) {
      if (d.type !== "fact" && d.type !== "seen") continue;
      const inLane = enemiesRef.current.some(
        (e) => e.row === d.row && e.x > d.col,
      );
      if (!inLane) continue;
      if (Math.random() < 0.06) {
        projectilesRef.current = [
          ...projectilesRef.current,
          { uid: newUid(), row: d.row, x: d.col + 0.5, type: d.type },
        ];
      }
    }

    // Move projectiles + collide
    projectilesRef.current = projectilesRef.current
      .map((p) => ({ ...p, x: p.x + 0.18 }))
      .filter((p) => p.x < COLS)
      .map((p) => {
        const hit = enemiesRef.current.find(
          (e) => e.row === p.row && Math.abs(e.x - p.x) < 0.4,
        );
        if (!hit) return p;
        if (p.type === "fact") {
          hit.hp -= 25;
        } else {
          hit.hp -= 10;
          hit.slowed = 30;
        }
        return null;
      })
      .filter((p): p is Projectile => p !== null);
    enemiesRef.current = enemiesRef.current.filter((e) => e.hp > 0);

    if (sanityRef.current <= 0) {
      emitSfx("accuse");
      void recordParodyScore("safeSpot", waveRef.current).then((bumped) => {
        if (bumped) emitSfx("match");
      });
      setPhase("GAME_OVER");
    }
  }, [recordParodyScore]);

  const tick = useCallback(
    (time: number) => {
      if (phaseRef.current === "PLAYING") {
        if (time - lastFrameRef.current >= FRAME_MS) {
          lastFrameRef.current = time;
          stepLogic();
          setRenderTick((v) => v + 1);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [stepLogic],
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  function placeDefender(row: number, col: number) {
    if (phase !== "PLAYING") return;
    if (!selectedTool) return;
    const tool = TOOLS.find((t) => t.id === selectedTool);
    if (!tool) return;
    if (pomRef.current < tool.cost) return;
    if (defendersRef.current.some((d) => d.row === row && d.col === col)) return;
    defendersRef.current = [
      ...defendersRef.current,
      { uid: newUid(), type: tool.id, row, col, hp: tool.hp },
    ];
    pomRef.current -= tool.cost;
    setPom(pomRef.current);
    emitSfx("swipe_pass");
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Safe Spot</Text>
          <View style={styles.sanityTrack}>
            <View
              style={[
                styles.sanityFill,
                { width: `${(sanity / STARTING_SANITY) * 100}%` },
              ]}
            />
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>WAVE</Text>
          <Text style={styles.headerValue}>{wave}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>POM</Text>
          <Text style={styles.headerValue}>{pom}</Text>
        </View>
      </View>

      <View style={styles.field}>
        {/* Tile grid (one Pressable per cell) */}
        <View style={styles.grid}>
          {Array.from({ length: ROWS }).map((_, r) => (
            <View key={r} style={styles.gridRow}>
              {Array.from({ length: COLS }).map((__, c) => (
                <Pressable
                  key={c}
                  testID={`safespot-tile-${r}-${c}`}
                  style={({ pressed }) => [
                    styles.gridCell,
                    pressed && { backgroundColor: "rgba(255,255,255,0.04)" },
                  ]}
                  onPress={() => placeDefender(r, c)}
                />
              ))}
            </View>
          ))}
        </View>

        {/* Defenders */}
        {defendersRef.current.map((d) => {
          const tool = TOOLS.find((t) => t.id === d.type);
          if (!tool) return null;
          return (
            <View
              key={d.uid}
              pointerEvents="none"
              style={[
                styles.entity,
                {
                  left: `${(d.col / COLS) * 100}%`,
                  top: `${(d.row / ROWS) * 100}%`,
                  width: `${100 / COLS}%`,
                  height: `${100 / ROWS}%`,
                },
              ]}
            >
              <View style={[styles.entityInner, { borderColor: tool.color }]}>
                <Feather name={tool.icon} size={18} color={tool.color} />
              </View>
            </View>
          );
        })}

        {/* Enemies */}
        {enemiesRef.current.map((e) => (
          <View
            key={e.uid}
            pointerEvents="none"
            style={[
              styles.entity,
              {
                left: `${(e.x / COLS) * 100}%`,
                top: `${(e.row / ROWS) * 100}%`,
                width: `${100 / COLS}%`,
                height: `${100 / ROWS}%`,
              },
            ]}
          >
            <View style={[styles.enemyBlob, { backgroundColor: e.color }]}>
              <Text style={styles.enemyTag}>
                {e.type === "vampire" ? "VAMP" : "GAS"}
              </Text>
            </View>
          </View>
        ))}

        {/* Projectiles */}
        {projectilesRef.current.map((p) => (
          <View
            key={p.uid}
            pointerEvents="none"
            style={[
              styles.projectile,
              {
                left: `${(p.x / COLS) * 100}%`,
                top: `${((p.row + 0.4) / ROWS) * 100}%`,
                backgroundColor: p.type === "fact" ? "#22e0ff" : "#a78bfa",
              },
            ]}
          />
        ))}
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        {TOOLS.map((tool) => {
          const selected = selectedTool === tool.id;
          const affordable = pom >= tool.cost;
          return (
            <Pressable
              key={tool.id}
              testID={`safespot-tool-${tool.id}`}
              onPress={() => setSelectedTool(tool.id)}
              style={({ pressed }) => [
                styles.toolBtn,
                selected && styles.toolBtnSelected,
                !affordable && { opacity: 0.4 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather
                name={tool.icon}
                size={18}
                color={selected ? "black" : tool.color}
              />
              <Text style={[styles.toolCost, selected && { color: "black" }]}>
                {tool.cost}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {phase === "READY" ? (
        <View style={styles.overlay}>
          <View style={styles.readyCard}>
            <Feather name="shield" size={48} color="#3b82f6" />
            <Text style={styles.readyTitle}>SAFE SPOT</Text>
            <Text style={styles.readyBody}>
              Best wave: {bestWave}
            </Text>
            <Pressable
              testID="safespot-start"
              onPress={() => {
                reset();
                setPhase("PLAYING");
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: "#3b82f6" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.primaryBtnLabel, { color: "white" }]}>
                DEPLOY BOUNDARIES
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === "GAME_OVER" ? (
        <View style={styles.overlay}>
          <Text style={styles.gameOverHeadline}>DRAINED</Text>
          <Text style={styles.gameOverBody}>
            Wave: {wave} · Best: {Math.max(bestWave, wave)}
          </Text>
          <Pressable
            testID="safespot-retry"
            onPress={() => {
              reset();
              setPhase("PLAYING");
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.primaryBtnLabel}>RETRY</Text>
          </Pressable>
          <Pressable
            testID="safespot-home"
            onPress={onExit}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.secondaryBtnLabel}>HOME</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#18181b",
    gap: 14,
  },
  title: {
    color: "#3b82f6",
    fontSize: 18,
    fontWeight: "900",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sanityTrack: {
    width: 96,
    height: 6,
    backgroundColor: "#27272a",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 6,
  },
  sanityFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerLabel: {
    color: "#52525b",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  headerValue: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    fontStyle: "italic",
  },
  field: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
  },
  gridCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  entity: {
    position: "absolute",
    padding: 6,
  },
  entityInner: {
    flex: 1,
    backgroundColor: "#18181b",
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  enemyBlob: {
    flex: 1,
    margin: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  enemyTag: {
    color: "white",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  projectile: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  toolbar: {
    flexDirection: "row",
    backgroundColor: "#09090b",
    borderTopWidth: 1,
    borderColor: "#27272a",
    padding: 10,
    gap: 8,
  },
  toolBtn: {
    flex: 1,
    aspectRatio: 1.4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  toolBtnSelected: {
    backgroundColor: "white",
    borderColor: "white",
  },
  toolCost: {
    color: "#a1a1aa",
    fontSize: 9,
    fontWeight: "800",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  readyCard: {
    backgroundColor: "#18181b",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 28,
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  readyTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  readyBody: {
    color: "#71717a",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  gameOverHeadline: {
    color: "#dc2626",
    fontSize: 56,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
    marginBottom: 16,
  },
  gameOverBody: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 24,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryBtnLabel: {
    color: "black",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  secondaryBtn: {
    width: "100%",
    backgroundColor: "#27272a",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnLabel: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
