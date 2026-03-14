import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development_only';

export class AuthController {
    static async login(req: Request, res: Response): Promise<any> {
        try {
            const { phone, password } = req.body;

            if (!phone || !password) {
                return res.status(400).json({ error: 'Phone and password are required' });
            }

            const user = await prisma.user.findUnique({
                where: { phone }
            });

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

            res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async register(req: Request, res: Response): Promise<any> {
        try {
            const { phone, password, name, role } = req.body;

            if (!phone || !password || !name) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const existingUser = await prisma.user.findUnique({ where: { phone } });
            if (existingUser) {
                return res.status(400).json({ error: 'Phone number already registered' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            // Validate Role
            let requestedRole: "rider" | "driver" | "admin" = "rider";
            if (role === "driver" || role === "admin" || role === "rider") {
                requestedRole = role;
            }

            const user = await prisma.user.create({
                data: {
                    name,
                    phone,
                    password_hash: hashedPassword,
                    role: requestedRole
                }
            });

            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

            res.status(201).json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
