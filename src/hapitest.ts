// `jwt.js` - how to used in combination with JSON Web Tokens (JWT) `securityDefinition`
//import "reflect-metadata";

import {Request, ResponseToolkit, Server, ServerRoute} from "@hapi/hapi";
import {ClassValidator, Description, Email, IObject, Required} from "hapi-joi-decorators/lib";



const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const Basic = require('@hapi/basic');
const Blipp = require('blipp');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');

const HapiSwagger = require('hapi-swagger');

//import * as Joi from "joi";
//import {Schema} from "joi";



class Example extends ClassValidator {
  @Required()
  @Email()
  email?: string="titi@free.fr";
  @Description('the first number')
  a?:number;

  @Required()
  @Description('the second number')
  b?:number;

}

const payload = Example.toObject();



let swaggerOptions = {
  info: {
    title: 'Test API Documentation',
    description: 'This is a sample example of API documentation.'
  },
  //auth: 'simple'
};

const users:IObject = {
  jane: {
    username: 'jane',
    password: 'password', // in real world store Bcrypt 'secret' here
    name: 'Jane Jones',
    id: '2133d32a'
  }
};

const validate = function (request:Request, username:string, password:string) {
  const user = users[username];
  if (!user) {
    return {
      isValid: false,
      credentials: null
    };
  }

  const isValid = password === user.password;
  let credentials = null;
  if (isValid) {
    credentials = {
      id: user.id,
      name: user.name
    };
  }

  return {
    isValid,
    credentials
  };
};


const ser = async () => {
  const server = Hapi.Server({
    host: 'localhost',
    port: 3000
  });

  await server.register(Basic);
  server.auth.strategy('simple', 'basic', { validate });
  server.auth.default('simple');

  // Blipp - Needs updating for Hapi v17.x
  await server.register([
    Inert,
    Vision,
    Blipp,
    {
      plugin: HapiSwagger,
      options: swaggerOptions,
    }
  ]);

  server.route({
    method: 'PUT',
    path: '/v1/store/{id?}',
    options: {
      handler: function (request:Request, h:ResponseToolkit) {
        return h.response('success');
      },
      description: 'Update sum',
      notes: ['Update a sum in our data store'],
      tags: ['api'],
      validate: {
        params: Joi.object({
          id: Joi.string()
            .required()
            .description('the id of the sum in the store')
        }),
        payload
      }
    }
  });

  await server.start();
  return server;
};

ser()
  .then(server => {
    console.log(`Server listening on ${server.info.uri}/documentation`);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
