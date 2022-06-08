## PROJECT SET UP
1. Add .env file with CLIENT_ID and LICENSE ID
2. HOST Frontend over HTTP
3. `npm install` `npm start`

## How to set up Custom Identity Provider [Tutorial]

The main idea behind the Custom Identity Provider (CIP) is sharing LiveChat chat history between multiple devices and sessions. This way, our user (provided that we have some identity management system in place) would be able to always access his chat history from any device/browser. The method requires a backend server and in this tutorial we will try to build a simple system utilizing this method. 

There are no limitations as to what technology is used for the backend, but in this demo, we will use a simple **node-js / express** server. For database storage we would also use a simple json database using **node-json-db** package.

### Prequisites

First of all let us understand how the Custom Identity Provider actually works. 

In a regular case, with no CIP system enabled, LiveChat when initializing on the page will:

- Check if lc cookies are set
- Send a request to customer/token endpoint
- The response will set a new cookies in the headers. If the cookies were sent in the request, the token will be generated for the already existing client, if not, new customer will be generated.

Now, when using CID, that process does not change, we will still be playing around with cookies, but this time with both hands on the steering wheel. 

As we know, livechat script will create a __lc object on our website, and before sending a request to customer/token it will check if that __lc object has a "custom_identity_provider" property, which we will have to supply. That property will consist of four functions:

``` javascript
window.__lc.custom_identity_provider = function () {
    return {
        getToken: ...,
        getFreshToken: ...,
        hasToken: ...,
        invalidate: ...
    }
}
```
These four functions will be supplied by our backend, and in this tutorial we will show you how that's done.

### LiveChat App
To properly fetch customer tokens, we need the "CLIENT_ID" parameter that can be obtained when creating a new LiveChat App via the developers console. 
More info on that here: https://developers.livechat.com/docs/getting-started/livechat-apps/

### Four Riders of Identity

The values for these properties will be supplied by our backend server, and these should be as follows:

- getToken `String` - token fetched from our database
- getFreshToken `String` - fresh token fetched from `customer/token` endpoint for a specific entityId
- hasToken `Boolean` - a confirmation that, a token exists for that specific customer
- invalidate `null` - a call to remove the cached version of our token, which we will not need in our example, hence this method will contain a placeholer `Promise.resolve()`

### BACKEND PLAN

We will define three endpoints here:
1. #### getFreshToken/
- Check if the user already exists in our DB
- If the user is unknown, we will fetch a fresh Token from the `https://accounts.livechat.com/customer/token` endpoint, parse response (including cookies) received and save everything to our database. 
- If the user is known, we will fetch the `__lc_cid` and `__lc_cst` cookies from our database and attach them to a `customer/token` request. This way we will receive a new token for an existing `entityId`. Next we need to save the newly obtained data to our database.

2. #### getToken/
- Here we only need to check if the user exists in our DB, and if he does, we will pass the data we have on him, otherwise we will simply forward to the getFreshToken/ endpoint

3. #### hasToken/ 
- This endpoint will return true if the user is in our DB and false otherwise. 

### THE BACKEND CODE

There are countless implementation posibilities and everything will depend on how your project is structured. In this demonstration we will simply pass the "username" as the request parameter, however for your implementation (and obvious security reason) you might want to use unique IDs and Access Tokens, so that your API is protected. 

```javascript
const express = require("express");
const axios = require("axios"); //could be any other package capable of http calls
const cors = require("cors"); //We are going to communicate via frontend with our API, therefore we need to handle CORS as well

require("dotenv").config(); 

//database configuration
const { JsonDB } = require("node-json-db");
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");

var db = new JsonDB(new Config("myDataBase", true));

const app = express();
app.use(cors());

//liveChat configuration
var licenseId = parseInt(process.env.LICENSE_ID);
var clientId = process.env.CLIENT_ID;

app.get("/getToken/:username", async (req, res) => {
  var getUserData = () => {
    try {
      //STEP 1. FIND IF THE USER IS ALREADY REGISTERED
      return db.getData("/" + req.params.username);
    } catch (err) {
      console.log(err.message);
      return null;
    }
  };

  var userObject = getUserData();
  if (userObject) res.send(userObject);
  else res.redirect("/getFreshToken/" + req.params.username);
});

app.get("/getFreshToken/:username", async (req, res) => {
  var getUserData = () => {
    try {
      //STEP 1. FIND IF THE USER IS ALREADY REGISTERED
      return db.getData("/" + req.params.username);
    } catch (err) {
      console.log(err.message);
      return null;
    }
  };

  var userObject = getUserData();

  const config = {
    method: "POST",
    url: "https://accounts.livechat.com/customer/token",
    headers: {
      "Content-Type": "application/json",
      origin: "https://www.placki.com", //an URL whitelisted in our app settings
      //STEP 2. ATTACH THE COOKIES TO THE REQUEST
      cookie: userObject ? [userObject.__lc_cid, userObject.__lc_cst] : null,
    },

    data: {
      grant_type: "cookie",
      response_type: "token",
      client_id: clientId,
      license_id: licenseId,
    },
  };

  //STEP 3. MAKE THE REQUEST CALL
  var response = await axios(config);

  var __lc_cid = response.headers["set-cookie"].find((el) =>
    el.includes("__lc_cid")
  );

  var __lc_cst = response.headers["set-cookie"].find((el) =>
    el.includes("__lc_cst")
  );

  //STEP 4. UPDATE DATABASE WITH NEWLY OBTAINED DATA
  var token = {};
  token.creationDate = Date.now();
  token.licenseId = licenseId;
  token.entityId = response.data.entity_id;
  token.expiresIn = response.data.expires_in;
  token.tokenType = response.data.token_type;
  token.accessToken = response.data.access_token;
  token.username = req.params.username;
  token.__lc_cid = __lc_cid;
  token.__lc_cst = __lc_cst;
  db.push("/" + req.params.username, token);

  //STEP 5. FORWARD THE RESPONSE

  res.json(token);
});

app.get("/hasToken/:username", async (req, res) => {
  //IF RECORD FOR THE USER EXISTS -> RETURN TRUE
  try {
    await db.getData("/" + req.params.username);
    res.send(true);
  } catch {
    res.send(false);
  }
});

app.get("/invalidate/:username", (req, res) => {
  //REMOVE THE USER RECORD
  try {
    db.delete("/" + req.params.username);
    res.send(true);
  } catch {
    res.send("errors when removing the user");
  }
});

//START THE SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Our app is running on port ${PORT}`);
});

```

### FRONTEND 

Now we can easily connect everything up on the front end side. This will be an incredibly straight forward system, without cache, however you might want to save the Tokens in the customers browser to minimize external API calls if that is something of a concern for you.

1. We need to include the classic LiveChat Script in our webpage
```html
<script>
    window.__lc = window.__lc || {};
    window.__lc.license = YOUR_LICENSE_ID
    ;(function(n,t,c){function i(n){return e._h?e._h.apply(null,n):e._q.push(n)}var e={_q:[],_h:null,_v:"2.0",on:function(){i(["on",c.call(arguments)])},once:function(){i(["once",c.call(arguments)])},off:function(){i(["off",c.call(arguments)])},get:function(){if(!e._h)throw new Error("[LiveChatWidget] You can't use getters before load.");return i(["get",c.call(arguments)])},call:function(){i(["call",c.call(arguments)])},init:function(){var n=t.createElement("script");n.async=!0,n.type="text/javascript",n.src="https://cdn.livechatinc.com/tracking.js",t.head.appendChild(n)}};!n.__lc.asyncInit&&e.init(),n.LiveChatWidget=n.LiveChatWidget||e}(window,document,[].slice))
</script>
```
2. In a separate script file (added below the liveChat script, as it needs to load up first on our page!!), we can include our custom_identity_provider method. Our username will be set as a query parameter `?user=USERNAME` or a random ID if the query param is missing.

```javascript
///1. GRAB THE USERNAME
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var user = urlParams.get('user') || Date.now().toString(36) + Math.random().toString(36).substring(2)

///2. ADD THE CUSTOM IDENTITY PROVIDER 
 window.__lc.custom_identity_provider =  () => {
    return {
        getToken: () => getToken(),
        getFreshToken:() => getFreshToken(),
        hasToken:() => hasToken(),
        invalidate:() => Promise.resolve(),
    }
 }
 

 var baseAPI = "YOUR_API_URL"
 
 ///3. CONNECT THE CIP METHODS TO OUR API
 
 const getToken =  async () => {
   var apiURL = baseAPI + "getToken/"
   var tokenObject =  await fetch(apiURL + user).then(res => {
     if(res.status<400)
     return res.json()
     else return null
   }
  )
   console.log("getToken", tokenObject)
   return tokenObject ? tokenObject : false
 }
 
 const getFreshToken =  async () => {
    var apiURL = baseAPI + "getFreshToken/"
   var tokenObject =  await fetch(apiURL + user).then(res => {
     if(res.status<400)
     return res.json()
     else return null
   })
   return tokenObject ? tokenObject : false
 }
 
 const hasToken = async () => {
    var apiURL = baseAPI + "hasToken/"
   var response =  await fetch(apiURL + user).then(res => res.json())
   response = JSON.stringify(response)
   return (response === "true")
 }
 
```


3. And that's it. You have got yourslef a working LiveChat Integration with a Custom Identity Provider. This way your customers will always have access to their chats history.

### GITHUB

The entire code for this tutorial is available on github:
