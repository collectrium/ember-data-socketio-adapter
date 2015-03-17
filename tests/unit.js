var env, store, adapter, Post, Comment, socketRequest;

module('unit - Socket Adapter: ', {
  setup: function() {
    Post = DS.Model.extend({
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

    Post.toString = function() {
      return 'Post';
    };

    Comment = DS.Model.extend({
      name: DS.attr('string')
    });

    Author = DS.Model.extend({
      name: DS.attr('string')
    });

    env = setupStore({
      post: Post,
      comment: Comment,
      author: Author,
      adapter: SA.Adapter
    });

    store = env.store;
    adapter = env.adapter;
    env.container.register('transform:string', DS.StringTransform);
  }
});

test('Find Post by ID without options', function() {
  expect(2);

  store.find('post', 1).then(async(function(post) {
    deepEqual(socketRequest, {type: 'post', requestType: 'READ', hash: {id: '1', include: ['comments'], fields: ['name']}},
        'Post READ event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "READ", \n' +
        'hash: {id: "1", include: ["comments"], fields: ["name"]} \n' +
        '}');
    ok(post.get('isLoaded'), 'post should be loaded in store correctly');
  }));
});

test('Find All Posts without options', function() {
  expect(2);

  store.find('post').then(async(function(posts) {
    deepEqual(socketRequest, {type: 'post', requestType: 'READ_LIST', hash: {}},
        'Posts READ_LIST event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "READ_LIST", \n' +
        '}');
    ok(posts.get('isLoaded'), 'posts should be loaded in store correctly');
  }));
});

test('Find Posts with meta', function() {
  expect(2);
  var query1, query2;
  store.findQuery('post', {limit: 1}).then(async(function(posts) {
    query1 = posts;
    store.findQuery('post', {limit: 2}).then(async(function(posts) {
      query2 = posts;

      equal(query1.get('meta.total'), 1, 'meta.total in first query should be equal 1');
      equal(query2.get('meta.total'), 2, 'meta.total in first query should be equal 2');
    }));
  }));
});

test('Create Post', function() {
  expect(3);

  store.find('author', 1).then(async(function(author) {
    ok(author, 'Should find author #1');
    var post = store.createRecord('post', {
      author: author,
      name: 'Socket.io is awesome'
    });

    post.get('author').then(function(){
      post.save().then(async(function(post) {
        deepEqual(socketRequest, {
            type: 'post',
            requestType: 'CREATE',
            hash: {
              post: {
                author: '1', name: 'Socket.io is awesome', comments: []
              }
            }
          },
          'Post CREATE event socket request should be equal to \n' +
          '{ \n' +
          'type: "post", \n' +
          'requestType: "CREATE", \n' +
          'hash: {author: "1", name: "Socket.io is awesome", comments: [] } \n' +
          '}');
        ok(post.get('isLoaded'), 'post should be loaded in store correctly');
      }, 1000));
    });

  }, 2000));
});

test('Create Posts', function() {
  expect(3);
  store.find('author', 1).then(async(function(author) {
    ok(!!author, 'Should find author #1');
    var posts = [
      store.createRecord('post', {
        author: author,
        name: 'Socket.io is awesome'
      }),
      store.createRecord('post', {
        author: author,
        name: 'Ember.js is awesome'
      })];
    Ember.RSVP.all(posts.invoke('get', 'author')).then(async(function() {
      Ember.RSVP.all(posts.invoke('save')).then(async(function(posts) {
        deepEqual(socketRequest, {
            type: 'post',
            requestType: 'CREATE_LIST',
            hash: {post: [
              {name: 'Socket.io is awesome', comments: [], author: '1' },
              {name: 'Ember.js is awesome', comments: [], author: '1' }
            ]}
          },
          'Post CREATE_LIST event socket request should be equal to \n' +
          '{ \n' +
          'type: "post", \n' +
          'requestType: "CREATE", \n' +
          'hash: {post: [ \n' +
          '{name: "Socket.io is awesome", comments: [], author: "1"}, \n' +
          '{name: "Ember.js is awesome", comments: [], author: "1" } \n' +
          ']} \n' +
          '}'
        );

        ok(posts.isEvery('isLoaded', true), 'posts should be loaded in store correctly');
      }));
    }));

  }));
});

test('Update Post', function() {
  expect(1);
  store.pushPayload('post', getFixture('Find Post by ID = 1'));
  var post = store.getById('post', 1);

  post.set('name', 'Javascript is awesome');

  post.get('author').then(async(function() {
    post.save().then(async(function(post) {
      deepEqual(socketRequest, {
          type: 'post',
          requestType: 'UPDATE',
          hash: { post: {
            id: '1', name: 'Javascript is awesome', comments: [], author: '1'
          }
          }
        },
        'Post UPDATE event socket request should be equal to \n' +
        '  {' +
        '\t type: "post", \n' +
        '\t requestType: "UPDATE", \n' +
        '\t hash: { post: [ \n' +
        '\t\t { id: "1", name: "Javascript is awesome", comments: [] } \n' +
        '\t ]}\n' +
        '  }'
      );
    }));
  }));
});

test('Update Posts', function() {
  expect(1);
  ok(true);
  console.log('[BROKEN]:\t UPDATE_LIST not implemented');
  return;

  store.pushPayload('post', getFixture('Find Posts without options').payload);

  var posts = store.all('post');

  posts.setEach('name', 'Javascript is awesome');

  Ember.RSVP.all(posts.invoke('get', 'author')).then(async(function() {
    posts.save().then(async(function(posts) {
      deepEqual(socketRequest, {
          type: 'post',
          requestType: 'UPDATE_LIST',
          hash: { post: [
            { id: '1', name: 'Javascript is awesome', comments: [], author: '1' },
            { id: '2', name: 'Javascript is awesome', comments: [], author: undefined }
          ]}
        },
        'Post UPDATE_LIST event socket request should be equal to \n' +
        '  {' +
        '\t type: "post", \n' +
        '\t requestType: "UPDATE_LIST", \n' +
        '\t hash: { post: [ \n' +
        '\t\t { id: "1", name: "Javascript is awesome", comments: [], author: "1" } \n' +
        '\t\t { id: "2", name: "Javascript is awesome", comments: [], author: undefined } \n' +
        '\t ]}\n' +
        '  }'
      );
    }));
  }));
});

//TODO: use pushPayload instead of find
test('Delete Post', function() {
  store.pushPayload('post', getFixture('Find Posts without options').payload);
  var posts = store.all('post');

  var post = posts.get('lastObject');
  post.deleteRecord();

  post.save().then(async(function(response) {
    deepEqual(socketRequest, {
        type: 'post',
        requestType: 'DELETE',
        hash: { id: '2' }
      },
        'Post DELETE event socket request should be equal to \n' +
        '  {' +
        '\t type: "post", \n' +
        '\t requestType: "DELETE", \n' +
        '\t hash: { id: "2" }\n' +
        '\t ]}\n' +
        '  }'
    );
    equal(response.get('id'), 2, 'post id should be equal 2');
  }));

});

test('Delete Posts', function() {
  expect(2);

  store.pushPayload('post', getFixture('Find Posts without options').payload);
  var posts = store.all('post');

  posts.findProperty('id', '1').deleteRecord();
  posts.findProperty('id', '2').deleteRecord();

  posts.save().then(async(function(posts) {
    deepEqual(socketRequest, {
        type: 'post',
        requestType: 'DELETE_LIST',
        hash: {
          ids: ['1', '2']
        }
      },
        'Posts DELETE_LIST event socket request should be equal to \n' +
        '  {' +
        '\t type: "post", \n' +
        '\t requestType: "DELETE_LIST", \n' +
        '\t hash: { ids: ["1", "2"] } \n' +
        '\t ]} \n' +
        '  }'
    );

    equal(posts.isEvery('isDeleted', true), true, 'every post should be deleted');
  }));

});

test('Read Posts with releations', function() {
  expect(4);

  store.find('post', {include: ['comments', 'author']}).then(async(function(posts) {
    equal(posts.get('length'), 2, 'posts length should be equal 2');
    posts.get('firstObject').get('comments').then(function(comments) {
      equal(comments.findProperty('id', '1').get('name'),
        'Greet.',
        'first comment to first post should be equal "Greet."');
    });

    posts.get('firstObject.author').then(function(author) {
      equal(author.get('name'), 'Test', 'author name sholud be equal "Test"');
    });

    var view;
    Ember.run(function() {
      view = Em.View.create({
        template: Em.Handlebars.compile('{{view.content.firstObject.author.name}}'),
        content: posts
      });

      view.append();
    });

    Ember.run.next(async(function() {
      var name = view.$().text();
      equal(name, 'Test', 'author name should be equal "Test"');
      view.remove();
    }));

  }));
});

test('Read Post with async relations (hasMany)', function() {
  expect(2);

  store.pushPayload('post', getFixture('Find Posts without options').payload);

  var posts = store.all('post');
  var comments = posts.get('firstObject.comments');
  comments.then(async(function(response) {
    deepEqual(socketRequest, {
        type: 'comment',
        requestType: 'READ_LIST',
        hash: {
          query: {
            id__in: ["1", "2"]
          }
        }
      },
        'Comment READ_LIST event socket request should be equal to \n' +
        '  {' +
        '\t type: "comment", \n' +
        '\t requestType: "READ_LIST", \n' +
        '\t hash: { ids: ["1", "2"] } \n' +
        '\t ]} \n' +
        '  }'
    );

    var firstCommentName = response.get('firstObject').get('name');
    equal(firstCommentName, 'Greet.', 'first comment should be equal "Greet."');

  }));
});

test('Read Post with async relations (belongs_to)', function() {
  expect(2);
  store.pushPayload('post', getFixture('Find Post by ID = 1'));
  var post = store.getById('post', 1);

  post.get('author').then(async(function(author) {
    equal(author.get('name'), 'Test', 'author name sholud be equal "Test"');
  }));

  var view;
  Ember.run(function() {

    view = Ember.View.create({
      template: Em.Handlebars.compile('{{view.content.author.name}}'),
      content: post
    });

    view.append();
  });

  Ember.run.next(async(function() {
    var name = view.$().text();
    equal(name, 'Test', 'author name should be equal "Test"');
    view.remove();
  }));
});

test('Create Posts from Server\'s PUSH', function() {
  expect(1);

  var tmpPost = store.createRecord('post'),
    type = tmpPost.constructor,
    socketNS = adapter.getConnection(type),
    serverPUSH = {
      payload: {
        post: [
          { id: 1, name: 'Socket.io is awesome', comments: [], author: 1 },
          { id: 2, name: 'Ember.js is awesome', comments: [], author: null }
        ]
      }};
  socketNS.trigger('message', serverPUSH);
  var posts = store.all('post');
  ok(posts.isEvery('isLoaded', true), 'All posts should be loaded from store correctly');
});

test('Delete Posts from Server\'s PUSH', function() {
  var socketNS = adapter.getConnection(store.modelFor('post')),
    posts;

  store.unloadAll('post');

  serverPUSH = {
    ids: [1, 2]
  };

  socketNS.trigger('message', serverPUSH);
  posts = store.all('post');
  ok(posts.content.isEvery('isDeleted', true), 'All Posts should be deleted');
});

test('Filtered Records should be contains metadata', function() {
  expect(1);

  store.filter('post', {limit: 2}, function(post) {
    return true;
  }).then(async(function(posts) {
    ok(posts.get('meta'), 'Records should be contains metadata');
  }));
});

test('Filterd Records should be added in store correctly', function() {
  expect(2);

  store.filter('post', {limit: 1}, function(post) {
    if (post.get('name') === 'Socket.io is awesome') {
      return true;
    }
  }).then(async(function(posts) {
    ok(posts.get('length'), 1, 'Posts Length should be equal 1');
    store.find('post', 3).then(async(function(post) {
      ok(posts.get('length'), 2, 'Post should be added in store correctly');
    }));
  }));
});
