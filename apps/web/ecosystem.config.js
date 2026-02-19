module.exports = {
    apps: [{
        name: 'microchat-web',
        cwd: '/home/vasily/websites/micro-chat-service/apps/web',
        script: 'pnpm',
        args: 'start',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '512M',
        env: {
            NODE_ENV: 'production',
            PORT: 4080,
        },
    }, ],
};