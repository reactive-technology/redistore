//const Path = require('path');
const config = require('../config');
const Package = require('../../package.json');
// const Validation = require('../../config/validation');
const JWT = require('jsonwebtoken');
const Boom = require('boom');

const Utils = require('../utils');
const Request = require('request');
const Settings = config.settings;
const { applicationKeys } = config;

const httpRequest = Request.defaults({// eslint-disable-line no-unused-vars
  headers: {
    'User-Agent': `${Package.name}/v${Package.version} node/${process.version}`
  }
});


module.exports = {
  checkIn: (server) => {
    return (request, reply) => {
      console.log( '-----------------> checkIn');
      let token = 0;
      let expiresIn = '10m';
      try {
        console.log( ['common', 'checkIn'], 'payload received', JSON.stringify(request.payload));
        // check payload and return credentials
        if (!request.payload) {
          throw Boom.unauthorized('payload not found!');
        }
        const applicationKey = request.payload && request.payload.applicationKey;

        let foundAppKeys = applicationKeys.find(u => u.id === applicationKey);
        if (!foundAppKeys) {
          console.log( 'APP KEY not found, check for user key');
          foundAppKeys = userKeys && userKeys.find(u => u.id === request.payload.applicationKey);
          if (!foundAppKeys) {
            throw Boom.unauthorized('invalid credentials');
          } else {
            console.log( 'User KEY found!', 'foundAppKeys', foundAppKeys);
          }
        } else {
          console.log( 'APP KEY found!', 'foundAppKeys', foundAppKeys);
        }
        expiresIn = foundAppKeys && foundAppKeys.expiresIn || expiresIn;

        const payload = Utils.getCredentialsFromPayLoad(request, foundAppKeys);


        console.log( 'sign with payload', payload);


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
        console.trace(e);
        throw Boom.unauthorized('invalid data');
      }
    };


  },
  page404: (request, reply) => {
    console.log('page404', request);
    reply.response({ result: 'Oops, 404 Page!' })
      .code(404);
  },
  healthCheck: (request, reply) => {
    //console.log('--> healthcheck reply');
    return reply.response({ result: 'hey, I am still alive!' });
  }
};