import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;

// Pool sized for high-traffic: max 20 connections per instance
// On Hostinger VPS with multiple workers, keep this at 10-15
const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
export { pool };
