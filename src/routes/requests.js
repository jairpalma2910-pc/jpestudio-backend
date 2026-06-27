const express = require('express');
const crypto = require('crypto');
const { auth, adminOnly } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();

  // Listar solicitudes
  router.get('/', auth, async (req, res) => {
    let query, params;
    if (req.user.rol === 'admin') {
      query = `SELECT s.*, u.nombre as solicitante, p.nombre as proyecto_nombre, p.tipo
               FROM solicitudes s JOIN usuarios u ON s.usuario_id=u.id
               JOIN proyectos p ON s.proyecto_id=p.id ORDER BY s.created_at DESC`;
      params = [];
    } else {
      query = `SELECT s.*, p.nombre as proyecto_nombre, p.tipo
               FROM solicitudes s JOIN proyectos p ON s.proyecto_id=p.id
               WHERE s.usuario_id=$1 ORDER BY s.created_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  });

  // Crear solicitud
  router.post('/', auth, async (req, res) => {
    try {
      const { proyecto_id, mensaje } = req.body;
      const p = await pool.query('SELECT id FROM proyectos WHERE id=$1 AND usuario_id=$2', [proyecto_id, req.user.id]);
      if (!p.rows.length) return res.status(403).json({ error: 'Sin acceso al proyecto' });
      const exist = await pool.query(
        'SELECT id FROM solicitudes WHERE proyecto_id=$1 AND usuario_id=$2 AND estado=$3',
        [proyecto_id, req.user.id, 'pendiente']
      );
      if (exist.rows.length) return res.status(400).json({ error: 'Ya tienes una solicitud pendiente para este proyecto' });
      const { rows } = await pool.query(
        'INSERT INTO solicitudes(usuario_id,proyecto_id,mensaje) VALUES($1,$2,$3) RETURNING *',
        [req.user.id, proyecto_id, mensaje || '']
      );
      res.json(rows[0]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Aprobar o rechazar (admin) — al aprobar genera token
  router.patch('/:id', auth, adminOnly, async (req, res) => {
    const { estado, respuesta } = req.body;
    let token = null;
    if (estado === 'aprobada') {
      token = crypto.randomBytes(32).toString('hex');
    }
    const { rows } = await pool.query(
      `UPDATE solicitudes 
       SET estado=$1, respuesta=$2, updated_at=NOW(),
           link_token = CASE WHEN $1='aprobada' THEN $3 ELSE link_token END
       WHERE id=$4 RETURNING *`,
      [estado, respuesta || '', token, req.params.id]
    );
    res.json(rows[0]);
  });

  // Revocar link (admin) — desactiva el token sin cambiar estado
  router.patch('/:id/revocar', auth, adminOnly, async (req, res) => {
    const { rows } = await pool.query(
      'UPDATE solicitudes SET link_token=NULL, updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    res.json(rows[0]);
  });

  // Reactivar link (admin) — genera nuevo token
  router.patch('/:id/reactivar', auth, adminOnly, async (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    const { rows } = await pool.query(
      'UPDATE solicitudes SET link_token=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [token, req.params.id]
    );
    res.json(rows[0]);
  });

  // Ver proyecto por token (público, sin auth)
  router.get('/present/:token', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT s.link_token, p.html_content, p.nombre, p.tipo
         FROM solicitudes s JOIN proyectos p ON s.proyecto_id=p.id
         WHERE s.link_token=$1 AND s.estado='aprobada'`,
        [req.params.token]
      );
      if (!rows.length) return res.status(404).json({ error: 'Link inválido o revocado' });
      res.json({ nombre: rows[0].nombre, tipo: rows[0].tipo, html: rows[0].html_content });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
