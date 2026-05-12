const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;

export const parseDurationToMs = (duration: string): number => {
  const match = DURATION_PATTERN.exec(duration.trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${duration}". Use a value like 15m, 7d, 30s, or 1000ms.`,
    );
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};
