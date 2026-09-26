import express from 'express';
import { mcpServerController } from '../controllers/mcp-server.controller.js';

const router = express.Router();

router.post('/', mcpServerController.handlePost);
router.get('/', mcpServerController.handleGet);
router.delete('/', mcpServerController.handleDelete);

export default router;