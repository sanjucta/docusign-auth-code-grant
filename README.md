# docusign-auth-code-grant
* To run the example, modify the ds_configuration.js file to put in your docusign integration key and client secret.<br />
* Run the app : node index.js<br />
* When you hit the application url (http://localhost:3000) for the first time you will be asked to login to Docusign and provide your consent.<br />
* On subsequent hits to the url, you will not be asked to log in as the application will use the saved refresh token to obtain an access token.<br />
* If you delete the refreshTokenFile and hit the url again, you will be asked to login again (once the access token expires). You can test 
this by hitting the application url in an incongnito window. <br />

