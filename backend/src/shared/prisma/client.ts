import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

let globalPrisma: PrismaClient | undefined;
let encryptionKey: Buffer | null = null;
let encryptionConfigured = false;

const ENCRYPTED_FIELDS_BY_MODEL: Record<string, string[]> = {
  Customer: ['kraPin', 'phone'],
  Member: ['phone'],
  User: ['phone'],
  Employee: ['phone'],
};

const getEncryptionKey = () => {
  if (encryptionConfigured) {
    return encryptionKey;
  }

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    // eslint-disable-next-line no-console
    console.error(
      'ENCRYPTION_KEY is not set. Sensitive fields will NOT be encrypted at rest.',
    );
    encryptionConfigured = true;
    encryptionKey = null;
    return null;
  }

  const buf = Buffer.from(raw, raw.length === 64 ? 'hex' : 'utf8');
  if (buf.length !== 32) {
    // eslint-disable-next-line no-console
    console.error(
      'ENCRYPTION_KEY must be 32 bytes (256 bits). Sensitive fields will NOT be encrypted at rest.',
    );
    encryptionConfigured = true;
    encryptionKey = null;
    return null;
  }

  encryptionConfigured = true;
  encryptionKey = buf;
  return encryptionKey;
};

const encrypt = (value: string): string => {
  const key = getEncryptionKey();
  if (!key) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join('.');
};

const decrypt = (value: string): string => {
  const key = getEncryptionKey();
  if (!key) return value;
  const parts = value.split('.');
  if (parts.length !== 3) return value;
  try {
    const [ivB64, encB64, tagB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const encrypted = Buffer.from(encB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return value;
  }
};

const transformForEncryption = (model: string, data: any) => {
  const fields = ENCRYPTED_FIELDS_BY_MODEL[model];
  if (!fields || !data) return;
  for (const field of fields) {
    if (typeof data[field] === 'string') {
      data[field] = encrypt(data[field]);
    }
  }
};

const transformForDecryption = (model: string, data: any) => {
  const fields = ENCRYPTED_FIELDS_BY_MODEL[model];
  if (!fields || !data) return;
  for (const field of fields) {
    if (typeof data[field] === 'string') {
      data[field] = decrypt(data[field]);
    }
  }
};

const applyEncryptionMiddleware = (client: PrismaClient) => {
  client.$use(async (params, next) => {
    const { model, action } = params;

    // Encrypt on writes
    if (
      model &&
      ['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(action)
    ) {
      if (params.args?.data) {
        if (Array.isArray(params.args.data)) {
          for (const item of params.args.data) {
            transformForEncryption(model, item);
          }
        } else {
          transformForEncryption(model, params.args.data);
        }
      }
    }

    const result = await next(params);

    // Decrypt on reads
    if (!model) {
      return result;
    }

    const decryptResult = (r: any) => {
      if (!r) return r;
      if (Array.isArray(r)) {
        for (const item of r) {
          transformForDecryption(model, item);
        }
      } else {
        transformForDecryption(model, r);
      }
      return r;
    };

    switch (action) {
      case 'findUnique':
      case 'findFirst':
      case 'findMany':
      case 'create':
      case 'update':
      case 'upsert':
      case 'createMany':
      case 'updateMany':
        return decryptResult(result);
      default:
        return result;
    }
  });
};

const getBaseClient = () => {
  if (!globalPrisma) {
    globalPrisma = new PrismaClient();
    applyEncryptionMiddleware(globalPrisma);
  }
  return globalPrisma;
};

export const prisma = getBaseClient();

/**
 * Returns a Prisma client instance extended with RLS support.
 * For every query, it wraps execution in a transaction where the
 * PostgreSQL GUC `app.current_tenant_id` is set.
 *
 * This ensures all RLS policies that rely on this setting are enforced.
 */
export const createTenantPrismaClient = (tenantId: string) => {
  const base = getBaseClient();

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return base.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
            // Queries executed after set_config in this transaction
            // will see the correct tenant id.
            return query(args);
          });
        },
      },
    },
  });
};