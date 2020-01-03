import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(__dirname, "/.env") });

export {RedisStore, RankingField} from './redistore';
export {RedisClientFactory} from './redisClientFactory';
export {WebSocketServer} from './webSocketServer';
export { IObject, IServerConfig } from "./interface";

export {
    Required, Alphanum, CustomSchema, DateString, Description,
    Email, ItemType, Max, MaxLength, Min, MinLength, Negative, NotEmpty,
    Nullable, Optional, Positive, SchemaOptions, ValidOptions
} from 'hapi-joi-decorators';
export const Joi = require('@hapi/joi');
export {Schema} from '@hapi/joi';
export {
    ClassDescription, ConditionSchema, SchemaArgs, SchemaFunction,
    MetadataKeys, Threshold
} from 'hapi-joi-decorators';

export {getSchema, ClassValidator, getSchemaDescription, Validate} from 'hapi-joi-decorators';
