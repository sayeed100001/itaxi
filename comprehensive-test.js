// اسکریپت تست کامل یکپارچگی سیستم iTaxi
// بررسی عمیق تمام اتصالات، API endpoints، database، و frontend integration

const fs = require('fs');
const path = require('path');

class ComprehensiveIntegrationTester {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.passed = [];
        this.basePath = process.cwd();
        this.testResults = {
            database: { score: 0, issues: [] },
            api: { score: 0, issues: [] },
            frontend: { score: 0, issues: [] },
            integration: { score: 0, issues: [] },
            security: { score: 0, issues: [] }
        };
    }

    log(type, category, message, details = '') {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, type, category, message, details };
        
        switch(type) {
            case 'ERROR':
                this.errors.push(logEntry);
                this.testResults[category]?.issues.push({ type: 'error', message, details });
                console.log(`🔴 [${category.toUpperCase()}] ERROR: ${message}`, details ? `\n   Details: ${details}` : '');
                break;
            case 'WARNING':
                this.warnings.push(logEntry);
                this.testResults[category]?.issues.push({ type: 'warning', message, details });
                console.log(`🟡 [${category.toUpperCase()}] WARNING: ${message}`, details ? `\n   Details: ${details}` : '');
                break;
            case 'PASS':
                this.passed.push(logEntry);
                console.log(`✅ [${category.toUpperCase()}] PASS: ${message}`);
                break;
            case 'INFO':
                console.log(`ℹ️  [${category.toUpperCase()}] INFO: ${message}`);
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

    // تست 1: بررسی کامل دیتابیس
    testDatabaseIntegrity() {
        this.log('INFO', 'database', 'Testing database integrity...');
        
        // بررسی فایلهای دیتابیس
        const dbFiles = ['schema.sql', 'DATABASE-SYNC.sql', 'CRITICAL-FIXES.sql', 'db-config.ts'];
        let dbScore = 0;
        
        dbFiles.forEach(file => {
            if (this.fileExists(file)) {
                this.log('PASS', 'database', `Database file exists: ${file}`);
                dbScore += 20;
            } else {
                this.log('ERROR', 'database', `Database file missing: ${file}`);
            }
        });

        // بررسی محتوای schema
        const schemaContent = this.readFile('schema.sql');
        const syncContent = this.readFile('DATABASE-SYNC.sql');
        
        if (schemaContent || syncContent) {
            const content = syncContent || schemaContent;
            const requiredTables = [
                'users', 'drivers', 'rides', 'taxi_types', 'system_settings',
                'transactions', 'credit_requests', 'withdrawal_requests',
                'chat_messages', 'admin_settings', 'notifications', 'admin_logs'
            ];

            let foundTables = 0;
            requiredTables.forEach(table => {
                if (content.includes(`CREATE TABLE IF NOT EXISTS ${table}`) || 
                    content.includes(`CREATE TABLE ${table}`)) {
                    this.log('PASS', 'database', `Required table found: ${table}`);
                    foundTables++;
                } else {
                    this.log('ERROR', 'database', `Required table missing: ${table}`);
                }
            });

            dbScore += (foundTables / requiredTables.length) * 60;

            // بررسی foreign keys
            if (content.includes('FOREIGN KEY')) {
                this.log('PASS', 'database', 'Foreign key constraints found');
                dbScore += 10;
            } else {
                this.log('WARNING', 'database', 'No foreign key constraints found');
            }

            // بررسی indexes
            if (content.includes('INDEX') || content.includes('KEY')) {
                this.log('PASS', 'database', 'Database indexes found');
                dbScore += 10;
            } else {
                this.log('WARNING', 'database', 'No database indexes found');
            }
        }

        this.testResults.database.score = Math.min(100, dbScore);
    }

    // تست 2: بررسی کامل API
    testAPIIntegrity() {
        this.log('INFO', 'api', 'Testing API integrity...');
        
        const serverContent = this.readFile('server.ts');
        const adminAPIContent = this.readFile('services/adminAPI.ts');
        const apiContent = this.readFile('services/api.ts');
        
        let apiScore = 0;

        if (serverContent) {
            // بررسی API endpoints حیاتی
            const criticalEndpoints = [
                '/api/auth/login',
                '/api/auth/register', 
                '/api/drivers',
                '/api/rides',
                '/api/admin/taxi-types',
                '/api/admin/system-metrics',
                '/api/wallet',
                '/api/chat'
            ];

            let foundEndpoints = 0;
            criticalEndpoints.forEach(endpoint => {
                if (serverContent.includes(`"${endpoint}"`) || serverContent.includes(`'${endpoint}'`)) {
                    this.log('PASS', 'api', `API endpoint found: ${endpoint}`);
                    foundEndpoints++;
                } else {
                    this.log('ERROR', 'api', `API endpoint missing: ${endpoint}`);
                }
            });

            apiScore += (foundEndpoints / criticalEndpoints.length) * 40;

            // بررسی middleware
            const middlewares = ['authenticateToken', 'cors', 'helmet', 'rateLimit'];
            let foundMiddlewares = 0;
            middlewares.forEach(middleware => {
                if (serverContent.includes(middleware)) {
                    this.log('PASS', 'api', `Middleware found: ${middleware}`);
                    foundMiddlewares++;
                } else {
                    this.log('WARNING', 'api', `Middleware missing: ${middleware}`);
                }
            });

            apiScore += (foundMiddlewares / middlewares.length) * 20;

            // بررسی error handling
            if (serverContent.includes('try') && serverContent.includes('catch')) {
                this.log('PASS', 'api', 'Error handling found in server');
                apiScore += 15;
            } else {
                this.log('ERROR', 'api', 'No error handling found in server');
            }

            // بررسی validation
            if (serverContent.includes('zod') || serverContent.includes('validation')) {
                this.log('PASS', 'api', 'Input validation found');
                apiScore += 15;
            } else {
                this.log('WARNING', 'api', 'No input validation found');
            }
        }

        if (adminAPIContent) {
            if (adminAPIContent.includes('class AdminAPI')) {
                this.log('PASS', 'api', 'AdminAPI service found');
                apiScore += 10;
            } else {
                this.log('ERROR', 'api', 'AdminAPI service missing');
            }
        }

        this.testResults.api.score = Math.min(100, apiScore);
    }

    // تست 3: بررسی کامل Frontend
    testFrontendIntegrity() {
        this.log('INFO', 'frontend', 'Testing frontend integrity...');
        
        let frontendScore = 0;

        // بررسی فایلهای اصلی
        const coreFiles = [
            'App.tsx', 'store.ts', 'types.ts', 'index.tsx',
            'components/Map/RealMap.tsx', 'pages/Admin/AdminDriversPage.tsx',
            'services/taxiTypes.ts', 'services/socketService.ts'
        ];

        let foundFiles = 0;
        coreFiles.forEach(file => {
            if (this.fileExists(file)) {
                this.log('PASS', 'frontend', `Core file found: ${file}`);
                foundFiles++;
            } else {
                this.log('ERROR', 'frontend', `Core file missing: ${file}`);
            }
        });

        frontendScore += (foundFiles / coreFiles.length) * 30;

        // بررسی App.tsx
        const appContent = this.readFile('App.tsx');
        if (appContent) {
            if (appContent.includes('AdminDriversPage') && !appContent.includes('SuperAdminPanel')) {
                this.log('PASS', 'frontend', 'App.tsx imports are correct');
                frontendScore += 15;
            } else {
                this.log('ERROR', 'frontend', 'App.tsx has incorrect imports');
            }

            if (appContent.includes('useAppStore')) {
                this.log('PASS', 'frontend', 'Store integration found in App.tsx');
                frontendScore += 10;
            } else {
                this.log('ERROR', 'frontend', 'No store integration in App.tsx');
            }
        }

        // بررسی store.ts
        const storeContent = this.readFile('store.ts');
        if (storeContent) {
            const storeActions = [
                'setSelectedTaxiType', 'updateTaxiType', 'addTaxiType', 'removeTaxiType',
                'createRide', 'updateRideStatus', 'openChat', 'closeChat'
            ];

            let foundActions = 0;
            storeActions.forEach(action => {
                if (storeContent.includes(action)) {
                    this.log('PASS', 'frontend', `Store action found: ${action}`);
                    foundActions++;
                } else {
                    this.log('WARNING', 'frontend', `Store action missing: ${action}`);
                }
            });

            frontendScore += (foundActions / storeActions.length) * 20;

            // بررسی type safety
            const asAnyCount = (storeContent.match(/as any/g) || []).length;
            if (asAnyCount === 0) {
                this.log('PASS', 'frontend', 'No type safety issues in store');
                frontendScore += 15;
            } else if (asAnyCount < 5) {
                this.log('WARNING', 'frontend', `Minor type safety issues: ${asAnyCount} "as any" usages`);
                frontendScore += 10;
            } else {
                this.log('ERROR', 'frontend', `Major type safety issues: ${asAnyCount} "as any" usages`);
            }
        }

        // بررسی components
        const mapContent = this.readFile('components/Map/RealMap.tsx');
        if (mapContent) {
            if (mapContent.includes('createTaxiIcon') && mapContent.includes('determineTaxiType')) {
                this.log('PASS', 'frontend', 'Map component has taxi type integration');
                frontendScore += 10;
            } else {
                this.log('WARNING', 'frontend', 'Map component missing taxi type integration');
            }
        }

        this.testResults.frontend.score = Math.min(100, frontendScore);
    }

    // تست 4: بررسی یکپارچگی کامل
    testSystemIntegration() {
        this.log('INFO', 'integration', 'Testing system integration...');
        
        let integrationScore = 0;

        // بررسی ارتباط frontend-backend
        const storeContent = this.readFile('store.ts');
        const serverContent = this.readFile('server.ts');
        
        if (storeContent && serverContent) {
            // بررسی API calls در store
            const apiCalls = ['/api/rides', '/api/drivers', '/api/auth', '/api/wallet'];
            let foundCalls = 0;
            
            apiCalls.forEach(call => {
                if (storeContent.includes(call) && serverContent.includes(call)) {
                    this.log('PASS', 'integration', `API integration found: ${call}`);
                    foundCalls++;
                } else {
                    this.log('ERROR', 'integration', `API integration missing: ${call}`);
                }
            });

            integrationScore += (foundCalls / apiCalls.length) * 30;
        }

        // بررسی taxi types integration
        const taxiTypesContent = this.readFile('services/taxiTypes.ts');
        const adminAPIContent = this.readFile('services/adminAPI.ts');
        
        if (taxiTypesContent && adminAPIContent && serverContent) {
            if (taxiTypesContent.includes('TAXI_TYPES') && 
                adminAPIContent.includes('TaxiTypeAPI') && 
                serverContent.includes('/api/admin/taxi-types')) {
                this.log('PASS', 'integration', 'Taxi types fully integrated');
                integrationScore += 25;
            } else {
                this.log('ERROR', 'integration', 'Taxi types integration incomplete');
            }
        }

        // بررسی socket integration
        const socketServiceContent = this.readFile('services/socketService.ts');
        if (socketServiceContent && serverContent) {
            if (socketServiceContent.includes('socket.io-client') && 
                serverContent.includes('socket.io')) {
                this.log('PASS', 'integration', 'Socket.IO integration found');
                integrationScore += 20;
            } else {
                this.log('WARNING', 'integration', 'Socket.IO integration incomplete');
            }
        }

        // بررسی database-API integration
        const dbConfigContent = this.readFile('db-config.ts');
        if (dbConfigContent && serverContent) {
            if (dbConfigContent.includes('mysql') && serverContent.includes('query')) {
                this.log('PASS', 'integration', 'Database-API integration found');
                integrationScore += 25;
            } else {
                this.log('ERROR', 'integration', 'Database-API integration missing');
            }
        }

        this.testResults.integration.score = Math.min(100, integrationScore);
    }

    // تست 5: بررسی امنیت
    testSecurityIntegrity() {
        this.log('INFO', 'security', 'Testing security integrity...');
        
        let securityScore = 0;
        const serverContent = this.readFile('server.ts');
        
        if (serverContent) {
            // بررسی authentication
            if (serverContent.includes('authenticateToken') && serverContent.includes('jwt')) {
                this.log('PASS', 'security', 'JWT authentication found');
                securityScore += 25;
            } else {
                this.log('ERROR', 'security', 'No JWT authentication found');
            }

            // بررسی password hashing
            if (serverContent.includes('bcrypt')) {
                this.log('PASS', 'security', 'Password hashing found');
                securityScore += 20;
            } else {
                this.log('ERROR', 'security', 'No password hashing found');
            }

            // بررسی rate limiting
            if (serverContent.includes('rateLimit')) {
                this.log('PASS', 'security', 'Rate limiting found');
                securityScore += 15;
            } else {
                this.log('WARNING', 'security', 'No rate limiting found');
            }

            // بررسی CORS
            if (serverContent.includes('cors')) {
                this.log('PASS', 'security', 'CORS configuration found');
                securityScore += 15;
            } else {
                this.log('WARNING', 'security', 'No CORS configuration found');
            }

            // بررسی helmet
            if (serverContent.includes('helmet')) {
                this.log('PASS', 'security', 'Security headers (helmet) found');
                securityScore += 15;
            } else {
                this.log('WARNING', 'security', 'No security headers found');
            }

            // بررسی input validation
            if (serverContent.includes('zod') || serverContent.includes('validation')) {
                this.log('PASS', 'security', 'Input validation found');
                securityScore += 10;
            } else {
                this.log('ERROR', 'security', 'No input validation found');
            }
        }

        this.testResults.security.score = Math.min(100, securityScore);
    }

    // تست 6: بررسی assets و تصاویر
    testAssetsIntegrity() {
        this.log('INFO', 'integration', 'Testing assets integrity...');
        
        const requiredImages = [
            'img/map img/1.png',
            'img/map img/2.png', 
            'img/map img/3big taxi.png',
            'img/map img/4.png'
        ];

        let foundImages = 0;
        requiredImages.forEach(img => {
            if (this.fileExists(img)) {
                this.log('PASS', 'integration', `Taxi image found: ${img}`);
                foundImages++;
            } else {
                this.log('ERROR', 'integration', `Taxi image missing: ${img}`);
            }
        });

        // بررسی CSS
        if (this.fileExists('components/Map/MapIcons.css')) {
            this.log('PASS', 'integration', 'Map icons CSS found');
        } else {
            this.log('ERROR', 'integration', 'Map icons CSS missing');
        }

        return (foundImages / requiredImages.length) * 100;
    }

    // اجرای تمام تستها
    async runComprehensiveTests() {
        console.log('🚀 Starting Comprehensive iTaxi Integration Tests...\n');
        console.log('=' .repeat(80));
        
        this.testDatabaseIntegrity();
        console.log('');
        this.testAPIIntegrity();
        console.log('');
        this.testFrontendIntegrity();
        console.log('');
        this.testSystemIntegration();
        console.log('');
        this.testSecurityIntegrity();
        console.log('');
        const assetsScore = this.testAssetsIntegrity();
        
        this.generateComprehensiveReport(assetsScore);
    }

    // تولید گزارش جامع
    generateComprehensiveReport(assetsScore = 0) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPREHENSIVE INTEGRATION TEST REPORT');
        console.log('='.repeat(80));
        
        // محاسبه امتیازات
        const scores = {
            database: this.testResults.database.score,
            api: this.testResults.api.score,
            frontend: this.testResults.frontend.score,
            integration: this.testResults.integration.score,
            security: this.testResults.security.score,
            assets: assetsScore
        };

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;

        console.log('📈 CATEGORY SCORES:');
        Object.entries(scores).forEach(([category, score]) => {
            const status = score >= 80 ? '✅' : score >= 60 ? '🟡' : '🔴';
            console.log(`${status} ${category.toUpperCase()}: ${score.toFixed(1)}%`);
        });

        console.log(`\n🎯 OVERALL SYSTEM SCORE: ${totalScore.toFixed(1)}%`);
        
        // تعیین وضعیت کلی
        let systemStatus = 'PRODUCTION_READY';
        let statusIcon = '✅';
        
        if (totalScore < 50) {
            systemStatus = 'CRITICAL_ISSUES';
            statusIcon = '🔴';
        } else if (totalScore < 70) {
            systemStatus = 'NEEDS_MAJOR_FIXES';
            statusIcon = '🟡';
        } else if (totalScore < 85) {
            systemStatus = 'NEEDS_MINOR_FIXES';
            statusIcon = '🟡';
        }

        console.log(`\n${statusIcon} SYSTEM STATUS: ${systemStatus}`);
        
        // خلاصه مشکلات
        console.log(`\n📊 ISSUE SUMMARY:`);
        console.log(`✅ Passed Tests: ${this.passed.length}`);
        console.log(`🟡 Warnings: ${this.warnings.length}`);
        console.log(`🔴 Critical Errors: ${this.errors.length}`);
        
        // مشکلات حیاتی
        if (this.errors.length > 0) {
            console.log('\n🔴 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:');
            this.errors.slice(0, 10).forEach((error, index) => {
                console.log(`${index + 1}. [${error.category.toUpperCase()}] ${error.message}`);
            });
            
            if (this.errors.length > 10) {
                console.log(`... and ${this.errors.length - 10} more errors`);
            }
        }

        // راهنمای اقدامات
        console.log('\n📋 RECOMMENDED ACTIONS:');
        
        if (scores.database < 80) {
            console.log('1. 🗄️  Run DATABASE-SYNC.sql to fix database issues');
        }
        if (scores.api < 80) {
            console.log('2. 🔧 Fix API endpoints and error handling');
        }
        if (scores.frontend < 80) {
            console.log('3. ⚛️  Fix frontend imports and type safety issues');
        }
        if (scores.integration < 80) {
            console.log('4. 🔗 Fix system integration and data flow');
        }
        if (scores.security < 80) {
            console.log('5. 🔒 Implement missing security measures');
        }
        if (scores.assets < 80) {
            console.log('6. 🖼️  Add missing assets and images');
        }

        console.log('7. 🧪 Run integration tests again after fixes');
        console.log('8. 🚀 Deploy to staging environment for testing');
        
        console.log('\n' + '='.repeat(80));
        
        // ذخیره گزارش جامع
        const comprehensiveReport = {
            timestamp: new Date().toISOString(),
            overallScore: totalScore,
            systemStatus: systemStatus,
            categoryScores: scores,
            summary: {
                passed: this.passed.length,
                warnings: this.warnings.length,
                errors: this.errors.length
            },
            detailedResults: this.testResults,
            recommendations: this.generateRecommendations(scores)
        };
        
        try {
            fs.writeFileSync('comprehensive-integration-report.json', JSON.stringify(comprehensiveReport, null, 2));
            console.log('📄 Comprehensive report saved to: comprehensive-integration-report.json');
        } catch (error) {
            console.log('⚠️  Could not save comprehensive report file');
        }

        return comprehensiveReport;
    }

    generateRecommendations(scores) {
        const recommendations = [];
        
        if (scores.database < 80) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Database',
                action: 'Execute DATABASE-SYNC.sql script',
                description: 'Fix missing tables, foreign keys, and indexes'
            });
        }

        if (scores.security < 70) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Security',
                action: 'Implement comprehensive security measures',
                description: 'Add input validation, rate limiting, and proper authentication'
            });
        }

        if (scores.integration < 75) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Integration',
                action: 'Fix API-Frontend integration',
                description: 'Ensure all API calls match backend endpoints'
            });
        }

        return recommendations;
    }
}

// اجرای تست
if (require.main === module) {
    const tester = new ComprehensiveIntegrationTester();
    tester.runComprehensiveTests();
}

module.exports = ComprehensiveIntegrationTester;