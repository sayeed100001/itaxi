export default function handler(req: any, res: any) {
    res.status(200).json({ status: 'ok', time: new Date().toISOString(), env: process.env.NODE_ENV });
}
