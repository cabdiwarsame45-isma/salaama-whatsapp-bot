const { Client, LocalAuth } = require('whatsapp-web.js');
const { neon } = require('@neondatabase/serverless');
const qrcode = require('qrcode-terminal');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sql = neon(process.env.DATABASE_URL);

const APOLOGY = `⚠️ *RALI GALIN*: 
Waxaan ka raalligalinaynaa cilad farsamo oo yar oo dhacday awgeed. Hadda wax walba waa hagaag.`;

const WELCOME_BODY = `🎓 Ku Soo Dhawoow SALAAMA LEARNING HUB! 🚀

Waxaad hadda qaaday tallaabadii ugu muhiimsaneyd ee guushaada waxbarasho.
Halkaan waxaad ka heli doontaa buugaagta manhajka, su'aalo & jawaabo, quiz maalinle ah,
iyo diyaarinta imtixaanka dowladda si heer sare ah.

📚 Baro si fudud
📝 Is tijaabi maalin walba
🏆 U diyaar garow guul dhab ah

Mustaqbalkaaga maanta ayuu bilaabanayaa — Ku dadaal, ku guuleyso! 🌟
*Waa lagugu fasaxay!*`;

const puppeteerOptions = {
    args: ['--no-sandbox']
};

if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
} else if (process.platform === 'win32') {
    puppeteerOptions.executablePath = 'C:\\Users\\hp\\.cache\\puppeteer\\chrome\\win64-150.0.7828.0\\chrome-win64\\chrome.exe';
}

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: __dirname // Use current folder for auth
    }),
    puppeteer: puppeteerOptions
});

client.on('qr', (qr) => {
    console.log('Fadlan iskaan garee QR Code-kan:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Client is Ready!');
    await runTask();
});

async function runTask() {
    try {
        console.log('📡 Fetching target users...');
        
        // Fetch 6 last G8
        const g8 = await sql`
          SELECT full_name, phone, grade FROM users 
          WHERE grade = '8aad' ORDER BY created_at DESC LIMIT 6
        `;
        
        // Fetch 6 last F4
        const f4 = await sql`
          SELECT full_name, phone, grade FROM users 
          WHERE grade = 'f4' ORDER BY created_at DESC LIMIT 6
        `;
        
        const allUsers = [...g8, ...f4];
        console.log(`👥 Total users to notify: ${allUsers.length}`);

        for (const user of allUsers) {
            const { full_name, phone } = user;
            
            // Format phone for WhatsApp
            let cleanPhone = String(phone).replace(/\D/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
            if (!cleanPhone.startsWith('252')) cleanPhone = '252' + cleanPhone;

            const message = `${APOLOGY}\n\n👤 *Username*: ${full_name}\n📞 *Phone*: ${phone}\n🔑 *Password*: [Securely Hashed - Fadlan isticmaal password-kii aad dooratay]\n\n${WELCOME_BODY}`;

            console.log(`📤 Sending to ${full_name} (${cleanPhone})...`);
            
            try {
                const numberId = await client.getNumberId(cleanPhone);
                if (numberId) {
                    await client.sendMessage(numberId._serialized, message);
                    console.log(`✅ Sent to ${full_name}`);
                } else {
                    console.error(`❌ ${phone} is not on WhatsApp.`);
                }
            } catch (err) {
                console.error(`❌ Failed for ${phone}:`, err.message);
            }

            // Wait 5 seconds between messages
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log('✨ All tasks completed.');
        await client.destroy();
        process.exit(0);

    } catch (err) {
        console.error('💥 Error:', err);
        process.exit(1);
    }
}

client.initialize();
