module.exports = {
    apps: [{
        name: 'itaxi-enterprise',
        script: './src/app.ts',
        interpreter: 'node',
        interpreter_args: '--import tsx', // Using tsx to natively run TS files
        instances: 'max', // Scale horizontally across ALL available CPU cores natively (No Docker)
        exec_mode: 'cluster',
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 80
        }
    }]
};
