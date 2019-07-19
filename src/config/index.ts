const userKeys = [
  {
    id: 'THEGAME_TEST_ADMIN',
    name: 'thegame',
    description: 'admin team api',
    version: '1.0.0',
    expiresIn: '2h',
  },];
const applicationKeys = [
  {
    id: 'THEGAME_TEST_01_V1',
    name: 'team_test',
    description: 'application ios 750g',
    version: '1.0.0',
    expiresIn: '14h',
  }
];

const admin_users_auth_strategy = 'jwt-admin-users-webedia';
// @ts-ignore
const settings = {
  jwtPrivateKey: 'Webedia-API-Mediation-7891325301238884445',
  app_webedia_auth_strategy: 'jwt-app-webedia',
  admin_users_auth_strategy,
  admin_authentication: {
    strategy: admin_users_auth_strategy,
    scope: ['admin'],
  },
  jwtCookieName: 'token',
  jwtVerifyOptions: {
    algorithm: 'HS256',
    expiresIn: '24h',
  },
};


module.exports = {
  userKeys,
  settings,
  applicationKeys,
  validation:require('./validation'),
};
