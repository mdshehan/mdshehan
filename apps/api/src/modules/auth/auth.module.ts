import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessService } from './access.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Global so JwtAuthGuard / PermissionsGuard / AccessService can be applied
 * via @UseGuards on any feature controller (e.g. admin write endpoints).
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, AccessService, JwtAuthGuard, PermissionsGuard, JwtModule],
})
export class AuthModule {}
