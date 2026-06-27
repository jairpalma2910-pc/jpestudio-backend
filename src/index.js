require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// DB
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Rutas
app.use('/api/auth',     require('./routes/auth')(pool));
app.use('/api/users',    require('./routes/users')(pool));
app.use('/api/projects', require('./routes/projects')(pool));
app.use('/api/requests', require('./routes/requests')(pool));
app.use('/api/suggestions', require('./routes/suggestions')(pool));

app.get('/', (req, res) => res.json({ ok: true, app: 'JP Estudio API' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`JP Estudio API corriendo en puerto ${PORT}`));
