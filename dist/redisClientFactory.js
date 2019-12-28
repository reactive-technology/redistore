"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { createClient } = require('thunk-redis');
const Q = require('q');
const redisMock = require('redis-js').toPromiseStyle(Q.defer);
//const redisMock  = require('redis-js');
//import os from 'os';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
class RedisClientFactory {
    constructor(conf = undefined) {
        this.host = conf && conf.host || REDIS_HOST; //os.hostname();
        this.password = conf && conf.password || undefined;
        this.port = conf && conf.port && conf.port.split(',') || ['6379'];
        this.logger = conf && conf.logger;
        console.log('using redis client at', this.host, this.port);
    }
    info(msg) {
        if (this.logger) {
            this.logger.info(msg);
        }
    }
    error(msg) {
        if (this.logger) {
            this.logger.error(msg);
        }
    }
    getHosts() {
        if (this.host.indexOf(',') != -1) {
            return this.host.split(',');
        }
        /*
        if (this.port.indexOf(',') != -1) {
          return this.port.split(',')
            .map(
              port => `${this.host}:${parseInt(port)}`
            );
        }
        */
        return [`${this.host}:${this.port}`];
    }
    getOptions() {
        const opt = {
            usePromise: true,
            clusterMode: true,
            authPass: ""
        };
        if (this.password) {
            opt.authPass = this.password;
        }
        return opt;
    }
    getConf() {
        return this.port.map((port, index) => {
            const conf = {
                host: this.host,
                port: parseInt(port) + index, password: ""
            };
            if (this.password) {
                conf.password = this.password;
            }
            return conf;
        });
    }
    createClient(userName, onFailure, onConnect) {
        try {
            const type = this ? 'internal' : 'external';
            const me = this || new RedisClientFactory();
            //this.info('CREATING NEW CLIENT FOR REDIS FROM user : ' + userName);
            //this.info(me.getConf());
            // const client = redis.createClient(this.getConf());
            let client;
            // const client = redisthunk.createClient(this.getConf());
            if (this.host === 'mock') {
                client = redisMock;
            }
            else {
                client = createClient(this.getHosts(), this.getOptions(), undefined);
            }
            //let client = redisMock.createClient(this.getHosts(), this.getOptions(), undefined);
            //console.log('client2',Object.keys(client));
            //console.log('client smembers',client.smembers.toString());
            //bluebird.promisifyAll(client);
            //const client = util.promisify(client2);
            //console.log('async client hgetall',client.hgetall.toString());
            // const client = new Redis.Cluster(me.getConf());
            // const client = new Redis(this.getConf()[0]);
            client.on('connect', () => {
                //this.info('REDIS CONNECT : ' + type);
                onConnect && onConnect();
            });
            client.on('error', (err) => {
                this.info(`REDIS CONNECT error ${err} : ${type}`);
                this.error('node error');
                onFailure && onFailure(err);
                //sleep(5000);
            });
            return client;
        }
        catch (err) {
            this.error('ERROR CREATING NEW CLIENT FOR REDIS FROM user : ' + userName);
            this.error('Error : ' + err.message);
            this.error(err.stack);
            return null;
        }
    }
}
exports.RedisClientFactory = RedisClientFactory;
;
//# sourceMappingURL=redisClientFactory.js.map