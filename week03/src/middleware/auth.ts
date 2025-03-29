import { Response, Request } from 'express';
import { User } from '../data/dataSchema';

export interface AuthenticatedRequest extends Request {
  user: User;
}

// Mock authentication middleware (replace with actual implementation)
const authenticate = (req: Request, res: Response, next: Function): void => {
  // This would normally validate JWT or session
  (req as AuthenticatedRequest).user = { 
    username: 'testuser_dc68e899', 
    id: '123',
    password_hash: 'test',
    created_at: new Date(),
    updated_at: new Date()
  };
  next();
};

export default authenticate;  