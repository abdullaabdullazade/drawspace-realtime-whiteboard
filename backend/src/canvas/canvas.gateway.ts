import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { BoardsService } from '../boards/boards.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { ElementType } from '../boards/entities/canvas-element.entity';

function mapElementType(t: unknown): ElementType {
  if (t === 'text') return ElementType.TEXT;
  if (t === 'image') return ElementType.IMAGE;
  return ElementType.PATH;
}

interface AuthSocket extends Socket {
  userId: string;
  username: string;
  isGuest: boolean;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/canvas',
})
export class CanvasGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CanvasGateway.name);

  constructor(
    private jwtService: JwtService,
    private boardsService: BoardsService,
    private rabbitMQService: RabbitMQService,
  ) {}

  async handleConnection(client: AuthSocket) {
    const token = client.handshake.auth?.token as string;
    if (!token) {
      // Anonymous guest — allowed, but can only act on public boards.
      client.userId = `guest:${client.id}`;
      client.username = 'Guest';
      client.isGuest = true;
      this.logger.log(`Guest connected: ${client.userId}`);
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token);
      client.userId = payload.sub;
      client.username = payload.email;
      client.isGuest = false;
      this.logger.log(`Client connected: ${client.userId}`);
    } catch {
      // Bad token → treat as guest rather than hard-disconnecting
      client.userId = `guest:${client.id}`;
      client.username = 'Guest';
      client.isGuest = true;
    }
  }

  handleDisconnect(client: AuthSocket) {
    this.logger.log(`Client disconnected: ${client.userId}`);
    client.rooms.forEach((room) => {
      client.to(room).emit('user:left', { userId: client.userId });
    });
  }

  @SubscribeMessage('board:join')
  async handleJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { boardId: string },
  ) {
    try {
      await this.boardsService.assertAccess(payload.boardId, client.userId);
      await client.join(payload.boardId);
      client.to(payload.boardId).emit('user:joined', { userId: client.userId });
      this.logger.log(`${client.userId} joined ${payload.boardId}`);
      return { event: 'board:joined', boardId: payload.boardId };
    } catch (err) {
      this.logger.warn(`Join denied ${client.userId} → ${payload.boardId}: ${(err as Error).message}`);
      return { event: 'error', message: 'Access denied' };
    }
  }

  @SubscribeMessage('board:leave')
  async handleLeave(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { boardId: string },
  ) {
    await client.leave(payload.boardId);
    client.to(payload.boardId).emit('user:left', { userId: client.userId });
    return { event: 'board:left' };
  }

  @SubscribeMessage('draw')
  async handleDraw(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { boardId: string; element: Record<string, unknown> },
  ) {
    // Broadcast to everyone in the room except sender
    client.to(payload.boardId).emit('draw', {
      userId: client.userId,
      element: payload.element,
    });

    // Persist to DB so the board reloads with its content
    try {
      const dto = { type: mapElementType(payload.element?.type), data: payload.element };
      if (client.isGuest) {
        await this.boardsService.addGuestElement(payload.boardId, dto);
      } else {
        await this.boardsService.addElement(payload.boardId, client.userId, dto);
      }
    } catch (err) {
      this.logger.warn(`Persist draw failed: ${(err as Error).message}`);
    }
  }

  @SubscribeMessage('element:add')
  handleElementAdd(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { boardId: string; element: Record<string, unknown> },
  ) {
    client.to(payload.boardId).emit('element:added', {
      userId: client.userId,
      element: payload.element,
    });

    this.rabbitMQService.publishCanvasPersist({
      event: 'element:add',
      boardId: payload.boardId,
      userId: client.userId,
      element: payload.element,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('element:update')
  handleElementUpdate(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: {
      boardId: string;
      elementId: string;
      data: Record<string, unknown>;
    },
  ) {
    client.to(payload.boardId).emit('element:updated', {
      userId: client.userId,
      elementId: payload.elementId,
      data: payload.data,
    });

    this.rabbitMQService.publishCanvasPersist({
      event: 'element:update',
      boardId: payload.boardId,
      userId: client.userId,
      elementId: payload.elementId,
      data: payload.data,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('element:delete')
  handleElementDelete(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { boardId: string; elementId: string },
  ) {
    client.to(payload.boardId).emit('element:deleted', {
      userId: client.userId,
      elementId: payload.elementId,
    });

    this.rabbitMQService.publishCanvasPersist({
      event: 'element:delete',
      boardId: payload.boardId,
      userId: client.userId,
      elementId: payload.elementId,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { boardId: string; x: number; y: number },
  ) {
    client.to(payload.boardId).emit('cursor:moved', {
      userId: client.userId,
      x: payload.x,
      y: payload.y,
    });
  }

  // Broadcast to a board room (used by canvas consumer)
  broadcastToBoard(boardId: string, event: string, data: unknown) {
    this.server.to(boardId).emit(event, data);
  }
}
