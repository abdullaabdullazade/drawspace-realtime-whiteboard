import 'reflect-metadata';
import cluster from 'node:cluster';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

const logger = new Logger('Bootstrap');
const NUM_WORKERS = 1;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Worker ${process.pid} running on port ${port}`);
}

// Cluster fans out across CPU cores. Socket.IO needs a sticky-session
// adapter to work behind multiple workers, so only cluster when NUM_WORKERS > 1.
if (NUM_WORKERS > 1 && cluster.isPrimary) {
  logger.log(`Master ${process.pid} started — forking ${NUM_WORKERS} workers`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code) => {
    logger.warn(`Worker ${worker.process.pid} died (code ${code}) — restarting`);
    cluster.fork();
  });
} else {
  bootstrap();
}
