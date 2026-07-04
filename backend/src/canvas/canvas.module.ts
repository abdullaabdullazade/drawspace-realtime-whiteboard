import { Module } from '@nestjs/common';
import { CanvasGateway } from './canvas.gateway';
import { BoardsModule } from '../boards/boards.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BoardsModule, AuthModule],
  providers: [CanvasGateway],
})
export class CanvasModule {}
