/* eslint-disable @typescript-eslint/no-explicit-any */
import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const channelId = process.env.TELEGRAM_CHANNEL_ID;

// Only initialize if token exists (webhook mode — no polling)
const bot = token ? new TelegramBot(token, { polling: false }) : null;

// ─── Existing Backup Function ───────────────────────────────────────────────

export const sendBackup = async (fileBuffer: Buffer, fileName: string, caption: string) => {
    if (!bot || !channelId) return;
    try {
        await bot.sendDocument(channelId, fileBuffer, {
            caption,
        }, {
            filename: fileName
        });
    } catch (error) {
        console.error('Telegram Backup Error:', error);
    }
};

// ─── Bot Messaging Helpers ──────────────────────────────────────────────────

export type InlineButton = {
    text: string;
    callback_data: string;
};

export type InlineKeyboard = InlineButton[][];

/**
 * Send a text message with optional inline keyboard
 */
export async function sendMessage(
    chatId: number | string,
    text: string,
    keyboard?: InlineKeyboard
): Promise<any> {
    if (!bot) return null;
    try {
        return await bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
        });
    } catch (error) {
        console.error('Telegram sendMessage Error:', error);
        return null;
    }
}

/**
 * Edit an existing message (for updating inline keyboards)
 */
export async function editMessage(
    chatId: number | string,
    messageId: number,
    text: string,
    keyboard?: InlineKeyboard
): Promise<any> {
    if (!bot) return null;
    try {
        return await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
        });
    } catch (error) {
        console.error('Telegram editMessage Error:', error);
        return null;
    }
}

/**
 * Answer a callback query (dismiss the loading spinner on buttons)
 */
export async function answerCallback(
    callbackQueryId: string,
    text?: string
): Promise<any> {
    if (!bot) return null;
    try {
        return await bot.answerCallbackQuery(callbackQueryId, { text });
    } catch (error) {
        console.error('Telegram answerCallback Error:', error);
        return null;
    }
}

/**
 * Send a document (PDF, CSV, etc.)
 */
export async function sendDocument(
    chatId: number | string,
    fileBuffer: Buffer,
    fileName: string,
    caption?: string
): Promise<any> {
    if (!bot) return null;
    try {
        return await bot.sendDocument(chatId, fileBuffer, {
            caption,
            parse_mode: 'HTML',
        }, {
            filename: fileName,
            contentType: 'application/pdf',
        });
    } catch (error) {
        console.error('Telegram sendDocument Error:', error);
        return null;
    }
}

/**
 * Delete a message
 */
export async function deleteMessage(
    chatId: number | string,
    messageId: number
): Promise<boolean> {
    if (!bot) return false;
    try {
        await bot.deleteMessage(chatId, messageId);
        return true;
    } catch (error) {
        console.error('Telegram deleteMessage Error:', error);
        return false;
    }
}

// ─── Keyboard Builder Helpers ───────────────────────────────────────────────

/** Create a single inline button */
export function btn(text: string, callbackData: string): InlineButton {
    return { text, callback_data: callbackData };
}

/** Create the main menu keyboard */
export function mainMenuKeyboard(): InlineKeyboard {
    return [
        [btn('🛒 بيع سريع', 'menu:sale'), btn('📋 بحث فاتورة', 'menu:invoice')],
        [btn('📦 المخزون', 'menu:stock'), btn('📊 ملخص اليوم', 'menu:today')],
        [btn('⚙️ الإعدادات', 'menu:settings')],
    ];
}

/** Create a navigation row with optional back and cancel */
export function navRow(options: { back?: string; cancel?: boolean; home?: boolean }): InlineButton[] {
    const row: InlineButton[] = [];
    if (options.back) row.push(btn('↩️ رجوع', options.back));
    if (options.cancel) row.push(btn('❌ إلغاء', 'cancel'));
    if (options.home) row.push(btn('🏠 القائمة', 'menu:main'));
    return row;
}

// ─── Webhook Setup ──────────────────────────────────────────────────────────

/**
 * Register the webhook URL with Telegram
 */
export async function setupWebhook(webhookUrl: string, secret: string): Promise<boolean> {
    if (!bot) return false;
    try {
        await bot.setWebHook(webhookUrl, {
            secret_token: secret,
        } as any);
        return true;
    } catch (error) {
        console.error('Telegram setWebhook Error:', error);
        return false;
    }
}

/**
 * Get current webhook info
 */
export async function getWebhookInfo(): Promise<any> {
    if (!bot) return null;
    try {
        return await bot.getWebHookInfo();
    } catch (error) {
        console.error('Telegram getWebhookInfo Error:', error);
        return null;
    }
}
