import {
    NullableValidationMetadata,
    PropertyValidationSchema,
    ValidationMetadata
} from "zafiro-validators/dts/interfaces";
import {object} from "joi";

export * from "zafiro-validators";

const VALIDATION_RULES = "VALIDATION_RULES";

function createSchemaFromMetadata<T>(
    metadata: ValidationMetadata<T>
): PropertyValidationSchema {
    let obj: any = {};
    const keys = metadata.keys();
    const keyArr = Array.from(keys);
    keyArr.forEach(key => {
        const val = metadata.get(key);
        obj[key] = val;
    });
    //console.log('find keys',obj)
    // @ts-ignore
    return object().keys(obj);
}


function _getSchema<T>(inst: T) {
    let instance = inst;
    if(typeof(inst) === "function"){
        // @ts-ignore
        if(typeof(inst.prototype) === "object") {
            // @ts-ignore
            instance = new inst();
        }
    }
    console.log('instance', Object.getPrototypeOf(instance));
    const constructor = Object.getPrototypeOf(instance).constructor;
    // @ts-ignore
    const metadata: NullableValidationMetadata<T> = Reflect.getMetadata(
        VALIDATION_RULES,
        constructor
    );
    if (metadata === undefined) {
        throw new Error('metadata is undefined');
    } else {
        return  createSchemaFromMetadata<T>(metadata);
    }
}

export function schema(inst:any){
    return _getSchema(inst);
}
