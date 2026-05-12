import { BadRequestException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { env } from '../../../config/env';

export interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  providerId: string;
  country: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { name, emails, photos } = profile;

    if (!emails || emails.length === 0) {
      return done(
        new BadRequestException(
          'No email provided by Google OAuth profile. Use a Google account with an email, or sign up with email and password.',
        ),
      );
    }

    if (!name?.givenName || !name?.familyName) {
      return done(
        new BadRequestException(
          'Name information missing from Google OAuth profile. Add a given name and family name to your Google account, or sign up with email and password.',
        ),
      );
    }

    const user: GoogleProfile = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos?.[0]?.value ?? '',
      providerId: profile.id,
      country: env.GOOGLE_DEFAULT_COUNTRY ?? 'Unknown',
    };
    done(null, user);
  }
}
