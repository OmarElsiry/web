import { defineConfig } from '@prisma/config';
import "dotenv/config";

export default defineConfig({
    datasource: {
        // Use direct connection for CLI/migrations
        url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
});
