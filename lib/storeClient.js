const TYPE_DOCUMENT = 'doc';
const TYPE_COLLECTION = 'collection';
const TYPE_QUEUE = 'queue';
const TYPE_LIST = 'list';
const TYPE_SORTED_LIST = 'scores';
const cuid = require('cuid');
const toInt = (x, def) => isNaN(x) ? 0 : parseInt(x);
const Logger = require('./logger');

const ioReq = require("socket.io-request");
const io = require('socket.io-client');

const socket = io('http://localhost:6100');
let SOCKET_READY = false;
socket.on('connect', function () {
  SOCKET_READY = true;
  Logger.info('socketio ##################### connect')


});
//socket.on('message', function(){console.log('socketio ##################### burp')});
//socket.on('event', function(data){console.log('socketio event data',data)});

socket.on('disconnect', function () {
  Logger.info('socketio disconnect')
});


class DocumentSnapshot {
  constructor(id, data) {
    this._data = data;
    this.id = id;
  }

  data() {
    return this._data;
  }

}

class QuerySnapshot {
  constructor(id, data) {
    this._data = data;
    this.id = id;
  }

  data() {
    return this._data;
  }

  forEach(cb) {
    this._data.forEach(data => {
      cb && cb(new DocumentSnapshot(data && data._id, data))
    })
  }
}

class RedisStoreClient {
  constructor(parent, type, docName) {
    try {
      this.where_clauses = [];
      if (!type) {
        type = TYPE_DOCUMENT;
        docName = 'db:';
        parent = {pathName: ''}
      } else {
        if (!docName) {
          docName = cuid();
        }
        //this.docName = docName;
      }
      this.id = docName;
      this._id = docName;
      this.docType = type;
      this.parent = parent;
      this.pathName = `${parent.pathName}/${docName}`;

    } catch (e) {
      Logger.error('RedisStore constructor : ' + e.message);
      Logger.error(e.stack);
      throw new Error("CANNOT ADD collection on collection.");
    }
  }

  throw_error(msg, reject) {
    //console.error(`### ${msg} ##`, '==> proxy ', this.pathName, 'type', this.docType)
    try {
      // if something unexpected
      throw new Error(msg);
    } catch (e) {
      Logger.error('Error : ' + e.message);
      Logger.error(e.stack);
    }
    reject && reject(msg);
  }


  doc(docName) {
    //console.log(' doc','on proxy ', this.pathName,'type',this.docType,'ref',this.ref.constructor.name);
    if (this.id && this.docType === TYPE_COLLECTION) {
      if (!docName) {
        Logger.error('doc with no id!');
      }
      const pathName = docName && docName.split('/');
      docName = pathName && pathName[0] || docName;
      const obj = new RedisStoreClient(this, TYPE_DOCUMENT, docName);
      if (pathName.length === 1) {
        return obj
      } else {
        return obj.collection(pathName.slice(1).join('/'));
      }
    }
    this.throw_error(`CANNOT ADD collection on type ${this.docType} ${this.pathName}`);
  }

  collection(collectionName, type = TYPE_COLLECTION) {
    //console.log(' collection','on proxy ', this.pathName,'type',this.docType);
    if (this.id && this.docType === TYPE_DOCUMENT) {
      const pathNames = collectionName.split('/').filter(p => p);
      collectionName = pathNames[0];
      const obj = new RedisStoreClient(this, type, collectionName);
      if (pathNames.length === 1) {
        return obj
      } else {
        return obj.doc(pathNames.slice(1).join('/'));
      }

    }
    this.throw_error(`CANNOT ADD collection on type ${this.docType} ${this.pathName}`);

  }

  clone() {
    const c = new RedisStoreClient();
    Object.keys(this).forEach(k => {
        if (c.hasOwnProperty(k)) {
          c[k] = this[k]
        }
      }
    );
    return c;
  }

  exists() {
    const me = this;
    return new Promise(function (resolve, reject) {
        //console.log('calling get', me.pathName,me.id);
      }
    );
  }


  where(a, eq, b) {
    //TODO:check Indexes
    //if (this.id && this.docType === COLLECTION_TYPE) {
    const c = this.clone();
    c.where_clauses.push([a, eq, b]);
    return c;

    //this.throw_error(`CANNOT ADD collection on type ${this.docType} ${this.pathName}`, reject);
  }

  limit(l) {
    const c = this.clone();
    c.limit = l;
    return c;
  }

  orderBy(a, eq) {
    const c = this.clone()
    c.orderBy = [a, eq];
    return c;
  }

  delete() {
    return this.remove();
  }

  remove() {
    const me = this;
    return new Promise(function (resolve, reject) {

    })
  }

  get0() {
    const me = this;
    return new Promise(function (resolve, reject) {
      const path = me.pathName.replace('db:/', '');
      socket.emit("get", path);
      socket.on(path, function (data) {
        Logger.info('socketio callback ####### received from doc.get with /userStates/vhtlmsKFmjYPjjYsJQOd8aMzQZf2  ##############');
        //Logger.info(JSON.stringify(data));

        if (data instanceof Array) {
          resolve(new QuerySnapshot(me.id, data));
        } else {
          resolve(new DocumentSnapshot(me.id, data));
        }
      });

    });

  }

  get() {
    const me = this;

    return new Promise(function (resolve, reject) {
      const path = me.pathName.replace('db:/', '');
      ioReq(io).request("get", path) // method, data
        .then(function (data) {
          Logger.info('socketio callback ####### received from doc.get with /userStates/vhtlmsKFmjYPjjYsJQOd8aMzQZf2  ##############');
          //Logger.info(JSON.stringify(data));

          if (data instanceof Array) {
            resolve(new QuerySnapshot(me.id, data));
          } else {
            resolve(new DocumentSnapshot(me.id, data));
          }
        })
        .catch(function (err) {
          Logger.error('Error : ' + err.message);
          Logger.error(err.stack || "");
          reject(err)
        });

    });

  }


  onSnapshot(options, resolve) {
    const me = this;
    if (SOCKET_READY) {
      me._onSnapshot(options,resolve);
    } else {
      setTimeout(() => {
        me.onSnapshot(options, resolve);
      }, 200);
    }
    return me.unsubscribe;
  }

  _onSnapshot(options, resolve) {
    const me = this;
    Logger.info('calling onSnapshot : ' + me.pathName);

    //just to keep firestore compat
    if (typeof(options) === 'function') {
      resolve = options
    }

    //do stuff here
    //const unsubscribe = db.doc().onSnapshot(...)
    //call unsubscribe() to unsubscribe
    //subscribe here for document  channel =  me.pathName
    //call resolve
    const path = me.pathName.replace('db:/', '');
      socket.emit("snapshot", path);
      socket.on(path, function (data) {
        Logger.info('socketio callback ####### received from doc.get with /userStates/vhtlmsKFmjYPjjYsJQOd8aMzQZf2  ##############');
        //Logger.info(JSON.stringify(data));

        if (data instanceof Array) {
          resolve(new QuerySnapshot(me.id, data));
        } else {
          resolve(new DocumentSnapshot(me.id, data));
        }
      });
    return this.unsubscribe;
  }

  set(data, opt = {merge: true}) {
    const me = this;
    const path = me.pathName.replace('db:/', '');
    return new Promise(function (resolve, reject) {
      socket.emit("set", {path, data});
    });
  }


}

module.exports = {RedisStoreClient};


