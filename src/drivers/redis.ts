import { defineDriver } from "./utils";
import Redis, {
  Cluster,
  ClusterNode,
  ClusterOptions,
  RedisOptions as _RedisOptions,
} from "ioredis";
import { EventEmitter } from 'events';

export interface RedisOptions extends _RedisOptions {
  /**
   * Optional prefix to use for all keys. Can be used for namespacing.
   */
  base?: string;

  /**
   * Url to use for connecting to redis. Takes precedence over `host` option. Has the format `redis://<REDIS_USER>:<REDIS_PASSWORD>@<REDIS_HOST>:<REDIS_PORT>`
   */
  url?: string;

  /**
   * List of redis nodes to use for cluster mode. Takes precedence over `url` and `host` options.
   */
  cluster?: ClusterNode[];

  /**
   * Options to use for cluster mode.
   */
  clusterOptions?: ClusterOptions;

  /**
   * Default TTL for all items in seconds.
   */
  ttl?: number;
}

export default defineDriver((opts: RedisOptions = {}) => {
  let redisClient: Redis | Cluster;
  const getRedisClient = () => {
    if (redisClient) {
      return redisClient;
    }
    if (opts.cluster) {
      redisClient = new Redis.Cluster(opts.cluster, opts.clusterOptions);
    } else if (opts.url) {
      redisClient = new Redis(opts.url, opts);
    } else {
      redisClient = new Redis(opts);
    }
    return redisClient;
  };

  const base = (opts.base || "").replace(/:$/, "");
  const p = (key: string) => (base ? `${base}:${key}` : key); // Prefix a key. Uses base for backwards compatibility
  const d = (key: string) => (base ? key.replace(base, "") : key); // Deprefix a key

  function exposeConnectionEvents() {
    const eventEmitter = new EventEmitter();
    // Connecting
    redisClient?.on('connect', (e) => eventEmitter.emit('connect', e));
    // Ready
    redisClient?.on('ready', (e) => eventEmitter.emit('ready', e));
    // Connection error
    redisClient?.on('error', (e) => eventEmitter.emit('error', e));
    // Connection closed
    redisClient?.on('close', (e) => eventEmitter.emit('close', e));
    // Reconnection
    redisClient?.on('reconnecting', (e) => eventEmitter.emit('reconnecting', e));
    // End
    redisClient?.on('end', (e) => eventEmitter.emit('end', e));
    // Wait
    redisClient?.on('wait', (e) => eventEmitter.emit('wait', e));
    return eventEmitter;
  }

  const eventEmitter = exposeConnectionEvents();
  return {
    name: "redis",
    options: opts,
    async hasItem(key) {
      return Boolean(await getRedisClient().exists(p(key)));
    },
    async getItem(key) {
      let value = await getRedisClient().get(p(key));
      return value !== null ? value : undefined;
    },
    async setItem(key, value, tOptions) {
      const ttl = tOptions?.ttl ?? opts.ttl;
      if (ttl) {
        await getRedisClient().set(p(key), value, "PX", ttl);
      } else {
        await getRedisClient().set(p(key), value);
      }
    },
    async removeItem(key) {
      await getRedisClient().del(p(key));
    },
    async getKeys() {
      const keys: string[] = await getRedisClient().keys(p("*"));
      return keys.map((key) => d(key));
    },
    async clear() {
      const keys = await getRedisClient().keys(p("*"));
      if (keys.length === 0) {
        return;
      }
      return getRedisClient()
        .del(keys)
        .then(() => {});
    },
    dispose() {
      return getRedisClient().disconnect();
    },
    eventEmitter
  };
});
