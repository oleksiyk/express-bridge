# Express-Bridge
Creates Express routes using meta tags in code documentation.

Someday it will also generate AngularJS service/resources to easily connect your Node.JS API with AngularJS browser client.

## Status
Under development, not even in beta yet.

## Controller
_./controllers/auth.js_

```javascript
/**
 * authentication controller
 *
 * @module auth
 */
var app;

module.exports = function (_app) {
    app = _app;
    return exports;
}


/**
 * Authenticate user
 *
 * @param {String} username Username (email)
 * @param {String} password User password
 *
 * @apiReturns {Object} User
 * @apiRoute POST /auth/authenticate
 */

exports.authenticate = function (username, password) {
    var users = app.collections.users;
  	if (!username || !password) {
        return false;
    }
    return users.findOne({email: username})
        .then(function (user) {
            if (!user) {
                return false;
            }
            return users.validatePassword(user._id, password).then(function (valid) {
                if (!valid) {
                    return false;
                }
                return user;
            })
        })
}
```

## Express
_./app.js:_ 

```javascript
// … 
var express = require('express');
var expressApp = express();

// … 
// app = new MyApplication();
// …


// express-bridge
var apiBridge = require('express-bridge');
    
// add request processing function before API handler
apiBridge.add('auth.authenticate', function (req, res, next) {
    req.scope = '*';
    next();
})
// add file(s) and any additional arguments
apiBridge.include(__dirname + '/controllers/auth', app);

// attach express-bridge routes
expressApp.use(apiBridge.app())

// controllers
// can be used as: app.api.auth.authenticate(username, password)
app.api = apiBridge.api();
```


## HTTP
-> 
POST http://localhost/auth/authenticate 

body: username=joe&password=secret

-> 
application/json

```json
{
  username: 'joe',
  email: 'joe@example.com'
}
```
