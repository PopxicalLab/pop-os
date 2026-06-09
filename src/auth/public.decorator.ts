import { SetMetadata } from '@nestjs/common';

// Mark a route handler as public — the JWT guard will skip it.
// Usage: @Public() on any controller method that doesn't need a token.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
