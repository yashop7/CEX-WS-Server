import { config } from "dotenv";
config();
export const redisUrl = process.env.REDIS_ENGINE_DOWNSTREAM_URL || "";
export const port = process.env.PORT || 3001;