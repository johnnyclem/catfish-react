export type SfxName =
  | "swipe_pass"
  | "swipe_like"
  | "swipe_left"
  | "swipe_right"
  | "match"
  | "match_first_message_tone"
  | "fact_filed"
  | "day_end"
  | "day_advance"
  | "accuse"
  | "win"
  | "lose"
  | "focusShift"
  | "clueDiscovered"
  | "choiceSelect"
  | "dateEnd"
  | "tab_switch"
  | "app_open"
  | "app_close"
  | "back_button"
  | "evidence_link"
  | "accusation_correct"
  | "accusation_wrong"
  | "phone_buzz"
  | "notification_chime"
  | "message_send"
  | "message_receive";

const SFX_MANIFEST: Record<SfxName, number | object> = {
  swipe_pass: require("@/assets/audio/sfx/swipe_pass.wav"),
  swipe_like: require("@/assets/audio/sfx/swipe_like.wav"),
  swipe_left: require("@/assets/audio/sfx/swipe_left.wav"),
  swipe_right: require("@/assets/audio/sfx/swipe_like.wav"),
  match: require("@/assets/audio/sfx/match.wav"),
  match_first_message_tone: require("@/assets/audio/sfx/match_first_message_tone.wav"),
  fact_filed: require("@/assets/audio/sfx/fact_filed.wav"),
  day_end: require("@/assets/audio/sfx/day_end.wav"),
  day_advance: require("@/assets/audio/sfx/day_advance.wav"),
  accuse: require("@/assets/audio/sfx/accuse.wav"),
  win: require("@/assets/audio/sfx/win.wav"),
  lose: require("@/assets/audio/sfx/lose.wav"),
  focusShift: require("@/assets/audio/sfx/focusShift.wav"),
  clueDiscovered: require("@/assets/audio/sfx/clueDiscovered.wav"),
  choiceSelect: require("@/assets/audio/sfx/choiceSelect.wav"),
  dateEnd: require("@/assets/audio/sfx/dateEnd.wav"),
  tab_switch: require("@/assets/audio/sfx/tab_switch.wav"),
  app_open: require("@/assets/audio/sfx/app_open.wav"),
  app_close: require("@/assets/audio/sfx/app_close.wav"),
  back_button: require("@/assets/audio/sfx/back_button.wav"),
  evidence_link: require("@/assets/audio/sfx/evidence_link.wav"),
  accusation_correct: require("@/assets/audio/sfx/accusation_correct.wav"),
  accusation_wrong: require("@/assets/audio/sfx/accusation_wrong.wav"),
  phone_buzz: require("@/assets/audio/sfx/phone_buzz.wav"),
  notification_chime: require("@/assets/audio/sfx/notification_chime.wav"),
  message_send: require("@/assets/audio/sfx/message_send.wav"),
  message_receive: require("@/assets/audio/sfx/message_receive.wav"),
};

export function sfxAsset(name: SfxName): number | object {
  return SFX_MANIFEST[name];
}
