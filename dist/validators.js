"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const joi_1 = require("joi");
tslib_1.__exportStar(require("zafiro-validators"), exports);
const VALIDATION_RULES = "VALIDATION_RULES";
function createSchemaFromMetadata(metadata) {
    let obj = {};
    const keys = metadata.keys();
    const keyArr = Array.from(keys);
    keyArr.forEach(key => {
        const val = metadata.get(key);
        obj[key] = val;
    });
    //console.log('find keys',obj)
    // @ts-ignore
    return joi_1.object().keys(obj);
}
function _getSchema(inst) {
    let instance = inst;
    if (typeof (inst) === "function") {
        // @ts-ignore
        if (typeof (inst.prototype) === "object") {
            // @ts-ignore
            instance = new inst();
        }
    }
    console.log('instance', Object.getPrototypeOf(instance));
    const constructor = Object.getPrototypeOf(instance).constructor;
    // @ts-ignore
    const metadata = Reflect.getMetadata(VALIDATION_RULES, constructor);
    if (metadata === undefined) {
        throw new Error('metadata is undefined');
    }
    else {
        return createSchemaFromMetadata(metadata);
    }
}
function schema(inst) {
    return _getSchema(inst);
}
exports.schema = schema;
//# sourceMappingURL=validators.js.map