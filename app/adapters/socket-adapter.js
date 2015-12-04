import Ember from 'ember';
import SocketAdapter from 'socket-adapter/adapters/socket';
import ENV from '../config/environment';

const { computed } = Ember;
export default SocketAdapter.extend({
  socketAddress: computed(function() {
    return ENV.APP.SOCKET_ADDRESS;
  }),
});
