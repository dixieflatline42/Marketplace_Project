const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// --- SEGURANÇA ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { erro: "Muitas tentativas. Tente novamente mais tarde." }
});

// --- BANCO DE DADOS (AJUSTADO PARA O NAS) ---
const pool = mysql.createPool({
    host: 'localhost', // Mude de 127.0.0.1 para localhost
    user: 'root',
    password: 'wonder', 
    database: 'recanto_heroico',
    port: 3307,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    // Força o protocolo de handshake que o MariaDB do MyCloud prefere
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// TESTE DE CONEXÃO COM LOG DETALHADO
pool.getConnection()
    .then(conn => {
        console.log("✅ CONECTADO AO MARIADB (PORTA 3307)!");
        conn.release();
    })
    .catch(err => {
        console.error("❌ ERRO NO BANCO:", err.code, "|", err.message);
    });

const SECRET_KEY = "clptec_seguranca_@2026_nas_server_protegido"; 

// Teste de conexão imediato no log
pool.query('SELECT 1').then(() => console.log("✅ Conectado ao MariaDB na 3307")).catch(err => console.error("❌ Erro DB:", err.message));

// --- MIDDLEWARE ---
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ erro: "Acesso negado." });
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ erro: "Sessão expirada." });
        req.userId = decoded.id;
        next();
    });
};

// --- ROTAS DA API ---

app.post('/api/login', loginLimiter, (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'josesouto' && senha === 'paludo00') {
        const token = jwt.sign({ id: 1 }, SECRET_KEY, { expiresIn: '6h' });
        return res.json({ auth: true, token });
    }
    res.status(401).json({ erro: "Incorreto!" });
});

app.get('/api/produtos', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM produtos ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar dados." });
    }
});

app.get('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM produtos WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ erro: "Não encontrado." });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar produto." });
    }
});

// Outras rotas (POST, PUT, DELETE) permanecem iguais...
// [Mantendo a lógica de INSERT/UPDATE/DELETE que você já tem]

// --- CONFIGURAÇÃO DE SITEMAP E NAVEGAÇÃO (ESTILO NAS/COMPATÍVEL) ---

// 1. ROTA DO SITEMAP
app.get('/sitemap.xml', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id FROM produtos');
        const baseUrl = 'https://clptec.net'; 
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        xml += `<url><loc>${baseUrl}/index.html</loc><priority>1.0</priority></url>`;
        rows.forEach(p => {
            xml += `\n  <url><loc>${baseUrl}/produto.html?id=${p.id}</loc></url>`;
        });
        xml += `\n</urlset>`;
        res.header('Content-Type', 'application/xml').send(xml);
    } catch (err) {
        res.status(500).send("Erro no sitemap");
    }
});

// 2. SERVIR ARQUIVOS ESTÁTICOS
app.use(express.static(path.join(__dirname, '../frontend')));

// 3. ROTA PARA PÁGINA INDIVIDUAL
app.get('/produto.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'produto.html'));
});

// 4. ROTA CORINGA 
app.use((req, res) => {
    // Se não for API e não for um arquivo físico (ex: .js, .css, .png)
    if (!req.url.startsWith('/api') && !req.url.includes('.')) {
        res.sendFile(path.resolve(__dirname, '../frontend', 'index.html'));
    } else if (req.url.startsWith('/api')) {
        res.status(404).json({ erro: "Rota API não encontrada" });
    }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Marketplace CLPTEC Online no NAS (Porta ${PORT})`);
});