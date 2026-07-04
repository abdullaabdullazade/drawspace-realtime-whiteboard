import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

const QUEUES = {
  CANVAS_PERSIST: 'canvas.persist',
  CANVAS_NOTIFY: 'canvas.notify',
} as const;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private connected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await (this.connection as any)?.close?.();
    } catch {}
  }

  private async connect() {
    const url = this.configService.get<string>('RABBITMQ_URL');
    if (!url) return;

    try {
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue(QUEUES.CANVAS_PERSIST, { durable: true });
      await this.channel.assertQueue(QUEUES.CANVAS_NOTIFY, { durable: false });

      this.connected = true;
      this.logger.log('RabbitMQ connected');
    } catch {
      this.logger.warn('RabbitMQ unavailable — running without queue');
    }
  }

  publishCanvasPersist(payload: Record<string, unknown>) {
    this.publish(QUEUES.CANVAS_PERSIST, payload);
  }

  publishCanvasNotify(payload: Record<string, unknown>) {
    this.publish(QUEUES.CANVAS_NOTIFY, payload);
  }

  async consumeCanvasPersist(handler: (msg: Record<string, unknown>) => Promise<void>) {
    if (!this.connected || !this.channel) return;

    this.channel.prefetch(10);
    await this.channel.consume(QUEUES.CANVAS_PERSIST, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as Record<string, unknown>;
        await handler(payload);
        this.channel!.ack(msg);
      } catch {
        this.channel!.nack(msg, false, false);
      }
    });
  }

  private publish(queue: string, payload: Record<string, unknown>) {
    if (!this.connected || !this.channel) return;
    this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
    );
  }
}
