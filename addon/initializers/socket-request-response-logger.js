import Ember from 'ember';
const {
  ArrayProxy,
  A: createArray
} = Ember;

export const RequestResponseLogger = ArrayProxy.create({
  _requests: createArray(),
  content: createArray(),
  logRequest(request) {
    this._requests.addObject(request);
  },
  logResponse(response) {
    const request = this._requests.findBy('request_id', response.request_id);
    delete request.request_id;
    delete response.request_id;
    this._requests.removeObject(request);
    this.addObject({
      request,
      response
    });
  }
});

export default {
  name: 'socket-request-response-logger',
  initialize( registry, application ) {
    application.register('socket-request-response-logger:-main', RequestResponseLogger, { instantiate: false, singleton: true });
    application.inject('socket-request-response-logger:-main', 'application', 'application:main');
  }
};
