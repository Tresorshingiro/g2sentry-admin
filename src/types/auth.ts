export interface AuthUser {
  id: string;
  name: string;
  role: 'SUPER_ADMIN' | 'OPS_ADMIN';
}
