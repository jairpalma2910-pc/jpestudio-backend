const express = require('express');
const bcrypt = require('bcryptjs');
const { auth, adminOnly } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();

  // Listar usuarios (admin)
  router.get('/', auth, adminOnly, async (req, res) => {
    const { rows } = await pool.query('SELECT id,usuario,nombre,rol,activo,created_at FROM usuarios ORDER BY created_at DESC');
    res.json(rows);
  });

  // Crear usuario (admin)
  router.post('/', auth, adminOnly, async (req, res) => {
    try {
      const { usuario, password, nombre, rol } = req.body;
      const hash = await bcrypt.hash(password, 10);
      const { rows } = await pool.query(
        'INSERT INTO usuarios(usuario,password_hash,nombre,rol) VALUES($1,$2,$3,$4) RETURNING id,usuario,nombre,rol,activo',
        [usuario, hash, nombre, rol || 'invitado']
      );
      res.json(rows[0]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Activar/desactivar usuario (admin)
  router.patch('/:id/toggle', auth, adminOnly, async (req, res) => {
    const { rows } = await pool.query(
      'UPDATE usuarios SET activo=NOT activo WHERE id=$1 RETURNING id,activo',
      [req.params.id]
    );
    res.json(rows[0]);
  });

  // Cambiar contraseña (admin)
  router.patch('/:id/password', auth, adminOnly, async (req, res) => {
    const hash = await bcrypt.hash(req.body.password, 10);
    await pool.query('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    res.json({ ok: true });
  });

  // Eliminar usuario (admin)
  router.delete('/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  });

  return router;
};
