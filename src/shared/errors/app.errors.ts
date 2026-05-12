import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export class BadRequestError extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}

export class ConflictError extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}

export class ForbiddenError extends ForbiddenException {
  constructor(message: string) {
    super(message);
  }
}

export class InternalServerError extends InternalServerErrorException {
  constructor(message: string) {
    super(message);
  }
}

export class NotFoundError extends NotFoundException {
  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends UnauthorizedException {
  constructor(message: string) {
    super(message);
  }
}
