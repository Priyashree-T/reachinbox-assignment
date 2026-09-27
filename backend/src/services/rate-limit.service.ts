import { redisConnection } from "../queues/redis.js";

export interface RateLimitReservation {
  allowedAt: number;
  delayMs: number;
  rateLimitHit: boolean;
}

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local baseTime = tonumber(ARGV[1])
local hourlyLimit = tonumber(ARGV[2])
local minDelayMs = tonumber(ARGV[3])
local reservationId = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, "-inf", baseTime - 3600000)

local existingScore = redis.call("ZSCORE", key, reservationId)
local count = redis.call("ZCARD", key)

if existingScore then
  count = count - 1
end

local lastItems = redis.call(
  "ZREVRANGE",
  key,
  0,
  0,
  "WITHSCORES"
)

local lastTimestamp = baseTime

if #lastItems >= 2 then
  lastTimestamp = tonumber(lastItems[2])
end

local allowedAt = math.max(
  baseTime,
  lastTimestamp + minDelayMs
)

local rateLimitHit = 0

if count >= hourlyLimit then
  rateLimitHit = 1

  local oldestItems = redis.call(
    "ZRANGE",
    key,
    0,
    0,
    "WITHSCORES"
  )

  if #oldestItems >= 2 then
    local oldestTimestamp = tonumber(oldestItems[2])

    allowedAt = math.max(
      allowedAt,
      oldestTimestamp + 3600000
    )
  end
end

redis.call(
  "ZADD",
  key,
  allowedAt,
  reservationId
)

redis.call(
  "EXPIRE",
  key,
  7200
)

return {
  allowedAt,
  rateLimitHit
}
`;

export const reserveEmailSlot = async (
  scope: string,
  hourlyLimit: number,
  minDelaySeconds: number,
  reservationId: string,
  earliestAt: number
): Promise<RateLimitReservation> => {
  const safeHourlyLimit =
    Number.isInteger(hourlyLimit) && hourlyLimit > 0
      ? hourlyLimit
      : 100;

  const safeMinDelaySeconds =
    Number.isFinite(minDelaySeconds) &&
    minDelaySeconds >= 0
      ? minDelaySeconds
      : 0;

  const baseTime = Math.max(Date.now(), earliestAt);

  const result = await redisConnection.eval(
    RATE_LIMIT_SCRIPT,
    1,
    `email-rate-limit:${scope}`,
    baseTime,
    safeHourlyLimit,
    safeMinDelaySeconds * 1000,
    reservationId
  );

  if (!Array.isArray(result) || result.length < 2) {
    throw new Error(
      "Failed to reserve email rate-limit slot"
    );
  }

  const allowedAt = Number(result[0]);
  const rateLimitHit = Number(result[1]) === 1;

  if (!Number.isFinite(allowedAt)) {
    throw new Error(
      "Invalid email rate-limit reservation"
    );
  }

  return {
    allowedAt,
    delayMs: Math.max(0, allowedAt - Date.now()),
    rateLimitHit
  };
};

export const releaseEmailSlot = async (
  scope: string,
  reservationId: string
): Promise<void> => {
  await redisConnection.zrem(
    `email-rate-limit:${scope}`,
    reservationId
  );
};