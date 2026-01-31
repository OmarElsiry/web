'use server';

import getPrisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function logActivity(
    action: string,
    details?: string,
    explicitUserId?: string
) {
    const prisma = getPrisma();
    let userId = explicitUserId;

    if (!userId) {
        // Try to get from Supabase session and find matching local user
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
            const localUser = await prisma.user.findFirst({ where: { username: user.email } });
            if (localUser) {
                userId = localUser.id;
            }
        }
    }

    if (!userId) {
        // Fallback: Try to find a 'ROOT' or 'ADMIN' user to attribute to, or fail gracefully
        const admin = await prisma.user.findFirst({ where: { role: 'ROOT' } });
        userId = admin?.id;
    }

    if (!userId) {
        console.warn(`Failed to log activity "${action}": No valid userId found.`);
        return { success: false, error: 'User not identified' };
    }

    try {
        await prisma.auditLog.create({
            data: {
                action,
                details,
                userId
            }
        });
        return { success: true };
    } catch (error) {
        console.error('Audit log error:', error);
        return { success: false, error: 'Failed to create log' };
    }
}

export async function getAuditLogs(page = 1, limit = 50) {
    const prisma = getPrisma();
    const skip = (page - 1) * limit;

    try {
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                skip,
                take: limit,
                orderBy: { timestamp: 'desc' },
                include: {
                    user: {
                        select: { name: true, username: true, role: true }
                    }
                }
            }),
            prisma.auditLog.count()
        ]);

        return {
            success: true,
            logs,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                current: page
            }
        };
    } catch (error) {
        console.error('Get logs error:', error);
        return { success: false, error: 'Failed to fetch logs' };
    }
}
