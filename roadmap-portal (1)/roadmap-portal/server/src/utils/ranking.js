/**
 * Trending score, in the spirit of Reddit's "hot" ranking.
 *
 * Votes are logarithmic, so the 2nd vote counts far more than the 200th, and age is a linear
 * bonus, so a new request with a few votes can outrank an old one with many. The score is stored
 * on the document (recomputed whenever votes or comments change) because MongoDB can't sort by a
 * time-decayed expression without an aggregation on every read.
 */
const EPOCH = new Date("2024-01-01T00:00:00Z").getTime();
const HALF_DAY = 43_200_000;

export function trendingScore({ voteCount = 0, commentCount = 0, createdAt = new Date() }) {
  const engagement = voteCount + commentCount * 0.5; // a comment is half a vote of interest
  const magnitude = Math.log10(Math.max(engagement, 0) + 1);
  const age = (new Date(createdAt).getTime() - EPOCH) / HALF_DAY;
  return Number((magnitude + age / 100).toFixed(6));
}
