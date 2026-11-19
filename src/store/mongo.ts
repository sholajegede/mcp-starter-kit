import type { Store } from './types.js';

interface KvDoc {
  _id: string;
  value: string | number;
  expiresAt: Date | null;
}

/** The subset of a MongoDB `Collection` the store calls. */
export interface MongoCollectionLike {
  findOne(filter: object): Promise<unknown>;
  updateOne(filter: object, update: object, options?: object): Promise<unknown>;
  deleteOne(filter: object): Promise<unknown>;
  findOneAndUpdate(filter: object, update: object | object[], options?: object): Promise<unknown>;
}

/**
 * MongoDB store. Add a TTL index so expired documents are removed:
 *   db.collection('mcp_kv').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
 */
export function mongoStore(collection: MongoCollectionLike): Store {
  const notExpired = () => ({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });

  return {
    name: 'mongo',
    async get(key) {
      const doc = (await collection.findOne({ _id: key, ...notExpired() })) as KvDoc | null;
      return doc ? String(doc.value) : null;
    },
    async set(key, value, opts) {
      const expiresAt = opts?.ttlMs ? new Date(Date.now() + opts.ttlMs) : null;
      await collection.updateOne({ _id: key }, { $set: { value, expiresAt } }, { upsert: true });
    },
    async delete(key) {
      await collection.deleteOne({ _id: key });
    },
    async increment(key, by = 1, opts) {
      const now = new Date();
      const freshExpiry = opts?.ttlMs ? new Date(now.getTime() + opts.ttlMs) : null;
      const stale = {
        $or: [{ $eq: [{ $type: '$value' }, 'missing'] }, { $and: [{ $ne: [{ $ifNull: ['$expiresAt', null] }, null] }, { $lte: ['$expiresAt', now] }] }],
      };
      const result = (await collection.findOneAndUpdate(
        { _id: key },
        [
          {
            $set: {
              value: { $cond: [stale, by, { $add: [{ $toLong: '$value' }, by] }] },
              expiresAt: { $cond: [stale, freshExpiry, '$expiresAt'] },
            },
          },
        ],
        { upsert: true, returnDocument: 'after' },
      )) as KvDoc | { value: KvDoc } | null;
      const doc = result && 'value' in result && typeof result.value === 'object' ? (result.value as KvDoc) : (result as KvDoc | null);
      return Number(doc?.value ?? by);
    },
  };
}
