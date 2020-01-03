"use strict";
/**
 * Created by bbelarbi on 01/03/2017.
 */
const Joi = require('joi');
// joi-extended
// Joi.binary().encoding('base64')
//Joi.string().regex(/whatever/)
module.exports = {
    access_token: [Joi.string(), Joi.number()],
    applicationKey: Joi.string().max(200).required().description('application API key'),
    deviceId: Joi.string().allow('').max(200).optional().description('IDFA (advertisingId for android, will be stored for stat)'),
    uuid: Joi.string().allow('').max(200).optional().description('device vendor id (or androidId, optional)'),
    name: Joi.string().min(3).max(10).required(),
    pass: Joi.string().min(6).required(),
    id: Joi.string().alphanum().required().description('identifier'),
    free: Joi.any().required().valid('0', '1').default('1').description('free channel'),
    pageNumber: Joi.number().integer().min(1).optional().description('Numéro de page'),
    pageSize: Joi.number().integer().min(1).optional().default(20).description('Nombre d\'élément par page'),
    _internal: Joi.any().optional().description('reserved parameter'),
};
//# sourceMappingURL=validation.js.map