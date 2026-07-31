import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { IdentityTokenService } from '../identity/application/token.service';
import { IdentityRepository } from '../identity/infrastructure/identity.repository';

type AuthenticatedSocket = Socket & {
  data: NotificationSocketData;
};
type NotificationSocketData = {
  userId?: string;
  organizationId?: string;
  sessionId?: string;
};

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.FRONTEND_ORIGIN ?? false, credentials: true },
  transports: ['websocket'],
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly tokens: IdentityTokenService,
    private readonly identities: IdentityRepository,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.bearer(client);
      const claims = await this.tokens.verifyAccessToken(token);
      const session = await this.identities.findSessionById(claims.sid);
      if (
        !session ||
        session.userId !== claims.sub ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new Error('Invalid session');
      }
      const data = client.data as unknown as NotificationSocketData;
      data.userId = claims.sub;
      data.organizationId = claims.organizationId ?? undefined;
      data.sessionId = claims.sid;
      await client.join(`user:${claims.sub}`);
      if (claims.organizationId)
        await client.join(`organization:${claims.organizationId}`);
      client.emit('notifications:ready', { connected: true });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    client.removeAllListeners();
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  private bearer(client: Socket): string {
    const handshakeAuth = client.handshake.auth as unknown;
    const authToken =
      typeof handshakeAuth === 'object' &&
      handshakeAuth !== null &&
      'token' in handshakeAuth
        ? handshakeAuth.token
        : undefined;
    const header = client.handshake.headers.authorization;
    const value =
      typeof authToken === 'string'
        ? authToken
        : typeof header === 'string' && header.startsWith('Bearer ')
          ? header.slice(7)
          : '';
    if (!value) throw new Error('Missing access token');
    return value;
  }
}
