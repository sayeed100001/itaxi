import express from 'express';
import { AdminController } from '../controllers/adminController.js';

const router = express.Router();

// Requirement 11: User Management
router.get('/users', AdminController.getAllUsers);

// Requirement 9: KYC Approval with Vehicle Type (Req 8)
router.post('/drivers/:id/kyc', AdminController.approveDriverKYC);

// Requirement 11: Monthly Revenue
router.get('/revenue', AdminController.getSystemRevenue);

// Legacy route (keep for backward compatibility)
router.post('/kyc/approve/:id', AdminController.approveDriverKYC);

export default router;
