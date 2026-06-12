import jwt from 'jsonwebtoken';
import { JwtPayload } from '../../shared/types';

export class JwtService {
  constructor(
    private secret: string,
    private expiresIn: string,
    private refreshSecret: string,
    private refreshExpiresIn: string
  ) {}

  generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn
    });
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn
    });
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.secret) as JwtPayload;
  }

  verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, this.refreshSecret) as { userId: string };
  }
}

