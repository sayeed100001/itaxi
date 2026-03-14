// اسکریپت تست یکپارچگی کامل سیستم iTaxi
// این اسکریپت تمام اتصالات و یکپارچگی سیستم را بررسی میکند

const fs = require('fs');
const path = require('path');

class iTaxiIntegrationTester {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.passed = [];
        this.basePath = process.cwd();
    }

    log(type, message, details = '') {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, type, message, details };
        
        switch(type) {
            case 'ERROR':
                this.errors.push(logEntry);
                console.log(`🔴 ERROR: ${message}`, details ? `\n   Details: ${details}` : '');
                break;
            case 'WARNING':
                this.warnings.push(logEntry);
                console.log(`🟡 WARNING: ${message}`, details ? `\n   Details: ${details}` : '');
                break;
            case 'PASS':
                this.passed.push(logEntry);
                console.log(`✅ PASS: ${message}`);
                break;
            case 'INFO':
                console.log(`ℹ️  INFO: ${message}`);
                break;
        }
    }

    fileExists(filePath) {
        const fullPath = path.join(this.basePath, filePath);
        return fs.existsSync(fullPath);
    }

    readFile(filePath) {
        try {
            const fullPath = path.join(this.basePath, filePath);
            return fs.readFileSync(fullPath, 'utf8');
        } catch (error) {
            return null;
        }
    }

    // تست 1: بررسی فایلهای حیاتی
    testCriticalFiles() {
        this.log('INFO', 'Testing critical files existence...');
        
        const criticalFiles = [
            'package.json',
            'server.ts',
            'App.tsx',
            'store.ts',
            'types.ts',
            'schema.sql',
            'db-config.ts',
            'services/taxiTypes.ts',
            'services/adminAPI.ts',
            'components/Map/RealMap.tsx',
            'pages/Admin/AdminDriversPage.tsx'
        ];

        criticalFiles.forEach(file => {
            if (this.fileExists(file)) {
                this.log('PASS', `Critical file exists: ${file}`);
            } else {
                this.log('ERROR', `Critical file missing: ${file}`);
            }
        });
    }

    // تست 2: بررسی وابستگیها
    testDependencies() {
        this.log('INFO', 'Testing package dependencies...');
        
        const packageJson = this.readFile('package.json');
        if (!packageJson) {
            this.log('ERROR', 'package.json not found');
            return;
        }

        try {
            const pkg = JSON.parse(packageJson);
            const requiredDeps = [
                'react', 'express', 'socket.io', 'mysql2', 'leaflet', 
                'react-leaflet', 'zustand', 'lucide-react', 'bcrypt', 'jsonwebtoken'
            ];

            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            
            requiredDeps.forEach(dep => {
                if (allDeps[dep]) {
                    this.log('PASS', `Dependency found: ${dep}@${allDeps[dep]}`);
                } else {
                    this.log('ERROR', `Missing dependency: ${dep}`);
                }
            });
        } catch (error) {
            this.log('ERROR', 'Invalid package.json format', error.message);
        }
    }

    // تست 3: بررسی imports و exports
    testImportsExports() {
        this.log('INFO', 'Testing imports and exports...');
        
        // بررسی App.tsx
        const appContent = this.readFile('App.tsx');
        if (appContent) {
            if (appContent.includes('SuperAdminPanel') && !appContent.includes('AdminDriversPage')) {
                this.log('ERROR', 'App.tsx has incorrect import: SuperAdminPanel instead of AdminDriversPage');
            } else {
                this.log('PASS', 'App.tsx imports are correct');
            }
        }

        // بررسی store.ts
        const storeContent = this.readFile('store.ts');
        if (storeContent) {
            const requiredActions = [
                'setSelectedTaxiType', 'updateTaxiType', 'addTaxiType', 'removeTaxiType'
            ];
            
            requiredActions.forEach(action => {
                if (storeContent.includes(action)) {
                    this.log('PASS', `Store action found: ${action}`);
                } else {
                    this.log('WARNING', `Store action missing: ${action}`);
                }
            });
        }
    }

    // تست 4: بررسی API endpoints
    testAPIEndpoints() {
        this.log('INFO', 'Testing API endpoints...');
        
        const serverContent = this.readFile('server.ts');
        if (!serverContent) {
            this.log('ERROR', 'server.ts not found');
            return;
        }

        const requiredEndpoints = [
            '/api/admin/taxi-types',
            '/api/admin/system-metrics',
            '/api/drivers',
            '/api/rides',
            '/api/auth/login'
        ];

        requiredEndpoints.forEach(endpoint => {
            if (serverContent.includes(endpoint)) {
                this.log('PASS', `API endpoint found: ${endpoint}`);
            } else {
                this.log('ERROR', `API endpoint missing: ${endpoint}`);
            }
        });
    }

    // تست 5: بررسی database schema
    testDatabaseSchema() {
        this.log('INFO', 'Testing database schema...');
        
        const schemaContent = this.readFile('schema.sql');
        if (!schemaContent) {
            this.log('ERROR', 'schema.sql not found');
            return;
        }

        const requiredTables = [
            'users', 'drivers', 'rides', 'hotels', 'transactions',
            'admin_settings', 'chat_messages'
        ];

        requiredTables.forEach(table => {
            if (schemaContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
                this.log('PASS', `Database table found: ${table}`);
            } else {
                this.log('ERROR', `Database table missing: ${table}`);
            }
        });

        // بررسی جدول taxi_types
        if (!schemaContent.includes('taxi_types')) {
            this.log('ERROR', 'Critical table missing: taxi_types (required for taxi type management)');
        }
    }

    // تست 6: بررسی تصاویر و assets
    testAssets() {
        this.log('INFO', 'Testing assets and images...');
        
        const requiredImages = [
            'img/map img/1.png',
            'img/map img/2.png', 
            'img/map img/3big taxi.png',
            'img/map img/4.png'
        ];

        requiredImages.forEach(img => {
            if (this.fileExists(img)) {
                this.log('PASS', `Taxi image found: ${img}`);
            } else {
                this.log('ERROR', `Taxi image missing: ${img}`);
            }
        });
    }

    // تست 7: بررسی type safety
    testTypeSafety() {
        this.log('INFO', 'Testing type safety...');
        
        const files = ['store.ts', 'types.ts', 'services/taxiTypes.ts'];
        
        files.forEach(file => {
            const content = this.readFile(file);
            if (content) {
                const asAnyCount = (content.match(/as any/g) || []).length;
                if (asAnyCount > 0) {
                    this.log('WARNING', `Type safety issue in ${file}: ${asAnyCount} "as any" usages found`);
                } else {
                    this.log('PASS', `Type safety good in ${file}`);
                }
            }
        });
    }

    // تست 8: بررسی CSS و styling
    testStyling() {
        this.log('INFO', 'Testing CSS and styling...');
        
        if (this.fileExists('components/Map/MapIcons.css')) {
            this.log('PASS', 'Map icons CSS found');
        } else {
            this.log('ERROR', 'Map icons CSS missing');
        }

        if (this.fileExists('index.css')) {
            this.log('PASS', 'Main CSS found');
        } else {
            this.log('WARNING', 'Main CSS missing');
        }
    }

    // تست 9: بررسی configuration files
    testConfiguration() {
        this.log('INFO', 'Testing configuration files...');
        
        const configFiles = [
            'vite.config.ts',
            'tailwind.config.js',
            'tsconfig.json',
            '.env.example'
        ];

        configFiles.forEach(file => {
            if (this.fileExists(file)) {
                this.log('PASS', `Config file found: ${file}`);
            } else {
                this.log('WARNING', `Config file missing: ${file}`);
            }
        });
    }

    // تست 10: بررسی services integration
    testServicesIntegration() {
        this.log('INFO', 'Testing services integration...');
        
        const taxiTypesContent = this.readFile('services/taxiTypes.ts');
        const adminAPIContent = this.readFile('services/adminAPI.ts');
        
        if (taxiTypesContent && adminAPIContent) {
            if (taxiTypesContent.includes('TAXI_TYPES') && adminAPIContent.includes('TaxiTypeAPI')) {
                this.log('PASS', 'Services integration looks good');
            } else {
                this.log('ERROR', 'Services integration incomplete');
            }
        } else {
            this.log('ERROR', 'Critical services missing');
        }
    }

    // اجرای تمام تستها
    async runAllTests() {
        console.log('🚀 Starting iTaxi Integration Tests...\n');
        
        this.testCriticalFiles();
        this.testDependencies();
        this.testImportsExports();
        this.testAPIEndpoints();
        this.testDatabaseSchema();
        this.testAssets();
        this.testTypeSafety();
        this.testStyling();
        this.testConfiguration();
        this.testServicesIntegration();
        
        this.generateReport();
    }

    // تولید گزارش نهایی
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 INTEGRATION TEST REPORT');
        console.log('='.repeat(60));
        
        console.log(`✅ Passed: ${this.passed.length}`);
        console.log(`🟡 Warnings: ${this.warnings.length}`);
        console.log(`🔴 Errors: ${this.errors.length}`);
        
        const totalTests = this.passed.length + this.warnings.length + this.errors.length;
        const successRate = ((this.passed.length / totalTests) * 100).toFixed(1);
        
        console.log(`\n📈 Success Rate: ${successRate}%`);
        
        if (this.errors.length > 0) {
            console.log('\n🔴 CRITICAL ERRORS:');
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.message}`);
                if (error.details) console.log(`   ${error.details}`);
            });
        }
        
        if (this.warnings.length > 0) {
            console.log('\n🟡 WARNINGS:');
            this.warnings.forEach((warning, index) => {
                console.log(`${index + 1}. ${warning.message}`);
            });
        }
        
        // تعیین وضعیت کلی سیستم
        let systemStatus = 'HEALTHY';
        if (this.errors.length > 5) {
            systemStatus = 'CRITICAL';
        } else if (this.errors.length > 0 || this.warnings.length > 10) {
            systemStatus = 'NEEDS_ATTENTION';
        }
        
        console.log(`\n🎯 SYSTEM STATUS: ${systemStatus}`);
        
        // راهنمای اقدامات بعدی
        console.log('\n📋 NEXT STEPS:');
        if (this.errors.length > 0) {
            console.log('1. Run CRITICAL-FIXES.sql to fix database issues');
            console.log('2. Fix import/export errors in components');
            console.log('3. Add missing dependencies');
        }
        if (this.warnings.length > 0) {
            console.log('4. Review type safety issues');
            console.log('5. Add missing configuration files');
        }
        console.log('6. Test the application manually');
        console.log('7. Run integration tests again');
        
        console.log('\n' + '='.repeat(60));
        
        // ذخیره گزارش در فایل
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                passed: this.passed.length,
                warnings: this.warnings.length,
                errors: this.errors.length,
                successRate: successRate,
                systemStatus: systemStatus
            },
            details: {
                passed: this.passed,
                warnings: this.warnings,
                errors: this.errors
            }
        };
        
        try {
            fs.writeFileSync('integration-test-report.json', JSON.stringify(report, null, 2));
            console.log('📄 Detailed report saved to: integration-test-report.json');
        } catch (error) {
            console.log('⚠️  Could not save report file');
        }
    }
}

// اجرای تست
if (require.main === module) {
    const tester = new iTaxiIntegrationTester();
    tester.runAllTests();
}

module.exports = iTaxiIntegrationTester;