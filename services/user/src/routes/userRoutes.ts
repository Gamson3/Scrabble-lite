import { Router, Request, Response } from 'express';
import { userService } from '../services/userService';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({
      success: false,
      error: { code: 'USERNAME_REQUIRED', message: 'Username is required' },
    });
  }

  const user = userService.register(username);
  res.json(user);
});

router.post('/login', (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({
      success: false,
      error: { code: 'USERNAME_REQUIRED', message: 'Username is required' },
    });
  }

  const { user, session } = userService.login(username);
  res.json({
    userId: user.userId,
    username: user.username,
    token: session.token,
    expiresAt: session.expiresAt,
  });
});

router.get('/:userId', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' },
    });
  }

  const token = authHeader.substring('Bearer '.length);
  const session = userService.validateToken(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }

  const user = userService.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    });
  }

  res.json(user);
});

export default router;
