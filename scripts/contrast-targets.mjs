/**
 * The thresholds, in one place, because the generator and the checker must not disagree.
 *
 * A checker holding its own copy of a number is a checker that can go green on output the
 * generator could never produce, or red on output it always produces. Both have happened to
 * somebody; neither is worth finding out about twice.
 */

/** WCAG 2.2 AA for text below 24px, or below 18.66px bold. --dim carries exactly that. */
export const TEXT_MIN = 4.5;

/** WCAG 2.2 AA for a boundary that identifies a control. An input underline is one. */
export const UI_MIN = 3;
