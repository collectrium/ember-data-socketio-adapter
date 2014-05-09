var env, store, adapter, Post, Comment, io = {}, socketRequest, value,
  forEach = Ember.EnumerableUtils.forEach;

io.connect = function() {
  return {
    on: function() {
      return true;
    }
  }
};

module('unit - Socket Adapter: ', {
  setup: function() {
    Post = DS.Model.extend({
      name: DS.attr('string'),
      comments: DS.hasMany('comment'),
      author: DS.belongsTo('author', true)
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

    socketRequest = null;
    adapter.send = function (type, requestType, hash) {
      socketRequest = {};
  
      if (type.typeKey) {
        socketRequest.type = type.typeKey;
      } 
      if (requestType) {
        socketRequest.requestType = requestType;
      }
      if (hash) {
        socketRequest.hash = hash;
      }
      var fix = null;
      fixtures.forEach(function (fixture) {
        if (JSON.stringify(fixture.request) === JSON.stringify(socketRequest)) {
          fix = JSON.stringify(fixture.response);
        }
      });

      if (fix) {
        return Ember.RSVP.resolve(JSON.parse(fix));
      } else {
        console.error('fixture not finded', socketRequest);
      }
    }
  }
});

function socketResponse(val) {
  value = val;
}


test('Find Post by ID without options', function() {
  expect(2);

  store.find('post', 1).then(async(function(post) {
    deepEqual(socketRequest, {type: 'post', requestType: 'READ', hash: {id: '1'}},
        'Post READ event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "READ", \n' +
        'hash: {id: "1"} \n' +
        '}');
    ok(post.get('isLoaded'), 'post should be loaded in store correctly');
  }));
});


test('Find All Posts without options', function() {
  expect(2);
  
  store.find('post').then(async(function(posts) {
    deepEqual(socketRequest, {type: 'post', requestType: 'READ_LIST'},
        'Posts READ_LIST event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "READ_LIST", \n' +
        '}');
    ok(posts.get('isLoaded'), 'posts should be loaded in store correctly');
  }));
});




test('Create Post', function() {
  expect(2);

  store.find('author', 1).then(async(function (author) {
    var post = store.createRecord('post', {
      author: author,
      name: 'Socket.io is awesome'
    });
    post.save().then(async(function(post) {
      deepEqual(socketRequest, {
        type: 'post',
        requestType: 'CREATE',
        hash: {post: [
          { author: '1', name: 'Socket.io is awesome', comments: []}
          ]}
        },
        'Post CREATE event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "CREATE", \n' +
        'hash: {author: "1", name: "Socket.io is awesome", comments: [] } \n' +
        '}');
      ok(post.get('isLoaded'), 'post should be loaded in store correctly');
    }));
  }));
});


test('Create Posts', function() {
  expect(2);
  store.find('author', 1).then(async(function (author) {
    var posts = [
    store.createRecord('post', {
      author: author,
      name: 'Socket.io is awesome'
    }),
    store.createRecord('post', {
      author: author,
      name: 'Ember.js is awesome'
    })];
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
  
});

test('Update Post', function () {
  expect(2);

  var post = store.find('post', 1);
  Ember.RSVP.resolve(post).then(async(function (post) {
    ok(post.get('isLoaded'), 'post should be loaded correctly');

    post.set('name', 'Javascript is awesome');
    post.save().then(async(function (post) {
      deepEqual(socketRequest, {
          type: 'post',
          requestType: 'UPDATE',
          hash: { post: [
            { id: '1', name: 'Javascript is awesome', comments: [], author: '1'}
          ]
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

test('Update Posts', function () {
  expect(2);

  store.find('post').then(async(function (posts) {
    ok(posts.get('isLoaded'), 'posts should be loaded in store correctly');

    posts.setEach('name', 'Javascript is awesome');

    posts.save().then(async(function (posts) {
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

test('Delete Post', function () {

  store.find('post').then(async(function (posts){
    equal(posts.get('length'), 2, 'posts length should be equal 2');
    var post = posts.get('lastObject');
    post.deleteRecord();

    post.save().then(async(function (response) {
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
  }));
});

test('Delete Posts', function () {
  expect(3);
  socketResponse({
    meta: {}, payload: {
      post: [
        { id: 1, name: 'Socket.io is awesome' },
        { id: 2, name: 'Ember.js is awesome' }
      ]
    }
  });

  store.find('post').then(async(function (posts) {
    equal(posts.get('length'), 2, 'posts length equal should be equal 2');
    posts.findProperty('id', '1').deleteRecord();
    posts.findProperty('id', '2').deleteRecord();
    socketResponse({
      post: {
        id: [1, 2]
      }
    });

    posts.save().then(async(function (posts) {
      //TODO: socketRequest type equal UPDATE, but should be equal DELETE_LIST if 
      //TODO: store has a records after delete records
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
  }));
});

test('Read Posts with releations', function () {
  expect(4);

  store.find('post', {include: ['comments', 'author']}).then(async(function (posts) {
    equal(posts.get('length'), 2, 'posts length should be equal 2');
    equal(posts.get('firstObject').get('comments').findProperty('id', '1').get('name'), 
      'Greet.',
      'first comment to first post should be equal "Greet."');
    posts.get('firstObject.author').then(function (author) {
      equal(author.get('name'), 'Test', 'author name sholud be equal "Test"');
    });
    
    var view;
    Ember.run(function () {

      view = Em.View.create({
        template: Em.Handlebars.compile('{{view.content.firstObject.author.name}}'),
        content: posts
      });

      view.append();
    });

    setTimeout(async(function () {
      var name = view.$().text();
      equal(name, 'Test', 'author name should be equal "Test"');
      view.remove();
    }));

  }));
});

test('Read Post relations (hasMany) after loading', function () {
  expect(2);
  store.find('post').then(async(function (posts) {
    var comments = posts.get('firstObject.comments');
    comments.then(async(function (response) {
      deepEqual(socketRequest, {
        type: 'comment',
        requestType: 'READ_LIST',
        hash: {
          ids: ["1", "2"]
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
  }));
});

test('Read Post relations (belongsTo) after loading', function () {
  expect(2);
  store.find('post', 1).then(async(function (post) {
    post.get('author').then(async(function (author) {
      equal(author.get('name'), 'Test', 'author name sholud be equal "Test"');
    })); 

    var view;
    Ember.run(function () {
      
      view = Ember.View.create({
        template: Em.Handlebars.compile('{{view.content.author.name}}'),
        content: post
      });

      view.append();
    });

    setTimeout(async(function () {
      var name = view.$().text();
      equal(name, 'Test', 'author name should be equal "Test"');
      view.remove();
    }));
  }));
});



