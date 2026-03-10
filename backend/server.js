const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = 3001;
const SECRET_KEY = "batman-predator-key";

// AUMENTA O LIMITE: Necessário para receber o texto das imagens
app.use(express.json({ limit: '10mb' }));
app.use(cors());

const pool = new Pool({
    user: 'marketplace',
    host: 'localhost',
    database: 'marketplace_db',
    password: 'wonder',
    port: 5432,
});

// --- LOGIN ---
app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'admin' && senha === 'clptec') {
        const token = jwt.sign({ user: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
        return res.json({ token });
    }
    res.status(401).json({ erro: "Usuário ou senha incorretos." });
});

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(403).json({ erro: "Faça login." });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ erro: "Sessão expirada." });
        req.user = decoded;
        next();
    });
};

// --- ROTAS ---

app.get('/produtos', async (req, res) => {
    const { busca } = req.query;
    try {
        let queryText = 'SELECT * FROM produtos ORDER BY id DESC';
        let values = [];
        if (busca) {
            queryText = `SELECT * FROM produtos WHERE nome ILIKE $1 OR fabricante ILIKE $1 OR modelo ILIKE $1 ORDER BY id DESC`;
            values = [`%${busca}%`];
        }
        const resultado = await pool.query(queryText, values);
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar no banco." });
    }
});

app.post('/produtos', verificarToken, async (req, res) => {
    const { nome, fabricante, modelo, preco, quantidade, estado, imagem, imagem2, descricao } = req.body;
    try {
        const queryText = `INSERT INTO produtos (nome, fabricante, modelo, preco, quantidade, estado, imagem, imagem2, descricao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
        const values = [nome, fabricante, modelo, preco, quantidade, estado, imagem, imagem2, descricao];
        const resultado = await pool.query(queryText, values);
        res.status(201).json(resultado.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(400).json({ erro: "Erro ao salvar: " + err.message });
    }
});

app.put('/produtos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nome, fabricante, modelo, preco, quantidade, estado, imagem, imagem2, descricao } = req.body;
    try {
        const queryText = `UPDATE produtos SET nome=$1, fabricante=$2, modelo=$3, preco=$4, quantidade=$5, estado=$6, imagem=$7, imagem2=$8, descricao=$9 WHERE id=$10 RETURNING *`;
        const values = [nome, fabricante, modelo, parseFloat(preco), parseInt(quantidade), estado, imagem, imagem2, descricao, id];
        const resultado = await pool.query(queryText, values);
        res.json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/produtos/:id', verificarToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM produtos WHERE id = $1', [req.params.id]);
        res.json({ mensagem: "Excluído!" });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao excluir." });
    }
});

app.listen(PORT, () => console.log(`🚀 Online na porta ${PORT}`));