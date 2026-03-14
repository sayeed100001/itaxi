import express from 'express';
import { AuthController } from '../controllers/authController.js';

const router = express.Router();

// Modular Auth routes
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);

export default router;
