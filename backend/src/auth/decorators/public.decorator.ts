import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublicRoute';
// Mark a route as public — skips JWT auth (used for public-board access).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
