"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Redlock = require('redlock');
const flatten = require('flat');
const unflatten = require('flat').unflatten;
const cuid = require('cuid');
const RedisPubSub = require('node-redis-pubsub');
const stringify = require('json-stable-stringify');
const sha1 = require('sha1');
// @ts-ignore
//import Promise = require('bluebird')
const TYPE_DOCUMENT = 'doc';
const TYPE_ITEM = 'item';
const TYPE_COLLECTION = 'collection';
const TYPE_QUEUE = 'queue';
const TYPE_LIST = 'list';
const TYPE_SORTED_LIST = 'scores';
const IDX_TYPE_RANK = 'indexRank';
const EventEmitter = require('events').EventEmitter;
const emitQueue = {};
// @ts-ignore
const toInt = (x) => (isNaN(x) ? 0 : parseInt(x));
let nodeRedisPubPubsub;
// @ts-ignore
global.gRankings = global.gRankings || {};
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isPrimitive(test) {
    return (test !== Object(test));
}
;
const is_array = function (value) {
    return (value &&
        typeof value === 'object' &&
        typeof value.length === 'number' &&
        typeof value.splice === 'function' &&
        !value.propertyIsEnumerable('length'));
};
const getServerTime = () => {
    const utcTime = new Date(new Date().toUTCString());
    return utcTime;
};
// array key,val to hash
// @ts-ignore
const arrayKeyValueToHash = (all) => all.reduce(([cr, key], val) => (key && [{
        ...cr,
        [key]: val
    }]) || [cr, val], [{}])[0];
const cb2promise = (resolve, reject, hook) => (err, res) => {
    if (!err) {
        if (hook) {
            resolve && resolve(hook(res));
        }
        else {
            resolve && resolve(res);
        }
    }
    if (err)
        reject && reject(err);
};
const flattenExt = (o) => {
    const fo = flatten(o);
    Object.keys(fo)
        .forEach(k => {
        if (fo[k] === '[' || fo[k] === ']' || fo[k] === '[]') {
            delete fo[k];
        }
    });
    const newObj = {};
    let nbKeys = 0;
    Object.keys(fo)
        .map(k => {
        if (typeof fo[k] !== 'undefined') {
            if (fo[k] instanceof Object) {
                newObj[k] = JSON.stringify(fo[k]);
            }
            else {
                newObj[k] = fo[k];
            }
            nbKeys++;
        }
    });
    return nbKeys && newObj;
};
const removeDeletes = (o) => {
    Object.keys(o)
        .forEach(k => {
        if (o[k] === '_deleteObject') {
            delete o[k];
        }
        if (typeof o[k] === 'object') {
            o[k] = removeDeletes(o[k]);
        }
    });
    return o;
};
const str2bool = (o) => {
    if (o === 'true') {
        o = true;
    }
    else if (o === 'false') {
        o = false;
    }
    return o;
};
const unflattenExt = (o, types) => {
    if (!o) {
        return o;
    }
    let hasDeletes = false;
    Object.keys(o)
        .forEach(k => {
        if (o[k] === '[' || o[k] === ']' || o[k] === '[]' || o[k] === '{}') {
            delete o[k];
        }
        if (o[k] === '_deleteObject') {
            hasDeletes = true;
        }
    });
    if (types && o) {
        for (const key in types) {
            const field = o[key];
            if (field) {
                switch (types[key]) {
                    case 'object':
                        o[key] = {};
                        break;
                    case 'array':
                        try {
                            o[key] = JSON.parse(field);
                        }
                        catch (err) {
                        }
                        break;
                    case 'number':
                        if (typeof field === 'number') {
                            o[key] = field;
                        }
                        else if (!isNaN(field)) {
                            if (field.indexOf && field.indexOf('.') > -1) {
                                o[key] = parseFloat(field);
                            }
                            else {
                                o[key] = parseInt(field, 10);
                            }
                        }
                        break;
                    case 'json':
                        try {
                            o[key] = JSON.parse(field);
                        }
                        catch (err) {
                        }
                        break;
                    case 'date':
                        o[key] = new Date(field);
                        break;
                    case 'boolean':
                        o[key] = str2bool(field);
                        break;
                    // ...
                    case 'string':
                    default:
                        if (field === '[]') {
                            o[key] = {};
                        }
                        o[key] = str2bool(field);
                        break;
                }
            }
        }
    }
    Object.keys(o)
        .forEach(key => {
        o[key] = str2bool(o[key]);
    });
    let fo = unflatten(o);
    fo = removeDeletes(fo);
    return fo;
};
const popTimeout = 0;
// @ts-ignore
global.redisClientMainInstance = global.redisClientMainInstance || null;
// redis.createClient({host:'ns3043647.ip-51-255-91.eu'})
let redLockInstance;
const getRedlock = (redisClientInstance) => {
    if (!redLockInstance) {
        redLockInstance = new Redlock(
        // you should have one client for each independent redis node
        // or cluster
        [redisClientInstance], {
            // the expected clock drift; for more details
            // see http://redis.io/topics/distlock
            driftFactor: 0.01,
            // the max number of times Redlock will attempt
            // to lock a resource before erroring
            retryCount: 10,
            // the time in ms between attempts
            retryDelay: 200,
            // the max time in ms randomly added to retries
            // to improve performance under high contention
            // see https://www.awsarchitectureblog.com/2015/03/backoff.html
            retryJitter: 200 // time in ms
        });
    }
    return redLockInstance;
};
//const { DEFAULT_PROJECT_NAME } = require('../../consts/requests');
//const PROJECT = process.env.PROJECT || DEFAULT_PROJECT_NAME;
class RankingField {
    constructor(rankingField, filteringKeys) {
        this.type = IDX_TYPE_RANK;
        this.rankingField = rankingField;
        this.filteringKeys = filteringKeys;
    }
}
exports.RankingField = RankingField;
class RedisStore {
    constructor(parent, type = undefined, docName = undefined, rankingField = undefined) {
        this.logger = undefined;
        this.timeout = 0;
        try {
            if (!this.logger) {
                this.logger = console;
            }
            // @ts-ignore
            if (global.redisClientMainInstance === null) {
                let redisClientFactory = null;
                if (parent.config) {
                    if (parent.config.getLogger && typeof parent.config.getLogger === 'function') {
                        this.setLogger(parent.getLogger());
                    }
                    if (parent.config.projectId) {
                        this.projectId = parent.config.projectId;
                    }
                    else {
                        this.projectId = 'undefined';
                        this.logger.warn('projectId not specified!');
                    }
                    if (parent.config.factory) {
                        redisClientFactory = parent.config.factory;
                    }
                }
                if (!redisClientFactory && typeof parent.createClient === 'function') {
                    redisClientFactory = parent;
                }
                if (redisClientFactory) {
                    // @ts-ignore
                    global.redisClientMainInstance = redisClientFactory.createClient('clientInstance', () => {
                        //on failure
                        // @ts-ignore
                        global.redisClientMainInstance && global.redisClientMainInstance.disconnect && global.redisClientMainInstance.disconnect();
                        // @ts-ignore
                        global.redisClientMainInstance = redisClientFactory.createClient();
                    });
                    //TODO:manage redis connection failure
                    const redisPub = redisClientFactory.createClient();
                    const redisSub = redisClientFactory.createClient();
                    const config = {
                        emitter: redisPub,
                        receiver: redisSub // Pass in an existing redis connection that should be used for sub
                    };
                    nodeRedisPubPubsub = new RedisPubSub(config); // This is the NRP client
                }
                else {
                    this.logger.error('################\n###################\nshould provide redis client factory\n#############');
                }
            }
            // @ts-ignore
            this.redisClient = global.redisClientMainInstance;
            this.redlock = getRedlock(this.redisClient);
            this.where_clauses = [];
            if (!type) {
                if (!this.projectId) {
                    if (parent.config.projectId) {
                        this.projectId = parent.config.projectId;
                    }
                    else {
                        this.projectId = 'undefined';
                        this.logger.warn('projectId not specified!');
                    }
                }
                type = TYPE_DOCUMENT;
                docName = `db:${this.projectId}`;
                parent = { pathName: '' };
            }
            else {
                if (!docName) {
                    docName = cuid();
                }
                // this.docName = docName;
            }
            this.id = docName;
            this._id = docName;
            this.docType = type;
            this.parent = parent;
            this.indexes = false;
            this.pathName = `${parent.pathName}/${docName}`;
            this.pathCollection = `${this.pathName}@collection`;
            this.pathIndexes = `${this.pathName}@indexes`;
            this.pathMetadata = `${this.pathName}@metadata`;
            this.defaultRankingIndex = rankingField || {};
            if (parent.timeout) {
                this.redisClient.expire(this.pathName, parent.timeout);
            }
            if (rankingField) {
                this.withRankingField(rankingField);
            }
            // this.logger.log('path', this.pathName);
            // this.eventWorker = new EventEmitter();
        }
        catch (e) {
            if (this.logger) {
                this.logger.error('RedisStore constructor : ', e.message);
                this.logger.error(e.stack);
            }
            throw new Error('CANNOT ADD collection on collection.');
        }
    }
    get path() {
        return this.pathName;
    }
    static createInstance(config) {
        // @ts-ignore
        global.redisStore = new RedisStore(config);
        // @ts-ignore
        return global.redisStore;
    }
    static getInstance() {
        // @ts-ignore
        return global.redisStore;
    }
    getRedisClient() {
        return this.redisClient;
    }
    throw_error(msg, reject = undefined) {
        // this.logger.error(`### ${msg} ##`, '==> proxy ', this.pathName, 'type', this.docType)
        try {
            // if something unexpected
            throw new Error(msg);
        }
        catch (e) {
            if (this.logger) {
                this.logger.error('Error : ' + e.message);
                this.logger.error(e.stack);
            }
        }
        reject && reject(msg);
    }
    setLogger(logger) {
        if (logger && logger.warn && logger.debug && logger.error) {
            this.logger = logger;
            this.logger('logger found!');
        }
        else {
            this.logger = console;
        }
    }
    doc(docName = undefined) {
        try {
            // this.logger.log(' doc','on proxy ', this.pathName,'type',this.docType,'ref',this.ref.constructor.name);
            if (this.id && this.docType === TYPE_COLLECTION) {
                const pathNames = docName && docName.split('/');
                docName = pathNames && pathNames[0] || docName;
                // @ts-ignore
                const obj = new RedisStore(this, TYPE_DOCUMENT, docName);
                if (!pathNames || pathNames.length === 1) {
                    return obj;
                }
                return obj.collection(pathNames.slice(1)
                    .join('/'));
            }
        }
        catch (e) {
            this.logger.error(e);
        }
        this.throw_error(`CANNOT ADD collection on type ${this.docType} ${this.pathName}`);
    }
    item(docName) {
        try {
            // this.logger.log(' doc','on proxy ', this.pathName,'type',this.docType,'ref',this.ref.constructor.name);
            if (this.id && (this.docType === TYPE_DOCUMENT || this.docType === TYPE_COLLECTION)) {
                const obj = new RedisStore(this, TYPE_ITEM, docName);
                return obj;
            }
        }
        catch (e) {
            this.logger.error(e);
        }
        this.throw_error(`CANNOT ADD collection on type ${this.docType} ${this.pathName}`);
    }
    collection(collectionName, type = TYPE_COLLECTION) {
        // this.logger.log(' collection','on proxy ', this.pathName,'type',this.docType);
        if (this.id && this.docType === TYPE_DOCUMENT) {
            const pathNames = collectionName && collectionName.split('/')
                .filter((p) => p);
            if (!pathNames) {
                this.logger.info('empty name');
            }
            collectionName = (pathNames && pathNames[0]) || collectionName;
            const obj = new RedisStore(this, type, collectionName);
            if (!pathNames || pathNames.length === 1) {
                return obj;
            }
            return obj.doc(pathNames.slice(1)
                .join('/'));
        }
        this.throw_error(`CANNOT ADD collection on type ${this.docType} ${this.pathName}`);
    }
    SortedCollection(collectionName, rankingField) {
        // this.logger.log(' collection','on proxy ', this.pathName,'type',this.docType);
        if (this.id && this.docType === TYPE_DOCUMENT) {
            return new RedisStore(this, TYPE_SORTED_LIST, collectionName, rankingField);
        }
        this.throw_error('CANNOT create scores on type', this.docType);
    }
    async addIndex(indexes) {
        if (indexes) {
            const prs = Object.keys(indexes)
                .map(indexName => {
                const index = indexes[indexName];
                index.id = indexName;
                //this.logger.info('__________ ADD INDEX _________');
                this.logger.verbose && this.logger.info(stringify(index) + ' pathname : ' + this.pathName);
                return this.getRedisClient()
                    .sadd(this.pathIndexes, stringify(index))
                    .then()
                    .catch((e) => {
                    this.logger.error('addIndex : ' + e.message);
                    this.logger.error(e.stack);
                });
            });
            return Promise.all(prs);
        }
    }
    getRankingFieldName(rankingField, filteringKeys) {
        const type = IDX_TYPE_RANK;
        if (rankingField &&
            filteringKeys &&
            (!this.defaultRankingIndex ||
                !Object.keys(this.defaultRankingIndex).length)) {
            this.defaultRankingIndex = {
                rankingField,
                filteringKeys,
                type
            };
        }
        let name = `${rankingField}:${type}`;
        if (filteringKeys && filteringKeys.map) {
            name += filteringKeys.join(':');
        }
        return name;
    }
    withRankingField(rankingField, filteringKeys = undefined) {
        if (rankingField.constructor.name === 'RankingField') {
            filteringKeys = rankingField.filteringKeys;
            rankingField = rankingField.rankingField;
        }
        const type = IDX_TYPE_RANK;
        const indexName = this.getRankingFieldName(rankingField, filteringKeys);
        this.rankingField = {
            rankingField,
            filteringKeys
        };
        if (this.docType !== TYPE_DOCUMENT &&
            rankingField &&
            // @ts-ignore
            !global.gRankings[`${this.pathName}:${indexName}`]) {
            const index = {
                rankingField,
                filteringKeys,
                type
            };
            //this.logger.info('ADD RANK INDEX : ', index);
            this.addIndex({ [indexName]: index })
                .then(() => {
                this.logger.verbose && this.logger.info('added index : ', rankingField);
            })
                .catch((e) => {
                this.logger.error('addIned err : ', e.message);
                this.logger.error(e.stack);
            });
            // @ts-ignore
            global.gRankings[`${this.pathName}:${indexName}`] = index;
        }
        return this;
    }
    async getDocumentIndexes(pathIndexes = 'toto') {
        let indexes = null;
        try {
            if (!pathIndexes) {
                throw ('pathIndexes cannot be undefined');
            }
            if (pathIndexes) {
                const obj = await this.getRedisClient()
                    .smembers(pathIndexes);
                // this.logger.log('list of indexes', obj)
                indexes = obj
                    .filter((o) => {
                    if (typeof o === 'undefined')
                        return false;
                    if (typeof o === 'string' && !o.length)
                        return false;
                    if (o === 'undefined')
                        return false;
                    return true;
                })
                    .map((o) => {
                    let res = o;
                    try {
                        res = JSON.parse(o);
                    }
                    catch (e) {
                        this.logger.error('error in index : ' + o + ' getPathIndexes parse : ', e.message);
                        this.logger.error(e.stack);
                    }
                    return res;
                });
            }
        }
        catch (e) {
            this.logger.error('updateRank error : ', e.message);
            this.logger.error(e.stack);
        }
        return indexes;
    }
    persist(path = undefined) {
        if (!path) {
            path = this.pathName;
        }
        this.getRedisClient().persist(path);
    }
    expire(path, time) {
        if (!path) {
            path = this.pathName;
        }
        this.getRedisClient()
            .expire(path, time);
    }
    expireIn(timeout) {
        this.timeout = timeout;
        this.getRedisClient()
            .expire(this.pathName, this.timeout);
    }
    formatIndexSubKeys(index, data) {
        if (index.filteringKeys && index.filteringKeys.map) {
            const values = index.filteringKeys.map((k) => {
                let val;
                if (data && !!data[k]) {
                    val = data[k];
                }
                else if (data) {
                    val = k.split('.')
                        .reduce((obj, o) => {
                        if (obj)
                            return obj[o];
                    }, data);
                }
                return !!val ? `${k}=${val}` : k;
            });
            return values.join(',');
        }
        return '';
    }
    formatIndexKey(index, data = undefined, path = undefined) {
        if (index && !index.type) {
            this.logger.debug('index type undefined in store.js', index);
        }
        const key = `field(${index && index.type}:${index.rankingField}).keys[${this.formatIndexSubKeys(index, data)}]`;
        return key;
    }
    getRankingPoolKey(index, indexMap, path = undefined) {
        if (!path) {
            path = this.parent.pathName;
        }
        return `${path}@rankingPool(${this.formatIndexKey(index, indexMap, path)})`;
    }
    getRankingPoolId(index, path = undefined) {
        if (!path) {
            path = this.parent.pathName;
        }
        return `${path}@rankingPool(${this.formatIndexKey(index)})@${this.id}`;
    }
    async updateIndexValue(indexMap, merge) {
        try {
            const indexes = await this.getDocumentIndexes(this.parent.pathIndexes);
            let fullData = null;
            if (indexes && indexes.map) {
                const prs = indexes.map(async (index) => {
                    switch (index.type) {
                        case IDX_TYPE_RANK:
                            // if data has our indexed field
                            let hasOneFieldOfCompositeIndex = false;
                            let hasOneAbsentField = false;
                            if (indexMap) {
                                //index.filteringKeys = this.parent.rankingField.filteringKeys;
                                [index.rankingField].concat(index.filteringKeys)
                                    .map(field => {
                                    if (typeof indexMap[field] !== 'undefined') {
                                        hasOneFieldOfCompositeIndex = true;
                                    }
                                    else {
                                        hasOneAbsentField = true;
                                    }
                                });
                                if (hasOneFieldOfCompositeIndex) {
                                    if (merge && hasOneAbsentField) {
                                        if (!fullData) {
                                            fullData = await this.getRedisClient()
                                                .hgetall(this.pathName);
                                        }
                                        indexMap = Object.assign(fullData, indexMap);
                                    }
                                    const rankingKeyId = this.getRankingPoolId(index);
                                    const rankingPoolKey = this.getRankingPoolKey(index, indexMap);
                                    const rankValue = toInt(indexMap[index.rankingField]);
                                    // this.logger.log('rankingKeyId', rankingKeyId)
                                    // this.logger.log('rankingPoolKey', rankingPoolKey)
                                    // remove old value
                                    return this.getRedisClient()
                                        .get(rankingKeyId)
                                        .then((oldRankingKey) => {
                                        //this.logger.log(this.rankingRange(0,100,data));
                                        if (oldRankingKey) {
                                            if (rankingPoolKey !== oldRankingKey) {
                                                // this.getRedisClient().del(oldRankingKey).then().catch((e:Error) this.logger.error(e));
                                                this.getRedisClient()
                                                    .zrem(oldRankingKey, this.id)
                                                    .then()
                                                    .catch((e) => {
                                                    this.logger.error('Error : ' + e.message);
                                                    this.logger.error(e.stack);
                                                });
                                            }
                                        }
                                        return this.getRedisClient()
                                            .zadd(rankingPoolKey, rankValue, this.id)
                                            .then(() => {
                                            if (this.timeout || this.parent.timeout) {
                                                this.expire(rankingPoolKey, this.timeout || this.parent.timeout);
                                            }
                                            else {
                                                this.persist(rankingPoolKey);
                                            }
                                            //this.logger.log('ok set ranking ',rankingPoolKey,this.id);
                                            this.getRedisClient()
                                                .set(rankingKeyId, rankingPoolKey)
                                                .then()
                                                .catch((e) => {
                                                this.logger.error('Error : ' + e.message);
                                                this.logger.error(e.stack);
                                            });
                                        })
                                            .catch((e) => {
                                            this.logger.error('Error : ' + e.message);
                                            this.logger.error(e.stack);
                                        });
                                    })
                                        .catch((e) => {
                                        this.logger.error('Error : ' + e.message);
                                        this.logger.error(e.stack);
                                    });
                                }
                                this.logger.debug('index key not present in data');
                            }
                            break;
                        default:
                            this.logger.error('unknown index type');
                    }
                    return false;
                });
                return Promise.all(prs);
            }
        }
        catch (e) {
            this.logger.error('updateRank error : ', e.message);
            this.logger.error(e.stack);
        }
        return 'ok';
    }
    async getRankingCount0(data) {
        const me = this;
        let err = '';
        try {
            // @ts-ignore
            const { rankingField, filteringKeys } = me.defaultRankingIndex;
            // /db/userStates:indexRank:rating.xp
            const indexName = me.getRankingFieldName(rankingField, filteringKeys);
            if (rankingField &&
                // @ts-ignore
                global.gRankings[`${me.pathName}:${indexName}`]) {
                // @ts-ignore
                const index = global.gRankings[`${me.pathName}:${indexName}`];
                const key = me.getRankingPoolKey(index, data, me.pathName);
                this.logger.info('getting rank for : ' + key + ' for id : ' + me._id);
                return await me.getRedisClient()
                    .zcount(key, '-inf', '+inf');
            }
            else {
                this.logger.trace('ERROR');
                err = `ranking field ${`${me.pathName}_${rankingField}`} not defined, not found in ${JSON.stringify(
                // @ts-ignore
                global.gRankings)}`;
            }
        }
        catch (e) {
            this.logger.error('getRank error : ', e.message);
            this.logger.error(e.stack);
            err = e.message;
        }
        throw Error(err);
    }
    async getRankingCount(data, min = '-inf', max = '+inf') {
        const me = this;
        const index = me.defaultRankingIndex;
        const key = me.getRankingPoolKey(index, data, this.pathName);
        const count = await me.getRedisClient()
            .zcount(key, min, max);
        //this.logger.log('count for ', key, 'is ', count);
        return count;
    }
    async getRank(data) {
        const me = this;
        let err = '';
        try {
            const { rankingField, filteringKeys } = me.parent.defaultRankingIndex;
            // /db/userStates:indexRank:rating.xp
            const indexName = me.getRankingFieldName(rankingField, filteringKeys);
            if (rankingField &&
                // @ts-ignore
                global.gRankings[`${me.parent.pathName}:${indexName}`]) {
                // @ts-ignore
                const index = global.gRankings[`${me.parent.pathName}:${indexName}`];
                const key = me.getRankingPoolKey(index, data);
                this.logger.info('getting rank for : ' + key + ' for id : ' + me._id);
                return await me.getRedisClient()
                    .zrank(key, me._id);
            }
            else {
                err = `ranking field ${`${me.parent.pathName}_${rankingField}`} not defined, not found in ${JSON.stringify(
                // @ts-ignore
                global.gRankings)}`;
            }
        }
        catch (e) {
            this.logger.error('getRank error : ', e.message);
            this.logger.error(e.stack);
            err = e.message;
        }
        throw Error(err);
    }
    rankingRange(min, max, data) {
        const me = this;
        const index = me.defaultRankingIndex;
        const key = me.getRankingPoolKey(index, data, this.pathName);
        return new Promise((resolve, reject) => {
            //this.logger.info('===> get ranking range ' + `${key} min : ${min} max : ${max}`);
            me.getRedisClient()
                .zrange(key, min, max)
                .then((values) => {
                Promise.all(values.map((docId) => me
                    .doc(docId)
                    .get()
                    .then((data) => data && (data.id || data._id) ? data : Object.assign(data, { _id: docId }))))
                    .then((vals) => resolve(vals));
            })
                .catch(reject);
        });
    }
    scoringRange(min, max, data) {
        const me = this;
        const index = me.defaultRankingIndex;
        const key = me.getRankingPoolKey(index, data, this.pathName);
        return new Promise((resolve, reject) => {
            //this.logger.info('===> get ranking range ' + `${key} min : ${min} max : ${max}`);
            me.getRedisClient()
                .zrangebyscore(key, min, max)
                .then((values) => {
                Promise.all(values.map((docId) => me
                    .doc(docId)
                    .get()
                    .then((data) => data && (data.id || data._id) ? data : Object.assign(data, { _id: docId }))))
                    .then((vals) => resolve(vals));
            })
                .catch(reject);
        });
    }
    rankFor(id) {
        const me = this;
        // /db/userStates:indexRank:rating.xp
        return new Promise((resolve, reject) => {
            // @ts-ignore
            if (global.gRankings[`${me.pathName}_${me.defaultRankingIndex}`]) {
                this.logger.info(`getting rank for ${me.pathName}:${IDX_TYPE_RANK}:${me.defaultRankingIndex} for id ${id}`);
                me.getRedisClient()
                    .zrank(`${me.pathName}:${IDX_TYPE_RANK}:${me.defaultRankingIndex}`, id)
                    .then(resolve)
                    .catch(reject);
            }
            else {
                reject(`ranking field ${me.defaultRankingIndex
                // @ts-ignore
                } not defined in ${JSON.stringify(global.gRankings)}`);
            }
        });
    }
    withTypes(types) {
        this.types = flatten(types);
        return this;
    }
    async getAtomicSlot(timeout = 100) {
        //be sure this function is not called in timeout slice
        const nb = await this.addItem(this.id);
        //to prevent from infinite lock, force deletion of id anyway after timeout
        this.delayedRemoveAll(timeout, [this.id])
            .then();
        if (nb !== 1) {
            return null;
        }
        else {
            const release = () => this.removeItem(this.id);
            return { release };
        }
        // this is a security in case of problem in job execution
    }
    setLock(timeout = 1000, _locker = true) {
        const me = this;
        return this.redlock.lock(`${this.pathName}:redlock`, timeout)
            .then((lock) => {
            // @ts-ignore
            me._lock = lock;
            return me.get()
                .then((data) => {
                if (data) {
                    const _lockedAt = getServerTime();
                    return me.set({
                        _locker,
                        _lockedAt
                    })
                        .then(() => data);
                }
                lock.unlock();
                return null;
            });
        });
    }
    unlock() {
        this._lock && this._lock.unlock();
        !this._lock && this.logger.error('Lock does not exists');
    }
    semLock(timeout = 1000) {
        const me = this;
        return this.redlock.lock(`${this.pathName}:redlock`, timeout)
            .then((lock) => {
            me._lock = lock;
            return lock;
        });
    }
    clone() {
        // @ts-ignore
        const c = new RedisStore();
        Object.keys(this)
            .forEach(k => {
            if (c.hasOwnProperty(k)) {
                // @ts-ignore
                c[k] = this[k];
            }
        });
        return c;
    }
    queueCollection(queueName) {
        // this.logger.log(' collection','on proxy ', this.pathName,'type',this.docType);
        if (this.id && this.docType === TYPE_COLLECTION) {
            return new RedisStore(this, TYPE_QUEUE, queueName);
        }
        this.throw_error('CANNOT create queue on type ', this.docType);
    }
    list(listName) {
        // this.logger.log(' collection','on proxy ', this.pathName,'type',this.docType);
        if (this.id && this.docType === TYPE_COLLECTION) {
            return new RedisStore(this, TYPE_LIST, listName);
        }
        this.throw_error('CANNOT create list on type ', this.docType);
    }
    pushJob(job) {
        const me = this;
        return new Promise((resolve, reject) => {
            // this.logger.log('calling get', me.pathName,me.id);
            if (me.id && me.docType === TYPE_QUEUE) {
                const id = cuid();
                const at = getServerTime();
                const sId = sha1(JSON.stringify(job));
                const item = JSON.stringify({
                    work: job,
                    at,
                    id,
                    sId,
                });
                this.logger.info('-----> push work ' + item);
                // we have a uniq key to make queue uniq
                this.logger.info('-----> check unicity on ' + sId + ' key ' + `${me.pathName}:uniqs`);
                me.getRedisClient()
                    .sadd(`${me.pathName}:uniqs`, sId)
                    .then((nbAdd) => {
                    if (nbAdd === 1) {
                        me.getRedisClient()
                            .lpush(`${me.pathName}:in`, item)
                            .then(resolve)
                            .catch(reject);
                    }
                    else {
                        // me.getRedisClient().lpush(`${me.pathName}:in`, item, cb2promise(resolve, reject));
                        this.logger.info('>>>>>>> value already beeing processed <<<<<<<<< sId ' + sId + ' item reject = ' + item);
                        me.checkProcessedJobs(sId, (isPresent) => {
                            if (!isPresent) {
                                me.getRedisClient()
                                    .lpush(`${me.pathName}:in`, item)
                                    .then(resolve)
                                    .catch(reject);
                            }
                            else {
                                this.logger.info('========> sId ' + sId + ' rejected');
                            }
                        });
                    }
                })
                    .catch(reject);
            }
            else {
                me.throw_error(`CANNOT push to queue on type ${me.docType}`, reject);
            }
        });
    }
    checkProcessedJobs(sId, cb) {
        const me = this;
        this.logger.info('check jobs for queue ' + `${me.pathName}:processing`);
        me.getRedisClient()
            .lrange(`${me.pathName}:processing`, 0, -1)
            .then((range) => {
            this.logger.info('range : ' + range);
            let sent = false;
            range &&
                range.forEach((item) => {
                    const job = JSON.parse(item);
                    const now = getServerTime();
                    // @ts-ignore
                    if (now - job.at > 50000) {
                        // @ts-ignore
                        this.logger.info('###################### delete old job for ' + now + ' - ' + job.at + ' = ' + now - job.at + ' > 50000');
                        this.logger.info('###################### delete old job for t > 50000 ' + item);
                        me.getRedisClient()
                            .srem(`${me.pathName}:uniqs`, job.sId)
                            .then()
                            .catch((e) => {
                            this.logger.error('Error : ' + e.message);
                            this.logger.error(e.stack);
                        });
                        me.getRedisClient()
                            .lrem(`${me.pathName}:processing`, 0, item)
                            .then()
                            .catch((e) => {
                            this.logger.error('Error : ' + e.message);
                            this.logger.error(e.stack);
                        });
                        sent = true;
                        cb && cb(false);
                    }
                    if (sId === job.sId && !sent) {
                        cb && cb(true);
                    }
                });
            if (!sent) {
                cb && cb(false);
            }
        })
            .catch((e) => {
            this.logger.error('Error : ' + e.message);
            this.logger.error(e.stack);
        });
    }
    startWorker(userHandler, qRedisClient) {
        const me = this;
        process.on('exit', () => {
            this.logger.info('process exit : redis client quit');
            close();
            setTimeout(() => {
                this.logger.info('exit node');
                process.exit(0);
            }, 1000);
        });
        process.on('SIGINT', () => {
            this.logger.info('sigint : redis client quit');
            close();
            process.exit(0);
            setTimeout(() => {
                this.logger.info('exit node');
                process.exit(0);
            }, 1000);
        });
        setImmediate(next);
        function next() {
            me.logger && me.logger.info('-----> start pop value');
            qRedisClient
                .brpoplpush(`${me.pathName}:in`, `${me.pathName}:processing`, popTimeout)
                .then(popped);
            function popped(err, item) {
                me.logger.info('popped value', err, item);
                if (err) {
                    me.logger.error('Error : ' + err.message);
                    me.logger.error(err.stack);
                    // @ts-ignore
                    me.eventWorker && me.eventWorker.emit('error', err);
                }
                else if (item) {
                    var parsed = JSON.parse(item);
                    // this.logger.log('calling user job', parsed.work, parsed.id);
                    userHandler.call(null, parsed.work, parsed.id, workFinished);
                }
                else {
                    me.logger.info('queue element timedout ');
                }
                function workFinished() {
                    me.logger.info('=========>  workFinished remove from queue');
                    qRedisClient.lrem(`${me.pathName}:processing`, 1, item, poppedFromProcessing);
                }
                function poppedFromProcessing(err) {
                    me.logger.info('=========>  poppedFromProcessing suppress uniqs');
                    if (parsed.sId) {
                        me.logger.info('removind sId ' + parsed.sId);
                        me.getRedisClient()
                            .srem(`${me.pathName}:uniqs`, parsed.sId)
                            .then()
                            .catch((e) => {
                            me.logger.error('Error : ' + e.message);
                            me.logger.error(e.stack);
                        });
                    }
                    if (err) {
                        me.logger.error('poppedFromProcessing error parsed not found');
                        // me.eventWorker && me.eventWorker.emit('error', err);
                    }
                    next();
                }
            }
        }
        function close() {
            qRedisClient.quit();
        }
        return this;
    }
    push(work) {
        const me = this;
        return new Promise((resolve, reject) => {
            // me.logger.log('calling get', me.pathName,me.id);
            if (me.id && me.docType === TYPE_QUEUE) {
                me.getRedisClient()
                    .lpush(me.pathName, work)
                    .then(resolve)
                    .catch(reject);
            }
            else {
                me.throw_error(`CANNOT push to queue on type ${me.docType}`, reject);
            }
        });
    }
    rangeByScore(scoreMin, scoreMax, limit) {
        const me = this;
        return new Promise((resolve, reject) => {
            // me.logger.log('calling get', me.pathName,me.id);
            if (me.id && me.docType === TYPE_SORTED_LIST) {
                // var args2 = [ 'myzset', max, min, 'WITHSCORES', 'LIMIT', offset, count ]; client.zrevrangebyscore(args2
                me.getRedisClient()
                    .zrangebyscore(me.pathName, scoreMin, scoreMax, 'withscores', 0, limit)
                    .then(resolve)
                    .catch(reject);
            }
            else {
                me.throw_error(`CANNOT set score on type ${me.docType}`, reject);
            }
        });
    }
    lrange(rankMin, rankMax) {
        const me = this;
        return new Promise((resolve, reject) => {
            // me.logger.log('calling get', me.pathName,me.id);
            if (me.id && me.docType === TYPE_SORTED_LIST) {
                // var args2 = [ 'myzset', max, min, 'WITHSCORES', 'LIMIT', offset, count ]; client.zrevrangebyscore(args2
                me.getRedisClient()
                    .zrange(me.pathName, rankMin, rankMax, 'withscores')
                    .then((all) => resolve(arrayKeyValueToHash(all)))
                    .catch(reject);
            }
            else {
                me.throw_error(`CANNOT set score on type ${me.docType}`, reject);
            }
        });
    }
    lrank(member) {
        const me = this;
        return new Promise((resolve, reject) => {
            // me.logger.log('calling get', me.pathName,me.id);
            if (me.id && me.docType === TYPE_SORTED_LIST) {
                // var args2 = [ 'myzset', max, min, 'WITHSCORES', 'LIMIT', offset, count ]; client.zrevrangebyscore(args2
                me.getRedisClient()
                    .zrank(me.pathName, member)
                    .then(resolve)
                    .catch(reject);
            }
            else {
                me.throw_error(`CANNOT set score on type ${me.docType}`, reject);
            }
        });
    }
    pop() {
        const me = this;
        return new Promise((resolve, reject) => {
            // me.logger.log('calling get', me.pathName,me.id);
            if (me.id && me.docType === TYPE_QUEUE) {
                me.getRedisClient()
                    .rpop(me.pathName)
                    .then(resolve)
                    .catch(reject);
            }
            else {
                me.throw_error(`CANNOT pop queue on type ${me.docType}`, reject);
            }
        });
    }
    hasMember(member) {
        const me = this;
        return new Promise((resolve, reject) => {
            // me.logger.log('calling get', me.pathName,me.id);
            if (me.id && me.docType === TYPE_LIST) {
                me.getRedisClient()
                    .sismember(me.pathName, member)
                    .then((resp) => resolve(resp > 0))
                    .catch(reject);
            }
            else {
                me.throw_error(`CANNOT check member belongs to list on type ${me.docType}`, reject);
            }
        });
    }
    exists() {
        const me = this;
        return new Promise((resolve, reject) => {
            // me.logger.log('calling get', me.pathName,me.id);
            me.getRedisClient()
                .exists(me.pathName)
                .then((resp) => resolve(resp > 0))
                .catch(reject);
        });
    }
    members() {
        const me = this;
        return new Promise((resolve, reject) => {
            // me.logger.log('calling get', me.pathName,me.id);
            if (me.id && me.docType === TYPE_LIST) {
                me.getRedisClient()
                    .smembers(me.pathName)
                    .then(resolve)
                    .catch(reject);
            }
            else {
                me.throw_error(`CANNOT check member belongs to list on type ${me.docType}`, reject);
            }
        });
    }
    where(a, eq, b) {
        // TODO:check Indexes
        // if (this.id && this.docType === COLLECTION_TYPE) {
        const c = this.clone();
        c.where_clauses.push([a, eq, b]);
        return c;
        // this.throw_error(`CANNOT ADD collection on type ${this.docType} ${this.pathName}`, reject);
    }
    limit(l) {
        const c = this.clone();
        c.limit = l;
        return c;
    }
    orderBy(a, eq) {
        const c = this.clone();
        c.orderBy = [a, eq];
        return c;
    }
    delete() {
        return this.remove();
    }
    remove() {
        const me = this;
        return new Promise((resolve, reject) => {
            this.logger.info('---> calling redis delete() on ' + me.pathName);
            me._lock && me._lock.unlock();
            me.getRedisClient()
                .del(me.pathName)
                .then(() => {
                this.logger.info('‡‡‡‡‡ redis ‡‡‡‡ delete ok ' + me.pathName);
                me.getRedisClient()
                    .srem(me.parent.pathCollection, me.id)
                    .then(() => {
                })
                    .catch((e) => {
                    this.logger.error('Error : ' + e.message);
                    this.logger.error(e.stack);
                });
            })
                .catch((e) => {
                try {
                    throw new Error('REDIS PROXY ERROR.' + e.message);
                }
                catch (e) {
                    this.logger.error('Error : ' + e.message);
                    this.logger.error(e.stack);
                }
                reject(e);
            });
        });
    }
    async removeToBeDeletedKeys(data) {
        const me = this;
        const deletes = [];
        try {
            Object.keys(data)
                .forEach(k => {
                if (data[k] === '_deleteObject') {
                    deletes.push(k);
                }
            });
            if (deletes.length) {
                const hKeys = await me.getRedisClient()
                    .hkeys(me.pathName);
                const delKeys = [];
                hKeys.forEach((key) => {
                    deletes.forEach((delk) => {
                        if (key.indexOf(delk) !== -1) {
                            delKeys.push(key);
                            this.logger.debug('KEY ' + key + ' DELETED CANDIDATE');
                        }
                    });
                });
                if (delKeys.length) {
                    await Promise.all(delKeys.map(async (delKey) => {
                        const nbDeletes = await me.getRedisClient()
                            .hdel(me.pathName, delKey);
                        if (nbDeletes) {
                            this.logger.debug('DELETE _deleteObject for ' + me.pathName + '/' + delKey);
                        }
                    }));
                }
            }
            return data;
        }
        catch (e) {
            this.logger.error('deletekeys ' + e.message);
            this.logger.error(e.stack);
        }
    }
    async addParentIdIfNotExist() {
        try {
            const count = await this.parent.getRedisClient()
                .sismember(this.parent.pathCollection, this.id);
            if (count === 0) {
                await this.parent.addItem(this.id);
            }
        }
        catch (e) {
            this.logger.error('addDocIfNotExist : ' + e.message);
            this.logger.error(e.stack);
        }
    }
    async incr() {
        if (this.id && this.docType === TYPE_ITEM) {
            try {
                await this.getRedisClient()
                    .incr(this.pathName);
            }
            catch (e) {
                this.logger.error('Error : ' + e.message);
                this.logger.error(e.stack);
                this.throw_error(e);
            }
        }
        else {
            this.throw_error(`CANNOT use incr on type ${this.docType} ${this.pathName}`);
        }
    }
    async decr() {
        if (this.id && this.docType === TYPE_ITEM) {
            try {
                await this.getRedisClient()
                    .decr(this.pathName);
            }
            catch (e) {
                this.logger.error('Error : ' + e.message);
                this.logger.error(e.stack);
                this.throw_error(e);
            }
        }
        else {
            this.throw_error(`CANNOT use incr on type ${this.docType} ${this.pathName}`);
        }
    }
    get(opt = { withContent: true }) {
        const me = this;
        opt = Object.assign({ withContent: true }, opt);
        return new Promise((resolve, reject) => {
            const callback = (obj) => {
                const res = unflattenExt(obj, me.types || me.parent.types);
                //this.addParentIdIfNotExist().then();
                resolve(res);
            };
            // me.logger.log('calling get()', me.pathName, me.id);
            if (me.id === 'none') {
                this.logger.error('ERROR calling get ' + me.pathName + ' ' + me.id);
            }
            if (me.id && me.docType === TYPE_ITEM) {
                this.getRedisClient()
                    .get(me.pathName)
                    .then(resolve)
                    .catch((e) => {
                    me.logger.error('Error : ' + e.message);
                    me.logger.error(e.stack);
                });
            }
            else if (me.id && me.docType === TYPE_DOCUMENT) {
                me.getRedisClient()
                    .hgetall(me.pathName)
                    .then(callback)
                    .catch(reject);
            }
            else {
                const membersWithValues = [];
                me.getRedisClient()
                    .smembers(me.pathCollection)
                    .then((objs) => {
                    if (opt.withContent) {
                        Promise.all(objs.map((obj) => {
                            if (obj && obj != 'none') {
                                return me
                                    .doc(obj)
                                    .get()
                                    .then((val) => {
                                    if (val._id) {
                                        membersWithValues.push(val);
                                    }
                                    else {
                                        membersWithValues.push(Object.assign({ _id: obj }, val));
                                    }
                                })
                                    .catch((e) => {
                                    this.logger.error('Error : ' + e.message);
                                    this.logger.error(e.stack);
                                });
                            }
                        }))
                            .then(() => resolve(membersWithValues));
                    }
                    else {
                        resolve(objs);
                    }
                })
                    .catch(reject);
            }
        });
    }
    async setDocData(data, opt = { merge: false, isReplicate: false, syncMainDb: false }) {
        try {
            if (opt.merge === false) {
                const response = await this.getRedisClient()
                    .del(this.pathName);
                if (response === 1) {
                    // this.logger.log('Deleted Successfully!')
                }
                else {
                    this.logger.info('Cannot delete to make merge');
                }
            }
            const ok = await this.getRedisClient()
                .hmset(this.pathName, data);
            if (this.timeout || this.parent.timeout) {
                this.expireIn(this.timeout || this.parent.timeout);
            }
            else {
                this.persist();
            }
            if (this.docType === TYPE_DOCUMENT) {
                // this.logger.log('set coll sadd', me.parent.pathCollection, me.id)
                //TODO: check if this still usefull
                const ok = this.addItem(this.id)
                    .then();
                //! err && this.logger.log('sadd ok for coll', me.parent.pathCollection, me.id);
                await this.removeToBeDeletedKeys(data);
                //me.persist(me.parent.pathCollection);
                if (this.indexes && this.indexes.length) {
                    this.indexes.forEach((keyPath) => {
                        const key = keyPath.replace(`${this.parent.pathName}/`, '');
                        // @ts-ignore
                        if (data[key]) {
                            //this.logger.log(this.pathName, 'sadd=====> INDEX', keyPath);
                            this.getRedisClient()
                                .sadd(keyPath, this.id)
                                .then()
                                .catch((err) => {
                                if (err) {
                                    this.logger.info('index update for ' + key);
                                }
                                else {
                                    if (this.timeout || this.parent.timeout) {
                                        this.expire(keyPath, this.timeout || this.parent.timeout);
                                    }
                                    else {
                                        this.persist(keyPath);
                                    }
                                }
                                // err && reject(err);
                            });
                        }
                    });
                }
            }
            else {
                this.removeToBeDeletedKeys(data)
                    .then();
            }
            if (opt.isReplicate || opt.syncMainDb) {
                this.setMetadata({ replicated: getServerTime() })
                    .then(() => {
                });
            }
            let newData = data;
            if (opt.merge === false) {
                // @ts-ignore
                newData = await this.get();
            }
            // this.logger.log(newData)
            await this.updateIndexValue(newData, opt.merge);
            this.emit();
            return newData;
        }
        catch (e) {
            this.logger.error('err1 : ' + e.message);
            this.logger.error(e.stack);
            this.logger.error('_lhmset path ' + this.pathName + ' for data ' + data);
            const checkErrorAndPath = (err, path) => {
                if (err) {
                    this.logger.info('REDIS ERROR Error : ' + err);
                    this.getRedisClient()
                        .type(path)
                        .then((res) => {
                        this.logger.info('CHECK TYPE type : ' + res);
                    })
                        .catch((e) => {
                        this.logger.error('hmset ' + e.message);
                        this.logger.error(e.stack);
                    });
                }
            };
            checkErrorAndPath(e, this.pathName);
            throw e;
        }
    }
    async addItem(data) {
        // this.logger.log('__sadd  path', me.pathName, 'data', data)
        try {
            const nb = await this.getRedisClient()
                .sadd(this.pathCollection, data);
            return nb;
        }
        catch (e) {
            this.logger.error('_sadd err path ' + this.pathCollection);
            this.logger.error(e.stack);
            throw e;
        }
    }
    async removeItem(data) {
        // this.logger.log('__sadd  path', me.pathName, 'data', data)
        try {
            const nb = await this.getRedisClient()
                .srem(this.pathCollection, data);
            return nb;
        }
        catch (e) {
            this.logger.error(e.message + ' _sadd err path ' + this.pathName);
            this.logger.error(e.stack);
            throw e;
        }
    }
    async getItems() {
        // this.logger.log('__sadd  path', me.pathName, 'data', data)
        try {
            const members = await this.getRedisClient()
                .smembers(this.pathCollection);
            return members;
        }
        catch (e) {
            this.logger.error(e.message + ' _sadd err path ' + this.pathName);
            this.logger.error(e.stack);
            throw e;
        }
    }
    async delayedRemoveAll(timeout, ids) {
        await sleep(timeout);
        let items = ids;
        //this.logger.log("reset job duplication ");
        if (!ids) {
            items = await this.getItems();
        }
        await Promise.all(items.map(async (item) => {
            const nb = await this.removeItem(item);
            //if (nb > 0) {          this.logger.log("reactivated ", item);        }
            return true;
        }));
        /*
        const its = await this.getItems();
        if (its.length) {
          this.logger.info("remain items " + its);
        }
        */
    }
    onSnapshot(options, callback) {
        const me = this;
        //this.logger.info('calling onSnapshot ' + me.pathName);
        // just to keep firestore compat
        if (typeof options === 'function') {
            callback = options;
        }
        // do stuff here
        // const unsubscribe = db.doc().onSnapshot(...)
        // call unsubscribe() to unsubscribe
        // subscribe here for document  channel =  me.pathName
        // call resolve
        // this.unsubscribe = nodeRedisPubPubsub.on(`${me.pathName}:pubsub:${me.docType}`, resolve);
        const path = `${me.pathName}:${me.docType}`;
        //this.logger.info('subscribing to ' + path);
        this.unsubscribe = nodeRedisPubPubsub.on(path, (data) => {
            // this.logger.log('snapshot redis pub sub received for path',path,'data',data);
            callback && callback(data);
        });
        return this.unsubscribe;
    }
    emit() {
        const me = this;
        const now = Date.now();
        let t;
        // @ts-ignore
        t = emitQueue[`${me.pathName}:${me.docType}`];
        if (!t || (now - t) > 100) {
            // @ts-ignore
            emitQueue[`${me.pathName}:${me.docType}`] = now;
            setTimeout(() => {
                me.get()
                    .then((_data) => {
                    //this.logger.info('emiting to ' + `${me.pathName}:${me.docType}`);
                    nodeRedisPubPubsub.emit(`${me.pathName}:${me.docType}`, _data);
                    //this.logger.info('emiting to ' + `'${me.parent.pathName}:${me.parent.docType}' t=${t} now=${now}`);
                    // @ts-ignore
                    emitQueue[`${me.pathName}:${me.docType}`] = null;
                    nodeRedisPubPubsub.emit(`${me.parent.pathName}:${me.parent.docType}`, _data);
                });
            }, 50);
        }
        else {
            //this.logger.log(`${me.pathName}:${me.docType} already queued`);
        }
    }
    setCollectionData(_data, opt) {
        const me = this;
        return new Promise((resolve, reject) => {
            let dataArray = _data;
            if (!is_array(_data)) {
                dataArray = Object.keys(_data)
                    .map(k => {
                    const o = _data[k];
                    if (!isPrimitive(o) && typeof o._id === 'undefined') {
                        o._id = k;
                    }
                    return o;
                });
            }
            if (dataArray.length > 0) {
                const nbErr = 0;
                const pall = dataArray.map((elem) => me
                    .doc(elem._id)
                    .set(elem)
                    .then() // .catch((e:Error) => this.logger.error(e, ++nbErr));
                );
                Promise.all(pall)
                    .then(() => resolve(_data.length))
                    .catch((e) => reject(e));
                if (nbErr) {
                    this.logger.error('nbErr ' + nbErr);
                    // reject('Error on ', nbErr, 'elements');
                }
                else if (opt.isReplicate) {
                    me.setMetadata({ replicated: getServerTime() })
                        .then(() => {
                    });
                }
            }
            else {
                this.logger.error('set call _sadd with data ' + me.docType + ' ' + _data);
                // emit here for collection =>  channel =  me.pathName
                nodeRedisPubPubsub.emit(`${me.pathName}:pubsub:${me.docType}`, _data);
                return me
                    .addItem(_data || me.id)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }
    async set(_data, opt = { merge: true }) {
        //const me = this;
        if (this.docType === TYPE_ITEM && _data) {
            this.getRedisClient()
                .set(this.pathName, _data)
                .then()
                .catch((e) => {
                this.logger.error('Error : ' + e.message);
                this.logger.error(e.stack);
            });
        }
        else if (_data && Object.keys(_data).length) {
            if (this.id && this.docType === TYPE_DOCUMENT) {
                const data = flattenExt(_data);
                if (data) {
                    this.addParentIdIfNotExist()
                        .then();
                    const res = await this.setDocData(data, opt);
                    return res;
                }
                // c'est mort data empty
                return `${this.pathName} data must not be empty, ignored`;
            }
            return await this.setCollectionData(_data, opt);
        }
        // c'est mort data empty
        return `${this.pathName} data must not be empty, ignored`;
    }
    async setMetadata(_data) {
        // this.logger.log('+++++++++ calling redis set with metadata', _data, 'opt');
        try {
            const data = _data && flattenExt(_data);
            if (data) {
                //this.logger.debug('+ redis set with formatted metadata', me.docType, data, me.pathMetadata);
                const res = await this.getRedisClient()
                    .hmset(this.pathMetadata, data);
                if (this.timeout) {
                    this.expire(this.pathMetadata, this.timeout || this.parent.timeout);
                }
                else {
                    this.persist(this.pathMetadata || this.parent.timeout);
                }
                return res;
            }
            this.logger.debug('cannot set empty value', this.id);
            return 'cannot set empty value';
        }
        catch (e) {
            this.logger.error('setMetaData err : ' + e.message);
            this.logger.error(e.stack);
            throw e;
        }
    }
    async getMetadata(_data) {
        return this.getRedisClient()
            .hgetall(this.pathMetadata);
    }
    publishToAll(server) {
        const me = this;
        const path = `/${me.pathName.split('/').slice(2).join('/')}`;
        //me.logger.info('Will publish ', me.pathName,'to',path, 'to clients!');
        // @ts-ignore
        me.onSnapshot(async (data) => {
            me.logger.log('-------> onSnapshot1 received gameRef data change publishing to', path, ' data=', data);
            await server.publish(path, data);
        });
    }
}
exports.RedisStore = RedisStore;
// @ts-ignore-stop
//# sourceMappingURL=redistore.js.map