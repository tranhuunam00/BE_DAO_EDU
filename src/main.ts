import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set API prefix
  app.setGlobalPrefix('api');

  // Tăng giới hạn payload body để hỗ trợ upload ảnh base64
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Configure Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('DAO EDU API')
    .setDescription(
      'Tài liệu hướng dẫn sử dụng API cho hệ thống quản lý giáo dục DAO EDU',
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Nhập JWT Token tại đây để xác thực',
      in: 'header',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Lưu lại token xác thực khi reload trang docs
    },
  });

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`NestJS application running on: http://localhost:${port}/api`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}
bootstrap();
