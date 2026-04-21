import { type RedisClientType, createClient } from "redis";
import { UserManager } from "./UserManager";
import { redisUrl } from "./config";

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subscriptions: Map<string, string[]> = new Map();
  private reverseSubscriptions: Map<string, string[]> = new Map();
  private redisClient: RedisClientType;

  private constructor() {
    this.redisClient = createClient({ url: redisUrl }) as RedisClientType;
    this.redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });
    this.redisClient.connect().then(() => {
      console.log("Connected to Redis (Engine downstream pub/sub)");
    });
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new SubscriptionManager();
    }
    return this.instance;
  }

  public subscribe(userId: string, subscription: string) {
    if (this.subscriptions.get(userId)?.includes(subscription)) {
      return;
    }
    this.subscriptions.set(
      userId,
      (this.subscriptions.get(userId) || []).concat(subscription)
    );
    this.reverseSubscriptions.set(
      subscription,
      (this.reverseSubscriptions.get(subscription) || []).concat(userId)
    );
    if (this.reverseSubscriptions.get(subscription)?.length === 1) {
      console.log("Subscribing to Redis channel:", subscription);
      this.redisClient.subscribe(subscription, this.redisCallbackHandler);
    }
  }

  private redisCallbackHandler = (message: string, channel: string) => {
    console.log("Redis message on channel", channel, ":", message);
    const parsedMessage = JSON.parse(message);
    this.reverseSubscriptions
      .get(channel)
      ?.forEach((uid) =>
        UserManager.getInstance().getUser(uid)?.emit(parsedMessage)
      );
  };

  public unsubscribe(userId: string, subscription: string) {
    const userSubscriptions = this.subscriptions.get(userId);
    if (userSubscriptions) {
      this.subscriptions.set(
        userId,
        userSubscriptions.filter((s) => s !== subscription)
      );
    }
    const users = this.reverseSubscriptions.get(subscription);
    if (users) {
      this.reverseSubscriptions.set(
        subscription,
        users.filter((u) => u !== userId)
      );
      if (this.reverseSubscriptions.get(subscription)?.length === 0) {
        this.reverseSubscriptions.delete(subscription);
        console.log("Unsubscribing from Redis channel:", subscription);
        this.redisClient.unsubscribe(subscription);
      }
    }
  }

  public userLeft(userId: string) {
    console.log("User left:");
    this.subscriptions.get(userId)?.forEach((s) => this.unsubscribe(userId, s));
  }

  public getSubscriptions(userId: string) {
    return this.subscriptions.get(userId) || [];
  }
}
