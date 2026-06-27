const express = require('express');
const { auth, adminOnly } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();

  // Listar solicitudes (admin ve todas, invitado sus propias)
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

  // Crear solicitud de descarga
  router.post('/', auth, async (req, res) => {
    try {
      const { proyecto_id, mensaje } = req.body;
      // Verificar que el proyecto pertenece al usuario
      const p = await pool.query('SELECT id FROM proyectos WHERE id=$1 AND usuario_id=$2', [proyecto_id, req.user.id]);
      if (!p.rows.length) return res.status(403).json({ error: 'Sin acceso al proyecto' });
      // Verificar que no haya solicitud pendiente
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

  // Aprobar o rechazar solicitud (admin)
  router.patch('/:id', auth, adminOnly, async (req, res) => {
    const { estado, respuesta } = req.body; // 'aprobada' | 'rechazada'
    const { rows } = await pool.query(
      'UPDATE solicitudes SET estado=$1,respuesta=$2,updated_at=NOW() WHERE id=$3 RETURNING *',
      [estado, respuesta || '', req.params.id]
    );
    res.json(rows[0]);
  });

  return router;
};
