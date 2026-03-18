// Test script to generate admin token
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

// Admin user from database
const adminUser = {
    id: 'u0',
    role: 'admin',
    name: 'Admin User',
    phone: '+10000000000'
};

const token = jwt.sign(
    { id: adminUser.id, role: adminUser.role },
    JWT_SECRET,
    { expiresIn: '24h' }
);

console.log('\n=== Admin Token Generated ===');
console.log('Token:', token);
console.log('\n=== How to use ===');
console.log('1. Open browser DevTools (F12)');
console.log('2. Go to Console tab');
console.log('3. Run: localStorage.setItem("token", "' + token + '")');
console.log('4. Refresh the page');
console.log('\n=== Or Login Again ===');
console.log('Phone: +10000000000');
console.log('Password: admin123');
console.log('\n');
