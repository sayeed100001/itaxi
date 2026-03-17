module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: {
            hasDatabase: !!process.env.DATABASE_URL || !!process.env.POSTGRES_URL,
            hasJWT: !!process.env.JWT_SECRET,
            nodeVersion: process.version
        }
    });
};
