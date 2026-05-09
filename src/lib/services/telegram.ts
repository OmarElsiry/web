import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const channelId = process.env.TELEGRAM_CHANNEL_ID;

// Only initialize if token exists
const bot = token ? new TelegramBot(token, { polling: false }) : null;



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
