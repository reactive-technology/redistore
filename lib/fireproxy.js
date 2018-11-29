let nbRead = 0;
let nbDel = 0;
let nbWrite = 0;
let lastSaveAt = 0;
const os = require('os');

const hostname = os.hostname();

const filterDefined = (o, newObj = {}) => {
  if (
    typeof o !== 'object' ||
    (o.constructor && o.constructor.name == 'DocumentReference')
  ) {
    return o;
  }
  Object.keys(o)
    .filter(k => typeof o[k] !== 'undefined')
    .map(k => (newObj[k] = filterDefined(o[k])));
  // newObj['host']=hostname;
  return newObj;
};

const is_array = function (value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.length === 'number' &&
    typeof value.splice === 'function' &&
    !value.propertyIsEnumerable('length')
  );
};
const FP = {
  MAIN_DB: 0,
  SECONDARY_DB: 1,
};

const activateReplication = true;

/**
 * FireProxy
 * enhance firetore architecture a unique interface to firestore and other key value dbs
 *
 */
class FireProxy {
  /**
   * constructor
   * @param parents
   * @param type
   * @param docName
   */
  constructor(parents, type, docName) {
    // console.log('constructor proxy db=',db.constructor.name);
    try {
      const _docName = docName;
      let parentRef = parents;
      this.snapShotInstNum = 0;
      if (parents) {
        if (!is_array(parents)) {
          parents = [parents];
        } else if (parents.length < 2) {
          try {
            throw new Error('need more refs.');
          } catch (e) {
            console.error(e);
          }
        }
        parents.forEach((parent, index) => {
          // console.log("proxy ",index,parent.constructor.name,parent);
          if (!parent) {
            parent = parents;
          } // only for functions, to use db
          if (
            parent.constructor.name === 'Firestore' ||
            parent.constructor.name === 'RedisStore' ||
            parent.constructor.name === 'RedisStoreClient'
          ) {
            // we start the structure with a db
            // proxyRef.pathName = proxyRef.constructor.name
            if (index === 0) {
              parentRef = { proxyId: 0 };
              parentRef.pathName = parent.constructor.name;
              parentRef.proxyRefs = { 0: parent };
            } else {
              parentRef.proxyRefs[1] = parent;
            }

            type = 'collection';
            // docName = 'db';
          }
        });
        if (docName) {
          this.proxyRefs = {};
          this.proxyId = parentRef.proxyId;
          if (type === 'doc') {
            if (_docName === '__AUTO__') {
              Object.keys(parentRef.proxyRefs).forEach(key => {
                this.proxyRefs[key] = parentRef.proxyRefs[key].doc();
              });
              docName = this.proxyRef.id;
              //console.log("docName == '__AUTO__' replace by", docName);
            } else {
              if (!parentRef.proxyRefs[0].doc) {
                console.error('ERROr');
              }
              Object.keys(parentRef.proxyRefs).forEach(key => {
                if (!parentRef.proxyRefs[key].doc) {
                  console.error(
                    '##DB REF ERROR##### for docName ',
                    docName,
                    'key',
                    key,
                    'parents',
                    Object.keys(parents),
                  );
                  // console.log('proxyRef',parentRef.refs[key],parentRef.refs[key]);
                  console.log(
                    'error on proxyRef type',
                    parentRef.proxyRefs[key].constructor.name,
                  );
                  try {
                    throw new Error('FIRESTORE PROXY CANNOT SET STORE REF.');
                  } catch (e) {
                    console.error(e);
                  }
                } else {
                  this.proxyRefs[key] = parentRef.proxyRefs[key].doc(docName);
                }
              });
            }
          } else if (parentRef.proxyRefs) {
            Object.keys(parentRef.proxyRefs).forEach(
              key =>
                (this.proxyRefs[key] = parentRef.proxyRefs[key].collection(
                  docName,
                )),
            );
          } else {
            console.error('parentRef.dbRefs undefined');
          }
          this.docName = docName;
        } else {
          this.docName = 'db';
        }
        this.id = docName;
        this._id = docName;
        this.docType = type;
        this.pathName = `${parentRef.pathName}/${docName}`;
        // this.refs = parentRef.refs;
      }
      // console.log('==> proxy create ', this.pathName,'type',type,docName,this.proxyRef.constructor.name);
    } catch (e) {
      console.error(e);
      console.error(
        'called with args parents',
        parents,
        'type',
        type,
        'docName',
        docName,
      );
      throw new Error('PROXY CONSTRUCTOR', e);
    }

    this.types = null;
  }

  /**
   * returns a proxy with the specified ranking field
   * @param {string} fieldName
   * @param {array} keys
   * @returns {FireProxy}
   */
  withRankingField(fieldName, keys) {
    this.proxyRef.withRankingField &&
    this.proxyRef.withRankingField(fieldName, keys);
    return this;
  }

  remove() {
    return this.proxyRef.remove && this.proxyRef.remove();
  }

  /**
   * get document rank using current primary key in indexMap
   * @param indexMap
   * @returns {FireProxy.getRank|RedisStore.getRank|*|Promise}
   */
  getRank(indexMap) {
    return this.proxyRef.getRank && this.proxyRef.getRank(indexMap);
  }

  /**
   * update document ranking using current primary key in indexMap with given score
   * @param id
   * @param score
   * @returns {*|Promise}
   */
  updateRank(id, score) {
    return this.proxyRef.rank && this.proxyRef.updateRank(id, score);
  }

  /**
   * Provide a range of elements in the ranking interval
   * @param min
   * @param max
   * @param field
   * @returns {FireProxy.rankingRange|RedisStore.rankingRange|*}
   */
  rankingRange(min, max, field) {
    return (
      this.proxyRef.rankingRange && this.proxyRef.rankingRange(min, max, field)
    );
  }

  /**
   * return a proxy clone with the new attribute types
   * @param types
   * @returns {FireProxy}
   */
  withTypes(types) {
    this.types = types;
    if (this.proxyRef.withTypes) {
      this.proxyRef.withTypes(types);
    }
    return this;
  }

  /**
   * return a proxy clone with the new proxy reference
   * @param proxyId
   * @returns {*}
   */
  withProxyRef(proxyId) {
    const c = this.clone();
    if (c.proxyRefs[proxyId]) {
      c.proxyId = proxyId;
    } else {
      try {
        if (!global.window && proxyId < 1) {
          console.error(
            'CAN SET STORE REF',
            proxyId,
            'AS IT DOES NOT EXIST IN REFS KEYS',
            Object.keys(this.proxyRefs),
          );
          throw new Error('FIRESTORE PROXY CANNOT SET STORE REF.');
        } else {
          c.proxyId = 0;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return c;
  }

  /**
   * get the current proxy ref
   * @returns {*}
   */
  get ref() {
    return this.proxyRef();
  }

  /**
   * get the current proxy ref
   * @returns {{}|*}
   */
  get proxyRef() {
    let proxyId = this.proxyId;
    if (!proxyId) {
      proxyId = 0;
    }
    if (!this.proxyRefs[this.proxyId]) {
      console.error(
        'cannot set proxyRef for proxyId',
        this.proxyId,
        'on refs ',
        Object.keys(this.proxyRefs),
      );
      try {
        throw new Error('FIRESTORE PROXY CANNOT SET  REF.1');
      } catch (e) {
        console.error(e);
        throw new Error('FIRESTORE PROXY CANNOT SET REF.1');
      }
    }
    return this.proxyRefs && this.proxyRefs[proxyId];
  }

  /**
   * clone this proxy
   * @returns {FireProxy}
   */
  clone() {
    const c = new FireProxy();
    c.proxyId = this.proxyId;
    c.proxyRefs = {};
    Object.keys(this.proxyRefs).forEach(
      k => (c.proxyRefs[k] = this.proxyRefs[k]),
    );
    c.docName = this.docName;
    c.docType = this.docType;
    c.pathName = this.pathName;
    return c;
  }

  /**
   * return a reference to the collection with the provided name
   * If the collection does not exist, a new one will be created
   * @param collectionName
   * @returns {FireProxy}
   */
  collection(collectionName) {
    // console.log(' collection','on proxy ', this.pathName,'type',this.docType);
    if (this.docName && this.docType === 'doc') {
      return new FireProxy(this, 'collection', collectionName);
    }
    console.error(
      '#####CANNOT ADD collection on collection',
      '==> proxy ',
      this.pathName,
      'type',
      this.docType,
    );
    try {
      // if something unexpected
      throw new Error('CANNOT ADD collection on collection.');
    } catch (e) {
      console.error(e);
    }
    // return proxy.collection(collectionName);
  }

  /**
   * add a new where clause to the request statement
   * @param a
   * @param eq
   * @param b
   * @returns {FireProxy}
   */
  where(a, eq, b) {
    const c = this.clone();
    Object.keys(c.proxyRefs).forEach(key => {
      c.where_clauses = c.where_clauses ? c.where_clauses : [];
      c.where_clauses.push([a, eq, b]);
      c.proxyRefs[key] = c.proxyRefs[key].where(a, eq, b);
    });
    return c;
  }

  /**
   * add a limit for the request statement
   * @param l
   * @returns {FireProxy}
   */
  limit(l) {
    const c = this.clone();
    Object.keys(c.proxyRefs).forEach(
      key => (c.proxyRefs[key] = c.proxyRefs[key].limit(l)),
    );
    // c.proxyRef = c.proxyRef.limit(l);
    return c;
  }

  selectDb(proxyId) {
    const c = this.clone();
    c.proxyId = proxyId;
    return c;
  }

  /**
   * add orderBy for the request statement
   * @param a
   * @param eq
   * @returns {FireProxy}
   */
  orderBy(a, eq) {
    const c = this.clone();
    Object.keys(c.proxyRefs).forEach(
      key => (c.proxyRefs[key] = c.proxyRefs[key].orderBy(a, eq)),
    );
    // c.proxyRef = c.proxyRef.orderBy(a, eq);
    return c;
  }

  /**
   * get a document reference for the provided doc name
   * @param docName
   * @returns {FireProxy}
   */
  doc(docName) {
    // console.log(' doc','on proxy ', this.pathName,'type',this.docType,'proxyRef',this.proxyRef.constructor.name);
    if (this.docName && this.docType === 'collection') {
      return new FireProxy(this, 'doc', docName || '__AUTO__');
    }
    console.error(
      '#### CANNOT ADD doc on doc',
      '==> proxy ',
      this.pathName,
      'type',
      this.docType,
      'with docName',
      docName,
    );
    try {
      throw new Error('FIRESTORE PROXY ERROR.');
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * delete the object referenced document or collection
   * @returns {Promise}
   */
  delete() {
    const me = this;
    return new Promise((resolve, reject) => {
      console.log('calling delete() on', me.pathName, me.proxyRef.id);
      me.proxyRef
        .delete()
        .then(snap => {
          nbDel++;
          console.warn(
            '‡‡‡‡‡ proxy ‡‡‡‡ delete ok ',
            nbDel,
            '‡‡‡‡',
            me.proxyRef.id,
            me.pathName,
          );
          try {
            resolve(snap);
          } catch (e) {
            console.log(e);
          }
        })
        .catch(error => {
          console.log('Error gettideleting documents: ', error);
        })
        .catch(e => {
          try {
            throw new Error('FIRESTORE PROXY ERROR.', e);
          } catch (e) {
            console.error(e);
          }
          reject(e);
        });
    });
  }

  /**
   * Write from Firestore to Redis
   *
   * @param {Promise} resolve
   * @param {Promise} reject
   */
  restoreFromFirestoreIfNeeded(resolve, reject, defaultValue) {
    const me = this;
    const keys = defaultValue && Object.keys(defaultValue).filter(k => k[0] != '_') || [];
    if(keys.length !== 0){
      resolve(defaultValue);
    } else {
      me.proxyRefs[1]
        .getMetadata()
        .then(metadata => {
          if (
            activateReplication &&
            (!metadata || (metadata && !metadata.replicated))
          ) {
            me.withProxyRef(0).replicateTo(1, defaultValue, (data, err) => {
              if(data && data !== defaultValue){
                console.log(
                  me.proxyRefs[1].pathMetadata,
                  '==== §§§§  restoreFromFirestore : sync because of metadata ',
                  me.id,
                  metadata,
                );
              }
              resolve(data);
            });
          } else {
            resolve(defaultValue);
          }
        })
        .catch(err => reject(err));
    }
  }

  /**
   * get the object document or collection reference
   * @param opt
   * @returns {Promise}
   */
  get (opt) {
    const me = this;
    if (this.proxyId === 0) {
      //console.log('getting with proxyId 0');
    }
    if (me.type === 'doc' && (!me.id || me.id === 'none')) {
      console.error('get : error id not defined');
    }
    return new Promise((resolve, reject) => {
      me.proxyRef
        .get(opt)
        .then(docRef => {
          // console.log('++++++++++ GETTING ', me.pathName, 'WITH REFID', me.proxyId);
          // docRef && docRef.size && console.log('snap', docRef.constructor.name, 'size', docRef.size);
          if (me.proxyRef.constructor.name === 'RedisStore') {
            // console.log('RECEIVED DOC FROM REDIS',docRef);
            me.restoreFromFirestoreIfNeeded(resolve, reject, docRef);
          } else {
            const inc = (docRef && docRef.size) || 1;
            nbRead += inc;

            if (nbRead + nbWrite - lastSaveAt > 500) {
              lastSaveAt = nbRead + nbWrite;
              console.log('get should save nbOp ', lastSaveAt, '‡‡‡‡');
            }
            //console.log('====> received type ', docRef.constructor.name);

            if (
              docRef.constructor.name === 'QuerySnapshot' ||
              docRef.constructor.name === 'QuerySnapshot'
            ) {
              const docs = [];
              docRef.forEach(doc => {
                nbRead += 1;
                console.warn(
                  '‡ get',
                  me.pathName,
                  'nbr',
                  nbRead,
                  '‡',
                  me.proxyRef.id,
                  '++ proxyId',
                  me.proxyId,
                  doc.id,
                );
                const data = doc.data();
                if (data) {
                  data._id = doc.id;
                }
                // data._docRef = doc;
                docs.push(data);
              });
              resolve(docs, docRef);
            } else {
              console.warn(
                '‡ get',
                me.pathName,
                'nbr',
                nbRead,
                '‡',
                me.proxyRef.id,
                '++ proxyId',
                me.proxyId,
              );
              const data = docRef.data();
              if (data) {
                data._id = docRef.id;
              }
              // data._docRef = docRef;
              resolve(data);
            }
          }
        })
        .catch(e => {
          try {
            console.log('Error getting documents: ', e);
            console.log(me.proxyRef.id, me.pathName);
            throw new Error('FIRESTORE PROXY ERROR.', e);
          } catch (e) {
            console.error(e);
          }
          reject(e);
        });
    });
  }

  _get() {
    const me = this;
    return new Promise((resolve, reject) => {
      // console.log('calling get', me.pathName,me.proxyRef.id);
      // if(me.where_clauses) console.log('get value with where_clauses',me.where_clauses);
      if (me.proxyRef.constructor.name === 'RedisStore') {
        me.proxyRefs[1].getMetadata().then(metadata => {
          if (metadata && !metadata.replicated) {
            console.log('@@@@@@@@@@ NOT YET DE-REPLICATED @@@@@@@@@@');
            me.withProxyRef(0)
              .get()
              .then(data => {
                data._replicated = true;
                resolve(data);
                console.log('@@@@@@@@@@ FIRESTORE WRITING REPILCA @@@@@@@@@@');
                me.proxyRefs[0].set(data).then(ok => {
                  me.unreplicated = true;
                });
              })
              .catch(e => {
                try {
                  console.log(me.proxyRef.id, me.pathName);
                  console.log('Error getting documents: ', error);
                  throw new Error('FIRESTORE PROXY ERROR.', e);
                } catch (e) {
                  console.error(e);
                }
                reject(e);
              });
          } else {
            me._get(resolve, reject);
          }
        });
      } else {
        me._get(resolve, reject);
      }
    });
  }

  /**
   * replicate the document or collection from current proxy ref to provided proxy Ref Id
   * @param proxyRefId
   * @param defaultValue
   * @param bk
   * @param merge
   */
  replicateTo(proxyRefId, defaultValue, bk, merge = false) {
    const me = this;
    // console.log('REPLICATING from', this.dbRefs[this.proxyId].constructor.name, 'TO ', this.dbRefs[dbId].constructor.name);
    me.get()
      .then(data => {
        // data._metadata = data._metadata||{};
        // data.replicated = getServerTime();
        let isDefault = false;
        if (!data) {
          data = defaultValue;
          isDefault = true;
        }
        const keys = data && Object.keys(data) || [];
        if(keys.length !== 0) {
          // console.log('SAVING DATA TO ', this.dbRefs[dbId].constructor.name, 'data', JSON.stringify(data));
          // console.log('call set on', typeof(me.dbRefs[dbId]), '+', me.dbRefs[dbId].constructor.name);
          // console.log('REPLICATING with merge=',merge,'defaultVal',isDefault,'data=',data)
          me.proxyRefs[proxyRefId]
            .set(filterDefined(data), { merge, isReplicate: true })
            .then(ok => {
              bk && bk(data, ok);
            })
            .catch(e => {
              console.error(e);
              bk && bk(null, e);
            });
        } else {
          console.debug('empty data not replicated');
          bk && bk(null, null);
        }
      })
      .catch(e => {
        console.error(e);
        bk && bk(null, e);
      });
  }

  /**
   * set new data object in document with merge/sync options
   * @param newData
   * @param mergingOpt
   * @returns {Promise}
   */
  set (newData, mergingOpt = { merge: true }) {
    const me = this;
    mergingOpt = Object.assign({ merge: true }, mergingOpt);
    if (mergingOpt.syncMainDb) {
      console.debug('syn db');
    }
    if (me.type === 'doc' && (!me.id || me.id === 'none')) {
      console.error('error id not defined');
    }
    // console.log('proxy adding newData',JSON.stringify(newData));
    return new Promise((resolve, reject) => {
      try {
        // console.log('calling set', me.pathName, "‡‡‡‡", 'merge', JSON.stringify(merge));
        const updateValue = (currentData, mergingOpt) => {
          me.proxyRef
            .set(filterDefined(newData), mergingOpt)
            .then(ok => {
              if (me.proxyRef.constructor.name === 'RedisStore') {
                if (mergingOpt.syncMainDb && activateReplication) {
                  // console.log('sync export from cache required by call');
                  //  me.withProxyRef(1).replicateTo(0, newData, (data, err) => {
                  // },mergingOpt.merge)
                  me.proxyRef
                    .get()
                    .then(mergeData => {
                      // console.log('mergeData',mergeData);
                      me.proxyRefs[0]
                        .set(filterDefined(mergeData), {
                          merge: false,
                          isReplicate: true,
                        })
                        .then(ok => {
                          if (mergingOpt.syncMainDb) {
                            console.debug('syn db');
                          }
                          ok.data = mergeData;
                          ok.id = me.id;
                          resolve(ok);
                        })
                        .catch(e => {
                          console.error(e);
                          reject(e);
                        });
                    })
                    .catch(e => {
                      console.error(e);
                      reject(e);
                    });
                } else {
                  resolve(ok);
                }
              } else {
                lastSaveAt++;
                console.warn(
                  '‡‡‡‡‡‡‡‡ set',
                  me.pathName,
                  ' OK ',
                  ++nbWrite,
                  '‡‡‡‡',
                  'merge',
                  mergingOpt,
                );

                resolve(ok);
              }
            })
            .catch(e => {
              try {
                console.error(
                  'ERROR setting path',
                  me.pathName,
                  'with data',
                  newData,
                  e,
                );
                throw new Error('FIRESTORE PROXY ERROR.', e);
              } catch (e) {
                console.error(e, 'path', me.pathName);
              }
              reject(e);
            });
        };

        if (me.proxyRef.constructor.name === 'RedisStore') {
          // console.log('---------> SYNCHRONIZE AFTER CHECK AND RESTORE');
          me.restoreFromFirestoreIfNeeded(
            restoredData => {
              // console.log('DB 2 SYNCHRONIZED OK from proxyId', me.proxyId, data);
              updateValue(restoredData, mergingOpt);
            },
            reject,
            newData,
          );
        } else {
          updateValue(newData, mergingOpt);
        }
      } catch (e) {
        console.error(e, 'path', me.pathName);
        reject(e);
      }
    });
  }

  /**
   * document change subscriber
   * @param onChange callback to receive document changes, based on proxy ref snapshot
   * @param onError
   * @param monitor
   * @param watchTimeout
   * @returns {(() => void) | *}
   */
  onDocChange(onChange, onError, monitor = true, watchTimeout = 30 * 60) {
    const me = this;
    //monitor && console.log("monitored watchTimeout", watchTimeout);
    this.snapShotInstNum++;
    let lastReadAt = Date.now();
    // if(me.where_clauses)
    // console.log('get onSnapshot with where_clauses',me.where_clauses,"\n", me.proxyRef);
    const unsubscriber = me.proxyRef.onSnapshot(
      (snapshot, err) => {
        if (err) {
          console.error(err);
          onError(err);
        }
        /*console.warn(
          '‡‡‡‡‡‡‡‡ snapshot received for ',
          me.pathName,
          'snapShot instance',
          me.snapShotInstNum,
        );*/
        lastReadAt = Date.now();
        if (me.proxyRef.constructor.name === 'RedisStore') {
          onChange(snapshot);
        } else if (snapshot.constructor.name === 'DocumentSnapshot') {
          const data = snapshot.data();

          if (data) {
            data._id = snapshot.id;
            // data._docRef = change.doc;
            // data._metadata = snapshot && snapshot.metadata;

            nbRead++;
            console.warn(
              '‡‡‡‡‡‡‡‡ snapshotDoc read nb',
              ++nbRead,
              'path',
              me.pathName,
              'OK id',
              data._id,
              '‡‡‡‡',
            );
            onChange(data);
          } else {
            // reject(new Error('undefined data'));
          }
        } else if (
          snapshot &&
          snapshot.docChanges &&
          snapshot.docChanges.forEach
        ) {
          // console.warn('‡‡‡‡‡‡‡‡ multiple snapshots ',
          // me.pathName, 'OK', ++nbWrite, "‡‡‡‡", snapshot.size);
          snapshot.docChanges.forEach(
            changedDoc => {
              // players.push(change.doc.data());
              // console.warn('‡‡‡‡‡‡‡‡ snapshotChange ', me.pathName, 'OK', ++nbRead, "‡‡‡‡");
              const data =
                changedDoc && changedDoc.doc && changedDoc.doc.data();
              if (data) {
                data._id = changedDoc.doc && changedDoc.doc.id;
                // data._docRef = change.doc;
                // data._metadata = changedDoc && changedDoc.doc  && changedDoc.metadata;
              }

              nbRead++;
              console.warn(
                '‡‡‡‡‡‡‡‡ snapshotChange read nb',
                nbRead,
                'path',
                me.pathName,
                'OK id',
                data && data._id,
                '‡‡‡‡',
              );
              onChange(data);
            },
            err => {
              try {
                throw new Error('FIRESTORE OnDocChange PROXY ERROR.', err);
              } catch (e) {
                console.error(e);
                onError(e);
              }
            },
          );
          //console.log("finished!");
          onChange({});
        } else if (snapshot.constructor.name === 'QueryDocumentSnapshot') {
          const data = snapshot.data();

          if (data) {
            data._id = snapshot.id;
            nbRead++;
            console.warn(
              '‡‡‡‡‡‡‡‡ snapshotDoc read nb',
              ++nbRead,
              'path',
              me.pathName,
              'OK id',
              data._id,
              '‡‡‡‡',
            );
            onChange(data);
          } else {
            onError(new Error('undefined data'));
          }
        } else {
          console.log('onDocChange Error', me.pathName);
        }
      },
      error => {
        console.error('onDocChange Error', error);
        unsubscriber();
        me.onDocChange(onChange, onError);
      },
    );
    var count = 1;
    const snapWatcher = () => {
      setTimeout(() => {
        const now = Date.now();
        const diff = now - lastReadAt;
        const since = Math.trunc(diff / 1000);
        if (since >= watchTimeout) {
          console.warn(
            new Date(now),
            me.pathName,
            '****** snapWatcherStopDetect: snapShot seems have stopped for more than',
            watchTimeout,
            'sec, no activity since',
            since,
            'sec at',
            new Date(lastReadAt),
            'stopping and re-subscribe',
          );
          unsubscriber();
          me.onDocChange(onChange, onError, true, watchTimeout);
        } else {
          if (count % 2 === 0) {
            false && console.log(
              new Date(now),
              count,
              '***** snapWatcher subscriber for ',
              me.pathName,
              'is active since',
              since,
              'sec at ',
              new Date(lastReadAt),
              ' continue watching ...',
            );
          }
          count++;
          snapWatcher();
        }
      }, 10000);
    };
    if (monitor) {
      console.log('start snapWatcher for ', me.pathName);
      snapWatcher();
    }

    return unsubscriber;
  }

  /**
   * add a direct snapshot subscriber on the current proxy ref
   * @param option
   * @param resolve
   * @param reject
   */
  onDataChange(option, resolve, reject) {
    const me = this;
    this.dataSnapShotNum = this.dataSnapShotNum ? 1 : this.dataSnapShotNum + 1;
    console.log('===============>>>>>>>>> calling onSnapshot', me.pathName);
    let lastReadAt = Date.now();
    const unsubscriber = me.proxyRef.onSnapshot(
      option,
      snapshot => {
        lastSaveAt++;
        lastReadAt = Date.now();
        console.warn(
          '‡‡‡‡‡‡‡‡ snapshot num',
          me.dataSnapShotNum,
          me.pathName,
          'OK',
          ++nbWrite,
          '‡‡‡‡',
          snapshot.size,
        );
        const data = snapshot.data();
        if (data) {
          data._id = snapshot.id;
        }
        // data._refDoc = snapshot;
        // data._metadata = snapshot && snapshot.metadata;
        resolve(data);
      },
      err => {
        try {
          throw new Error('FIRESTORE PROXY ERROR.', err);
        } catch (e) {
          console.error(e);
          reject(e);
        }
        unsubscriber();
        me.onDataChange(option, resolve, reject);
      },
    );
    /**
     * The watcher will check if the snaphot change is always working
     * After some amount of inactivity the watcher will consider the snapshot change
     * subscribe as blocked and will restart it
     */
    const watcher = () => {
      setTimeout(() => {
        if (Date.now() - lastReadAt > 5 * 60 * 1000) {
          console.log('snapShot seems have stopped, need to re subscribe');
          unsubscriber();
          me.onDataChange(option, resolve, reject);
        } else {
          watcher();
        }
      }, 1000);
    };
    /* .catch(e => {
    try { throw new Error("FIRESTORE PROXY ERROR.",e); } catch (e) {      console.error(e);   }
    reject(e)
  }); */
  }
}

module.exports = FireProxy;
