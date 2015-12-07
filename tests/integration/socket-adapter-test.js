import DS from 'ember-data';
import Ember from 'ember';
import setupStore from 'dummy/tests/helpers/store';
import fixtures from 'dummy/tests/fixtures';
import { getFixture, addFixture } from 'dummy/tests/fixtures';
import {module, test} from 'qunit';

let store;
let adapter;
let socketRequest;
let env;

const {
  get,
  set,
  run,
  EnumerableUtils: { forEach, map, filter },
  RSVP: { all }
 } = Ember;

window.io = {};
window.io.connect = function(address) {
  // TOOD: create typeFromAddress and addressFromType functions
  var type = address.split('/').reverse()[1];
  return Ember.Object.createWithMixins(Ember.Evented, {

    /**
     * Tests will emit events only for resource namespaces, so requestType and type are always set,
     * hash can be an empty object
     *
     * @param requestType
     * @param hash
     */
    emit: function(requestType, hash) {
      var fix,
        requestId = hash.request_id;
      delete hash.request_id;
      socketRequest = {};
      socketRequest.type = type;
      socketRequest.requestType = requestType;
      socketRequest.hash = hash;
      forEach(fixtures, function(fixture) {
        if (JSON.stringify(fixture.request) === JSON.stringify(socketRequest)) {
          // return fixture deep copy, to save fixture data across all tests
          fix = JSON.stringify(fixture.response);
          fix = JSON.parse(fix);
        }
      });
      if (fix) {
        fix.request_id = requestId;
        this.trigger('message', fix);
      } else {
        console.error('fixture not found', socketRequest);
      }
    }
  });
};

module('Acceptance | Socket Adapter', {
  beforeEach() {
    const Post = DS.Model.extend({
      name: DS.attr('string'),
      comments: DS.hasMany('comment', {async: true}),
      author: DS.belongsTo('author', {async: true})
    });

    Post.reopenClass({
      _findByIdParams:{
        include: [
          'comments'
        ],
        fields: [
          'name'
        ]
      }
    });

    const Comment = DS.Model.extend({
      name: DS.attr('string')
    });

    const Author = DS.Model.extend({
      name: DS.attr('string')
    });

    env = setupStore({
      post: Post,
      comment: Comment,
      author: Author
    });

    store = env.store;
    adapter = env.adapter;
    env.container.register('transform:string', DS.StringTransform);
  },
  afterEach() {
     run(store, 'destroy');
  }
});

test('Find Post by ID without options', function(assert) {
  assert.expect(2);
  run(() => {
    store.find('post', 1).then((post) => {
      assert.deepEqual(socketRequest, {type: 'post', requestType: 'READ', hash: {id: '1', include: ['comments'], fields: ['name']}},
          `Defult includes and fields should be sent in READ request`
        );
      assert.ok(get(post, 'isLoaded'), 'post should be loaded in store correctly');
    });
  });
});


test('Find All Posts without options', function(assert) {
  assert.expect(2);
  run(() => {
    store.find('post').then(((posts) => {
      assert.deepEqual(socketRequest, {type: 'post', requestType: 'READ_LIST', hash: {}},
          'READ_LIST request should be sent with empty hash');
      assert.ok(get(posts, 'isLoaded'), 'posts should be loaded in store correctly');
    }));
  });
});

test('Find Posts with meta', function(assert) {
  assert.expect(2);
  run(() => {
    all([store.findQuery('post', {limit: 1}), store.findQuery('post', {limit: 2})]).then((response) => {
      assert.equal(get(response[0], 'meta.total'), 1, 'meta.total in first query should be equal 1');
      assert.equal(get(response[1], 'meta.total'), 2, 'meta.total in first query should be equal 2');
    });
  });
});

test('Create Post', function(assert) {
  assert.expect(3);
  run(() => {
    store.find('author', 1).then((author) => {
      assert.ok(author, 'Should find author #1');
      const post = store.createRecord('post', {
        author: author,
        name: 'Socket.io is awesome'
      });
      post.save().then((post) => {
        assert.deepEqual(socketRequest, {
            type: 'post',
            requestType: 'CREATE',
            hash: {
              post: {
                author: '1', name: 'Socket.io is awesome', comments: []
              }
            }
          }, 'CREATE request should be sent with all new data');
        assert.ok(post.get('isLoaded'), 'post should be loaded in store correctly');
      });
    });
  });
});


test('Create Posts', function(assert) {
  assert.expect(3);
  run(() => {
    store.find('author', 1).then(((author) => {
      assert.ok(!!author, 'Should find author #1');
      const posts = [
        store.createRecord('post', {
          author: author,
          name: 'Socket.io is awesome'
        }),
        store.createRecord('post', {
          author: author,
          name: 'Ember.js is awesome'
        })];
        all(map(posts, (post) =>  post.save())).then((posts) => {
          assert.deepEqual(socketRequest, {
              type: 'post',
              requestType: 'CREATE_LIST',
              hash: {post: [
                {name: 'Socket.io is awesome', comments: [], author: '1' },
                {name: 'Ember.js is awesome', comments: [], author: '1' }
              ]}
            },
            'CREATE_LIST request should be sent with all new data for both 2 posts'
          );
          assert.ok(filter(posts, (post) => get(post, 'isLoaded')).length === 2, 'posts should be loaded in store correctly');
        });
    }));
  });
});

test('Update Post', function(assert) {
  run(() => {
    store.pushPayload('post', getFixture('Find Post by ID = 1'));
  });

  run(() => {
    const post = store.getById('post', 1);
    set(post, 'name', 'Javascript is awesome');
    post.save().then(() => {
      assert.deepEqual(socketRequest, {
          type: 'post',
          requestType: 'UPDATE',
          hash: { post: {
            id: '1', name: 'Javascript is awesome', author: '1'
          }
          }
        },
        `UPDATE request should be sent with only updated data`
      );
    });
  });
});

test('Update Posts', function(assert) {
  run(() => {
    store.pushPayload('post', getFixture('Find Posts without options').payload);
  });

  run(() => {
    const posts = store.all('post');
    forEach(posts, (post) => {
      set(post, 'name', 'Javascript is awesome');
    });
    posts.save().then(() => {
      assert.deepEqual(socketRequest, {
          type: 'post',
          requestType: 'UPDATE_LIST',
          hash: { post: [
            { id: '1', name: 'Javascript is awesome', author: '1' },
            { id: '2', name: 'Javascript is awesome' }
          ]}
        },
        'UPDATE_LIST request should be sent with only updated data');
    });
  });
});

test('Delete Post', function(assert) {
  run(() => {
    store.pushPayload('post', getFixture('Find Posts without options').payload);
  });
  run(() => {
    const posts = store.all('post');
    const post = get(posts, 'lastObject');

    post.destroyRecord().then((response) => {
      assert.deepEqual(socketRequest, {
          type: 'post',
          requestType: 'DELETE',
          hash: { id: '2' }
        }, 'DELETE reqeust should be sent only with deletable id'
      );
      assert.equal(response.get('id'), 2, 'post id should be equal 2');
    });
  });
});

test('Delete Posts', function(assert) {
  assert.expect(2);
  run(() => {
    store.pushPayload('post', getFixture('Find Posts without options').payload);
  });
  run(() => {
    const posts = store.all('post');

    posts.findProperty('id', '1').deleteRecord();
    posts.findProperty('id', '2').deleteRecord();

    posts.save().then((posts) => {
      assert.deepEqual(socketRequest, {
          type: 'post',
          requestType: 'DELETE_LIST',
          hash: {
            ids: ['1', '2']
          }
        }, 'DELETE_LIST reqeust should be send with deletable ids'
      );
      assert.equal(posts.isEvery('isDeleted', true), true, 'every post should be deleted');
    });
  });
});

test('Read Posts with releations', function(assert) {
  assert.expect(3);

  run(() => {
    store.find('post', {include: ['comments', 'author']}).then((posts) => {
      assert.equal(posts.get('length'), 2, 'posts length should be equal 2');
      assert.equal(get(posts, 'firstObject.comments').findProperty('id', '1').get('name'),
        'Greet.',
        'first comment to first post should be equal "Greet."');
      assert.equal(get(posts, 'firstObject.author.name'), 'Test', 'author name sholud be equal "Test"');
    });
  });
});

test('Create Posts from Server\'s PUSH', function(assert) {
  run(() => {
    const socketNS = adapter.getConnection(store.modelFor('post'));
    const serverPUSH = {
    payload: {
      post: [
        { id: 1, name: 'Socket.io is awesome'},
        { id: 2, name: 'Ember.js is awesome'}
      ]
    }};
    socketNS.trigger('message', serverPUSH);
  });

  run(() => {
    const posts = store.all('post');
    assert.equal(get(posts, 'length'), 2, 'All posts should be loaded from store correctly');
  });
});

test('Delete Posts from Server\'s PUSH', function(assert) {
  assert.expect(2);
  let posts;
  run(() => {
    store.pushPayload('post', getFixture('Find Posts without options').payload);
  });

  run(() => {
    posts = store.all('post');
    assert.equal(get(posts, 'length'), 2, 'posts should be loaded in store correctly');
    const socketNS = adapter.getConnection(store.modelFor('post'));
    const serverPUSH = {
      ids: [1, 2]
    };
    socketNS.trigger('message', serverPUSH);
  });

  run(() => {
    posts = store.all('post');
    assert.equal(get(posts, 'length'), 0, 'Posts with id 1 and 2 should be removed from store');
  });
});

test('Request model key should be underscored', function(assert) {
  const UserPreferences = DS.Model.extend();
  env.container.register('model:user-preferences', UserPreferences);

  run(() => {
    addFixture('Create User Preferences', {
      type: 'user-preferences',
      requestType: 'CREATE',
      hash: {
          user_preferences: {}
        }
      }, {
        user_preferences: [
          { id: 1 }
        ]
    });
    store.createRecord('user-preferences').save().then(() => {
      assert.ok(socketRequest.hash.user_preferences, 'User Preferences key have to be underscored in request');
    });
  });
});
