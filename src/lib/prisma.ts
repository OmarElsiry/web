import { PrismaClient } from '../generated/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

let prisma: PrismaClient | null = null;

const getPrisma = () => {
    if (prisma) return prisma;

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
    const adapter = new PrismaPg(pool);

    prisma = new PrismaClient({ adapter });

    return prisma;
}

export default getPrisma;
