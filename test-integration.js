#!/usr/bin/env node

/**
 * iTaxi System Integration Test
 * تست یکپارچگی کامل سیستم
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    details?: string;
}

class SystemIntegrationTest {
    private results: TestResult[] = [];
    private projectRoot: string;

    constructor() {
        this.projectRoot = process.cwd();
    }

    private addResult(name: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: string) {
        this.results.push({ name, status, message, details });
    }

    // تست وجود فایل های ضروری
    testRequiredFiles() {
        console.log('🔍 Testing Required Files...');
        
        const requiredFiles = [
            'package.json',
            'tsconfig.json',
            'vite.config.ts',
            'App.tsx',
            'index.tsx',
            'server.ts',
            'schema.sql',
            'db-config.ts',
            'store.ts',
            'services/api.ts',
            'services/socketService.ts',
            'services/taxiTypes.ts',
            'services/adminAPI.ts',
            'components/Map/RealMap.tsx',
            'components/Map/MapIcons.css',
            'pages/Admin/SuperAdminPanel.tsx',
            'img/map img/1.png',
            'img/map img/2.png',
            'img/map img/3big taxi.png',
            'img/map img/4.png'
        ];

        requiredFiles.forEach(file => {
            const filePath = join(this.projectRoot, file);
            if (existsSync(filePath)) {
                this.addResult(`File: ${file}`, 'PASS', 'File exists');
            } else {
                this.addResult(`File: ${file}`, 'FAIL', 'File missing');
            }
        });
    }

    // تست dependencies
    testDependencies() {
        console.log('📦 Testing Dependencies...');
        
        try {
            const packageJson = JSON.parse(readFileSync(join(this.projectRoot, 'package.json'), 'utf8'));
            const requiredDeps = [
                'react',
                'react-dom',
                'zustand',
                'leaflet',
                'socket.io-client',
                'lucide-react',
                'express',
                'socket.io',
                'mysql2',
                'bcrypt',
                'jsonwebtoken'
            ];

            const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            requiredDeps.forEach(dep => {
                if (allDeps[dep]) {
                    this.addResult(`Dependency: ${dep}`, 'PASS', `Version: ${allDeps[dep]}`);
                } else {
                    this.addResult(`Dependency: ${dep}`, 'FAIL', 'Missing dependency');
                }
            });
        } catch (error) {
            this.addResult('Dependencies', 'FAIL', 'Cannot read package.json');
        }
    }

    // تست TypeScript compilation
    testTypeScript() {
        console.log('🔧 Testing TypeScript...');
        
        try {
            execSync('npx tsc --noEmit', { stdio: 'pipe' });
            this.addResult('TypeScript', 'PASS', 'No type errors');
        } catch (error) {
            this.addResult('TypeScript', 'FAIL', 'Type errors found', error.toString());
        }
    }

    // تست imports و exports
    testImportsExports() {
        console.log('🔗 Testing Imports/Exports...');
        
        const filesToCheck = [
            { file: 'App.tsx', imports: ['SuperAdminPanel', 'useAppStore', 'socketService'] },
            { file: 'store.ts', exports: ['useAppStore'] },
            { file: 'services/taxiTypes.ts', exports: ['TAXI_TYPES', 'determineTaxiType'] },
            { file: 'services/adminAPI.ts', exports: ['AdminAPI'] }
        ];

        filesToCheck.forEach(({ file, imports, exports }) => {
            try {
                const content = readFileSync(join(this.projectRoot, file), 'utf8');
                
                if (imports) {
                    imports.forEach(imp => {
                        if (content.includes(imp)) {
                            this.addResult(`Import: ${imp} in ${file}`, 'PASS', 'Import found');
                        } else {
                            this.addResult(`Import: ${imp} in ${file}`, 'FAIL', 'Import missing');
                        }
                    });
                }

                if (exports) {
                    exports.forEach(exp => {
                        if (content.includes(`export`) && content.includes(exp)) {
                            this.addResult(`Export: ${exp} in ${file}`, 'PASS', 'Export found');
                        } else {
                            this.addResult(`Export: ${exp} in ${file}`, 'FAIL', 'Export missing');
                        }
                    });
                }
            } catch (error) {
                this.addResult(`File: ${file}`, 'FAIL', 'Cannot read file');
            }
        });
    }

    // تست API endpoints
    testAPIEndpoints() {
        console.log('🌐 Testing API Endpoints...');
        
        try {
            const serverContent = readFileSync(join(this.projectRoot, 'server.ts'), 'utf8');
            const requiredEndpoints = [
                '/api/admin/taxi-types',
                '/api/admin/system-metrics',
                '/api/admin/settings',
                '/api/drivers',
                '/api/rides',
                '/api/auth/login'
            ];

            requiredEndpoints.forEach(endpoint => {
                if (serverContent.includes(endpoint)) {
                    this.addResult(`API: ${endpoint}`, 'PASS', 'Endpoint defined');
                } else {
                    this.addResult(`API: ${endpoint}`, 'FAIL', 'Endpoint missing');
                }
            });
        } catch (error) {
            this.addResult('API Endpoints', 'FAIL', 'Cannot read server.ts');
        }
    }

    // تست database schema
    testDatabaseSchema() {
        console.log('🗄️ Testing Database Schema...');
        
        try {
            const schemaContent = readFileSync(join(this.projectRoot, 'schema.sql'), 'utf8');
            const requiredTables = [
                'users',
                'drivers',
                'rides',
                'transactions',
                'admin_settings'
            ];

            requiredTables.forEach(table => {
                if (schemaContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
                    this.addResult(`Table: ${table}`, 'PASS', 'Table defined');
                } else {
                    this.addResult(`Table: ${table}`, 'FAIL', 'Table missing');
                }
            });

            // Check for taxi_types table
            if (existsSync(join(this.projectRoot, 'schema-update.sql'))) {
                const updateContent = readFileSync(join(this.projectRoot, 'schema-update.sql'), 'utf8');
                if (updateContent.includes('CREATE TABLE IF NOT EXISTS taxi_types')) {
                    this.addResult('Table: taxi_types', 'PASS', 'Table defined in update');
                } else {
                    this.addResult('Table: taxi_types', 'FAIL', 'Table missing');
                }
            } else {
                this.addResult('Table: taxi_types', 'FAIL', 'Update schema missing');
            }
        } catch (error) {
            this.addResult('Database Schema', 'FAIL', 'Cannot read schema files');
        }
    }

    // تست map icons
    testMapIcons() {
        console.log('🗺️ Testing Map Icons...');
        
        const iconFiles = [
            'img/map img/1.png',
            'img/map img/2.png', 
            'img/map img/3big taxi.png',
            'img/map img/4.png'
        ];

        iconFiles.forEach(icon => {
            if (existsSync(join(this.projectRoot, icon))) {
                this.addResult(`Icon: ${icon}`, 'PASS', 'Icon file exists');
            } else {
                this.addResult(`Icon: ${icon}`, 'FAIL', 'Icon file missing');
            }
        });

        // Check CSS classes
        try {
            const cssContent = readFileSync(join(this.projectRoot, 'components/Map/MapIcons.css'), 'utf8');
            const requiredClasses = ['.taxi-eco', '.taxi-plus', '.taxi-lux', '.taxi-premium'];
            
            requiredClasses.forEach(cls => {
                if (cssContent.includes(cls)) {
                    this.addResult(`CSS: ${cls}`, 'PASS', 'CSS class defined');
                } else {
                    this.addResult(`CSS: ${cls}`, 'WARN', 'CSS class missing');
                }
            });
        } catch (error) {
            this.addResult('Map CSS', 'FAIL', 'Cannot read MapIcons.css');
        }
    }

    // تست store integration
    testStoreIntegration() {
        console.log('🏪 Testing Store Integration...');
        
        try {
            const storeContent = readFileSync(join(this.projectRoot, 'store.ts'), 'utf8');
            const requiredActions = [
                'setSelectedTaxiType',
                'updateTaxiType',
                'addTaxiType',
                'removeTaxiType'
            ];

            requiredActions.forEach(action => {
                if (storeContent.includes(action)) {
                    this.addResult(`Store Action: ${action}`, 'PASS', 'Action defined');
                } else {
                    this.addResult(`Store Action: ${action}`, 'FAIL', 'Action missing');
                }
            });

            // Check selectedTaxiType state
            if (storeContent.includes('selectedTaxiType')) {
                this.addResult('Store State: selectedTaxiType', 'PASS', 'State defined');
            } else {
                this.addResult('Store State: selectedTaxiType', 'FAIL', 'State missing');
            }
        } catch (error) {
            this.addResult('Store Integration', 'FAIL', 'Cannot read store.ts');
        }
    }

    // اجرای تمام تست ها
    async runAllTests() {
        console.log('🚀 Starting iTaxi System Integration Tests...\n');
        
        this.testRequiredFiles();
        this.testDependencies();
        this.testTypeScript();
        this.testImportsExports();
        this.testAPIEndpoints();
        this.testDatabaseSchema();
        this.testMapIcons();
        this.testStoreIntegration();

        this.printResults();
    }

    // نمایش نتایج
    private printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('========================\n');

        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const warnings = this.results.filter(r => r.status === 'WARN').length;

        this.results.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
            console.log(`${icon} ${result.name}: ${result.message}`);
            if (result.details && result.status === 'FAIL') {
                console.log(`   Details: ${result.details.substring(0, 100)}...`);
            }
        });

        console.log('\n📈 Summary:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`⚠️ Warnings: ${warnings}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📊 Total: ${this.results.length}`);

        const successRate = ((passed / this.results.length) * 100).toFixed(1);
        console.log(`🎯 Success Rate: ${successRate}%`);

        if (failed === 0) {
            console.log('\n🎉 All critical tests passed! System is integrated.');
        } else {
            console.log('\n🔧 Some tests failed. Please fix the issues above.');
            process.exit(1);
        }
    }
}

// اجرای تست
const tester = new SystemIntegrationTest();
tester.runAllTests().catch(console.error);