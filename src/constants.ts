export const ADMIN_EMAILS = [
  'job.rexoagency@gmail.com',
  'rexoagency.in@gmail.com'
];

export const isAdminEmail = (email: string | null | undefined) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
