import {
    NullableValidationMetadata,
    PropertyValidationSchema,
    ValidationMetadata
} from "zafiro-validators/dts/interfaces";
//import * as Joi from "joi";

export interface IObjectIndexer<T> {
    [id: string]: T;
}

export interface IObject extends IObjectIndexer<any> {}
export interface IServerConfig extends IObjectIndexer<any> {
    host?:string;
    password?:string;
    port?:string;
    logger?:IObject;
    hooks?:IObject;
}

export {NullableValidationMetadata} from "zafiro-validators/dts/interfaces";
export { ValidationMetadata, PropertyValidationSchema } from "zafiro-validators/dts/interfaces";

