import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTooManyRequestsResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  clearOAuthSignupRoleCookie,
  clearAuthCookies,
  OAUTH_SIGNUP_ROLE_COOKIE,
  readCookie,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from './auth.cookies';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleOAuthGuard } from './guards/google-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OAuthSignupRoleRequiredException } from './exceptions/oauth-signup-role-required.exception';
import type { GoogleProfile } from './strategies/google.strategy';
import {
  normalizeOAuthSignupRole,
  type OAuthSignupRole,
} from './oauth-signup-role';
import { ErrorMessages, SuccessMessages } from '../../shared';
import {
  DisableTotp2faDto,
  EnableTotp2faDto,
  VerifyMfa,
  VerifyRecoveryCode,
  RegenerateRecoveryCodesDto,
} from '@modules/auth/dto/2fa.dto';
import { TwoFaPendingGuard } from '@modules/auth/guards/two-fa-pending.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private parseOAuthSignupRole(role: string): OAuthSignupRole {
    const normalizedRole = normalizeOAuthSignupRole(role);
    if (!normalizedRole) {
      throw new HttpException(
        ErrorMessages.AUTH.INVALID_OAUTH_SIGNUP_ROLE,
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalizedRole;
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiConflictResponse({ description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address with an OTP' })
  @ApiBadRequestResponse({ description: 'Invalid or expired otp' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyEmail(dto);
    setAuthCookies(response, result.tokens);
    return {
      message: result.message,
      user: result.user,
    };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the email verification OTP' })
  @ApiBadRequestResponse({ description: 'Account is already verified' })
  @ApiTooManyRequestsResponse({
    description: 'Too many requests. Please wait before trying again.',
  })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiForbiddenResponse({
    description: 'Please verify your email to continue',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    if (result.message === ErrorMessages.AUTH.TWO_FA_REQUIRED) {
      response.status(401);
      return result;
    }
    setAuthCookies(response, result.tokens);
    return this.authService.toResponse(result);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiTooManyRequestsResponse({
    description: 'Too many requests — limit is 5 per minute per IP',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiBadRequestResponse({
    description: 'Invalid, expired, or already used token',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Passwords do not match',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary: 'Initiate Google OAuth',
    description: 'Redirects the browser to the Google consent screen.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect to Google authorization',
  })
  async googleAuth() {}

  @Public()
  @Get('google/signup/:role')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary: 'Initiate Google OAuth for a specific signup path',
    description:
      'Redirects the browser to Google and preserves whether the user entered through the talent or employer path.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect to Google authorization',
  })
  googleAuthForRole(@Param('role') role: string) {
    this.parseOAuthSignupRole(role);
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Handles the Google OAuth callback, creates or logs in the user, sets auth cookies, then redirects to the appropriate frontend route based on role and onboarding status.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description:
      'Redirect to frontend: /talent/onboarding or /employer/onboarding if setup incomplete; /discovery for employers, /admin for admins, or /dashboard for talents if complete. Auth cookies set on this response.',
  })
  async googleAuthRedirect(
    @Req() request: Request & { user: GoogleProfile },
    @Res() response: Response,
  ) {
    const signupRoleCookie = readCookie(request, OAUTH_SIGNUP_ROLE_COOKIE);
    const signupRole = normalizeOAuthSignupRole(signupRoleCookie);

    try {
      const result = await this.authService.googleCallback(
        request.user,
        signupRole,
      );
      clearOAuthSignupRoleCookie(response);
      setAuthCookies(response, result.tokens);
      return response.redirect(
        this.authService.buildFrontendRedirectUrl(result.data.user),
      );
    } catch (error: unknown) {
      clearOAuthSignupRoleCookie(response);
      const key =
        error instanceof OAuthSignupRoleRequiredException
          ? 'oauth_role_required'
          : 'oauth_failed';
      return response.redirect(
        HttpStatus.FOUND,
        `${this.authService.getFrontendOrigin()}/login?error=${key}`,
      );
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue new auth cookies from the refresh cookie' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = readCookie(request, REFRESH_TOKEN_COOKIE);
    const result = await this.authService.refresh(refreshToken);
    setAuthCookies(response, result.tokens);
    return {
      message: result.message,
      status: 'success',
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = readCookie(request, REFRESH_TOKEN_COOKIE);
    await this.authService.logoutByRefreshToken(refreshToken);
    clearAuthCookies(response);
    return {
      message: SuccessMessages.AUTH.LOGGED_OUT,
      status: 'success',
    };
  }

  @ApiCookieAuth()
  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.sub);
  }

  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Setup TOTP two-factor authentication',
    description:
      'Generates a TOTP secret and QR code for the user to scan with their authenticator app (Google Authenticator, Authy, etc.). The secret is encrypted and stored securely.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'TOTP setup successful. Returns the QR code URL and the manual entry key.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '2FA is already enabled',
  })
  @Post('mfa/totp/setup')
  setup2faTotp(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setup2faTotp(user);
  }

  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Enable TOTP two-factor authentication',
    description:
      'Enables TOTP-based 2FA for the user account. Requires a valid 6-digit TOTP code from the authenticator app to verify the secret was correctly configured.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'TOTP 2FA enabled successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired TOTP code',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'No TOTP secret found. Call setup endpoint first.',
  })
  @Post('mfa/totp/enable')
  enable2faTotp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: EnableTotp2faDto,
  ) {
    return this.authService.enableTotp2fa({
      userId: user.sub,
      code: payload.code,
    });
  }

  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Disable two-factor authentication',
    description:
      'Disables 2FA for the user account. Requires a valid 6-digit TOTP code from the authenticator app to confirm the action.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA disabled successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired TOTP code',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '2FA is not enabled',
  })
  @Post('mfa/disable')
  disable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: DisableTotp2faDto,
  ) {
    return this.authService.disable2fa({
      userId: user.sub,
      password: payload.password,
    });
  }

  @Post('mfa/recovery-codes/regenerate')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Regenerate recovery codes',
    description:
      'Invalidates all existing recovery codes and generates a new set of 8 codes. Requires password authentication. The new codes are shown once and must be saved by the user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New recovery codes generated (shown once)',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '2FA is not enabled or invalid password',
  })
  regenerateRecoveryCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: RegenerateRecoveryCodesDto,
  ) {
    return this.authService.regenerateRecoveryCodes(
      user.sub,
      payload.password,
    );
  }

  @Public()
  @Post('mfa')
  @ApiBearerAuth('JWT')
  @UseGuards(TwoFaPendingGuard)
  @ApiOperation({
    summary: 'Verify TOTP code for MFA',
    description:
      'Verifies the TOTP code entered by the user after login. If valid, returns authentication tokens and clears the 2FA pending state. This endpoint requires a JWT token that was issued when 2FA was triggered.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'MFA verification successful. Auth cookies set with fresh tokens.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired TOTP code',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired JWT token',
  })
  async verifyMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: VerifyMfa,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyMfa({
      userId: user.sub,
      code: payload.code,
    });
    setAuthCookies(response, result.tokens);
    return this.authService.toResponse(result);
  }

  @Public()
  @Post('mfa/recovery')
  @ApiBearerAuth('JWT')
  @UseGuards(TwoFaPendingGuard)
  @ApiOperation({
    summary: 'Verify recovery code for MFA',
    description:
      'Verifies a recovery code entered by the user after login. If valid, returns authentication tokens, clears the 2FA pending state, and marks the code as used.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'MFA verification successful. Auth cookies set with fresh tokens.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired recovery code',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired JWT token',
  })
  async verifyRecoveryCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: VerifyRecoveryCode,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyRecoveryCode({
      userId: user.sub,
      code: payload.code,
    });
    setAuthCookies(response, result.tokens);
    return this.authService.toResponse(result);
  }
}
