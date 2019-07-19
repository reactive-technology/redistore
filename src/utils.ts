/**
 * Created by bbelarbi on 03/03/2017.
 */

const requestIp = require('request-ip');

//const ENV = (process.env.NODE_ENV || 'development').toUpperCase().slice(0,4);

// const DbUrl = 'mongodb://localhost:27017/hapi-app';
function getClientIp(request:any) {
  return requestIp.getClientIp(request);
};



module.exports.callerName=() =>{
  try {
    throw new Error();
  }
  catch (e) {
    try {
      return e.stack.split('at ')[3].split(' ')[0];
    } catch (e) {
      return '';
    }
  }

};


module.exports.getCredentialsFromPayLoad = (request:any,AppKey:any) => {
  const payload = request.payload;
  const applicationId = payload.applicationKey;
  const customerId = payload.deviceId || '0';
  const deviceUUId = payload.uuid || '0';
  let [service, type, application, key_version] = applicationId.toLowerCase().split('_');
  application = AppKey.name;
  key_version = AppKey.version;
  //service = module.exports.getService(applicationId,request);

  if(!service) {
    return false;
  }
  const ip = getClientIp(request);
  return {
    applicationKey: applicationId,
    deviceId: customerId,
    deviceUUId,
    //service,
    application,
    key_version,
    type,
    ip,
    //dataId: customerId + '._.' + deviceUUId
  };
};
