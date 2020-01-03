const Handlers = require('./handlers');
//const Validation = require('../config').validation;
//const Joi = require('joi');
/*
const Relish = require('relish')({
  messages: {
    'applicationKey': 'Please enter a valid application key',
    'deviceId': 'Please enter a valid deviceId'
  }
});
*/

const NO_CACHE = false;
const registerFunc = (plugin:any) => {
  plugin.route([
    {
      path: '/account/checkIn',
      method: 'POST',
      config: {
        auth: false,
        cache: NO_CACHE,
        handler: Handlers.checkIn(plugin),
        /*validate: {
          failAction: Relish.failAction,
          payload: Joi.object({
            applicationKey: Validation.applicationKey,
            deviceId: Validation.deviceId,
            uuid: Validation.uuid,
          }),
        },*/
        description: 'check in ',
        tags: ['api', 'auth'],
      },
    },
    {
      path: '/healthcheck',
      method: 'GET',
      config: {
        auth: false,
        cache: NO_CACHE,
        handler: Handlers.healthCheck,
        description: 'healthcheck ',
        tags: ['superv', 'admin'],
      },
    },
    {
      path: '/{path*}',
      method: 'GET',
      config: {
        handler: Handlers.page404,
      },
    },
  ]);

};

module.exports = {
  register: registerFunc,
  version: '1.0.0',
  name: 'auth',
};
