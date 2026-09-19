import { AssessmentSession, AssessmentEvent } from '../types';
import { getEmergencyScenario } from '../data/emergencyScenarios';

/** Per-severity target reaction window (seconds) for FIRST correct action. */
const REACTION_TARGET_SEC: Record<string, number> = {
  critical: 6,
  high: 9,
  moderate: 12,
};

/** Point penalties. */
const HINT_PENALTY = 5;
const TIMEOUT_PENALTY = 15;
const MAX_HINT_PENALTY = 25; // cap per event

export interface EventScore {
  scenarioId: string;
  title: string;
  severity: string;
  /** seconds to first correct action, or null if never acted / aborted. */
  reactionSec: number | null;
  /** seconds to full resolution, or null. */
  resolveSec: number | null;
  hintsUsed: number;
  timedOutSteps: number;
  resolved: boolean;
  /** 0-100 score for this event. */
  score: number;
}

export interface AssessmentReport {
  overallScore: number;
  grade: 'excellent' | 'competent' | 'practice' | 'retrain';
  eventScores: EventScore[];
  eventsHandled: number;
  eventsResolved: number;
  avgReactionSec: number | null;
  hintsUsedTotal: number;
  timeoutsTotal: number;
  durationSec: number;
}

const scoreEvent = (ev: AssessmentEvent): EventScore => {
  const sc = getEmergencyScenario(ev.scenarioId);
  const severity = sc?.severity ?? 'high';
  const title = sc?.title ?? ev.scenarioId;

  const reactionSec =
    ev.firstActionAt != null ? Math.max(0, (ev.firstActionAt - ev.injectedAt) / 1000) : null;
  const resolveSec =
    ev.resolvedAt != null ? Math.max(0, (ev.resolvedAt - ev.injectedAt) / 1000) : null;
  const resolved = ev.resolvedAt != null;

  let score = 100;

  // Reaction-time component (up to -40): linear beyond the target window.
  const target = REACTION_TARGET_SEC[severity] ?? 9;
  if (reactionSec == null) {
    score -= 40; // never acted
  } else if (reactionSec > target) {
    const over = reactionSec - target;
    score -= Math.min(40, over * 3);
  }

  // Hint penalty (capped).
  score -= Math.min(MAX_HINT_PENALTY, ev.hintsUsed * HINT_PENALTY);

  // Timeout / consequence penalty.
  score -= ev.timedOutSteps * TIMEOUT_PENALTY;

  // Unresolved (aborted mid-event) heavy penalty.
  if (!resolved) score -= 30;

  score = Math.max(0, Math.min(100, Math.round(score)));

  return { scenarioId: ev.scenarioId, title, severity, reactionSec, resolveSec, hintsUsed: ev.hintsUsed, timedOutSteps: ev.timedOutSteps, resolved, score };
};

const gradeFor = (score: number): AssessmentReport['grade'] =>
  score >= 90 ? 'excellent' : score >= 75 ? 'competent' : score >= 60 ? 'practice' : 'retrain';

/** Compute the full scored report for a (finished or in-progress) session. */
export const computeAssessmentReport = (session: AssessmentSession): AssessmentReport => {
  const eventScores = session.events.map(scoreEvent);
  const eventsHandled = eventScores.length;
  const eventsResolved = eventScores.filter((e) => e.resolved).length;

  const reactionVals = eventScores
    .map((e) => e.reactionSec)
    .filter((v): v is number => v != null);
  const avgReactionSec =
    reactionVals.length > 0
      ? reactionVals.reduce((a, b) => a + b, 0) / reactionVals.length
      : null;

  const overallScore =
    eventScores.length > 0
      ? Math.round(eventScores.reduce((a, e) => a + e.score, 0) / eventScores.length)
      : 0;

  const end = session.endedAt ?? Date.now();
  const durationSec = Math.max(0, (end - session.startedAt) / 1000);

  return {
    overallScore,
    grade: gradeFor(overallScore),
    eventScores,
    eventsHandled,
    eventsResolved,
    avgReactionSec,
    hintsUsedTotal: session.hintsUsedTotal,
    timeoutsTotal: eventScores.reduce((a, e) => a + e.timedOutSteps, 0),
    durationSec,
  };
};
