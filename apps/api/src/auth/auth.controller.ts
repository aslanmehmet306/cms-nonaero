import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ========== ADMIN AUTH ==========

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async adminLogin(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.adminLogin(dto.email, dto.password);
  }

  @Public()
  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Refresh admin tokens (token rotation)' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async adminRefresh(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: JwtPayload & { refreshToken: string },
  ): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(user.sub, dto.refreshToken);
  }

  // ========== TENANT AUTH ==========

  @Public()
  @Post('tenant/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tenant login with email, password, and tenant code' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or tenant code' })
  async tenantLogin(@Body() dto: TenantLoginDto): Promise<AuthResponseDto> {
    return this.authService.tenantLogin(dto.email, dto.password, dto.tenantCode);
  }

  @Public()
  @Post('tenant/refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Refresh tenant tokens (token rotation)' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async tenantRefresh(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: JwtPayload & { refreshToken: string },
  ): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(user.sub, dto.refreshToken);
  }

  // ========== SHARED ==========

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (invalidate refresh token)' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@CurrentUser() user: JwtPayload): Promise<{ message: string }> {
    await this.authService.logout(user.sub);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  me(@CurrentUser() user: JwtPayload) {
    return {
      sub: user.sub,
      email: user.email,
      role: user.role,
      airportId: user.airportId,
      tenantId: user.tenantId,
    };
  }
}
