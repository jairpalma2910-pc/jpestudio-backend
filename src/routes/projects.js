const express = require('express');
const { auth } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();

  // Listar proyectos del usuario (o todos si admin)
  router.get('/', auth, async (req, res) => {
    let query, params;
    if (req.user.rol === 'admin') {
      query = `SELECT p.*, u.nombre as autor FROM proyectos p 
               JOIN usuarios u ON p.usuario_id=u.id ORDER BY p.updated_at DESC`;
      params = [];
    } else {
      query = `SELECT p.*, u.nombre as autor FROM proyectos p 
               JOIN usuarios u ON p.usuario_id=u.id 
               WHERE p.usuario_id=$1 ORDER BY p.updated_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  });

  // Obtener proyecto por ID
  router.get('/:id', auth, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM proyectos WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    const p = rows[0];
    if (req.user.rol !== 'admin' && p.usuario_id !== req.user.id)
      return res.status(403).json({ error: 'Sin acceso' });
    res.json(p);
  });

  // Crear proyecto
  router.post('/', auth, async (req, res) => {
    try {
      const { nombre, tipo, html_content } = req.body;
      const { rows } = await pool.query(
        'INSERT INTO proyectos(usuario_id,nombre,tipo,html_content) VALUES($1,$2,$3,$4) RETURNING *',
        [req.user.id, nombre, tipo, html_content]
      );
      res.json(rows[0]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Actualizar proyecto (guardar cambios)
  router.put('/:id', auth, async (req, res) => {
    try {
      const { nombre, html_content } = req.body;
      const check = await pool.query('SELECT usuario_id FROM proyectos WHERE id=$1', [req.params.id]);
      if (!check.rows.length) return res.status(404).json({ error: 'No encontrado' });
      if (req.user.rol !== 'admin' && check.rows[0].usuario_id !== req.user.id)
        return res.status(403).json({ error: 'Sin acceso' });
      const { rows } = await pool.query(
        'UPDATE proyectos SET nombre=$1,html_content=$2,updated_at=NOW() WHERE id=$3 RETURNING *',
        [nombre, html_content, req.params.id]
      );
      res.json(rows[0]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Eliminar proyecto
  router.delete('/:id', auth, async (req, res) => {
    const check = await pool.query('SELECT usuario_id FROM proyectos WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.rol !== 'admin' && check.rows[0].usuario_id !== req.user.id)
      return res.status(403).json({ error: 'Sin acceso' });
    await pool.query('DELETE FROM proyectos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  });

  return router;
};
