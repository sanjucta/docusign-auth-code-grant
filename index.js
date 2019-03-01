#!/usr/bin/env node

const express = require('express')
    , session = require('express-session')  // https://github.com/expressjs/session
    , bodyParser = require('body-parser')
    , cookieParser = require('cookie-parser')
    , MemoryStore = require('memorystore')(session) // https://github.com/roccomuso/memorystore
    , path = require('path')
    , passport = require('passport')
    , DocusignStrategy = require('passport-docusign')
    , dsConfig = require('./ds_configuration.js').config
    , moment = require('moment')
    , tokenReplaceMinGet = 60; 

const superagent = require('superagent'),    
    Encrypt = require('./Encrypt').Encrypt, 
    docusign = require('docusign-esign'),
    fs = require('fs');
    
const PORT = process.env.PORT || 3000
    , HOST = process.env.HOST || 'localhost'
    , max_session_min = 180 ;

let hostUrl = 'http://' + HOST + ':' + PORT
if (dsConfig.appUrl != '' && dsConfig.appUrl != '{APP_URL}') {hostUrl = dsConfig.appUrl}

let app = express()
    .use(cookieParser())
    .use(session({
    secret: dsConfig.sessionSecret,
    name: 'ds-authexample-session',
    cookie: {maxAge: max_session_min * 60000},
    saveUninitialized: true,
    resave: true,
    store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
  })}))
  .use(passport.initialize())
  .use(passport.session())
  .use(bodyParser.urlencoded({ extended: true }))
  
  .get('/ds/login', (req, res, next) => {
    passport.authenticate('docusign')(req, res, next);
    })
  .get('/ds/callback', [dsLoginCB1, dsLoginCB2]); // OAuth callbacks. See below
  
function dsLoginCB1 (req, res, next) {
    passport.authenticate('docusign', { failureRedirect: '/ds/login' })(req, res, next);
}
function dsLoginCB2 (req, res, next) {

    console.log(`Received access_token: |${req.user.accessToken}|`);
    console.log(`Expires at ${req.user.tokenExpirationTimestamp.format("dddd, MMMM Do YYYY, h:mm:ss a")}`);
    console.log('Auth Successful');
    console.log(`Received access_token: |${req.user.accessToken}|`);
    console.log(`Expires at ${req.user.tokenExpirationTimestamp.format("dddd, MMMM Do YYYY, h:mm:ss a")}`);

    // Most Docusign api calls require an account id. This is where you can fetch the default account id for the user 
    // and store in the session.

    res.redirect('/');
}

/* Start the web server */
if (dsConfig.dsClientId && dsConfig.dsClientId !== '{CLIENT_ID}' &&
    dsConfig.dsClientSecret && dsConfig.dsClientSecret !== '{CLIENT_SECRET}') {
    app.listen(PORT)
    console.log(`Listening on ${PORT}`);
    console.log(`Ready! Open ${hostUrl}`);
} else {
  console.log(`PROBLEM: You need to set the clientId (Integrator Key), and perhaps other settings as well. 
You can set them in the source file ds_configuration.js or set environment variables.\n`);
  process.exit(); // We're not using exit code of 1 to avoid extraneous npm messages.
}

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete DocuSign profile is serialized
//   and deserialized.
passport.serializeUser  (function(user, done) {

    console.log("In serialize user");
    done(null, user)
});
passport.deserializeUser(function(obj,  done) {
    console.log("In de-serialize user");
    done(null, obj);
   
});

// Configure passport for DocusignStrategy
let docusignStrategy = new DocusignStrategy({
    production: dsConfig.production,
    clientID: dsConfig.dsClientId,
    clientSecret: dsConfig.dsClientSecret,
    callbackURL: hostUrl + '/ds/callback',
    state: true // automatic CSRF protection.
    // See https://github.com/jaredhanson/passport-oauth2/blob/master/lib/state/session.js
  },
  function _processDsResult(accessToken, refreshToken, params, profile, done) {
    // The params arg will be passed additional parameters of the grant.
    // See https://github.com/jaredhanson/passport-oauth2/pull/84
    //
    // Here we're just assigning the tokens to the account object
    // We store the data in DSAuthCodeGrant.getDefaultAccountInfo
    let user = profile;
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    user.expiresIn = params.expires_in;
    user.tokenExpirationTimestamp = moment().add(user.expiresIn, 's'); // The dateTime when the access token will expire
    //Save the encrypted refresh token to be used to get a new access token when the current one expires
    new Encrypt(dsConfig.refreshTokenFile).encrypt(refreshToken);
    return done(null, user);
  }
);

/**
 * The DocuSign OAuth default is to allow silent authentication.
 * An additional OAuth query parameter is used to not allow silent authentication
 */
if (!dsConfig.allowSilentAuthentication) {
  // See https://stackoverflow.com/a/32877712/64904 
  docusignStrategy.authorizationParams = function(options) {
    return {prompt: 'login'};
  }
}
passport.use(docusignStrategy);

function hasToken(req,bufferMin = tokenReplaceMinGet)
{
    let noToken = !req.user || !req.user.accessToken || !req.user.tokenExpirationTimestamp
    , now = moment()
    , needToken = noToken || moment(req.user.tokenExpirationTimestamp).subtract(
        bufferMin, 'm').isBefore(now);
 
    if (noToken) {console.log('hasToken: Starting up--need a token')}
    if (needToken && !noToken) {console.log('checkToken: Replacing old token')}
    if (!needToken) {console.log('checkToken: Using current token')}
  
    return (!needToken)
}

function internalLogout (req, res,next) {
    req.user.tokenExpirationTimestamp = null;
  }

function getAccessTokenUsingRefreshToken(req, res,callback) {  
  const clientId = dsConfig.dsClientId;
  const clientSecret = dsConfig.dsClientSecret;

  //read and decrypt the refresh token 
  const refreshToken = new Encrypt(dsConfig.refreshTokenFile).decrypt();
  
  const clientString = clientId + ":" + clientSecret,
  postData = {
      "grant_type": "refresh_token",
      "refresh_token": refreshToken,
    },
  headers = {
      "Authorization": "Basic " + (new Buffer(clientString).toString('base64')),
    },
  authReq = superagent.post( dsConfig.dsOauthServer + "/oauth/token")
      .send(postData)
      .set(headers)
      .type("application/x-www-form-urlencoded");

  const _this = this;      

  authReq.end(function (err, authRes) {
      
      if (err) {
          console.log("ERROR getting access token using refresh token:");
          console.log(err);
        return callback(err, authRes);
      } else {
          console.log("Received access token after refresh");
          //console.log(authRes.body.access_token);
          const accessToken = authRes.body.access_token;
          const refreshToken = authRes.body.refresh_token;
          const expiresIn = authRes.body.expires_in;

          //Obtain the user profile
          docusignStrategy.userProfile(accessToken, function(err,profile)
          {
              if (err) {
                  console.log("ERROR getting user profile:");
                  console.log(err);
                  return callback(err, authRes);
              }else{
                  let user = profile;
                  user.accessToken = accessToken;
                  user.refreshToken = refreshToken;
                  user.expiresIn = expiresIn;
                  user.tokenExpirationTimestamp = moment().add(user.expiresIn, 's'); // The dateTime when the access token will expire
                  req.login(user,(err)=>{
                          // Most Docusign api calls require an account id. This is where you can fetch the default account id for the user 
                          // and store in the session.
                          callback();
                      }
              
                  )}
          })
    
      }
    });
  
};


app.get("/",function(req, res, next){
    
    if(hasToken(req))
    {
        let msg = "<h1>Have a valid access token.</h1>";
        if (req.query.msg)
        {
            msg += "<br/>"
            msg += req.query.msg;
        }
        res.send(msg);    
    }
    else if(fs.existsSync(dsConfig.refreshTokenFile))
    { 
        console.log("New Refresh Token File Found, getting access token from refresh token");
        getAccessTokenUsingRefreshToken(req, res,(err)=>{
            if(err)
            {
                console.log("Error getting access token from refresh token");
                res.redirect(mustAuthenticate);
            }else
            {
                console.log("After getting access token from refresh token");
                res.redirect("/?msg=Obtained Access Token From Refresh Token");
            }
            
        });
    }else
    {
        console.log("No valid access token found. Saved refresh token not available either ");
        res.send("<h1>You are not authenticated with Docusign.</h1>Click <a href='/ds/login'>here</a> to autheticate");
    }
    
});


app.get("/ds/logout",function(req, res, next)
    {
        internalLogout(req, res, next);
        res.redirect("/");
    }
);
