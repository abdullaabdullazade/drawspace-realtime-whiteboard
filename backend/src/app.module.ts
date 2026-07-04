import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BoardsModule } from './boards/boards.module';
import { CanvasModule } from './canvas/canvas.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { User } from './users/entities/user.entity';
import { Board } from './boards/entities/board.entity';
import { BoardMember } from './boards/entities/board-member.entity';
import { CanvasElement } from './boards/entities/canvas-element.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        entities: [User, Board, BoardMember, CanvasElement],
        synchronize: true, // dev only — use migrations in prod
      }),
    }),
    RabbitMQModule,
    AuthModule,
    UsersModule,
    BoardsModule,
    CanvasModule,
  ],
})
export class AppModule {}
