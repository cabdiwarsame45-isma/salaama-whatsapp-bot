const { Client, LocalAuth } = require('whatsapp-web.js');
const { neon } = require('@neondatabase/serverless');
const qrcode = require('qrcode-terminal');
const path = require('path');
// Load .env from root
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is missing in .env file');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const APP_LINK = 'https://salama-learning-hub.netlify.app/';

const F4_MESSAGE = `🌟 *SALAAMA HUB: WAR CUSUB!* 🌟

Sxb/Walaal, waxaan kuu haynaa update muhiim ah:

📸 *Profile Picture:*
Hadda waad bedelan kartaa sawirkaaga profile-ka si uu app-kaaga u qurxoonado.

📚 *Scientific Subjects (F1, F2, F3):*
Waxaan ku soo kordhinay revision-ka maaddooyinka sayniska. Hadda:
✅ Waad akhrisan kartaa.
✅ Waad is tijaabin kartaa (Test Yourself).

🔗 *Linkiga App-ka:*
${APP_LINK}

Mustaqbalkaaga maanta ayuu bilaabanayaa — Dadaal oo guulayso! 🚀`;

const GRADE8_MESSAGE = `🌟 *SALAAMA HUB: WAR CUSUB!* 🌟

Sxb/Walaal, waxaan kuu haynaa update yar oo xiiso leh:

📸 *Profile Picture:*
Hadda waad bedelan kartaa sawirkaaga profile-ka si uu app-kaaga u qurxoonado.

🔗 *Linkiga App-ka:*
${APP_LINK}

Guul ayaan kuu rajaynaynaa! 🚀`;

// Initialize WhatsApp Client using the existing local session
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: __dirname // Looking for .wwebjs_auth in this folder
    }),
    puppeteer: {
        executablePath: 'C:\\Users\\hp\\.cache\\puppeteer\\chrome\\win64-150.0.7828.0\\chrome-win64\\chrome.exe',
        args: ['--no-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n⚠️ Session local lama helin ama waa dhacay. Fadlan iskaan garee QR Code-kan:\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Client is Ready!');
    await startBulkNotifications();
});

async function startBulkNotifications() {
    console.log('🚀 Starting bulk notifications...');

    try {
        // Fetch active students
        let students = await sql`
            SELECT full_name, phone, grade 
            FROM users 
            WHERE role = 'student' AND status = 'active'
            ORDER BY id ASC
        `;

        // SKIP the first 22 students who were already processed in the previous run
        const alreadySentCount = 22;
        const remainingStudents = students.slice(alreadySentCount);

        console.log(`👥 Total active students: ${students.length}`);
        console.log(`⏭️ Skipping first ${alreadySentCount} students.`);
        console.log(`🚀 Remaining to send: ${remainingStudents.length}`);

        let successCount = 0;
        let failCount = 0;

        for (const student of remainingStudents) {
            const { full_name, phone, grade } = student;
            const isF4 = grade && grade.toLowerCase() === 'f4';
            const message = isF4 ? F4_MESSAGE : GRADE8_MESSAGE;

            // Format phone number
            let cleanPhone = String(phone).replace(/\D/g, '');
            if (!cleanPhone.startsWith('252')) {
                cleanPhone = '252' + cleanPhone;
            }

            console.log(`📤 Sending to ${full_name} (${phone})...`);
            
            try {
                // Better validation: Get the official WhatsApp ID for the number
                const numberId = await client.getNumberId(cleanPhone);
                
                if (numberId) {
                    await client.sendMessage(numberId._serialized, message);
                    console.log(`✅ Sent successfully to ${full_name}`);
                    successCount++;
                } else {
                    console.error(`❌ Number ${phone} is not on WhatsApp.`);
                    failCount++;
                }
            } catch (err) {
                console.error(`❌ Failed to send to ${phone}:`, err.message);
                failCount++;
            }

            // Delay to prevent spam detection
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log('\n=========================================');
        console.log('📊 Final Report:');
        console.log(`✅ Success: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);
        console.log('=========================================');

        console.log('Fariimihii waa ay dhamaadeen. Client-ka waa la xirayaa...');
        await client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

client.initialize();
