const express = require('express');
const { auth, adminOnly } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();

  router.get('/', auth, adminOnly, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.*, u.nombre as autor FROM sugerencias s 
       JOIN usuarios u ON s.usuario_id=u.id ORDER BY s.created_at DESC`
    );
    res.json(rows);
  });

  router.post('/', auth, async (req, res) => {
    const { titulo, descripcion } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO sugerencias(usuario_id,titulo,descripcion) VALUES($1,$2,$3) RETURNING *',
      [req.user.id, titulo, descripcion]
    );
    res.json(rows[0]);
  });

  router.patch('/:id/leida', auth, adminOnly, async (req, res) => {
    await pool.query('UPDATE sugerencias SET leida=true WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  });

  return router;
};
