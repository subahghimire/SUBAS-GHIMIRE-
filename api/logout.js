// Clears the members-area session cookie.
module.exports = (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', 'sg_member=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.statusCode = 303;
  res.setHeader('Location', '/members.html');
  res.end();
};
