// ds_configuration.js -- configuration information
// Either fill in the data below or set the environment variables
//
exports.config = {
    dsClientId: process.env.DS_CLIENT_ID || '5a1ce3a9-298a-46a9-8752-b7a0e6d1e200' // The app's DocuSign integration key
  , dsClientSecret: process.env.DS_CLIENT_SECRET || 'ea26fde3-4b6e-4798-819e-5f7812abcae0'
  , appUrl: process.env.DS_APP_URL || 'http://localhost:3000' // The url of the application.
  , production: false
  , debug: true // Send debugging statements to console
  , sessionSecret: process.env.SESSION_SECRET ||'12345' // Secret for encrypting session cookie content,
  , tokenSecret :  process.env.TOKEN_SECRET || 'LJHDJAS67567%7677SDKLKJSL'// Secret for encrypting refresh token,
  , allowSilentAuthentication: true // a user can be silently authenticated if they have an
    // active login session on another tab of the same browser

  , targetAccountId: null // Set if you want a specific DocuSign AccountId, If null, the user's default account will be used.

}

exports.config.dsOauthServer = exports.config.production ?
    'https://account.docusign.com' : 'https://account-d.docusign.com';

exports.config.refreshTokenFile =  require('path').resolve(__dirname,'./refreshTokenFile');

