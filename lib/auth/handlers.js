const config = require('../config');
const Package = require('../../package.json');
const JWT = require('jsonwebtoken');
const Boom = require('boom');
const Utils = require('../utils');
const Settings = config.settings;
const { applicationKeys } = config;
const logger = null;

module.exports = {
  checkIn: (server) => {
    return (request, reply) => {
      logger && logger.log('-----------------> checkIn');
      let token = 0;
      let expiresIn = '10m';
      try {
        logger && logger.log(['common', 'checkIn'], 'payload received', JSON.stringify(request.payload));
        // check payload and return credentials
        if (!request.payload) {
          throw Boom.unauthorized('payload not found!');
        }
        const applicationKey = request.payload && request.payload.applicationKey;

        let foundAppKeys = applicationKeys.find(u => u.id === applicationKey);
        if (!foundAppKeys) {
          logger && logger.log('APP KEY not found, check for user key');
          foundAppKeys = userKeys && userKeys.find(u => u.id === request.payload.applicationKey);
          if (!foundAppKeys) {
            throw Boom.unauthorized('invalid credentials');
          } else {
            logger && logger.log('User KEY found!', 'foundAppKeys', foundAppKeys);
          }
        } else {
          logger && logger.log('APP KEY found!', 'foundAppKeys', foundAppKeys);
        }
        expiresIn = foundAppKeys && foundAppKeys.expiresIn || expiresIn;

        const payload = Utils.getCredentialsFromPayLoad(request, foundAppKeys);


        logger && logger.log('sign with payload', payload);


        token = JWT.sign(
          payload,
          Settings.jwtPrivateKey, Object.assign(Settings.jwtVerifyOptions, {
            expiresIn
          }));

        const units = {
          s: 1,
          m: 60,
          h: 60 * 60,
          d: 24 * 60 * 60,
          ms: 0.001
        };
        const ttl = (([duration, unit]) =>
          (duration && unit && units[unit] && duration * units[unit] || 0))
        (expiresIn.replace(/\s*(\d+)\s*(.*)/g, '$1|$2')
          .split('|'));
        return reply.response({
          systemInfos: {
            appVersion: `v${Package.version}`,
            nodeVersion: process.version,
            uptime: process.uptime(),
            env: process.env.NODE_ENV && process.env.NODE_ENV || 'development',
            //logs: Path.resolve(process.env.PRJ_ROOT || '../../', 'logs')
          },
          expiresIn,
          ttl,
          token
        })
          .state(Settings.jwtCookieName, token);

      } catch (e) {
        logger && logger.trace(e);
        throw Boom.unauthorized('invalid data');
      }
    };


  },
  page404: (request, reply) => {
    logger && logger.log('page404', request);
    reply.response({ result: 'Oops, 404 Page!' })
      .code(404);
  },
  healthCheck: (request, reply) => {
    //logger && logger.log('--> healthcheck reply');
    return reply.response({ result: 'hey, I am still alive!' });
  }
};
