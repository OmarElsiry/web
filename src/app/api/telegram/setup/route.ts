import { NextResponse } from 'next/server';
import { setupWebhook } from '@/lib/services/telegram';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    // Simple security check (use the same cron secret or another specific secret)
    if (key !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (!appUrl) {
        return NextResponse.json({ error: 'APP_URL not configured' }, { status: 500 });
    }

    const protocol = appUrl.startsWith('http') ? '' : 'https://';
    const baseUrl = `${protocol}${appUrl}`;
    
    // We generate a secret token that Telegram will send back in every request
    // For simplicity, we use the CRON_SECRET or another env var
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
        return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET not configured' }, { status: 500 });
    }

    const webhookUrl = `${baseUrl}/api/telegram/webhook?secret=${webhookSecret}`;
    
    const success = await setupWebhook(webhookUrl, webhookSecret);

    if (success) {
        return NextResponse.json({ 
            success: true, 
            message: 'Webhook registered successfully',
            url: webhookUrl 
        });
    } else {
        return NextResponse.json({ 
            success: false, 
            error: 'Failed to register webhook. Check bot token.' 
        }, { status: 500 });
    }
}
