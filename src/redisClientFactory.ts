

const {createClient}  = require('thunk-redis');
//import os from 'os';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';

export class RedisClientFactory {
  private host: string;
  private password: string|undefined;
  private logger: undefined | any;
  private port: string[];
  constructor(conf:any=undefined ) {
    this.host = conf && conf.host || REDIS_HOST;//os.hostname();
    this.password = conf && conf.password || undefined;
    this.port = conf && conf.port && conf.port.split(',') || ['6379'];
    this.logger = conf && conf.logger;
    console.log('using redis client at',this.host,this.port)
  }

  info(msg: string) {
    if (this.logger) {
      this.logger.info(msg);
    }
  }

  error(msg: string) {
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

  createClient(userName: string, onFailure: (arg0: any) => void, onConnect: () => void) {
    try {
      const type = this ? 'internal' : 'external';
      const me = this || new RedisClientFactory();
      //this.info('CREATING NEW CLIENT FOR REDIS FROM user : ' + userName);
      //this.info(me.getConf());

      // const client = redis.createClient(this.getConf());
      let client;
      // const client = redisthunk.createClient(this.getConf());
      client = createClient(this.getHosts(), this.getOptions(), undefined);

      // const client = new Redis.Cluster(me.getConf());

      // const client = new Redis(this.getConf()[0]);

      client.on('connect', () => {
        //this.info('REDIS CONNECT : ' + type);
        onConnect && onConnect();
      });

      client.on('error', (err:Error) => {
        this.info(`REDIS CONNECT error ${err} : ${type}`);
        this.error('node error');

        onFailure && onFailure(err);
        //sleep(5000);
      });
      return client;
    } catch (err) {
      this.error('ERROR CREATING NEW CLIENT FOR REDIS FROM user : ' + userName);
      this.error('Error : ' + err.message);
      this.error(err.stack);

      return null;
    }
  }
};
