const Config = require('../config');
const Settings = Config.settings;
const Utils = require('../utils');


//const applicationKeys:{id:string}[]=[];
//const userKeys:{id:string}[]=[];

const register = function (server:any) {
  server.state(Settings.jwtCookieName, {
    ttl: null,
    isSecure: false,
    isHttpOnly: true,
    clearInvalid: false,
    encoding: 'none',
    path: '/',
  });

  server.register(require('hapi-auth-jwt2'));
  server && server.log('adding jwt', Settings);
  server && server.log('adding jwt',Settings)
  server.auth.strategy(Settings.app_webedia_auth_strategy, 'jwt', {
    key: Settings.jwtPrivateKey,
    headerKey: true,
    cookieKey: Settings.jwtCookieName,
    verifyOptions: { algorithms: ['HS256'], expiresIn: '24h' },
    // Implement validation function
    validate: (decoded:any, request:any, callback:any) => {
      // NOTE: This is purely for demonstration purposes!
      server && server.log(['jwt', 'auth', 'app'],
        'app_webedia_auth_strategy : decoded token', JSON.stringify(decoded)      );
      const ip = Utils.getClientIp(request);
      request.app.decoded = decoded;
      request.app.applicationKey = decoded.applicationKey;
      if (decoded.ip && ip != decoded.ip ) {
        request && request.error(request,'ip changed! expected ',ip,'found',decoded.ip,decoded);
        if(decoded.ip != '10.0.7.169')
        {
          return callback(null, false);
        }
        else{
          request && request.error(request,'exception detected : token redirect from our ip server are accepted');
        }
      }
      request.app.deviceId = decoded.applicationKey + '.' + decoded.deviceId;
      /*
      if (
        applicationKeys.find((u:any) => u.id === decoded.applicationKey)
        || userKeys.find((u:any) => u.id === decoded.applicationKey)
      ) {
        server && server.log(['jwt', 'auth', 'app'], 'device ', decoded.applicationKey, 'found!');
        try {
          return callback(null, true, decoded);
        } catch (e) {
          request && request.trace(e);
          return callback(null, true, 'validation error');
        }
      } else if (!userKeys.find((u:any) => u.id === decoded.applicationKey)) {
        server && server.log(['jwt', 'auth', 'app'], 'device ', decoded.applicationKey, 'found in users!');
      }
    */
      server && server.log(['jwt', 'auth', 'app'], 'device', decoded.applicationKey, ' not found!');


      return callback(null, false);
    },
  });

  server.auth.strategy(Settings.admin_users_auth_strategy, 'jwt', {
    key: Settings.jwtPrivateKey,
    headerKey: true,
    verifyOptions: { algorithms: ['HS256'] },
    // Implement validation function
    validate: (decoded:any, request:any, callback:any) => {
      // NOTE: This is purely for demonstration purposes!
      server && server.log(['jwt', 'auth', 'user'], {
        'admin_users_auth_strategy : decoded token': decoded,
      });
      /*
      if (userKeys.find((u:any) => u.id === decoded.applicationKey)) {
        server && server.log(['jwt', 'auth', 'user'], 'device ', decoded.applicationKey, 'found!');
        try {
          return callback(null, true, decoded);
        } catch (e) {
          request && request.trace && request.trace(e);
          return callback(null, true, 'validation error');
        }
      }
      */
      server && server.log(['jwt', 'auth', 'user'], 'device', decoded.applicationKey, ' not found!');
      return callback(null, false);
    },
  });

  //server.auth.default(Settings.app_webedia_auth_strategy);

  // Uncomment this to apply default auth to all routes
  // plugin.auth.default('jwt');

};

module.exports = {
  register,
  version: '1.0.0',
  name: 'auth-jwt',
};

