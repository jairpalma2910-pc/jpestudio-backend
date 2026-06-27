const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = (pool) => {
  const router = express.Router();

  // LOGIN
  router.post('/login', async (req, res) => {
    try {
      const { usuario, password } = req.body;
      const { rows } = await pool.query('SELECT * FROM usuarios WHERE usuario=$1', [usuario]);
      if (!rows.length) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      const user = rows[0];
      if (!user.activo) return res.status(401).json({ error: 'Usuario inactivo' });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      const token = jwt.sign(
        { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ token, usuario: { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol } });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
