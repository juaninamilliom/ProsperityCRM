/** A user row as it may leave the API.
 *
 *  The password column exists so local login can read it. It is stripped
 *  here, at the response boundary, rather than in the queries, because the
 *  same query serves both login and the routes that echo the user back. */
export function toPublicUser<T extends { password?: unknown }>(user: T): Omit<T, 'password'> {
  const copy: T = { ...user };
  delete copy.password;
  return copy;
}
