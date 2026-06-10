export interface AuthenticatedUser {
  id: string;
  email: string;
  permissions: string[]; // effective permission names ('*' = super admin wildcard)
}
