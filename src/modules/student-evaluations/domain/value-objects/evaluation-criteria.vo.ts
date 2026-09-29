export enum AttendanceStatus {
  ON_TIME = 'on_time',
  MAKEUP = 'makeup',
  LATE = 'late',
  EARLY_LEAVE = 'early_leave',
  LATE_MUCH = 'late_much',
  ABSENT_EXCUSED = 'absent_excused',
  ABSENT_UNEXCUSED = 'absent_unexcused',
}

export enum HomeworkStatus {
  EXCELLENT = 'excellent',
  COMPLETED = 'completed',
  DONE = 'done',
  MISSING_FEW = 'missing_few',
  FORGOT_NOTEBOOK = 'forgot_notebook',
  COPING = 'coping',
  MISSING_MANY = 'missing_many',
  INCOMPLETE = 'incomplete',
  NOT_DONE = 'not_done',
  NO_HOMEWORK = 'no_homework',
}

export enum ParticipationStatus {
  ACTIVE = 'active',
  ACTIVE_RAISE_HAND = 'active_raise_hand',
  PROACTIVE_ASK = 'proactive_ask',
  ANSWER_WELL = 'answer_well',
  ATTENTIVE_QUIET = 'attentive_quiet',
  ANSWER_HESITANT = 'answer_hesitant',
  CANNOT_ANSWER = 'cannot_answer',
  NORMAL = 'normal',
  PASSIVE = 'passive',
}

export enum UnderstandingStatus {
  UNDERSTOOD = 'understood',
  NOT_UNDERSTOOD = 'not_understood',
  QUICK = 'quick',
  SLOW = 'slow',
  NORMAL = 'normal',
}

export enum BehaviorTag {
  GOOD = 'good',
  ATTENTIVE = 'attentive',
  UNFOCUSED = 'unfocused',
  DISTRACTED = 'distracted',
  SLEEPY = 'sleepy',
  MISSING_TOOLS = 'missing_tools',
  TALKATIVE = 'talkative',
  PHONE = 'phone',
  PHONE_PRIVATE = 'phone_private',
  DISRUPTIVE = 'disruptive',
  LATE = 'late',
}
