const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Global state for WhatsApp connection
let qrCodeDataURL = null;
let isReady = false;

const puppeteerOptions = {
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
};

if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
} else if (process.platform === 'win32') {
  puppeteerOptions.executablePath = 'C:\\Users\\hp\\.cache\\puppeteer\\chrome\\win64-150.0.7828.0\\chrome-win64\\chrome.exe';
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: puppeteerOptions
});


client.on('qr', async (qr) => {
  console.log('=========================================');
  console.log('Fadlan waxyar sug...');
  
  const dataURL = await qrcode.toDataURL(qr);
  console.log('QR CODE-KA HOOS KA SOO KOOBI OO BROWSER CUSUB KU FUR:');
  console.log('');
  console.log(dataURL);
  console.log('');
  console.log('=========================================');

  qrCodeDataURL = dataURL;
  isReady = false;
});

client.on('ready', () => {
  console.log('WhatsApp Bot is Ready!');
  isReady = true;
  qrCodeDataURL = null;
});

client.on('disconnected', (reason) => {
  console.log('WhatsApp Bot disconnected:', reason);
  isReady = false;
  qrCodeDataURL = null;
  // Cleanup session on disconnect to avoid stale state
  client.initialize();
});

client.on('auth_failure', (msg) => {
  console.error('WhatsApp Auth Failure:', msg);
  isReady = false;
  qrCodeDataURL = null;
});

client.initialize();

// Helper to build the HTML status page
function buildStatusPage() {
  const statusDiv = isReady
    ? '<div class="status online">&#x1F7E2; Bot is Ready &amp; Connected!</div><p>Fariimaha si otomaatig ah ayay ku baxayaan.</p>'
    : '<div class="status offline">&#x1F534; Not Connected</div><p>Fadlan iskaan garee QR Code-kan hoose adigoo isticmaalaya "Linked Devices" ee WhatsApp-kaaga.</p>';

  const qrSection = qrCodeDataURL
    ? '<img src="' + qrCodeDataURL + '" alt="WhatsApp QR Code" />'
    : (!isReady ? '<p>Generating QR code... Please wait and refresh.</p>' : '');

  const autoRefresh = !isReady ? '<script>setTimeout(function(){ window.location.reload(); }, 5000);</script>' : '';

  return '<!DOCTYPE html>' +
    '<html lang="so"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Salama WhatsApp Bot Status</title>' +
    '<style>' +
    'body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #f8fafc; margin: 0; color: #1e293b; }' +
    '.card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; width: 90%; }' +
    '.status { padding: 0.5rem 1rem; border-radius: 9999px; font-weight: bold; display: inline-block; margin-bottom: 1rem; }' +
    '.status.offline { background: #fee2e2; color: #ef4444; }' +
    '.status.online { background: #dcfce7; color: #22c55e; }' +
    'img { max-width: 100%; border-radius: 0.5rem; margin-top: 1rem; border: 2px solid #e2e8f0; }' +
    'h1 { margin-top: 0; color: #0f172a; }' +
    '</style>' +
    autoRefresh +
    '</head><body>' +
    '<div class="card">' +
    '<h1>Salama Bot</h1>' +
    statusDiv +
    qrSection +
    '</div>' +
    '</body></html>';
}

// API - Status
app.get('/status', (req, res) => {
  res.json({
    isReady,
    qrCodeDataURL,
    uptime: process.uptime()
  });
});

// API - Logout/Reset
app.get('/logout', async (req, res) => {
  console.log('Logging out...');
  try {
    isReady = false;
    qrCodeDataURL = null;
    await client.logout();
    await client.initialize();
    res.json({ success: true, message: 'Bot has been reset. Please wait for a new QR code.' });
  } catch (err) {
    console.error('Logout error:', err);
    // Force initialize even if logout fails
    client.initialize();
    res.status(500).json({ error: 'Failed to logout properly, but re-initializing...', details: err.message });
  }
});

// Frontend - HTML page to scan QR code
app.get('/', (req, res) => {
  res.send(buildStatusPage());
});

// API - Send Message
app.post('/send-welcome', async (req, res) => {
  const { phone, studentName } = req.body;

  if (!phone || !studentName) {
    return res.status(400).json({ error: 'Phone and studentName are required' });
  }

  if (!isReady) {
    return res.status(503).json({ error: 'WhatsApp bot is not connected yet. Please scan QR.' });
  }

  // Format phone number - remove + if present
  const formattedPhone = String(phone).replace('+', '');
  const chatId = formattedPhone + '@c.us';

  const message = [
    '🎓 Ku Soo Dhawoow SALAAMA LEARNING HUB ' + studentName + '! 🚀',
    '',
    'Waxaad hadda qaaday tallaabadii ugu muhiimsaneyd ee guushaada waxbarasho.',
    'Halkaan waxaad ka heli doontaa buugaagta manhajka, su\'aalo & jawaabo, quiz maalinle ah,',
    'iyo diyaarinta imtixaanka dowladda si heer sare ah.',
    '',
    '📚 Baro si fudud',
    '📝 Is tijaabi maalin walba',
    '🏆 U diyaar garow guul dhab ah',
    '',
    'Mustaqbalkaaga maanta ayuu bilaabanayaa — Ku dadaal, ku guuleyso! 🌟'
  ].join('\n');

  try {
    // Check connection state before sending
    const state = await client.getState().catch(() => 'DISCONNECTED');
    if (state !== 'CONNECTED') {
       console.log('Client not connected (State: ' + state + '). Re-initializing...');
       isReady = false;
       return res.status(503).json({ error: 'WhatsApp is not connected (State: ' + state + ').' });
    }

    // Add timeout to sendMessage to prevent hanging
    const sendPromise = client.sendMessage(chatId, message);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SendMessage timeout (30s)')), 30000)
    );

    await Promise.race([sendPromise, timeoutPromise]);
    
    console.log('Message sent to: ' + formattedPhone);
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server is running on port ' + PORT);
});
