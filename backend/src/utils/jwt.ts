import jwt from "jsonwebtoken";

interface JwtPayload {
  userId: string;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

export const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId } satisfies JwtPayload,
    getJwtSecret(),
    {
      expiresIn: "7d"
    }
  );
};

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, getJwtSecret());

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.userId !== "string"
  ) {
    throw new Error("Invalid JWT payload");
  }

  return {
    userId: decoded.userId
  };
};