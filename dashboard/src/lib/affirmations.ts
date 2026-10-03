const AFFIRMATIONS: Record<string, string> = {
  "Take it easy today.": "I can rest without falling behind.",
  "Protect your attention today.": "I choose what I let into my mind.",
  "You let the filter hold today.": "I did not have to take all of that in.",
  "The feed asked a lot today.": "I can notice the weight without carrying all of it.",
  "Give your mind a quieter feed today.": "I am in control of my thoughts.",
  "You have a solid baseline today.": "I notice both sides of how I feel.",
  "Check in with both sides today.": "I can look after my body and my attention."
};

export const DEFAULT_AFFIRMATION = "I am in control of my thoughts.";

export function affirmationFor(headline: string): string {
  return AFFIRMATIONS[headline] || DEFAULT_AFFIRMATION;
}

export function isKnownAffirmation(text: string): boolean {
  return text === DEFAULT_AFFIRMATION || Object.values(AFFIRMATIONS).includes(text);
}
