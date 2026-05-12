/**
 * FaceTimeApp — video-call-style date interactions.
 *
 * Phase 9 surface: a pixel-noir "incoming FaceTime call" screen that
 * presents a character portrait with animated call UI, scripted
 * dialogue lines, and choice buttons that advance the conversation.
 *
 * Each FaceTime call reveals 1 fact. Calls are scheduled by
 * `advanceDay()` when a match reaches the affinity threshold or
 * day gate. The player can accept (enter the call) or decline
 * (character calls back next day).
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import type { FacetimeCall } from "@/core/models";

interface CallScriptLine {
  text: string;
  /** Optional choice buttons that follow this line. */
  choices?: Array<{ label: string; nextIndex: number }>;
  /** If set, this line commits a fact to the journal. */
  commitsFact?: {
    factId: string;
    quote: string;
    candidateId: string;
  };
}

interface CallScript {
  candidateId: string;
  characterName: string;
  portraitExpression: string;
  lines: CallScriptLine[];
  closingLine: string;
}

/** Pre-authored FaceTime call scripts keyed by character. */
const FACEBOOK_CALLS: Record<string, CallScript> = {
  miles: {
    candidateId: "miles",
    characterName: "Miles",
    portraitExpression: "nervous",
    lines: [
      {
        text: "Hey — thanks for picking up. I've been thinking about what happened at the warehouse.",
        choices: [
          { label: "What did you see?", nextIndex: 1 },
          { label: "Are you okay?", nextIndex: 1 },
        ],
      },
      {
        text: "I wasn't there that night. I swear. But... I heard something. On my way home.",
        choices: [
          { label: "What did you hear?", nextIndex: 2 },
          { label: "Why didn't you come forward?", nextIndex: 2 },
        ],
      },
      {
        text: "Voices near the canal. Two people. One of them — I recognized the laugh. It was someone from the app.",
        commitsFact: {
          factId: "miles_canal_voices",
          quote: "Miles claims he heard two voices near the canal on the night of the fire, including one he recognized from the dating app.",
          candidateId: "miles",
        },
        choices: [{ label: "Who was it?", nextIndex: 3 }],
      },
      {
        text: "I can't say for certain. Not yet. But I've been watching, and I'm careful.",
        choices: [{ label: "Stay safe.", nextIndex: 4 }, { label: "Tell me more.", nextIndex: 4 }],
      },
    ],
    closingLine: "I'll figure it out. Just... be careful who you trust.",
  },
  jules: {
    candidateId: "jules",
    characterName: "Jules",
    portraitExpression: "guarded",
    lines: [
      {
        text: "You picked up. Good. I wasn't sure you would.",
        choices: [
          { label: "What's going on?", nextIndex: 1 },
          { label: "You sound different.", nextIndex: 1 },
        ],
      },
      {
        text: "The bar was closed by ten. I have witnesses for that. But after... I went somewhere private.",
        choices: [
          { label: "Where did you go?", nextIndex: 2 },
          { label: "Why does it matter?", nextIndex: 2 },
        ],
      },
      {
        text: "I don't owe anyone an explanation. But I'm going to say it anyway — I was at home. Alone.",
        commitsFact: {
          factId: "jules_alibi_claim",
          quote: "Jules claims he was home alone after the bar closed, contradicting what witnesses might say about his whereabouts.",
          candidateId: "jules",
        },
        choices: [{ label: "Should I believe you?", nextIndex: 3 }],
      },
      {
        text: "Believe what you want. But I didn't do this.",
        choices: [{ label: "I believe you.", nextIndex: 4 }, { label: "Prove it.", nextIndex: 4 }],
      },
    ],
    closingLine: "I've said what I needed to say.",
  },
  tessa: {
    candidateId: "tessa",
    characterName: "Tessa",
    portraitExpression: "uneasy",
    lines: [
      {
        text: "Hey. This isn't about us — it's about something I saw at the station.",
        choices: [
          { label: "What did you see?", nextIndex: 1 },
          { label: "Are you in trouble?", nextIndex: 1 },
        ],
      },
      {
        text: "I wasn't on air Tuesday. The station ran a pre-record. I told some people I was working — but I wasn't.",
        commitsFact: {
          factId: "tessa_missing_night",
          quote: "Tessa admits she was not actually working at the station on Tuesday night, despite claiming otherwise to friends.",
          candidateId: "tessa",
        },
        choices: [{ label: "Where were you really?", nextIndex: 2 }],
      },
      {
        text: "I was dealing with something personal. I don't want to talk about it.",
        choices: [
          { label: "I understand.", nextIndex: 3 },
          { label: "This could affect the case.", nextIndex: 3 },
        ],
      },
      {
        text: "My personal stuff has nothing to do with this. Just — watch your back.",
        choices: [{ label: "You too.", nextIndex: 4 }],
      },
    ],
    closingLine: "I have to go. Stay safe out there.",
  },
  ren: {
    candidateId: "ren",
    characterName: "Ren",
    portraitExpression: "evasive",
    lines: [
      {
        text: "I'm on the water most mornings. You know that. But lately I've been watching things I shouldn't.",
        choices: [
          { label: "Watching what?", nextIndex: 1 },
          { label: "What do you mean?", nextIndex: 1 },
        ],
      },
      {
        text: "The marina activity logs. They don't match what people are saying about their schedules.",
        commitsFact: {
          factId: "ren_marina_discrepancy",
          quote: "Ren has been tracking marina logs and noticed that departure times don't match what people claim publicly.",
          candidateId: "ren",
        },
        choices: [{ label: "Who is lying?", nextIndex: 2 }],
      },
      {
        text: "Everyone's got something they're not saying. I'm not different.",
        choices: [
          { label: "Are you involved?", nextIndex: 3 },
          { label: "I won't judge.", nextIndex: 3 },
        ],
      },
      {
        text: "Just watch the water. Something's off out there.",
        choices: [{ label: "Be careful.", nextIndex: 4 }],
      },
    ],
    closingLine: "The water remembers everything.",
  },
  kai: {
    candidateId: "kai",
    characterName: "Kai",
    portraitExpression: "tense",
    lines: [
      {
        text: "I know what people think about me. The mural, the late nights — it looks a certain way.",
        choices: [
          { label: "What are you saying?", nextIndex: 1 },
          { label: "You seem nervous.", nextIndex: 1 },
        ],
      },
      {
        text: "The transit lot is fenced off. Has been for weeks. I wasn't painting there on Tuesday.",
        commitsFact: {
          factId: "kai_transit_alibi",
          quote: "Kai states he was NOT at the transit lot on Tuesday despite his alibi — the lot has been fenced off all month.",
          candidateId: "kai",
        },
        choices: [{ label: "Then where were you?", nextIndex: 2 }],
      },
      {
        text: "That's my business. But I was somewhere — I just can't prove it.",
        choices: [
          { label: "That doesn't look good.", nextIndex: 3 },
          { label: "I'll keep an open mind.", nextIndex: 3 },
        ],
      },
      {
        text: "Judge me when you have the full picture. Not before.",
        choices: [{ label: "I hear you.", nextIndex: 4 }],
      },
    ],
    closingLine: "The truth's messier than it looks.",
  },
  delphine: {
    candidateId: "delphine",
    characterName: "Delphine",
    portraitExpression: "controlled",
    lines: [
      {
        text: "My shop has cameras. I know because I installed them myself.",
        choices: [
          { label: "What did they show?", nextIndex: 1 },
          { label: "Are they working?", nextIndex: 1 },
        ],
      },
      {
        text: "The footage is clean. I opened at seven AM as usual. But someone accessed my system logs remotely.",
        commitsFact: {
          factId: "delphine_system_access",
          quote: "Delphine says her shop's system logs show a remote access attempt the night of the fire — someone trying to cover their tracks.",
          candidateId: "delphine",
        },
        choices: [{ label: "Who accessed it?", nextIndex: 2 }],
      },
      {
        text: "I don't know yet. But whoever it was knew my schedule.",
        choices: [
          { label: "That's concerning.", nextIndex: 3 },
          { label: "Can you trace it?", nextIndex: 3 },
        ],
      },
      {
        text: "I'm handling it. The city's smaller than people think.",
        choices: [{ label: "Stay safe.", nextIndex: 4 }],
      },
    ],
    closingLine: "Somebody's watching. Maybe more than one.",
  },
  river: {
    candidateId: "river",
    characterName: "River",
    portraitExpression: "distant",
    lines: [
      {
        text: "Solo hiking is what I do. But last Sunday — it wasn't solo.",
        choices: [
          { label: "Who was with you?", nextIndex: 1 },
          { label: "What happened?", nextIndex: 1 },
        ],
      },
      {
        text: "Someone from the app. We met at the trailhead. It wasn't a date — it was something else.",
        commitsFact: {
          factId: "river_trailhead_meeting",
          quote: "River admits he met someone from the dating app at the gorge trailhead on Sunday — not a casual hike.",
          candidateId: "river",
        },
        choices: [{ label: "Who was it?", nextIndex: 2 }],
      },
      {
        text: "I can't say. Not yet. But it wasn't random. They were watching someone.",
        choices: [
          { label: "Watching who?", nextIndex: 3 },
          { label: "This is important.", nextIndex: 3 },
        ],
      },
      {
        text: "The gorge has sight lines to the whole valley. If you know where to look.",
        choices: [{ label: "I understand.", nextIndex: 4 }],
      },
    ],
    closingLine: "The rock doesn't keep secrets. People do.",
  },
  sam: {
    candidateId: "sam",
    characterName: "Sam",
    portraitExpression: "worried",
    lines: [
      {
        text: "Badge swipes are public record. I didn't think anyone would look.",
        choices: [
          { label: "What did the records show?", nextIndex: 1 },
          { label: "What are you hiding?", nextIndex: 1 },
        ],
      },
      {
        text: "Two hours. Offsite. I was dealing with something that had nothing to do with work.",
        commitsFact: {
          factId: "sam_offsite_badge",
          quote: "Sam's badge records show a 2-hour offsite gap during her claimed shift — she's aware the records are now public.",
          candidateId: "sam",
        },
        choices: [{ label: "Where did you go?", nextIndex: 2 }],
      },
      {
        text: "Personal. I shouldn't have to explain myself. But I see how this looks.",
        choices: [
          { label: "It doesn't look great.", nextIndex: 3 },
          { label: "I won't jump to conclusions.", nextIndex: 3 },
        ],
      },
      {
        text: "Just — the badge data doesn't tell the whole story.",
        choices: [{ label: "I hear you.", nextIndex: 4 }],
      },
    ],
    closingLine: "Sometimes the facts make people look worse than they are.",
  },
};

const SCRIPT_KEYS = Object.keys(FACEBOOK_CALLS);

function animateBars(bars: number[]): number[] {
  return bars.map((b) => Math.max(1, b + Math.floor(Math.random() * 4) - 2));
}

function VoiceBars({ active }: { active: boolean }) {
  const [heights, setHeights] = useState([3, 5, 4, 6, 3]);

  useState(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setHeights(animateBars);
    }, 150);
    return () => clearInterval(interval);
  });

  return (
    <View style={styles.voiceBars}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={[
            styles.voiceBar,
            { height: h * 3 },
          ]}
        />
      ))}
    </View>
  );
}

function CallScreen({
  call,
  script,
  onDone,
}: {
  call: FacetimeCall;
  script: CallScript;
  onDone: () => void;
}) {
  const commitFact = useGameState((s) => s.commitFact);
  const [lineIndex, setLineIndex] = useState(0);
  const [showChoices, setShowChoices] = useState(false);

  const line = script.lines[lineIndex];
  const isDone = !line;

  if (isDone) {
    return (
      <View style={styles.callRoot}>
        <ScanlineOverlay />
        <View style={styles.callPortrait}>
          <View style={styles.portraitFrame}>
            <PixelText size={24} color={cfPalette.iron} style={{ textAlign: "center" }}>
              {script.characterName.slice(0, 1)}
            </PixelText>
          </View>
          <PixelText size={12} color={cfPalette.bone} style={{ marginTop: 12 }}>
            {script.characterName}
          </PixelText>
          <PixelText size={7} color={cfPalette.fog} style={{ marginTop: 4 }}>
            {script.portraitExpression}
          </PixelText>
        </View>

        <View style={styles.closingLine}>
          <PixelText size={9} color={cfPalette.bone} align="center">
            {script.closingLine}
          </PixelText>
        </View>

        <Pressable onPress={onDone} style={styles.endCallBtn}>
          <PixelText size={8} color={cfPalette.bone}>
            end call
          </PixelText>
        </Pressable>
      </View>
    );
  }

  function handleChoice(nextIndex: number) {
    if (line.commitsFact) {
      void commitFact({
        candidateId: line.commitsFact!.candidateId,
        quote: line.commitsFact!.quote,
      });
    }
    if (line.choices) {
      setLineIndex(nextIndex);
      setShowChoices(false);
    }
  }

  function handleNext() {
    if (line.commitsFact) {
      void commitFact({
        candidateId: line.commitsFact!.candidateId,
        quote: line.commitsFact!.quote,
      });
    }
    if (line.choices) {
      setShowChoices(true);
    } else {
      setLineIndex((prev) => prev + 1);
    }
  }

  return (
    <View style={styles.callRoot}>
      <ScanlineOverlay />
      <View style={styles.glitchOverlay}>
        <View style={styles.callPortrait}>
          <View style={styles.portraitFrame}>
            <PixelText size={24} color={cfPalette.iron} style={{ textAlign: "center" }}>
              {script.characterName.slice(0, 1)}
            </PixelText>
          </View>
          <PixelText size={12} color={cfPalette.bone} style={{ marginTop: 12 }}>
            {script.characterName}
          </PixelText>
          <PixelText size={7} color={cfPalette.fog} style={{ marginTop: 4 }}>
            calling...
          </PixelText>
        </View>

        <View style={styles.voiceBarContainer}>
          <VoiceBars active={true} />
        </View>
      </View>

      <View style={styles.scriptArea}>
        <PixelText size={8} color={cfPalette.bone} align="center" style={styles.speakerName}>
          {script.characterName}
        </PixelText>
        <PixelText size={7} color={cfPalette.ash} align="center" style={{ marginTop: 4 }}>
          {line.text}
        </PixelText>
      </View>

      {showChoices && line.choices ? (
        <View style={styles.choicesArea}>
          {line.choices.map((c) => (
            <Pressable
              key={c.label}
              onPress={() => handleChoice(c.nextIndex)}
              style={styles.choiceBtn}
            >
              <PixelText size={7} color={cfPalette.navyDeep}>
                {c.label}
              </PixelText>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable onPress={handleNext} style={styles.continueBtn}>
          <PixelText size={7} color={cfPalette.fog}>
            tap to continue
          </PixelText>
        </Pressable>
      )}
    </View>
  );
}

export function FaceTimeApp() {
  const run = useGameState((s) => s.run);
  const [activeCall, setActiveCall] = useState<FacetimeCall | null>(null);
  const [dismissedCalls, setDismissedCalls] = useState<Set<string>>(new Set());
  const [incomingCall, setIncomingCall] = useState<{ call: FacetimeCall; script: CallScript } | null>(
    null,
  );

  const pendingCalls = run?.pendingFacetimeCalls ?? [];

  function pickScript(candidateId: string): CallScript {
    return FACEBOOK_CALLS[candidateId] ?? FACEBOOK_CALLS[SCRIPT_KEYS[0]!];
  }

  if (activeCall) {
    const script = pickScript(activeCall.candidateId);
    return <CallScreen call={activeCall} script={script} onDone={() => setActiveCall(null)} />;
  }

  if (incomingCall) {
    const { call, script } = incomingCall;
    return (
      <View style={styles.callRoot}>
        <ScanlineOverlay />
        <View style={styles.ringingOverlay}>
          <View style={styles.portraitFrame}>
            <PixelText size={32} color={cfPalette.iron} style={{ textAlign: "center" }}>
              {script.characterName.slice(0, 1)}
            </PixelText>
          </View>
          <PixelText size={14} color={cfPalette.bone} style={{ marginTop: 16 }}>
            {script.characterName}
          </PixelText>
          <PixelText size={8} color={cfPalette.fog} style={{ marginTop: 6 }}>
            incoming video call...
          </PixelText>

          <View style={styles.ringingActions}>
            <Pressable
              onPress={() => {
                setActiveCall(call);
                setIncomingCall(null);
              }}
              style={styles.acceptBtn}
            >
              <PixelText size={8} color={cfPalette.bone}>
                accept
              </PixelText>
            </Pressable>
            <Pressable
              onPress={() => {
                setDismissedCalls((prev) => new Set([...prev, call.id]));
                setIncomingCall(null);
              }}
              style={styles.declineBtn}
            >
              <PixelText size={8} color={cfPalette.bone}>
                decline
              </PixelText>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const upcomingCalls = pendingCalls.filter((c) => !dismissedCalls.has(c.id));

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <PixelText size={11} color={cfPalette.bone}>
          FaceTime
        </PixelText>
      </View>

      {upcomingCalls.length === 0 ? (
        <View style={styles.emptyState}>
          <PixelText size={8} color={cfPalette.ash} align="center">
            no pending calls
          </PixelText>
          <PixelText size={6} color={cfPalette.fog} align="center" style={{ marginTop: 8 }}>
            match with someone to receive a video call
          </PixelText>
        </View>
      ) : (
        <View style={styles.callList}>
          <PixelText size={6} color={cfPalette.ash} style={styles.callListLabel}>
            incoming
          </PixelText>
          {upcomingCalls.map((call) => {
            const script = pickScript(call.candidateId);
            return (
              <Pressable
                key={call.id}
                onPress={() => setIncomingCall({ call, script })}
                style={styles.callRow}
              >
                <View style={[styles.callRowAvatar, { backgroundColor: cfPalette.purple }]}>
                  <PixelText size={10} color={cfPalette.bone}>
                    {script.characterName.slice(0, 1)}
                  </PixelText>
                </View>
                <View style={{ flex: 1 }}>
                  <PixelText size={8} color={cfPalette.bone}>
                    {script.characterName}
                  </PixelText>
                  <PixelText size={6} color={cfPalette.cyan} style={{ marginTop: 2 }}>
                    video call
                  </PixelText>
                </View>
                <PixelText size={6} color={cfPalette.ash}>
                  tap to view
                </PixelText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.iron,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  callList: {
    padding: 12,
  },
  callListLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
    gap: 12,
  },
  callRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  callRoot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  glitchOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ringingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  portraitFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: cfPalette.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBarContainer: {
    position: "absolute",
    bottom: 200,
    left: "50%",
    transform: [{ translateX: -30 }],
  },
  voiceBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 30,
  },
  voiceBar: {
    width: 4,
    backgroundColor: cfPalette.cyan,
    borderRadius: 2,
  },
  callPortrait: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  scriptArea: {
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
    marginHorizontal: 16,
    borderRadius: 8,
  },
  speakerName: {
    marginBottom: 8,
  },
  closingLine: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  choicesArea: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 20,
    justifyContent: "center",
  },
  choiceBtn: {
    backgroundColor: cfPalette.cyan,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  continueBtn: {
    alignItems: "center",
    padding: 16,
  },
  endCallBtn: {
    alignSelf: "center",
    backgroundColor: cfPalette.pinkHot,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 40,
  },
  ringingActions: {
    flexDirection: "row",
    gap: 24,
    marginTop: 40,
  },
  acceptBtn: {
    backgroundColor: cfPalette.greenBright,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 8,
  },
  declineBtn: {
    backgroundColor: cfPalette.pinkHot,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 8,
  },
});