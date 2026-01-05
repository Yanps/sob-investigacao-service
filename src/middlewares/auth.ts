import { Request, Response, NextFunction } from 'express';

export function auth(req: Request, res: Response, next: NextFunction) {
    const token = req.headers['x-internal-token'];

    if (!token || token !== process.env.INTERNAL_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}
